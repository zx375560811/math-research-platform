"""Competition material permissions, shared reading, and lossless old-plan migration."""
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
schema = (backend / 'src/main/resources/schema.sql').read_text(encoding='utf-8')
with socket.socket() as probe:
    probe.bind(('127.0.0.1', 0))
    port = probe.getsockname()[1]
base = 'http://127.0.0.1:' + str(port)
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def request(path, method='GET', body=None, csrf=True):
    headers = {}
    if body is not None:
        headers['Content-Type'] = 'application/json'
        body = json.dumps(body).encode()
    if method != 'GET' and csrf:
        token = request('/api/auth/csrf')[1]
        headers[token['header']] = token['token']
    try:
        response = client.open(urllib.request.Request(base + path, data=body, method=method, headers=headers), timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read()
        return response.status, json.loads(raw) if 'json' in response.headers.get_content_type() else raw


with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    (root / 'data/files').mkdir(parents=True)
    pdf = b'%PDF-1.4\ncompetition fixture\n%%EOF\n'
    (root / 'data/files/upload-old').write_bytes(pdf)
    database = root / 'data/math.db'
    with closing(sqlite3.connect(database)) as db:
        # Simulate a deployed database with the old source CHECK and existing personal data.
        db.executescript(schema.replace("'math-to-ai','competition'", "'math-to-ai'"))
        db.execute("INSERT INTO account_migrations(name) VALUES('invite_only_v1')")
        db.execute("INSERT INTO users(username,password_hash) VALUES('legacy_reader','unused')")
        db.execute("INSERT INTO documents(id,title,authors,file_path,file_size) VALUES(41,'Existing textbook','Author','data/files/upload-old',?)", (len(pdf),))
        db.execute("INSERT INTO document_progress(username,document_id,page,total_pages) VALUES('legacy_reader',41,3,12)")
        db.execute("INSERT INTO study_plan(username,document_id,source,completed,added_at) VALUES('legacy_reader',41,'series',1,'2026-10-01T00:00:00Z')")
        db.commit()

    with (root / 'server.log').open('w+', encoding='utf-8') as log:
        process = None

        def start():
            child = subprocess.Popen([os.environ.get('MATH_TEST_JAVA', 'java'), '-jar', str(backend / 'target/math-server.jar')], cwd=root,
                                     env={**os.environ, 'MATH_PORT': str(port), 'MATH_WEB_DIR': str(backend.parent / 'frontend')}, stdout=log, stderr=log)
            for _ in range(300):
                try:
                    if request('/api/health')[0] == 200:
                        return child
                except (OSError, urllib.error.URLError):
                    pass
                if child.poll() is not None:
                    log.seek(0)
                    raise AssertionError(log.read())
                time.sleep(.1)
            child.terminate(); child.wait(timeout=15)
            raise AssertionError('Server not ready')

        try:
            process = start()
            assert request('/api/competition')[0] == 401
            assert request('/competition.js')[0] == 200
            with closing(sqlite3.connect(database)) as db:
                assert db.execute('SELECT source,completed,added_at FROM study_plan').fetchone() == ('series', 1, '2026-10-01T00:00:00Z')
                assert db.execute('SELECT page FROM document_progress').fetchone()[0] == 3
                code = secrets.token_urlsafe(32)
                db.execute('INSERT INTO invitations(code_hash,expires_at) VALUES(?,?)', (hashlib.sha256(code.encode()).hexdigest(), int(time.time()) + 3600))
                db.commit()
            assert request('/api/auth/register', 'POST', {'username': 'contest_reader', 'password': 'ContestPassword123!', 'invitation': code})[0] == 201
            assert request('/api/auth/login', 'POST', {'username': 'contest_reader', 'password': 'ContestPassword123!'})[0] == 200
            courses = request('/api/competition')[1]['courses']
            assert [c['slug'] for c in courses] == ['analysis', 'algebra', 'geometry', 'training', 'past-papers']
            assert all(c['topics'] and c['practice'] and not c['books'] for c in courses)
            endpoint = '/api/admin/competition/analysis/books'
            assert request('/api/admin/competition')[0] == 403
            assert request(endpoint, 'POST', {'document_id': 41})[0] == 403
            with closing(sqlite3.connect(database)) as db:
                db.execute("INSERT INTO administrators(username) VALUES('contest_reader')")
                db.commit()
            # Renew authentication so the session contains the administrator role.
            assert request('/api/auth/logout', 'POST', {})[0] == 200
            assert request('/api/auth/login', 'POST', {'username': 'contest_reader', 'password': 'ContestPassword123!'})[0] == 200
            assert request('/api/admin/competition')[0] == 200
            assert request(endpoint, 'POST', {'document_id': 41}, csrf=False)[0] == 403
            assert request('/api/admin/competition/unknown/books', 'POST', {'document_id': 41})[0] == 404
            assert request(endpoint, 'POST', {'document_id': 99999})[0] == 404
            assert request(endpoint, 'POST', {'document_id': 41, 'sort_order': -1})[0] == 400
            assert request(endpoint, 'POST', {'document_id': 41})[1]['added'] == 1
            assert request(endpoint, 'POST', {'document_id': 41})[1]['added'] == 0
            assert request(endpoint + '/41', 'PATCH', {'sort_order': 30})[0] == 200
            book = request('/api/competition')[1]['courses'][0]['books'][0]
            assert book['id'] == 41 and book['sort_order'] == 30 and book['progress'] is None
            assert request('/api/study-plan/41', 'PUT', {'source': 'competition'})[0] == 200
            assert request('/api/study-plan')[1]['books'][0]['source'] == 'competition'
            assert request('/api/library/documents/41/progress', 'PUT', {'page': 2, 'total_pages': 12, 'position': .2, 'zoom': 1})[0] == 200
            assert request('/api/competition')[1]['courses'][0]['books'][0]['progress']['page'] == 2
            assert request(endpoint + '/41', 'DELETE', {})[0] == 200
            assert request('/api/competition')[1]['courses'][0]['books'] == []
            assert request('/api/documents/41/file')[1] == pdf
            assert request('/api/study-plan?scope=progress')[1]['books'][0]['progress']['page'] == 2
            # Removing a recommendation must leave the source, plan, progress, and file intact.
            process.terminate(); process.wait(timeout=15); process = None
            process = start()
            with closing(sqlite3.connect(database)) as db:
                assert db.execute('SELECT count(*) FROM study_plan').fetchone()[0] == 2
                assert db.execute('SELECT count(*) FROM competition_courses').fetchone()[0] == 5
                assert db.execute('PRAGMA foreign_key_check').fetchall() == []
        finally:
            if process is not None:
                process.terminate(); process.wait(timeout=15)

print('Competition: permissions, CSRF, shared books/progress, plan migration, restart and non-destructive unlink passed.')
