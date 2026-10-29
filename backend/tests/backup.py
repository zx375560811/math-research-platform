"""Online backup script on old Python builds and with FTS content."""
import importlib.util
from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile

backend = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('backup_database', backend / 'admin/backup_database.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def make_database(path):
    with closing(sqlite3.connect(str(path))) as db:
        db.execute('CREATE TABLE notes(id INTEGER PRIMARY KEY, body TEXT)')
        db.executemany('INSERT INTO notes(body) VALUES(?)', [('a',), ('b',), ('c',)])
        try:
            db.execute('CREATE VIRTUAL TABLE notes_fts USING fts5(body)')
            db.execute("INSERT INTO notes_fts(body) VALUES('hello world')")
        except sqlite3.OperationalError:
            pass
        db.commit()
    return path


def verify(path, expected_rows=3):
    with closing(sqlite3.connect(str(path))) as db:
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert db.execute('SELECT count(*) FROM notes').fetchone()[0] == expected_rows
        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert 'notes' in tables


with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    db = make_database(root / 'math.db')
    backups = root / 'backups'

    result = module.backup_database(str(db), str(backups), keep=2)
    assert Path(result['database_backup']).is_file()
    verify(result['database_backup'])

    # Exercise the Python 3.6 path directly: sqlite3 CLI when present, else iterdump.
    fallback = root / 'fallback.db'
    module._fallback_backup(db, fallback)
    verify(fallback)

    # Rotation must drop the oldest snapshots and tolerate missing key files.
    (backups / 'math-20200101-000000Z.db').write_bytes(b'old')
    (backups / 'math-20200102-000000Z.db').write_bytes(b'old')
    module.backup_database(str(db), str(backups), keep=2)
    remaining = sorted(path.name for path in backups.glob('math-*.db'))
    assert len(remaining) == 2, remaining

print('Backup creation, fallback and rotation checks passed.')
