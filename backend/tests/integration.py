"""Read-only HTTP and administrator import, against an isolated database."""
import concurrent.futures
import importlib.util
import http.cookiejar
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
backend = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('admin', backend / 'admin/import_document.py')
admin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(admin)
invite_spec = importlib.util.spec_from_file_location('invitations', backend / 'admin/create_invitation.py')
invitations = importlib.util.module_from_spec(invite_spec); invite_spec.loader.exec_module(invitations)
pdf = b'%PDF-1.4\n%%EOF\n'
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
base = 'http://127.0.0.1:{}'.format(port)
cookies = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
def request(path, method='GET', data=None, headers=None):
    try:
        response = client.open(urllib.request.Request(base + path, data=data, method=method, headers=headers or {}), timeout=5)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read()
        return response.status, json.loads(raw) if 'json' in response.headers.get_content_type() else raw
def auth(path, body):
    token = request('/api/auth/csrf')[1]
    return request(path, 'POST', json.dumps(body).encode(), {'Content-Type': 'application/json', token['header']: token['token']})

with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    (root / 'data/files').mkdir(parents=True)
    (root / 'data/files/upload-legacy').write_bytes(pdf)
    with sqlite3.connect(root / 'data/math.db') as db:
        db.executescript((backend / 'tests/fixtures/c-schema.sql').read_text(encoding='utf-8'))
        db.execute("UPDATE subjects SET name='我的代数分类' WHERE id=1")
        db.execute("INSERT INTO documents(id,title,authors,file_path,file_size) VALUES(41,'Existing C library','Original author','data/files/upload-legacy',?)", (len(pdf),))
        db.execute('INSERT INTO document_subjects VALUES(41,1)')
        db.commit()
        db.executescript((backend / 'src/main/resources/schema.sql').read_text(encoding='utf-8'))
        db.execute("INSERT INTO users(username,password_hash) VALUES('old_reader','legacy-hash')")
    with (root / 'server.log').open('w+') as log:
        process = subprocess.Popen(['java', '-jar', str(backend / 'target/math-server.jar')], cwd=root, env={**os.environ, 'MATH_PORT': str(port), 'MATH_WEB_DIR': str(backend.parent / 'frontend')}, stdout=log, stderr=log)
        previous = Path.cwd()
        try:
            for _ in range(300):
                try:
                    if request('/api/health')[0] == 200: break
                except (OSError, urllib.error.URLError): time.sleep(.1)
            else: raise AssertionError('Server not ready')
            assert request('/api/subjects')[0] == 401
            for asset in ['/', '/app.js', '/style.css', '/icons.js', '/vendor/morphicons/dom.js', '/vendor/morphicons/spring-CFHloqPP.js', '/vendor/morphicons/normalize-CYnN3Npw.js']:
                with urllib.request.urlopen(base + asset) as response:
                    assert response.status == 200 and response.headers['Content-Security-Policy'] and response.read()
            for endpoint in ['/api/documents?title=attack&subject_id=1', '/api/admin/documents', '/api/documents/1']:
                for method in ['POST', 'PUT', 'PATCH', 'DELETE']: assert request(endpoint, method, pdf)[0] == 405
            assert request('/api/documents')[0] == 401
            assert request('/api/documents/41/file')[0] == 401
            assert request('/api/auth/me')[1] == {'authenticated': False}
            with sqlite3.connect(root / 'data/math.db') as db: assert db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0
            code = invitations.create_invitation(str(root / 'data/math.db'))
            credentials = {'username': 'Reader_1', 'password': 'ResearchPass123!', 'invitation': code}
            assert request('/api/auth/register', 'POST', json.dumps(credentials).encode(), {'Content-Type': 'application/json'})[0] == 403
            assert auth('/api/auth/register', {**credentials, 'password': 'short'})[0] == 400
            assert auth('/api/auth/register', {'username': 'Reader_1', 'password': 'ResearchPass123!'})[0] == 400
            assert auth('/api/auth/register', {**credentials, 'invitation': 'X' * 43})[0] == 400
            expired = invitations.create_invitation(str(root / 'data/math.db'))
            with sqlite3.connect(root / 'data/math.db') as db: db.execute('UPDATE invitations SET expires_at=0 WHERE code_hash=?', (invitations.hashlib.sha256(expired.encode()).hexdigest(),))
            assert auth('/api/auth/register', {**credentials, 'invitation': expired})[0] == 400
            assert auth('/api/auth/register', credentials)[0] == 201
            assert auth('/api/auth/register', {**credentials, 'username': 'another_reader'})[0] == 400
            unused = invitations.create_invitation(str(root / 'data/math.db'))
            assert auth('/api/auth/register', {**credentials, 'username': 'reader_1', 'invitation': unused})[0] == 409
            assert auth('/api/auth/register', {**credentials, 'username': 'reader_2', 'invitation': unused})[0] == 201
            concurrent_code = invitations.create_invitation(str(root / 'data/math.db'))
            def concurrent_register(name):
                opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
                token = json.load(opener.open(base + '/api/auth/csrf'))
                payload = json.dumps({**credentials, 'username': name, 'invitation': concurrent_code}).encode()
                try: return opener.open(urllib.request.Request(base + '/api/auth/register', data=payload, headers={'Content-Type': 'application/json', token['header']: token['token']})).status
                except urllib.error.HTTPError as error: return error.code
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: assert sorted(pool.map(concurrent_register, ['race_one', 'race_two'])) == [201,400]
            assert auth('/api/auth/login', {**credentials, 'password': 'WrongPassword123!'})[0] == 401
            before_session = next(c.value for c in cookies if c.name == 'JSESSIONID')
            assert auth('/api/auth/login', credentials)[1]['user']['role'] == 'USER'
            after_session = next(c for c in cookies if c.name == 'JSESSIONID')
            assert before_session != after_session.value
            assert 'HttpOnly' in after_session._rest and after_session._rest.get('SameSite', '').lower() == 'lax'
            assert request('/api/auth/me')[1]['user']['username'] == 'reader_1'
            assert request('/api/subjects')[1]['subjects'][0]['name'] == '我的代数分类'
            assert request('/api/documents')[1]['documents'][0]['id'] == 41
            assert request('/api/documents/41/file') == (200, pdf)
            assert [p.name for p in (root / 'data/files').iterdir()] == ['upload-legacy']
            os.chdir(root)
            source = root / 'source.pdf'; source.write_bytes(pdf)
            imported = admin.import_document(source, '定理 "A" <img src=x>', '作者甲', 1)
            assert request('/api/documents')[1]['documents'][0]['id'] == imported['id']
            assert request('/api/documents/{}'.format(imported['id']))[1]['title'] == '定理 "A" <img src=x>'
            assert request(imported['file_url']) == (200, pdf)
            assert request('/api/documents?subject_id=2')[1]['documents'] == []
            before = set((root / 'data/files').iterdir())
            for title, subject, content in [('bad', 999, pdf), ('bad', 1, b'wrong'), (' ', 1, pdf), ('big', 1, b'%PDF-' + b'x' * (20 * 1024 * 1024))]:
                source.write_bytes(content)
                try: admin.import_document(source, title, '', subject)
                except ValueError: pass
                else: raise AssertionError('Invalid import accepted')
                assert set((root / 'data/files').iterdir()) == before
            assert len(request('/api/documents')[1]['documents']) == 2
            assert request('/api/documents/41')[1]['authors'] == 'Original author'
            for path in ['/schema.h', '/data/math.db', '/admin/import_document.py', '/api/documents/999999/file']: assert request(path)[0] == 404
            # Tomcat rejects traversal before Spring routing; both rejection statuses protect the boundary.
            assert request('/../backend/src/main.c')[0] in (400, 404)
            assert request('/api/documents?offset=-1')[0] == 400
            assert request('/api/documents?subject_id=1%20OR%201=1')[0] == 400
            with sqlite3.connect(root / 'data/math.db') as db:
                username, hashed, role = db.execute('SELECT username,password_hash,role FROM users').fetchone()
                assert username == 'reader_1' and hashed.startswith('$2') and hashed != credentials['password'] and role == 'USER'
            assert request('/api/auth/logout', 'POST', b'{}', {'Content-Type': 'application/json'})[0] == 403
            assert request('/api/auth/me')[1]['authenticated']
            assert auth('/api/auth/logout', {})[0] == 200
            assert request('/api/auth/me')[1] == {'authenticated': False}
            assert request('/api/documents')[0] == 401 and request('/api/documents/41/file')[0] == 401
            assert auth('/api/auth/login', credentials)[0] == 200
            assert request('/api/documents/41/file') == (200, pdf)
            process.terminate(); process.wait(timeout=10)
            process = subprocess.Popen(['java', '-jar', str(backend / 'target/math-server.jar')], cwd=root, env={**os.environ, 'MATH_PORT': str(port), 'MATH_WEB_DIR': str(backend.parent / 'frontend')}, stdout=log, stderr=log)
            for _ in range(300):
                try:
                    if request('/api/health')[0] == 200: break
                except (OSError, urllib.error.URLError): time.sleep(.1)
            else: raise AssertionError('Restart failed')
            assert request('/api/documents')[0] == 401
            assert auth('/api/auth/login', credentials)[0] == 200
            with sqlite3.connect(root / 'data/math.db') as db:
                assert db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 3
                assert db.execute("SELECT COUNT(*) FROM users WHERE username='old_reader'").fetchone()[0] == 0
                assert db.execute('SELECT code_hash FROM invitations WHERE used_by=?', ('reader_1',)).fetchone()[0] == invitations.hashlib.sha256(code.encode()).hexdigest()
            assert request('/api/documents/41/file') == (200, pdf)

        finally:
            os.chdir(previous); process.terminate(); process.wait(timeout=10)
print('Read-only HTTP, administrator import, schema preservation and retrieval checks passed.')
