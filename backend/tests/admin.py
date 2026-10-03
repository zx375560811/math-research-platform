"""Administrator boundaries and management flows on a disposable Java server."""
import hashlib
from contextlib import closing
import http.client
import http.cookiejar
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
import urllib.parse
import urllib.request

backend = Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, backend / ('admin/' + name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


invitations = module('create_invitation')
roles = module('grant_admin')
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
base = 'http://127.0.0.1:' + str(port)
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def request(path, method='GET', data=None, headers=None):
    try:
        response = client.open(urllib.request.Request(base + path, data=data, method=method, headers=headers or {}), timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = response.read()
        return response.status, json.loads(body) if 'json' in response.headers.get_content_type() else body


def write(path, body, method='POST', pdf=False):
    csrf = request('/api/auth/csrf')[1]
    return request(path, method, body if pdf else json.dumps(body).encode(), {'Content-Type': 'application/pdf' if pdf else 'application/json', csrf['header']: csrf['token']})


with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    database = str(root / 'data/math.db')
    with (root / 'server.log').open('w+') as log:
        process = subprocess.Popen(['java', '-jar', str(backend / 'target/math-server.jar')], cwd=root,
            env={**os.environ, 'MATH_PORT': str(port), 'MATH_WEB_DIR': str(backend.parent / 'frontend')}, stdout=log, stderr=log)
        try:
            for _ in range(300):
                try:
                    if request('/api/health')[0] == 200:
                        break
                except OSError:
                    time.sleep(.1)
            else:
                log.seek(0)
                raise AssertionError(log.read())
            for path in ['/api/admin/documents', '/api/admin/books', '/api/admin/invitations']:
                assert request(path)[0] == 401
            assert b'account-form' in request('/admin')[1]  # anonymous redirect to login shell
            credentials = {'username': 'owner_one', 'password': 'AdministratorPass123!', 'invitation': invitations.create_invitation(database)}
            assert write('/api/auth/register', {**credentials, 'role': 'ADMIN'})[1]['user']['role'] == 'USER'
            assert write('/api/auth/login', credentials)[1]['user']['role'] == 'USER'
            for path in ['/api/admin/documents', '/api/admin/books', '/api/admin/invitations', '/admin', '/admin/']:
                assert request(path) == (403, {'error': 'admin_required'})
            assert write('/api/admin/documents?title=Test&subject_id=1', b'%PDF-1.4\n%%EOF', pdf=True)[0] == 403
            assert write('/api/admin/invitations', {'days': 7})[0] == 403
            roles.grant_admin('OWNER_ONE', database)
            assert write('/api/auth/login', credentials)[1]['user']['role'] == 'ADMIN'
            assert request('/api/auth/me')[1]['user']['role'] == 'ADMIN'
            assert b'document-form' in request('/admin')[1]
            assert request('/admin.html')[0] == 404
            assert request('/api/admin/invitations', 'POST', b'{"days":7}', {'Content-Type': 'application/json'})[0] == 403
            assert write('/api/admin/invitations', {'days': 0})[0] == 400
            created = write('/api/admin/invitations', {'days': 7})
            assert created[0] == 201 and len(created[1]['code']) == 43
            code = created[1]['code']; digest = hashlib.sha256(code.encode()).hexdigest()
            listed = request('/api/admin/invitations')[1]['invitations']
            assert any(item['id'] == digest and item['status'] == 'active' for item in listed)
            assert code not in json.dumps(listed)
            assert write('/api/admin/invitations/' + digest + '/revoke', {})[0] == 200
            assert write('/api/admin/invitations/' + digest + '/revoke', {})[0] == 200
            assert write('/api/auth/register', {'username': 'invited_reader', 'password': credentials['password'], 'invitation': code}) == (400, {'error': 'invalid_invitation'})
            assert any(item['id'] == digest and item['status'] == 'revoked' for item in request('/api/admin/invitations')[1]['invitations'])
            valid = write('/api/admin/invitations', {'days': 1})[1]['code']
            assert write('/api/auth/register', {'username': 'invited_reader', 'password': credentials['password'], 'invitation': valid})[0] == 201
            used = hashlib.sha256(valid.encode()).hexdigest()
            assert write('/api/admin/invitations/' + used + '/revoke', {})[0] == 409
            pdf = b'%PDF-1.4\n%%EOF\n'
            query = '/api/admin/documents?' + urllib.parse.urlencode({'title': '线性代数 <img src=x>', 'authors': 'Author', 'subject_id': 1})
            assert write(query, b'invalid', pdf=True)[0] == 400
            assert write('/api/admin/documents?title=Test&subject_id=9999', pdf, pdf=True)[0] == 400
            token = request('/api/auth/csrf')[1]
            outgoing = urllib.request.Request(base + '/api/auth/csrf')
            for handler in client.handlers:
                if isinstance(handler, urllib.request.HTTPCookieProcessor): handler.cookiejar.add_cookie_header(outgoing)
            headers = {'Content-Type': 'application/pdf', token['header']: token['token'], 'Cookie': outgoing.get_header('Cookie')}
            # Header rejection happens before reading a body. Half-close the sending side
            # so the HTTP server need not drain a fictitious oversized request.
            with closing(http.client.HTTPConnection('127.0.0.1', port, timeout=15)) as connection:
                connection.request('POST', query, body=b'', headers={**headers, 'Content-Length': str(20 * 1024 * 1024 + 1)})
                connection.sock.shutdown(socket.SHUT_WR)
                response = connection.getresponse(); assert response.status == 413; response.read()
            with closing(http.client.HTTPConnection('127.0.0.1', port, timeout=15)) as connection:
                connection.request('POST', query, body=iter([b'%PDF-' + b'0' * (1024 * 1024)] * 21), headers={**headers, 'Transfer-Encoding': 'chunked'}, encode_chunked=True)
                response = connection.getresponse(); assert response.status == 413; response.read()
            assert not list((root / 'data/files').iterdir())
            imported = write(query, pdf, pdf=True); assert imported[0] == 201
            document = imported[1]['id']
            assert request('/api/documents/' + str(document) + '/file') == (200, pdf)
            assert len(request('/api/admin/documents?q=' + urllib.parse.quote('线性'))[1]['documents']) == 1
            metadata = {'title': 'Changed title', 'authors': 'New author', 'subject_ids': [1, 3]}
            assert write('/api/admin/documents/' + str(document), {**metadata, 'subject_ids': [999]}, 'PATCH')[0] == 400
            assert write('/api/admin/documents/' + str(document), metadata, 'PATCH')[0] == 200
            assert request('/api/documents/' + str(document))[1]['subject_ids'] == [1, 3]
            books = request('/api/admin/books')[1]['books']; assert len(books) == 19
            book = next(book for book in books if book['id'] == 7)
            config = {'stage': '基础入门', 'prerequisites': 'Proofs', 'sort_order': 20, 'document_id': document}
            assert write('/api/admin/books/7', {**config, 'document_id': 999}, 'PUT')[0] == 404
            assert write('/api/admin/books/7', config, 'PUT')[0] == 200
            assert request('/api/learning/books/7')[1]['available']
            assert write('/api/learning/books/7/progress', {'page': 1, 'total_pages': 2, 'position': .3, 'zoom': 1.2}, 'PUT')[0] == 200
            assert write('/api/admin/books/7', {**config, 'document_id': None}, 'PUT')[0] == 409
            assert request('/api/learning/books/7')[1]['progress']['position'] == .3
            assert write('/api/admin/books/7', {**config, 'stage': '核心理论'}, 'PUT')[0] == 200
            assert request('/api/learning/books/7')[1]['stage'] == '核心理论'
            assert request('/api/documents', 'POST', pdf)[0] == 405
            roles.grant_admin('owner_one', database, revoke=True)
            assert request('/api/auth/me')[1]['user']['role'] == 'USER'
            assert request('/api/admin/books') == (403, {'error': 'admin_required'})
            assert write('/api/admin/invitations', {'days': 7})[0] == 403
            with sqlite3.connect(database) as db:
                assert db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 2
                assert db.execute('PRAGMA foreign_key_check').fetchall() == []
        finally:
            process.terminate(); process.wait(timeout=10)
print('Administrator permissions, PDF import, textbook bindings and invitation revocation passed.')
