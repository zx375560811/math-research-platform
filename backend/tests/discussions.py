"""Real HTTP tests for shared discussion permissions, pagination and persistence."""
from contextlib import closing
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import secrets
import socket
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

backend = Path(__file__).resolve().parents[1]
with socket.socket() as probe:
    probe.bind(('127.0.0.1', 0))
    port = probe.getsockname()[1]
base = 'http://127.0.0.1:' + str(port)
clients = {name: urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())) for name in ['guest', 'alice', 'bob', 'admin']}


def request(name, path, method='GET', body=None, csrf=True):
    headers = {}
    if body is not None:
        body = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    if method != 'GET' and csrf:
        token = request(name, '/api/auth/csrf')[1]
        headers[token['header']] = token['token']
    try:
        response = clients[name].open(urllib.request.Request(base + path, data=body, method=method, headers=headers), timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read()
        return response.status, json.loads(raw) if 'json' in response.headers.get_content_type() else raw


with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    (root / 'data/files').mkdir(parents=True)
    database = root / 'data/math.db'
    with closing(sqlite3.connect(database)) as db:
        db.executescript((backend / 'src/main/resources/schema.sql').read_text(encoding='utf-8'))
        db.execute("INSERT INTO account_migrations(name) VALUES('invite_only_v1')")
        db.execute("INSERT INTO documents(id,title,file_path,file_size) VALUES(41,'A textbook (Z-Library)','data/files/fixture',20)")
        db.commit()
    with (root / 'server.log').open('w+', encoding='utf-8') as log:
        process = None

        def start():
            child = subprocess.Popen([os.environ.get('MATH_TEST_JAVA', 'java'), '-jar', str(backend / 'target/math-server.jar')], cwd=root,
                                     env={**os.environ, 'MATH_PORT': str(port), 'MATH_WEB_DIR': str(backend.parent / 'frontend')}, stdout=log, stderr=log)
            for _ in range(300):
                try:
                    if request('guest', '/api/health')[0] == 200:
                        return child
                except (OSError, urllib.error.URLError):
                    time.sleep(.1)
            child.terminate()
            child.wait(timeout=10)
            log.seek(0)
            raise AssertionError(log.read())

        try:
            process = start()
            assert request('guest', '/api/discussions')[0] == 401
            assert request('guest', '/api/discussions/1')[0] == 401
            assert request('guest', '/api/discussions', 'POST', {'title': 'x'})[0] == 401
            for name in ['alice', 'bob', 'admin']:
                code = secrets.token_urlsafe(32)
                with closing(sqlite3.connect(database)) as db:
                    db.execute('INSERT INTO invitations(code_hash) VALUES(?)', (hashlib.sha256(code.encode()).hexdigest(),))
                    db.commit()
                credentials = {'username': name, 'password': 'DiscussionPass123!', 'invitation': code}
                assert request(name, '/api/auth/register', 'POST', credentials)[0] == 201
                if name == 'admin':
                    with closing(sqlite3.connect(database)) as db:
                        db.execute("INSERT INTO administrators VALUES('admin')")
                        db.commit()
                assert request(name, '/api/auth/login', 'POST', credentials)[0] == 200
            topic = {'title': '一致收敛与积分', 'content': r'怎样理解 $f_n\to f$？' + '\n\n<script>alert(1)</script>', 'category': 'mathematics', 'document_id': 41}
            assert request('alice', '/api/discussions', 'POST', topic, csrf=False)[0] == 403
            for invalid in [{**topic, 'title': ' '}, {**topic, 'title': 'x' * 121}, {**topic, 'content': 'x' * 12001}, {**topic, 'category': 'unknown'}]:
                assert request('alice', '/api/discussions', 'POST', invalid)[0] == 400
            assert request('alice', '/api/discussions', 'POST', {**topic, 'document_id': 9999})[0] == 404
            status, created = request('alice', '/api/discussions', 'POST', topic)
            assert status == 200
            path = '/api/discussions/' + str(created['id'])
            original = request('bob', path)[1]
            assert original['author'] == 'alice' and not original['can_edit'] and not original['can_delete']
            assert original['document'] == {'id': 41, 'title': 'A textbook'}
            assert '<script>' in original['content']  # Stored as source; the browser must sanitize rendering.
            assert request('bob', path, 'PATCH', {**topic, 'version': 1})[0] == 403
            assert request('bob', path, 'DELETE', {})[0] == 403
            assert request('bob', path + '/moderation', 'PATCH', {'pinned': True, 'locked': True})[0] == 403
            assert request('alice', path, 'PATCH', {**topic, 'title': '更新后的话题', 'version': 1})[0] == 200
            assert request('alice', path, 'PATCH', {**topic, 'version': 1})[0] == 409
            assert request('bob', path + '/replies', 'POST', {'content': '我的思路'})[0] == 200
            reply = request('alice', path + '/replies')[1]['replies'][0]
            reply_path = '/api/discussions/replies/' + str(reply['id'])
            assert reply['author'] == 'bob' and not reply['can_edit']
            assert request('alice', reply_path, 'PATCH', {'content': '修改他人', 'version': 1})[0] == 403
            assert request('bob', reply_path, 'PATCH', {'content': r'证明 $x^2\ge0$', 'version': 1})[0] == 200
            assert request('bob', reply_path, 'PATCH', {'content': '过期', 'version': 1})[0] == 409
            assert request('alice', reply_path, 'DELETE', {})[0] == 403
            assert request('admin', path + '/moderation', 'PATCH', {'pinned': True, 'locked': True})[0] == 200
            assert request('alice', path + '/replies', 'POST', {'content': '锁定后回复'})[0] == 409
            assert request('admin', path)[1]['can_moderate']
            assert not request('admin', path)[1]['can_edit']
            assert request('admin', reply_path, 'DELETE', {})[0] == 200
            assert request('admin', path + '/moderation', 'PATCH', {'pinned': True, 'locked': False})[0] == 200
            for n in range(23):
                assert request('bob', path + '/replies', 'POST', {'content': '回复 ' + str(n)})[0] == 200
            replies = request('alice', path + '/replies?offset=20')[1]
            assert replies['total'] == 23 and replies['total_pages'] == 2 and len(replies['replies']) == 3
            assert request('bob', path + '/replies?offset=-1')[0] == 400
            for n in range(21):
                assert request('bob', '/api/discussions', 'POST', {**topic, 'title': 'AI 话题 ' + str(n), 'category': 'math-to-ai', 'document_id': None})[0] == 200
            listing = request('alice', '/api/discussions')[1]
            assert listing['total'] == 22 and listing['total_pages'] == 2 and listing['topics'][0]['id'] == created['id']
            assert 'content' not in listing['topics'][0] and listing['topics'][0]['reply_count'] == 23
            assert request('alice', '/api/discussions?scope=mine')[1]['total'] == 1
            assert request('bob', '/api/discussions?scope=mine')[1]['total'] == 21
            assert request('alice', '/api/discussions?scope=unanswered')[1]['total'] == 21
            assert request('alice', '/api/discussions?category=math-to-ai&offset=20')[1]['total'] == 21
            assert request('alice', '/api/discussions?q=AI')[1]['total'] == 21
            assert request('alice', '/api/discussions?q=%27%20OR%201%3D1')[1]['total'] == 0
            # A deleted library book detaches the reference, not the discussion.
            with closing(sqlite3.connect(database)) as db:
                db.execute('PRAGMA foreign_keys=ON')
                db.execute('DELETE FROM documents WHERE id=41')
                db.commit()
            assert request('alice', path)[1]['document'] is None
            process.terminate()
            process.wait(timeout=10)
            process = start()
            assert request('alice', '/api/auth/login', 'POST', {'username': 'alice', 'password': 'DiscussionPass123!'})[0] == 200
            assert request('alice', path)[1]['reply_count'] == 23
            assert request('alice', path, 'DELETE', {})[0] == 200
            assert request('alice', path)[0] == 404
            with closing(sqlite3.connect(database)) as db:
                assert db.execute('SELECT count(*) FROM discussion_replies').fetchone()[0] == 0
            assert request('alice', '/api/discussions', 'POST', {**topic, 'document_id': None})[0] == 200
        finally:
            if process is not None:
                process.terminate()
                process.wait(timeout=10)
print('Discussion authentication, ownership, moderation, formula source, pagination, references and restart persistence passed.')
