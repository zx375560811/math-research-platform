"""Import reviewed competition PDFs directly into the shared library.

Run from backend after starting the updated Java server. Default: preview only.
--apply downloads verified files, reuses identical documents and links resources.
Each resource commits separately; failures preserve earlier imports and can be retried.
No browser upload, second staging copy, or review queue is involved.
"""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import http.client
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile
import urllib.parse
import urllib.request

from replace_library import backup_database, digest, inside

CATALOGUE = Path(__file__).resolve().parents[1] / 'src/main/resources/competition-resources.json'
GROUPS = {'a': '数学A类', 'b': '数学B类', 'junior': '低年级组', 'senior': '高年级组'}


def source_url(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname != 'www.cmathc.org.cn' or parsed.port not in (None, 443) or parsed.username or parsed.password or not parsed.path.startswith('/static/upload/file/'):
        raise ValueError('Unreviewed download URL')
    return urllib.parse.quote(url, safe=':/%?=&')


class ReviewedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return super().redirect_request(req, fp, code, msg, headers, source_url(newurl))


def download(url):
    return urllib.request.build_opener(ReviewedRedirect()).open(source_url(url), timeout=30)


def folder(db, names):
    parent = None
    for depth in range(1, len(names) + 1):
        path = names[:depth]
        key = json.dumps(path, ensure_ascii=False, separators=(',', ':'))
        db.execute('INSERT OR IGNORE INTO library_collections(source,path_key,parent_id,name) VALUES(?,?,?,?)', ('competition-import-v1', key, parent, path[-1]))
        parent = db.execute('SELECT id FROM library_collections WHERE source=? AND path_key=?', ('competition-import-v1', key)).fetchone()[0]
    return parent


def run(database='data/math.db', apply=False, fetch=download):
    workspace = Path.cwd().resolve()
    storage = workspace / 'data/files'
    catalogue = json.loads(CATALOGUE.read_text(encoding='utf-8'))
    verified = {r['id']: r for r in catalogue['resources'] if r.get('download_verified') and r.get('sha256')}
    if not Path(database).is_file():
        raise ValueError('Start the updated Java server once to initialize the database')
    with closing(sqlite3.connect(database, timeout=10)) as db:
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        if not db.execute("SELECT 1 FROM sqlite_master WHERE name='competition_resources'").fetchone():
            raise ValueError('Start the updated Java server once to initialize competition resources')
        rows = db.execute('SELECT * FROM competition_resources WHERE visible=1 AND document_id IS NULL ORDER BY sort_order,id').fetchall()
        rows = [r for r in rows if r['id'] in verified and r['download_url'] == verified[r['id']]['download_url']]
        result = {'pending_pdfs': len(rows), 'expected_bytes': sum(verified[r['id']]['file_size'] for r in rows), 'imported': 0, 'reused': 0, 'skipped': 0, 'failed': []}
        if not apply or not rows:
            return result
        if not storage.is_dir() or storage.is_symlink():
            raise ValueError('Managed data/files directory is unavailable')
        reserve = max(verified[r['id']]['file_size'] for r in rows) + 32 * 1024 * 1024
        if shutil.disk_usage(str(storage)).free < reserve:
            raise ValueError('Not enough disk space for a temporary PDF and database transaction')
        backup = workspace / 'data/backups' / ('competition-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
        backup.mkdir(parents=True, mode=0o700)
        with closing(sqlite3.connect(str(backup / 'math.db'))) as snapshot:
            backup_database(db, snapshot)
        result['backup'] = str(backup)
        for index, row in enumerate(rows, 1):
            saved = None
            keep = False
            try:
                reference = verified[row['id']]
                print('Downloading {}/{}: {}'.format(index, len(rows), row['id']), flush=True)
                checksum = hashlib.sha256()
                with fetch(row['download_url']) as response, tempfile.NamedTemporaryFile(prefix='upload-competition-', dir=str(storage), delete=False) as output:
                    saved = Path(output.name)
                    size = 0
                    while True:
                        chunk = response.read(65536)
                        if not chunk:
                            break
                        size += len(chunk)
                        if size > reference['file_size']:
                            raise ValueError('Source size changed; review the catalogue before importing')
                        checksum.update(chunk); output.write(chunk)
                    output.flush(); os.fsync(output.fileno())
                if size != reference['file_size'] or checksum.hexdigest() != reference['sha256']:
                    raise ValueError('Source checksum changed; review the catalogue before importing')
                with saved.open('rb') as stream:
                    if not stream.read(5).startswith(b'%PDF-'):
                        raise ValueError('Source is not a PDF')
                # Only hash same-size candidates; the large existing library is not read in full.
                document = None
                for candidate in db.execute('SELECT id,file_path FROM documents WHERE file_size=?', (size,)).fetchall():
                    path = Path(candidate['file_path'])
                    path = path if path.is_absolute() else workspace / path
                    if path.is_file() and not path.is_symlink() and inside(path, storage) and digest(path) == reference['sha256']:
                        document = candidate['id']; break
                db.execute('BEGIN IMMEDIATE')
                current = db.execute('SELECT * FROM competition_resources WHERE id=?', (row['id'],)).fetchone()
                if not current or current['document_id'] is not None or not current['visible']:
                    db.rollback(); result['skipped'] += 1; continue
                added = document is None
                if added:
                    document = db.execute('INSERT INTO documents(title,authors,file_path,file_size) VALUES(?,?,?,?)', (current['title'], '', saved.relative_to(workspace).as_posix(), size)).lastrowid
                    db.execute("INSERT INTO document_formats VALUES(?,'pdf')", (document,))
                    db.execute("INSERT INTO document_catalog(document_id,language) VALUES(?,'zh')", (document,))
                names = ['数学竞赛', {'syllabus':'考试大纲','preliminary':'初赛真题','final':'决赛真题'}[current['stage']]]
                if current['stage'] != 'syllabus':
                    names.extend([GROUPS[current['group_key']], str(current['year']) + '年' if current['year'] else '第{}届'.format(current['edition'])])
                db.execute('INSERT OR IGNORE INTO document_collections VALUES(?,?)', (document, folder(db, names)))
                db.execute('UPDATE competition_resources SET document_id=? WHERE id=? AND document_id IS NULL', (document, row['id']))
                db.commit(); keep = added
                result['imported' if added else 'reused'] += 1
            except (OSError, ValueError, sqlite3.Error, http.client.HTTPException) as error:
                db.rollback(); result['failed'].append({'id': row['id'], 'error': str(error)})
                print('Retained for retry: {} ({})'.format(row['id'], error), flush=True)
            finally:
                if saved and not keep:
                    saved.unlink()
        return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', default=os.getenv('MATH_DB_PATH') or 'data/math.db')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    try:
        report = run(args.database, args.apply)
        print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
        if report['failed']:
            raise SystemExit(2)
    except (OSError, ValueError, sqlite3.Error, http.client.HTTPException) as error:
        parser.exit(1, 'Competition import failed: {}\n'.format(error))
