"""Real Java organizer with a local compatible provider and disposable files."""
import importlib.util
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
import http.cookiejar
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

backend = Path(__file__).resolve().parents[1]
def helper(name):
    spec = importlib.util.spec_from_file_location(name, backend / ('admin/' + name + '.py'))
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value); return value
invitations, roles = helper('create_invitation'), helper('grant_admin')
calls = []; mode = 'good'; entered = threading.Event(); release = threading.Event()
class Provider(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_POST(self):
        value = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        documents = json.loads(value['messages'][-1]['content'])['documents']
        calls.append((self.headers.get('Authorization'), value)); selected_mode = mode
        if selected_mode == 'slow': entered.set(); release.wait(15)
        items = [{'id': d['id'], 'direction': 'analysis', 'topic': '复分析' if selected_mode != 'invalid' else '../../invalid',
                  'confidence': .3 if d['title'] == 'Opaque' else .95, 'reason': 'Metadata only'} for d in documents]
        body = json.dumps({'choices': [{'message': {'content': json.dumps({'items': items})}, 'finish_reason': 'stop'}]}).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(body)
provider = ThreadingHTTPServer(('127.0.0.1', 0), Provider)
thread = threading.Thread(target=provider.serve_forever, daemon=True); thread.start()
endpoint = 'http://127.0.0.1:' + str(provider.server_port) + '/v1'
with socket.socket() as sock: sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
base = 'http://127.0.0.1:' + str(port)
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def request(path, method='GET', body=None, headers=None):
    try: response = client.open(urllib.request.Request(base + path, data=body, method=method, headers=headers or {}), timeout=20)
    except urllib.error.HTTPError as error: response = error
    with response:
        content = response.read(); return response.status, json.loads(content) if 'json' in response.headers.get_content_type() else content
def write(path, body, method='POST', pdf=False):
    csrf = request('/api/auth/csrf')[1]
    return request(path, method, body if pdf else json.dumps(body).encode(), {'Content-Type': 'application/pdf' if pdf else 'application/json', csrf['header']: csrf['token']})
def wait_state(expected):
    for _ in range(200):
        value = request('/api/admin/library-ai')[1]
        if value['state'] in expected: return value
        time.sleep(.1)
    raise AssertionError(value)
try:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory); database = str(root / 'data/math.db')
        with (root / 'server.log').open('w+') as log:
            process = subprocess.Popen(['java', '-jar', str(backend / 'target/math-server.jar')], cwd=root,
                env={**os.environ, 'MATH_PORT': str(port), 'MATH_WEB_DIR': str(backend.parent / 'frontend'), 'MATH_AI_TEST_ENDPOINT': endpoint}, stdout=log, stderr=log)
            try:
                for _ in range(300):
                    try:
                        if request('/api/health')[0] == 200: break
                    except OSError: time.sleep(.1)
                else: log.seek(0); raise AssertionError(log.read())
                assert request('/api/admin/library-ai')[0] == 401
                credentials = {'username': 'organizer_owner', 'password': 'AdministratorPass123!', 'invitation': invitations.create_invitation(database)}
                assert write('/api/auth/register', credentials)[0] == 201
                assert write('/api/auth/login', credentials)[0] == 200
                assert write('/api/admin/library-ai', {'source': 'custom'})[0] == 403
                roles.grant_admin(credentials['username'], database)
                assert write('/api/auth/login', credentials)[0] == 200
                assert write('/api/admin/library-ai', {'source': 'custom'})[0] == 503
                custom = {'source': 'custom', 'enabled': True, 'base_url': endpoint, 'model': 'organizer-test', 'api_key': 'previous-personal-key'}
                assert write('/api/ai/settings', custom, 'PUT')[0] == 200
                pdf = b'%PDF-1.4\n%%EOF'
                documents = [write('/api/admin/documents?title=' + title + '&subject_id=1', pdf, pdf=True)[1]['id'] for title in ['Complex-analysis', 'Opaque']]
                folder_a = write('/api/admin/collections', {'name': 'Original', 'parent_id': None})[1]['id']
                folder_b = write('/api/admin/collections', {'name': 'Manual', 'parent_id': None})[1]['id']
                assert write('/api/admin/documents/move', {'document_ids': documents, 'collection_id': folder_a})[0] == 200
                assert write('/api/admin/books/7', {'stage': '基础入门', 'sort_order': 1, 'prerequisites': '', 'document_id': documents[0]}, 'PUT')[0] == 200
                reading = '/api/library/documents/' + str(documents[0])
                position = {'page': 1, 'total_pages': 2, 'position': .4, 'zoom': 1.2}
                assert write(reading + '/progress', position, 'PUT')[0] == 200
                annotation = write(reading + '/annotations', {'page': 1, 'quote': 'Private theorem', 'note': 'Private personal note', 'color': 'yellow', 'rects':[{'x':.1,'y':.1,'width':.2,'height':.03}]})
                assert annotation[0] == 200, annotation
                assert request('/api/admin/library-ai', 'POST', json.dumps({'source': 'custom'}).encode(), {'Content-Type': 'application/json'})[0] == 403
                start = write('/api/admin/library-ai', {'source': 'custom', 'collection_id': folder_a}); assert start[0] == 200, start
                job = wait_state({'completed'}); assert job['total'] == 2 and job['applied'] == 1 and job['review'] == 1, job
                assert calls[-1][0] == 'Bearer previous-personal-key'
                assert 'Private personal note' not in json.dumps(calls) and 'Private theorem' not in json.dumps(calls)
                archive = request('/api/library/collections')[1]['collections']
                assert any(c['name'] == '数学主题' and c['count'] == 2 for c in archive)
                assert any(c['name'] == '待确认' and c['count'] == 1 for c in archive)
                assert any(c['id'] == folder_a and c['count'] == 2 for c in archive)
                assert set(request(reading)[1]['directions']) == {'analysis', 'algebra'}
                assert request(reading)[1]['progress'] == position
                assert request(reading + '/annotations')[1]['annotations'][0]['note'] == 'Private personal note'
                assert request('/api/documents/' + str(documents[0]) + '/file') == (200, pdf)
                assert write('/api/admin/library-ai/' + job['id'] + '/control', {'action': 'undo'})[0] == 200
                assert request(reading)[1]['directions'] == ['algebra']
                with sqlite3.connect(database) as db:
                    assert db.execute('SELECT collection_id FROM document_collections WHERE document_id=?', (documents[0],)).fetchall() == [(folder_a,)]
                # An in-flight result must not apply after pause, even if the provider finishes later.
                mode = 'slow'; entered.clear(); release.clear()
                slow = write('/api/admin/library-ai', {'source': 'custom', 'collection_id': folder_a})[1]
                assert entered.wait(10)
                assert write('/api/admin/library-ai', {'source': 'custom'})[0] == 409
                assert write('/api/admin/library-ai/' + slow['id'] + '/control', {'action': 'pause'})[1]['state'] == 'paused'
                release.set(); time.sleep(.3)
                assert request('/api/admin/library-ai')[1]['applied'] == 0
                mode = 'good'
                assert write('/api/admin/library-ai/' + slow['id'] + '/control', {'action': 'resume'})[0] == 200
                slow = wait_state({'completed'}); assert slow['applied'] == 1
                assert write('/api/admin/documents/move', {'document_ids': [documents[0]], 'collection_id': folder_b})[0] == 200
                undone = write('/api/admin/library-ai/' + slow['id'] + '/control', {'action': 'undo'})[1]
                assert undone['skipped'] == 1 and undone['undone'] == 1
                with sqlite3.connect(database) as db:
                    assert db.execute('SELECT collection_id FROM document_collections WHERE document_id=?', (documents[0],)).fetchall() == [(folder_b,)]
                # Reject invented taxonomy/path strings without applying any classification.
                mode = 'invalid'
                bad = write('/api/admin/library-ai', {'source': 'custom', 'collection_id': folder_a})[1]
                paused = wait_state({'paused'}); assert paused['error'] == 'ai_classification_invalid' and paused['applied'] == 0
                mode = 'good'
                assert write('/api/admin/library-ai/' + bad['id'] + '/control', {'action': 'resume'})[0] == 200
                assert wait_state({'completed'})['review'] == 1
                assert request(reading)[1]['progress'] == position
                with sqlite3.connect(database) as db:
                    assert db.execute('PRAGMA foreign_key_check').fetchall() == []
                    db.execute("UPDATE ai_library_jobs SET state='running' WHERE id=?", (bad['id'],)); db.commit()
                process.terminate(); process.wait(timeout=15)
                process = subprocess.Popen(['java', '-jar', str(backend / 'target/math-server.jar')], cwd=root,
                    env={**os.environ, 'MATH_PORT': str(port), 'MATH_WEB_DIR': str(backend.parent / 'frontend'), 'MATH_AI_TEST_ENDPOINT': endpoint}, stdout=log, stderr=log)
                for _ in range(300):
                    try:
                        if request('/api/health')[0] == 200: break
                    except OSError: time.sleep(.1)
                assert write('/api/auth/login', credentials)[0] == 200
                assert request('/api/admin/library-ai')[1]['state'] == 'paused'
                assert request('/api/admin/library-ai')[1]['error'] == 'ai_job_restarted'
                print('AI classification, original API reuse, scope, review, pause races, resume, undo, metadata-only prompts, bindings, reading preservation and restart passed.')
            finally:
                release.set(); process.terminate(); process.wait(timeout=15)
finally:
    release.set(); provider.shutdown(); provider.server_close(); thread.join(timeout=5)
