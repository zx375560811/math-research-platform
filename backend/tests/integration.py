"""Compile first, then run against an isolated temporary database and file directory."""
import concurrent.futures
import http.client
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

binary = (Path(__file__).resolve().parents[1] / 'build/math-server').resolve()
pdf = b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n'

with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
base = f'http://127.0.0.1:{port}'

def request(path, data=None, content_type='application/pdf', method=None):
    headers = {'Content-Type': content_type} if data is not None else {}
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    try:
        response = urllib.request.urlopen(req, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read()
        body = raw if response.headers.get_content_type() == 'application/pdf' else json.loads(raw)
        return response.status, body

def upload(title='代数 "例子" \\ 测试', authors='作者甲', subject='1', data=pdf, content_type='application/pdf'):
    query = urllib.parse.urlencode({'title': title, 'authors': authors, 'subject_id': subject})
    return request('/api/documents?' + query, data, content_type)

with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    (root / 'data').mkdir()
    # Simulate upgrading the previously deployed subjects-only database.
    with sqlite3.connect(root / 'data/math.db') as db:
        db.execute('CREATE TABLE subjects (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL)')
        db.execute("INSERT INTO subjects VALUES(1,'algebra','我的代数分类')")
    log_path = root / 'server.log'
    with log_path.open('w+') as log:
        process = subprocess.Popen([str(binary)], cwd=root, env={**os.environ, 'MATH_PORT': str(port),
                                   'MATH_WEB_DIR': str(binary.parents[2] / 'frontend')},
                                   stdout=log, stderr=log)
        try:
            for _ in range(100):
                if process.poll() is not None:
                    log.seek(0)
                    raise AssertionError(log.read())
                try:
                    assert request('/api/health')[0] == 200
                    break
                except (OSError, urllib.error.URLError):
                    time.sleep(0.05)
            else:
                raise AssertionError('Server did not become ready')
            assert request('/api/subjects')[1]['subjects'][0]['name'] == '我的代数分类'
            for asset, content_type in [('/', 'text/html'), ('/app.js', 'text/javascript'), ('/style.css', 'text/css')]:
                with urllib.request.urlopen(base + asset, timeout=5) as response:
                    assert response.status == 200 and response.headers.get_content_type() == content_type
                    assert response.headers['X-Content-Type-Options'] == 'nosniff'
                    assert response.headers['Content-Security-Policy']
                    assert response.read()
            assert request('/schema.h')[0] == 404
            assert request('/data/math.db')[0] == 404
            assert request('/../backend/src/main.c')[0] == 404
            assert request('/api/documents')[1]['documents'] == []
            code, created = upload()
            assert code == 201, (code, created)
            doc_id = created['id']
            code, doc = request(f'/api/documents/{doc_id}')
            assert code == 200 and doc['title'] == '代数 "例子" \\ 测试'
            assert doc['authors'] == '作者甲' and doc['subject_ids'] == [1]
            assert doc['file_size'] == len(pdf)
            assert request(created['file_url']) == (200, pdf)
            assert request('/api/documents?subject_id=1')[1]['documents'][0]['id'] == doc_id
            assert request('/api/documents?subject_id=2')[1]['documents'] == []
            assert request('/api/documents?offset=1')[1]['documents'] == []
            assert request('/api/documents?offset=-1')[0] == 400
            assert request('/api/documents?subject_id=1%20OR%201=1')[0] == 400
            assert request('/api/documents/999999999')[0] == 404
            assert request('/api/documents/1/file/extra')[0] == 404
            assert upload(subject='9999')[0] == 400
            assert upload(title='')[0] == 400
            assert upload(title=' ' * 5)[0] == 400
            assert upload(title='a' * 501)[0] == 400
            assert upload(authors='bad\nmetadata')[0] == 400
            assert upload(data=b'not a PDF')[0] == 400
            assert upload(data=b'')[0] == 400
            assert upload(content_type='text/plain')[0] == 415
            assert upload(data=b'%PDF-' + b'x' * (20 * 1024 * 1024))[0] == 413
            # Streaming overflow without a Content-Length must also be rejected.
            conn = http.client.HTTPConnection('127.0.0.1', port, timeout=10)
            conn.request('POST', '/api/documents?title=chunked&subject_id=1',
                         body=iter([b'%PDF-', *([b'x' * (1024 * 1024)] * 21)]),
                         headers={'Content-Type': 'application/pdf'}, encode_chunked=True)
            response = conn.getresponse()
            assert response.status == 413
            response.read(); conn.close()
            # A dropped connection must not leave a record or partial upload.
            conn = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
            conn.putrequest('POST', '/api/documents?title=interrupted&subject_id=1')
            conn.putheader('Content-Type', 'application/pdf')
            conn.putheader('Content-Length', '1000')
            conn.endheaders(); conn.send(b'%PDF-partial'); conn.close()
            for _ in range(100):
                if len(list((root / 'data/files').iterdir())) == 1:
                    break
                time.sleep(0.02)
            assert len(list((root / 'data/files').iterdir())) == 1
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
                results = list(pool.map(lambda i: upload(title=f'并发文献 {i}', subject='2'), range(3)))
            assert all(code == 201 for code, _ in results), results
            assert len({body['id'] for _, body in results}) == 3
            assert len(request('/api/documents?subject_id=2')[1]['documents']) == 3
            with sqlite3.connect(root / 'data/math.db') as db:
                assert db.execute('SELECT COUNT(*) FROM documents').fetchone()[0] == 4
                assert db.execute('SELECT COUNT(*) FROM document_subjects').fetchone()[0] == 4
                file_path = db.execute('SELECT file_path FROM documents WHERE id=?', (doc_id,)).fetchone()[0]
            assert len(list((root / 'data/files').iterdir())) == 4
            (root / file_path).unlink()
            assert request(created['file_url'])[0] == 500
            assert request('/api/ai/status')[1]['enabled'] is False
            assert request('/api/subjects', method='POST')[0] == 405
            print('Upload, download, filtering, migration, limits, interruption and concurrency checks passed.')
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill(); process.wait()
        assert process.returncode == 0, process.returncode
