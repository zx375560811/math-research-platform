"""Replace the live library from a directory, preserving accounts and API settings.

Run from backend with the service stopped. Preview is read-only; --apply --replace
requires a preview plan. The old database and data/files are backed up first.
"""
import argparse
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import tempfile

from document_format import detect

GROUPS = {'分析': 'analysis', '复分析': 'analysis', '实分析': 'analysis',
          '测度论': 'analysis', '泛函分析': 'analysis', '偏微分方程': 'analysis',
          '高等代数': 'algebra', '抽象代数': 'algebra'}
ORDER = ['分析', '复分析', '实分析', '测度论', '泛函分析', '偏微分方程', '高等代数', '抽象代数']


def inside(path, root):
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def clean_title(name):
    return re.sub(r'\s*[（(][^()（）]*(?:z-library|z-lib\.sk|1lib\.sk)[^()（）]*[）)]\s*$',
                  '', name, flags=re.I).strip()


def suggest_language(name):
    # Only a filename hint, visible and editable in the preview plan.
    if re.search(r'英文版|\bEnglish\b|\bApostol\b', name, re.I):
        return 'en'
    return 'zh' if re.search(r'[\u4e00-\u9fff]', name) else 'en'


def preview(source):
    root = Path(source).resolve(strict=True)
    if not root.is_dir():
        raise ValueError('Source must be a directory')
    directories, documents = [], []
    for entry in sorted(root.rglob('*'), key=lambda p: p.relative_to(root).as_posix()):
        if entry.is_symlink() or not inside(entry, root):
            raise ValueError('Symlinks or paths outside the source are not supported: ' + str(entry))
        relative = entry.relative_to(root)
        if entry.is_dir():
            if relative.parts[0] not in GROUPS:
                raise ValueError('Unknown category: ' + relative.parts[0])
            directories.append(list(relative.parts))
        elif entry.suffix.lower() in ('.pdf', '.djvu', '.djv'):
            if len(relative.parts) < 2 or relative.parts[0] not in GROUPS:
                raise ValueError('Put each document inside a supported category: ' + str(relative))
            with entry.open('rb') as stream:
                kind = detect(stream.read(16))
            if entry.stat().st_size == 0:
                raise ValueError('Empty document: ' + str(relative))
            documents.append({'path': relative.as_posix(), 'folders': list(relative.parts[:-1]),
                              'direction': GROUPS[relative.parts[0]], 'course': relative.parts[0],
                              'title': clean_title(entry.stem), 'authors': '',
                              'language': suggest_language(entry.stem), 'format': kind,
                              'size': entry.stat().st_size, 'sha256': digest(entry)})
    if not documents:
        raise ValueError('No valid PDF or DJVU files found; old library will not be changed')
    if len(directories) > 2000 or any(len(p) > 30 for p in directories):
        raise ValueError('Too many folders or folder hierarchy exceeds 30 levels')
    return {'version': 1, 'root_name': root.name, 'source': str(root), 'directories': directories,
            'summary': {'files': len(documents), 'unique_files': len(set(d['sha256'] for d in documents)),
                        'formats': dict(Counter(d['format'] for d in documents)),
                        'folders': dict(Counter(d['course'] for d in documents))}, 'documents': documents}


def validate_plan(source, plan):
    actual = preview(source)
    if plan.get('version') != 1 or plan.get('directories') != actual['directories'] or plan.get('root_name') != actual['root_name']:
        raise ValueError('Source folders changed; create a fresh preview')
    rows = {d['path']: d for d in plan['documents']}
    if len(rows) != len(plan['documents']) or set(rows) != set(d['path'] for d in actual['documents']):
        raise ValueError('Preview file list differs from the source')
    for original in actual['documents']:
        row = rows[original['path']]
        for key in ('sha256', 'size', 'format', 'folders', 'direction', 'course'):
            if row.get(key) != original[key]:
                raise ValueError('Source changed or invalid preview field: ' + original['path'] + ' / ' + key)
        if row.get('language') not in ('zh', 'en'):
            raise ValueError('Recommendation language must be zh or en')
        for key in ('title', 'authors'):
            value = row.get(key)
            if not isinstance(value, str) or len(value.encode('utf-8')) > 500 or any(ord(c) < 32 or ord(c) == 127 for c in value) or (key == 'title' and not value.strip()):
                raise ValueError('Invalid ' + key + ': ' + original['path'])
    return plan


def apply(source, plan, database='data/math.db'):
    plan = validate_plan(source, plan)
    workspace = Path.cwd().resolve()
    root = Path(source).resolve(strict=True)
    database = Path(database).resolve(strict=True)
    storage = workspace / 'data' / 'files'
    if Path('/proc').is_dir():
        for process in Path('/proc').iterdir():
            if not process.name.isdigit():
                continue
            try:
                command = (process / 'cmdline').read_bytes()
                if b'math-server.jar' in command and (process / 'cwd').resolve() == workspace:
                    raise ValueError('Stop math-platform before replacing the library')
            except (OSError, RuntimeError):
                continue
    if not database.is_file() or not storage.is_dir() or storage.is_symlink():
        raise ValueError('Start the updated server once, then stop it before replacement')
    if inside(root, storage) or inside(storage, root):
        raise ValueError('Import source and live storage must be separate directories')
    required = sum(p.stat().st_size for p in storage.rglob('*') if p.is_file()) + database.stat().st_size + sum(d['size'] for d in plan['documents']) + 64 * 1024 * 1024
    if shutil.disk_usage(str(storage)).free < required:
        raise ValueError('Not enough disk space for the backup and new files')
    backup = workspace / 'data' / 'backups' / ('library-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    created, committed = [], False
    with closing(sqlite3.connect(str(database), timeout=10)) as db:
        db.execute('PRAGMA foreign_keys=ON')
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {'learning_course_config', 'library_settings', 'library_collections', 'learning_books'} <= tables:
            raise ValueError('Update and start the new Java backend once before running this script')
        if not db.execute("SELECT 1 FROM account_migrations WHERE name='document_reading_v1'").fetchone():
            raise ValueError('Reading-data migration is incomplete')
        old_paths = [r[0] for r in db.execute('SELECT file_path FROM documents')]
        # Never remove files outside the verified managed storage.
        for value in old_paths:
            path = Path(value)
            path = path if path.is_absolute() else workspace / path
            if not inside(path, storage) or path.resolve() == storage.resolve() or path.is_symlink():
                raise ValueError('Old file path is outside managed storage: ' + str(path))
        if any(p.is_symlink() for p in storage.rglob('*')):
            raise ValueError('Managed storage contains symlinks; replacement aborted')
        old_files = [p.resolve() for p in storage.rglob('*') if p.is_file()]
        backup.mkdir(mode=0o700, parents=True, exist_ok=False)
        with closing(sqlite3.connect(str(backup / 'math.db'))) as snapshot:
            db.backup(snapshot)
        shutil.copytree(str(storage), str(backup / 'files'))
        # The database includes encrypted API keys; preserve the encryption key too.
        key = workspace / 'data' / 'ai-secret.key'
        if key.exists():
            shutil.copy2(str(key), str(backup / key.name))
        (backup / 'import-plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding='utf-8')
        print('Backup: ' + str(backup), flush=True)
        staged = {}
        try:
            for row in plan['documents']:
                if row['sha256'] in staged:
                    continue
                with (root / row['path']).open('rb') as original, tempfile.NamedTemporaryFile(prefix='folder-', dir=str(storage), delete=False) as output:
                    target = Path(output.name); created.append(target)
                    shutil.copyfileobj(original, output, 1024 * 1024)
                    output.flush(); os.fsync(output.fileno())
                if digest(target) != row['sha256']:
                    raise ValueError('Source changed during copy: ' + row['path'])
                staged[row['sha256']] = target
            db.execute('BEGIN IMMEDIATE')
            for table in ('ai_library_items', 'ai_library_jobs', 'learning_progress', 'learning_marks',
                          'learning_books', 'library_collections', 'documents', 'learning_course_config'):
                if table in tables:
                    db.execute('DELETE FROM ' + table)
            db.execute("INSERT OR REPLACE INTO library_settings(name,value) VALUES('seed_books','disabled')")
            source_name = 'folder-library:' + plan['root_name']
            folders = {}
            folders[()] = db.execute('INSERT INTO library_collections(source,path_key,parent_id,name,sort_order) VALUES(?,?,NULL,?,0)',
                                    (source_name, '[]', plan['root_name'])).lastrowid
            paths = sorted(plan['directories'], key=lambda p: (len(p), ORDER.index(p[0]), p))
            for index, path in enumerate(paths):
                folders[tuple(path)] = db.execute('INSERT INTO library_collections(source,path_key,parent_id,name,sort_order) VALUES(?,?,?,?,?)',
                                                 (source_name, json.dumps(path, ensure_ascii=False), folders[tuple(path[:-1])], path[-1], index)).lastrowid
            for index, course in enumerate(ORDER):
                if any(d['course'] == course for d in plan['documents']):
                    db.execute('INSERT INTO learning_course_config(direction,name,sort_order) VALUES(?,?,?)', (GROUPS[course], course, index))
            ids, recommendations = {}, set()
            for index, row in enumerate(plan['documents']):
                identity = row['sha256']
                if identity not in ids:
                    stored = staged[identity].relative_to(workspace).as_posix()
                    ids[identity] = db.execute('INSERT INTO documents(title,authors,file_path,file_size) VALUES(?,?,?,?)',
                                              (row['title'], row['authors'], stored, row['size'])).lastrowid
                    db.execute('INSERT INTO document_formats VALUES(?,?)', (ids[identity], row['format']))
                    # Unknown library language allows one physical file in multiple explicit slots.
                    languages = {d['language'] for d in plan['documents'] if d['sha256'] == identity}
                    db.execute('INSERT INTO document_catalog(document_id,module,language) VALUES(?,?,?)',
                               (ids[identity], 'mathematics', next(iter(languages)) if len(languages) == 1 else 'und'))
                doc = ids[identity]
                db.execute('INSERT OR IGNORE INTO document_directions VALUES(?,?)', (doc, row['direction']))
                db.execute('INSERT OR IGNORE INTO document_subjects VALUES(?,?)', (doc, 1 if row['direction'] == 'algebra' else 3))
                db.execute('INSERT OR IGNORE INTO document_collections VALUES(?,?)', (doc, folders[tuple(row['folders'])]))
                slot = (doc, row['direction'], row['course'], row['language'])
                if slot not in recommendations:
                    book = db.execute('INSERT INTO learning_books(direction,title,authors,stage,prerequisites,sort_order,source_url,document_id) VALUES(?,?,?,?,?,?,?,?)',
                                      (row['direction'], row['title'], row['authors'], row['course'], '', index, '', doc)).lastrowid
                    db.execute('INSERT INTO learning_book_details VALUES(?,?)', (book, row['language']))
                    recommendations.add(slot)
            if db.execute('PRAGMA foreign_key_check').fetchall():
                raise ValueError('Database integrity check failed')
            db.commit(); committed = True
        finally:
            if not committed:
                db.rollback()
                for path in created:
                    path.unlink()
        pending = []
        for path in old_files:
            try:
                if path.exists():
                    path.unlink()
            except OSError:
                pending.append(str(path))
        result = {'documents': len(ids), 'recommendations': len(recommendations), 'backup': str(backup), 'old_file_cleanup_pending': pending}
        (backup / 'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory')
    parser.add_argument('--database', default=os.getenv('MATH_DB_PATH') or 'data/math.db')
    parser.add_argument('--plan', default='data/folder-import-plan.json')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--replace', action='store_true', help='Explicitly replace ALL old documents, folders and recommendations')
    args = parser.parse_args()
    try:
        if args.apply:
            if not args.replace:
                raise ValueError('Replacement requires --apply --replace')
            plan = json.loads(Path(args.plan).read_text(encoding='utf-8'))
            result = apply(args.directory, plan, args.database)
        else:
            result = preview(args.directory)
            Path(args.plan).parent.mkdir(parents=True, exist_ok=True)
            Path(args.plan).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
            result = {'summary': result['summary'], 'plan': args.plan,
                      'language_note': 'Language is inferred from filenames; edit zh/en in the plan if needed.'}
        print(json.dumps(result, ensure_ascii=False))
    except (OSError, ValueError, KeyError, sqlite3.Error) as failure:
        parser.exit(1, 'Replacement failed: ' + str(failure) + '\n')


if __name__ == '__main__':
    main()
