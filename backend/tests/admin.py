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
            for path in ['/api/admin/documents', '/api/admin/books', '/api/admin/invitations', '/api/library/documents']:
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
            assert not list((root / 'data/files').iterdir())
            large = b'%PDF-1.4\n' + b'0' * (21 * 1024 * 1024)
            big_ids = []
            # Both fixed-length and chunked uploads must preserve the complete large PDF.
            fixed = write(query, large, pdf=True); assert fixed[0] == 201; big_ids.append(fixed[1]['id'])
            with closing(http.client.HTTPConnection('127.0.0.1', port, timeout=15)) as connection:
                chunks = (large[start:start + 65536] for start in range(0, len(large), 65536))
                connection.request('POST', query, body=chunks, headers={**headers, 'Transfer-Encoding': 'chunked'}, encode_chunked=True)
                response = connection.getresponse(); assert response.status == 201
                big_ids.append(json.loads(response.read())['id'])
            for doc_id in big_ids:
                assert request('/api/documents/' + str(doc_id))[1]['file_size'] == len(large)
                downloaded = request('/api/documents/' + str(doc_id) + '/file')
                assert downloaded[0] == 200 and hashlib.sha256(downloaded[1]).digest() == hashlib.sha256(large).digest()
            # Invalid classification rolls back metadata and cleans its streamed temporary file.
            before = set((root / 'data/files').iterdir())
            assert write(query + '&direction=invalid', large, pdf=True)[0] == 400
            assert set((root / 'data/files').iterdir()) == before
            # Remove only these disposable fixtures so the original catalog count assertions remain valid.
            with sqlite3.connect(database) as db:
                db.execute('PRAGMA foreign_keys=ON')
                for doc_id in big_ids:
                    stored = db.execute('SELECT file_path FROM documents WHERE id=?', (doc_id,)).fetchone()[0]
                    db.execute('DELETE FROM documents WHERE id=?', (doc_id,)); (root / stored).unlink()
            del large, downloaded
            imported = write(query, pdf, pdf=True); assert imported[0] == 201
            document = imported[1]['id']
            assert request('/api/documents/' + str(document) + '/file') == (200, pdf)
            assert len(request('/api/admin/documents?q=' + urllib.parse.quote('线性'))[1]['documents']) == 1
            metadata = {'title': 'Changed title', 'authors': 'New author', 'subject_ids': [1, 3]}
            assert write('/api/admin/documents/' + str(document), {**metadata, 'subject_ids': [999]}, 'PATCH')[0] == 400
            assert write('/api/admin/documents/' + str(document), metadata, 'PATCH')[0] == 200
            assert request('/api/documents/' + str(document))[1]['subject_ids'] == [1, 3]
            books = request('/api/admin/books')[1]['books']; assert len(books) == 56
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
            library_path = '/api/library/documents/' + str(document)
            assert request('/api/library/categories')[1]['modules'][0]['slug'] == 'mathematics'
            assert len(request('/api/library/documents?direction=algebra')[1]['documents']) == 1
            assert request('/api/library/documents?direction=discrete-foundations')[1]['documents'] == []
            assert request('/api/library/documents?direction=invalid')[0] == 400
            assert request(library_path)[1]['progress']['position'] == .3
            assert request(library_path + '/progress', 'PUT', b'{}', {'Content-Type':'application/json'})[0] == 403
            position = {'page': 2, 'total_pages': 3, 'position': .4, 'zoom': 1.5}
            assert write(library_path + '/progress', position, 'PUT')[0] == 200
            assert request('/api/learning/books/7')[1]['progress'] == position
            annotation = {'page':2,'quote':'Shared highlight','note':'Personal note','color':'yellow','rects':[{'x':.1,'y':.1,'width':.2,'height':.03}]}
            mark = write(library_path + '/annotations', annotation)[1]['id']
            assert request('/api/learning/books/7/annotations')[1]['annotations'][0]['id'] == mark
            assert write('/api/learning/books/7/annotations/' + str(mark), {'note':'Updated'}, 'PATCH')[0] == 200
            assert request(library_path + '/annotations')[1]['annotations'][0]['note'] == 'Updated'
            recommendation = {**config, 'title':'中文推荐','authors':'Author','direction':'algebra','language':'zh','source_url':''}
            assert write('/api/admin/books', {**recommendation,'direction':'discrete-foundations'})[0] == 400
            added = write('/api/admin/books', recommendation); assert added[0] == 201
            assert request('/api/learning/books/' + str(added[1]['id']))[1]['progress'] == position
            classified = {**metadata,'module':'mathematics','language':'zh','directions':['algebra','analysis']}
            assert write('/api/admin/documents/' + str(document), classified, 'PATCH')[0] == 409  # existing English binding
            chinese = write('/api/admin/documents?' + urllib.parse.urlencode({'title':'中文文献','authors':'作者','subject_id':1,'direction':'algebra','language':'zh'}), pdf, pdf=True)
            assert chinese[0] == 201
            assert len(request('/api/library/documents?direction=algebra&language=zh')[1]['documents']) == 1
            assert write('/api/admin/books', {**recommendation,'document_id':chinese[1]['id'],'language':'en'})[0] == 400
            assert write('/api/admin/documents/' + str(document), {**classified,'language':'und','directions':['analysis']}, 'PATCH')[0] == 409
            assert request('/api/documents/' + str(document))[1]['language'] == 'und'
            selection = '/api/learning/books/106/selection'
            assert request(selection,'PUT',b'{}',{'Content-Type':'application/json'})[0] == 403
            assert write('/api/learning/books/7/selection',{'document_id':chinese[1]['id']},'PUT')[0] == 400
            assert write('/api/learning/books/123/selection',{'document_id':chinese[1]['id']},'PUT')[0] == 400
            assert write(selection,{'document_id':9999},'PUT')[0] == 404
            selected = write(selection,{'document_id':chinese[1]['id']},'PUT'); assert selected[0] == 200
            assert selected[1]['title'] == '中文文献' and selected[1]['selected_document_id'] == chinese[1]['id']
            assert selected[1]['available'] and selected[1]['progress'] is None
            assert next(b for b in request('/api/admin/books')[1]['books'] if b['id']==106)['document_id'] is None
            assert write('/api/learning/books/106/progress',position,'PUT')[0] == 200
            assert request('/api/library/documents/' + str(chinese[1]['id']))[1]['progress'] == position
            assert write('/api/auth/login', {'username':'invited_reader','password':credentials['password']})[0] == 200
            archive=request('/api/library/collections')[1]
            root_folder=next(c for c in archive['collections'] if c['name']=='Original')
            analysis_folder=next(c for c in archive['collections'] if c['name']=='分析')
            complex_folder=next(c for c in archive['collections'] if c['name']=='复分析')
            assert root_folder['count']==2 and analysis_folder['count']==2 and complex_folder['parent_id']==analysis_folder['id']
            for folder in [root_folder,analysis_folder,complex_folder]:
                found=request('/api/library/documents?collection='+str(folder['id']))[1]['documents']
                assert {d['id'] for d in found}=={document,native_id}
            assert request('/api/library/documents?collection=-1')[0]==400
            assert request('/api/library/documents?collection=999999')[0]==404
            assert not {d['id'] for d in request('/api/library/documents?collection=unfiled')[1]['documents']} & {document,native_id}
            assert request('/api/learning/books/106')[1]['selected_document_id'] is None
            assert request(library_path)[1]['progress'] is None
            assert request(library_path + '/annotations')[1]['annotations'] == []
            assert write(library_path + '/annotations/' + str(mark), {'note':'Steal'}, 'PATCH')[0] == 404
            assert write(library_path + '/annotations/' + str(mark), {}, 'DELETE')[0] == 404
            assert write('/api/auth/login', credentials)[0] == 200
            assert write(library_path + '/annotations/' + str(mark), {}, 'DELETE')[0] == 200
            assert request('/api/documents', 'POST', pdf)[0] == 405
            analysis_courses = request('/api/admin/books')[1]['analysis_courses']
            assert len(analysis_courses) == 7 and '复分析' in analysis_courses
            analysis_config = next(book for book in request('/api/admin/books')[1]['books'] if book['id'] == 300)
            assert analysis_config['stage'] == '复分析'
            assert write('/api/admin/books/300', {**analysis_config,'stage':'常微分方程'}, 'PUT')[0] == 200
            assert request('/api/learning/books/300')[1]['stage'] == '常微分方程'
            assert write('/api/admin/books/300', {**analysis_config,'stage':'核心理论'}, 'PUT')[0] == 400
            assert write('/api/admin/books/300', {**analysis_config,'direction':'algebra'}, 'PUT')[0] == 400
            # Original DjVu upload and download, metadata, recommendation and private progress.
            djvu = b'AT&TFORM\x00\x00\x00\x04DJVU'
            csrf = request('/api/auth/csrf')[1]
            upload = request('/api/admin/documents?title=Native%20DjVu&subject_id=1&direction=algebra&language=en', 'POST', djvu, {'Content-Type':'image/vnd.djvu', csrf['header']:csrf['token']})
            assert upload[0] == 201
            native_id = upload[1]['id']
            assert request('/api/documents/' + str(native_id))[1]['format'] == 'djvu'
            assert request('/api/documents/' + str(native_id) + '/file') == (200, djvu)
            with client.open(base + '/api/documents/' + str(native_id) + '/file') as response:
                assert response.headers.get_content_type() == 'image/vnd.djvu'
                assert '.djvu' in response.headers['Content-Disposition']
            assert request('/reader-djvu.js')[0] == 200 and request('/vendor/djvu/djvu.js')[0] == 200
            assert request('/vendor/djvu/NOTICE.md')[0] == 200
            assert request('/api/admin/documents?title=Invalid&subject_id=1','POST',b'DJVU', {'Content-Type':'image/vnd.djvu',csrf['header']:csrf['token']})[0] == 400
            assert write('/api/learning/books/7/selection', {'document_id':native_id}, 'PUT')[1]['format'] == 'djvu'
            assert write('/api/learning/books/7/selection', {'document_id':None}, 'PUT')[0] == 200
            roles.grant_admin('owner_one', database, revoke=True)
            assert request('/api/auth/me')[1]['user']['role'] == 'USER'
            assert request('/api/admin/books') == (403, {'error': 'admin_required'})
            assert write('/api/admin/invitations', {'days': 7})[0] == 403
            # Legacy source paths recover on restart, without copying or reimporting files.
            with sqlite3.connect(database) as db:
                db.execute('CREATE TABLE zotero_import_sources(document_id INTEGER,source TEXT,attachment TEXT,collections_json TEXT,imported_at TEXT)')
                db.executemany('INSERT INTO zotero_import_sources VALUES(?,?,?,?,?)',[(document,'Original.rdf','one',json.dumps(['分析 / 复分析','代数']),'2026'),(document,'Original.rdf','duplicate',json.dumps(['分析 / 复分析']),'2026'),(native_id,'Original.rdf','native',json.dumps(['分析 / 复分析']),'2026')])
                db.commit()
            process.terminate(); process.wait(timeout=10)
            process = subprocess.Popen(['java','-jar',str(backend / 'target/math-server.jar')],cwd=root,
                env={**os.environ,'MATH_PORT':str(port),'MATH_WEB_DIR':str(backend.parent / 'frontend')},stdout=log,stderr=log)
            for _ in range(300):
                try:
                    if request('/api/health')[0] == 200: break
                except OSError: time.sleep(.1)
            else: raise AssertionError('Restart failed')
            assert write('/api/auth/login',credentials)[0] == 200
            archive=request('/api/library/collections')[1]
            root_folder=next(c for c in archive['collections'] if c['name']=='Original')
            analysis_folder=next(c for c in archive['collections'] if c['name']=='分析')
            complex_folder=next(c for c in archive['collections'] if c['name']=='复分析')
            assert root_folder['count']==2 and analysis_folder['count']==2 and complex_folder['parent_id']==analysis_folder['id']
            for folder in [root_folder,analysis_folder,complex_folder]:
                found=request('/api/library/documents?collection='+str(folder['id']))[1]['documents']
                assert {d['id'] for d in found}=={document,native_id}
            assert request('/api/library/documents?collection=-1')[0]==400
            assert request('/api/library/documents?collection=999999')[0]==404
            assert not {d['id'] for d in request('/api/library/documents?collection=unfiled')[1]['documents']} & {document,native_id}
            assert request('/api/learning/books/106')[1]['selected_document_id'] == chinese[1]['id']
            assert request('/api/learning/books/106')[1]['progress'] == position
            assert write(selection,{'document_id':None},'PUT')[1]['title'] == '高等代数'
            assert request('/api/learning/books/106')[1]['available'] is False
            assert request('/api/library/documents/' + str(chinese[1]['id']))[1]['progress'] == position
            with sqlite3.connect(database) as db:
                assert db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 2
                assert db.execute('PRAGMA foreign_key_check').fetchall() == []
        finally:
            process.terminate(); process.wait(timeout=10)
print('Administrator permissions, PDF import, textbook bindings and invitation revocation passed.')

