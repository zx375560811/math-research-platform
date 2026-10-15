"""Append six series folders; preserve the current library and reading records.

Run from backend with math-platform stopped. Default: read-only preview.
--apply backs up the database and atomically imports/associates PDF and DJVU files.
--apply --move uses same-filesystem hard links, then removes source files only
after the database commits. It does not require a second copy of the books.
"""
import argparse
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import sqlite3
import stat
import tempfile

from document_format import detect
from import_document import metadata
from replace_library import backup_database, clean_title, digest, inside

SERIES = {
    'Graduate Studies in Mathematics(GSM)': 'Graduate Studies in Mathematics (GSM)',
    'Graduate Studies in Mathematics (GSM)': 'Graduate Studies in Mathematics (GSM)',
    'Graduate Texts in Mathematics(GTM)': 'Graduate Texts in Mathematics (GTM)',
    'Graduate Texts in Mathematics (GTM)': 'Graduate Texts in Mathematics (GTM)',
    'Lecture Notes in Mathematics': 'Lecture Notes in Mathematics',
    'London Mathematical Society Student Texts': 'London Mathematical Society Student Texts',
    'SMM': 'SMM 系列', 'SMM 系列': 'SMM 系列',
    'UTM': 'UTM 系列', 'UTM 系列': 'UTM 系列',
}


def identity(path):
    value = os.stat(str(path), follow_symlinks=False)
    if not stat.S_ISREG(value.st_mode):
        raise ValueError('Source must remain a regular file: ' + str(path))
    return (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns)


def preview(source):
    root = Path(source).resolve(strict=True)
    if not root.is_dir():
        raise ValueError('Source must be a directory')
    rows, folders, skipped = [], set(), 0
    for entry in sorted(root.rglob('*')):
        if entry.is_symlink() or not inside(entry, root):
            raise ValueError('Symlink or path outside source: ' + str(entry))
        relative = entry.relative_to(root)
        if entry.is_file() and entry.suffix.lower() in ('.pdf', '.djvu', '.djv'):
            if len(relative.parts) < 2 or relative.parts[0] not in SERIES:
                raise ValueError('Unknown series folder: ' + str(relative))
            with entry.open('rb') as stream:
                kind = detect(stream.read(16))
            title = clean_title(entry.stem)
            metadata(title, True)
            size = entry.stat().st_size
            if size <= 0:
                raise ValueError('Empty document: ' + str(relative))
            path = relative.parts[:-1]
            for length in range(1, len(path) + 1):
                folders.add(path[:length])
            before = identity(entry)
            checksum = digest(entry)
            if identity(entry) != before:
                raise ValueError('Source changed during scan: ' + str(relative))
            rows.append({'path': relative.as_posix(), 'folders': path,
                         'series': SERIES[path[0]], 'title': title,
                         'format': kind, 'size': size, 'sha256': checksum, 'identity': before})
        elif entry.is_file():
            skipped += 1
    if not rows:
        raise ValueError('No valid PDF or DJVU files found')
    if len(folders) > 2000 or any(len(p) > 30 for p in folders):
        raise ValueError('Too many folders or hierarchy exceeds 30 levels')
    return {'source': str(root), 'documents': rows,
            'folders': sorted(folders, key=lambda p: (len(p), p)),
            'summary': {'files': len(rows), 'unique_files': len({r['sha256'] for r in rows}),
                        'series': dict(Counter(r['series'] for r in rows)),
                        'formats': dict(Counter(r['format'] for r in rows)), 'skipped': skipped}}


def apply(plan, database='data/math.db', move=False):
    workspace = Path.cwd().resolve()
    if Path('/proc').is_dir():
        for process in Path('/proc').iterdir():
            if not process.name.isdigit():
                continue
            try:
                running = b'math-server.jar' in (process / 'cmdline').read_bytes() and (process / 'cwd').resolve() == workspace
            except (OSError, RuntimeError):
                continue
            if running:
                raise ValueError('Stop math-platform before importing series')
    root = Path(plan['source'])
    storage = workspace / 'data' / 'files'
    database = Path(database).resolve(strict=True)
    if not storage.is_dir() or storage.is_symlink() or inside(root, storage) or inside(storage, root):
        raise ValueError('Source and managed storage must be separate directories')
    if move:
        for row in plan['documents']:
            original = root / row['path']
            if not inside(original, root) or identity(original) != row['identity']:
                raise ValueError('Source changed before import: ' + row['path'])
            if row['identity'][0] != storage.stat().st_dev:
                raise ValueError('--move requires every source file and data/files on the same filesystem')
            if not os.access(str(original.parent), os.W_OK | os.X_OK):
                raise ValueError('--move needs write permission on source folders: ' + str(original.parent))
    created, committed = [], False
    with closing(sqlite3.connect(str(database), timeout=10)) as db:
        db.execute('PRAGMA foreign_keys=ON')
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {'book_series', 'series_documents', 'document_formats', 'document_collections'} <= tables:
            raise ValueError('Update and start the Java server once to initialize series tables')
        series_ids = dict(db.execute('SELECT name,id FROM book_series'))
        if any(row['series'] not in series_ids for row in plan['documents']):
            raise ValueError('A series is missing or renamed; restore its name in administration first')
        known = {}
        for doc, stored in db.execute('SELECT id,file_path FROM documents'):
            path = Path(stored)
            path = path if path.is_absolute() else workspace / path
            if not path.is_file() or path.is_symlink() or not inside(path, storage):
                raise ValueError('Existing document has a missing or unmanaged file: ' + str(doc))
            known.setdefault(digest(path), doc)
        required = (0 if move else sum(r['size'] for r in plan['documents'] if r['sha256'] not in known)) + database.stat().st_size + 64 * 1024 * 1024
        if shutil.disk_usage(str(storage)).free < required:
            raise ValueError('Not enough disk space')
        backup = workspace / 'data' / 'backups' / ('series-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
        backup.mkdir(mode=0o700, parents=True)
        with closing(sqlite3.connect(str(backup / 'math.db'))) as snapshot:
            backup_database(db, snapshot)
        key = workspace / 'data' / 'ai-secret.key'
        if key.exists():
            shutil.copy2(str(key), str(backup / key.name))
        print('Database backup: ' + str(backup), flush=True)
        added, linked = 0, 0
        try:
            db.execute('BEGIN IMMEDIATE')
            folder_ids = {}
            namespace = 'series-import:' + str(root)
            for order, path in enumerate(plan['folders']):
                path_key = json.dumps(path, ensure_ascii=False, separators=(',', ':'))
                db.execute('INSERT OR IGNORE INTO library_collections(source,path_key,parent_id,name,sort_order) VALUES(?,?,?,?,?)',
                           (namespace, path_key, folder_ids.get(path[:-1]), path[-1], order))
                folder_ids[path] = db.execute('SELECT id FROM library_collections WHERE source=? AND path_key=?', (namespace, path_key)).fetchone()[0]
            orders = {sid: db.execute('SELECT COALESCE(MAX(sort_order),0) FROM series_documents WHERE series_id=?', (sid,)).fetchone()[0] for sid in series_ids.values()}
            for number, row in enumerate(plan['documents'], 1):
                doc = known.get(row['sha256'])
                if doc is None:
                    if move:
                        if identity(root / row['path']) != row['identity']:
                            raise ValueError('Source changed during import: ' + row['path'])
                        # The staging directory is private. Reserving a random name
                        # keeps retries collision-free; linking allocates no book copy.
                        with tempfile.NamedTemporaryFile(prefix='series-', dir=str(storage), delete=False) as output:
                            saved = Path(output.name)
                        saved.unlink()
                        os.link(str(root / row['path']), str(saved), follow_symlinks=False)
                        created.append(saved)
                    else:
                        with (root / row['path']).open('rb') as original, tempfile.NamedTemporaryFile(prefix='series-', dir=str(storage), delete=False) as output:
                            saved = Path(output.name)
                            created.append(saved)
                            shutil.copyfileobj(original, output, 1024 * 1024)
                            output.flush()
                            os.fsync(output.fileno())
                    if digest(saved) != row['sha256']:
                        raise ValueError('Source changed during import: ' + row['path'])
                    doc = db.execute('INSERT INTO documents(title,authors,file_path,file_size) VALUES(?,?,?,?)',
                                     (row['title'], '', saved.relative_to(workspace).as_posix(), row['size'])).lastrowid
                    db.execute('INSERT INTO document_formats VALUES(?,?)', (doc, row['format']))
                    db.execute('INSERT INTO document_catalog(document_id) VALUES(?)', (doc,))
                    known[row['sha256']] = doc
                    added += 1
                db.execute('INSERT OR IGNORE INTO document_collections VALUES(?,?)', (doc, folder_ids[row['folders']]))
                sid = series_ids[row['series']]
                orders[sid] += 10
                linked += db.execute('INSERT OR IGNORE INTO series_documents VALUES(?,?,?)', (sid, doc, orders[sid])).rowcount
                if number % 100 == 0:
                    print('Processed {}/{}'.format(number, len(plan['documents'])), flush=True)
            if db.execute('PRAGMA foreign_key_check').fetchall():
                raise ValueError('Foreign key integrity check failed')
            db.commit()
            committed = True
        finally:
            if not committed:
                db.rollback()
                for path in created:
                    path.unlink()
        removed, pending = 0, []
        if move:
            for row in plan['documents']:
                original = root / row['path']
                try:
                    if not inside(original, root) or identity(original) != row['identity']:
                        raise ValueError('Source changed; retained')
                    original.unlink()
                    removed += 1
                except (OSError, ValueError):
                    pending.append(row['path'])
        result = {'new_documents': added, 'new_series_links': linked, 'reused_files': len(plan['documents']) - added,
                  'backup': str(backup), 'mode': 'move' if move else 'copy',
                  'source_files_removed': removed, 'source_cleanup_pending': pending}
        (backup / 'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory')
    parser.add_argument('--database', default=os.getenv('MATH_DB_PATH') or 'data/math.db')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--move', action='store_true', help='Use same-filesystem links; remove uploaded source files after commit (requires --apply)')
    args = parser.parse_args()
    if args.move and not args.apply:
        parser.error('--move requires --apply')
    try:
        print('Scanning files and calculating hashes; this may take several minutes...', flush=True)
        plan = preview(args.directory)
        print(json.dumps(apply(plan, args.database, args.move) if args.apply else plan['summary'], ensure_ascii=False))
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.exit(1, 'Series import failed: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
