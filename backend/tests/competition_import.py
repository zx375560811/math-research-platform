"""Reviewed competition import: dedupe, integrity, partial retry and preservation."""
from contextlib import closing, redirect_stdout
import hashlib
import io
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
from unittest import mock

backend = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend / 'admin'))
import import_competition as importer


def main():
    previous = Path.cwd()
    with tempfile.TemporaryDirectory() as directory:
        try:
            os.chdir(directory)
            Path('data/files').mkdir(parents=True)
            manifest = json.loads((backend / 'src/main/resources/competition-resources.json').read_text(encoding='utf-8'))
            rows = manifest['resources'][:3]
            contents = {r['id']: b'%PDF-1.4\n' + r['id'].encode() + b'\n%%EOF\n' for r in rows}
            for r in rows:
                r.update(file_size=len(contents[r['id']]), sha256=hashlib.sha256(contents[r['id']]).hexdigest(), download_verified=True)
            Path('manifest.json').write_text(json.dumps({'resources': rows}), encoding='utf-8')
            Path('data/files/upload-original').write_bytes(contents[rows[0]['id']])
            with closing(sqlite3.connect('data/math.db')) as db:
                db.executescript((backend / 'src/main/resources/schema.sql').read_text(encoding='utf-8'))
                db.execute("INSERT INTO documents(id,title,authors,file_path,file_size) VALUES(41,'Original title','Original author','data/files/upload-original',?)", (len(contents[rows[0]['id']]),))
                db.execute("INSERT INTO users(username,password_hash) VALUES('reader','test')")
                db.execute("INSERT INTO document_progress(username,document_id,page,total_pages) VALUES('reader',41,3,12)")
                db.execute("INSERT INTO study_plan(username,document_id,source) VALUES('reader',41,'mathematics')")
                for row in rows:
                    db.execute('INSERT INTO competition_resources(id,title,stage,group_key,year,edition,kind,source_url,download_url) VALUES(?,?,?,?,?,?,?,?,?)', tuple(row[k] for k in ['id','title','stage','group_key','year','edition','kind','source_url','download_url']))
                db.commit()
                fail = {rows[-1]['id']}
                def fetch(url):
                    row = next(r for r in rows if r['download_url'] == url)
                    return io.BytesIO(b'<html>failure</html>' if row['id'] in fail else contents[row['id']])
                with mock.patch.object(importer, 'CATALOGUE', Path('manifest.json')):
                    preview = importer.run(fetch=lambda url: (_ for _ in ()).throw(AssertionError('Preview downloaded a file')))
                    assert preview['pending_pdfs'] == 3 and not Path('data/backups').exists()
                    with redirect_stdout(io.StringIO()):
                        first = importer.run(apply=True, fetch=fetch)
                    assert first['reused'] == 1 and first['imported'] == 1 and len(first['failed']) == 1
                    assert len(list(Path('data/files').iterdir())) == 2
                    assert db.execute('SELECT document_id FROM competition_resources WHERE id=?', (rows[0]['id'],)).fetchone()[0] == 41
                    fail.clear()
                    with redirect_stdout(io.StringIO()):
                        second = importer.run(apply=True, fetch=fetch)
                        again = importer.run(apply=True, fetch=lambda url: (_ for _ in ()).throw(AssertionError('Downloaded imported PDF')))
                    assert second['imported'] == 1 and not second['failed'] and again['pending_pdfs'] == 0
                    assert len(list(Path('data/files').iterdir())) == 3
                    assert db.execute('SELECT count(*) FROM documents').fetchone()[0] == 3
                    assert db.execute('SELECT title,authors FROM documents WHERE id=41').fetchone() == ('Original title','Original author')
                    assert db.execute('SELECT page FROM document_progress').fetchone()[0] == 3
                    assert db.execute('SELECT document_id FROM study_plan').fetchone()[0] == 41
                    assert db.execute("SELECT count(*) FROM library_collections WHERE name='数学竞赛'").fetchone()[0] == 1
                    assert db.execute('PRAGMA foreign_key_check').fetchall() == []
                for url in ['http://www.cmathc.org.cn/static/upload/file/test.pdf','https://localhost/static/upload/file/test.pdf','https://www.cmathc.org.cn.evil.test/static/upload/file/test.pdf']:
                    try:
                        importer.source_url(url)
                        raise AssertionError('Unreviewed URL accepted')
                    except ValueError:
                        pass
        finally:
            os.chdir(previous)
    print('Competition import: preview, exact hashes, deduplication, partial retry, directory links and existing user data passed.')


if __name__ == '__main__':
    main()
