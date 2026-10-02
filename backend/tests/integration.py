"""Read-only HTTP and administrator import, against an isolated database."""
import importlib.util
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
pdf = b'%PDF-1.4\n%%EOF\n'
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
base = 'http://127.0.0.1:{}'.format(port)
def request(path, method='GET', data=None):
    try:
        response = urllib.request.urlopen(urllib.request.Request(base + path, data=data, method=method), timeout=5)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read()
        return response.status, json.loads(raw) if 'json' in response.headers.get_content_type() else raw
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    (root / 'data/files').mkdir(parents=True)
    (root / 'data/files/upload-legacy').write_bytes(pdf)
    with sqlite3.connect(root / 'data/math.db') as db:
        db.executescript((backend / 'tests/fixtures/c-schema.sql').read_text(encoding='utf-8'))
        db.execute("UPDATE subjects SET name='我的代数分类' WHERE id=1")
        db.execute("INSERT INTO documents(id,title,authors,file_path,file_size) VALUES(41,'Existing C library','Original author','data/files/upload-legacy',?)", (len(pdf),))
        db.execute('INSERT INTO document_subjects VALUES(41,1)')
    with (root / 'server.log').open('w+') as log:
        process = subprocess.Popen(['java', '-jar', str(backend / 'target/math-server.jar')], cwd=root, env={**os.environ, 'MATH_PORT': str(port), 'MATH_WEB_DIR': str(backend.parent / 'frontend')}, stdout=log, stderr=log)
        previous = Path.cwd()
        try:
            for _ in range(300):
                try:
                    if request('/api/health')[0] == 200: break
                except (OSError, urllib.error.URLError): time.sleep(.1)
            else: raise AssertionError('Server not ready')
            assert request('/api/subjects')[1]['subjects'][0]['name'] == '我的代数分类'
            for asset in ['/', '/app.js', '/style.css', '/icons.js', '/vendor/morphicons/dom.js', '/vendor/morphicons/spring-CFHloqPP.js', '/vendor/morphicons/normalize-CYnN3Npw.js']:
                with urllib.request.urlopen(base + asset) as response:
                    assert response.status == 200 and response.headers['Content-Security-Policy'] and response.read()
            for endpoint in ['/api/documents?title=attack&subject_id=1', '/api/admin/documents', '/api/documents/1']:
                for method in ['POST', 'PUT', 'PATCH', 'DELETE']: assert request(endpoint, method, pdf)[0] == 405
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
        finally:
            os.chdir(previous); process.terminate(); process.wait(timeout=10)
print('Read-only HTTP, administrator import, schema preservation and retrieval checks passed.')
