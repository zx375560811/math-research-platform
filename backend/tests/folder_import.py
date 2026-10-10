"""Folder replacement, rollback, account preservation and restart without seeds."""
from contextlib import closing
import json
import hashlib
import http.cookiejar
import os
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.request

backend = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend / 'admin'))
import replace_library as importer


def run():
    previous = Path.cwd()
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        os.chdir(root)
        try:
            (root / 'data/files').mkdir(parents=True)
            old_file = root / 'data/files/old.pdf'; old_file.write_bytes(b'%PDF-1.4 old')
            (root / 'data/ai-secret.key').write_bytes(b'k' * 32)
            with closing(sqlite3.connect('data/math.db')) as db:
                for name in ('schema.sql', 'learning.sql', 'learning-courses.sql'):
                    db.executescript((backend / 'src/main/resources' / name).read_text(encoding='utf-8'))
                db.execute("INSERT INTO users(username,password_hash) VALUES('owner','existing-hash')")
                db.execute("INSERT INTO administrators VALUES('owner')")
                db.execute("INSERT INTO ai_provider_settings(owner,base_url,api_key) VALUES('default','https://example.com/v1','encrypted-existing-key')")
                for name in ('invite_only_v1', 'library_catalog_v1', 'document_reading_v1', 'analysis_courses_v1'):
                    db.execute('INSERT OR IGNORE INTO account_migrations(name) VALUES(?)', (name,))
                db.execute("INSERT INTO documents(id,title,file_path,file_size) VALUES(81,'Old library','data/files/old.pdf',12)")
                db.execute('UPDATE learning_books SET document_id=81 WHERE id=7')
                db.execute("INSERT INTO learning_progress(username,book_id,page,total_pages) VALUES('owner',7,1,2)")
                db.execute("INSERT INTO document_progress(username,document_id,page,total_pages) VALUES('owner',81,1,2)")
                db.execute("INSERT INTO library_collections(source,path_key,name) VALUES('old','[]','Old folder')")
                db.commit()
            source = root / '数学文献'
            for category in importer.ORDER:
                folder = source / category / '子目录'
                folder.mkdir(parents=True)
                (folder / (category + '教材 (Z-Library).pdf')).write_bytes(b'%PDF-1.4\n' + category.encode('utf-8'))
            (source / '复分析' / 'Native.djvu').write_bytes(b'AT&TFORM\x00\x00\x00\x10DJVUtest')
            shutil.copy2(str(source / '分析/子目录/分析教材 (Z-Library).pdf'), str(source / '实分析/Copy.pdf'))
            plan = importer.preview(source)
            assert plan['summary']['files'] == 10 and plan['summary']['unique_files'] == 9
            assert plan['summary']['formats']['djvu'] == 1
            assert old_file.exists()
            changed = source / '分析/子目录/分析教材 (Z-Library).pdf'
            original = changed.read_bytes(); changed.write_bytes(b'%PDF-1.4 changed')
            try:
                importer.apply(source, plan)
                raise AssertionError('Changed source must fail before replacement')
            except ValueError:
                pass
            assert old_file.exists() and not (root / 'data/backups').exists()
            changed.write_bytes(original)
            with closing(sqlite3.connect('data/math.db')) as db:
                db.execute("CREATE TRIGGER fail_import BEFORE INSERT ON documents BEGIN SELECT RAISE(ABORT,'test failure'); END")
                db.commit()
            try:
                importer.apply(source, plan)
                raise AssertionError('Insert failure must roll back replacement')
            except sqlite3.IntegrityError:
                pass
            assert old_file.exists() and len(list((root / 'data/files').iterdir())) == 1
            with closing(sqlite3.connect('data/math.db')) as db:
                assert db.execute('SELECT COUNT(*) FROM learning_books').fetchone()[0] == 56
                db.execute('DROP TRIGGER fail_import'); db.commit()
            result = importer.apply(source, plan)
            assert result['documents'] == 9 and result['recommendations'] == 10
            assert not old_file.exists() and changed.exists()
            backup = Path(result['backup'])
            assert (backup / 'files/old.pdf').exists()
            assert (backup / 'ai-secret.key').read_bytes() == b'k' * 32
            with closing(sqlite3.connect(str(backup / 'math.db'))) as db:
                assert db.execute('SELECT COUNT(*) FROM learning_books').fetchone()[0] == 56
                assert db.execute('SELECT title FROM documents WHERE id=81').fetchone()[0] == 'Old library'
            with closing(sqlite3.connect('data/math.db')) as db:
                assert db.execute('PRAGMA foreign_key_check').fetchall() == []
                assert db.execute('SELECT COUNT(*) FROM document_progress').fetchone()[0] == 0
                assert db.execute('SELECT COUNT(*) FROM learning_progress').fetchone()[0] == 0
                assert db.execute("SELECT password_hash FROM users WHERE username='owner'").fetchone()[0] == 'existing-hash'
                assert db.execute("SELECT api_key FROM ai_provider_settings WHERE owner='default'").fetchone()[0] == 'encrypted-existing-key'
                names = {r[0] for r in db.execute('SELECT name FROM library_collections')}
                assert names == set(importer.ORDER) | {'数学文献', '子目录'}
                assert all('Z-Library' not in r[0] for r in db.execute('SELECT title FROM documents'))
                assert {r[0] for r in db.execute('SELECT name FROM learning_course_config')} == set(importer.ORDER)
            if (backend / 'target/math-server.jar').is_file() and shutil.which('java'):
                with socket.socket() as sock:
                    sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
                with (root / 'server.log').open('w+') as log:
                    process = subprocess.Popen(['java', '-jar', str(backend / 'target/math-server.jar')],
                                               env={**os.environ, 'MATH_PORT': str(port), 'MATH_WEB_DIR': str(backend.parent / 'frontend')}, stdout=log, stderr=log)
                    try:
                        for _ in range(300):
                            try:
                                with urllib.request.urlopen('http://127.0.0.1:{}/'.format(port), timeout=1) as response:
                                    if response.status == 200:
                                        break
                            except OSError:
                                time.sleep(.1)
                        else:
                            log.seek(0); raise AssertionError(log.read())
                        with closing(sqlite3.connect('data/math.db')) as db:
                            assert db.execute('SELECT COUNT(*) FROM learning_books').fetchone()[0] == 10
                            assert db.execute('SELECT COUNT(*) FROM documents').fetchone()[0] == 9
                            assert db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 1
                            invitation = 'T' * 43
                            db.execute('INSERT INTO invitations(code_hash) VALUES(?)', (hashlib.sha256(invitation.encode()).hexdigest(),))
                            db.commit()
                        client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
                        base = 'http://127.0.0.1:{}'.format(port)
                        def request(path, body=None, method=None):
                            headers = {}
                            if body is not None:
                                token = request('/api/auth/csrf')
                                headers = {'Content-Type': 'application/json', token['header']: token['token']}
                            with client.open(urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method), timeout=5) as response:
                                return json.load(response)
                        request('/api/auth/register', {'username':'folder_reader','password':'FolderTestPass123!','invitation':invitation})
                        request('/api/auth/login', {'username':'folder_reader','password':'FolderTestPass123!'})
                        assert {d['slug'] for d in request('/api/learning/directions')['directions']} == {'analysis','algebra'}
                        detail = request('/api/learning/directions/analysis')
                        assert detail['custom_courses'] is True
                        assert detail['courses'] == importer.ORDER[:6]
                        assert all(b['available'] for b in detail['books'])
                        assert {b['stage'] for b in detail['books']} == set(importer.ORDER[:6])
                        with closing(sqlite3.connect('data/math.db')) as db:
                            db.execute("INSERT INTO administrators VALUES('folder_reader')"); db.commit()
                        request('/api/auth/login', {'username':'folder_reader','password':'FolderTestPass123!'})
                        configured = request('/api/admin/books')
                        assert configured['courses']['analysis'] == importer.ORDER[:6]
                        assert configured['courses']['algebra'] == importer.ORDER[6:]
                        book = next(b for b in configured['books'] if b['stage'] == '测度论')
                        body = {k:book[k] for k in ('direction','language','stage','prerequisites','sort_order','document_id','title','authors','source_url')}
                        assert request('/api/admin/books/' + str(book['id']), body, 'PUT')['status'] == 'ok'
                        tree = request('/api/library/collections')['collections']
                        assert {f['name'] for f in tree} == set(importer.ORDER) | {'数学文献','子目录'}
                        try:
                            importer.apply(source, plan)
                            raise AssertionError('Live server must block replacement')
                        except ValueError as failure:
                            assert 'Stop math-platform' in str(failure)
                    finally:
                        process.terminate(); process.wait(timeout=10)
            print('Folder names, PDF/DJVU import, duplicate handling, backup, account preservation and safe replacement passed.')
        finally:
            os.chdir(previous)


if __name__ == '__main__':
    run()
