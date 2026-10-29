"""Online hot backup for SQLite database and AI encryption key with rotation."""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess


def _sqlite_cli_backup(src, target):
    """Use the sqlite3 shell's online backup API when Python lacks it (<3.7)."""
    executable = shutil.which('sqlite3')
    if not executable or "'" in str(src) or "'" in str(target):
        return False
    result = subprocess.run(
        [executable, str(src)],
        input=".backup '{}'\n".format(target),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
    if result.returncode == 0 and target.is_file():
        return True
    if target.exists():
        target.unlink()
    return False


def _fallback_backup(src, target):
    if _sqlite_cli_backup(src, target):
        return
    if sqlite3.sqlite_version_info >= (3, 27, 0):
        with closing(sqlite3.connect(str(src), timeout=10)) as source:
            source.execute('VACUUM INTO ?', (str(target),))
        return
    raise OSError('Python without sqlite3.Connection.backup needs the sqlite3 CLI or SQLite 3.27+')


def backup_database(database='data/math.db', output_dir='data/backups', keep=14):
    if keep < 1:
        raise ValueError('keep must be at least 1')
    src = Path(database)
    if not src.is_file():
        raise ValueError('Database does not exist: {}'.format(src))
    dest_dir = Path(output_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%SZ')
    target = dest_dir / f'math-{stamp}.db'
    sequence = 1
    while target.exists():
        target = dest_dir / f'math-{stamp}-{sequence}.db'
        sequence += 1
    temp = dest_dir / ('.' + target.name + '.tmp')
    try:
        if hasattr(sqlite3.Connection, 'backup'):
            with closing(sqlite3.connect(str(src), timeout=10)) as source_db, \
                    closing(sqlite3.connect(str(temp), timeout=10)) as backup_db:
                source_db.backup(backup_db)
        else:
            _fallback_backup(src, temp)
        if os.name != 'nt':
            temp.chmod(0o600)
        temp.replace(target)
    finally:
        if temp.exists():
            temp.unlink()

    key_file = src.parent / 'ai-secret.key'
    key_backup = None
    if key_file.is_file():
        key_backup = target.with_suffix('.ai-secret.key')
        shutil.copy2(key_file, key_backup)
        if os.name != 'nt':
            key_backup.chmod(0o600)

    snapshots = sorted(dest_dir.glob('math-*.db'))
    for old in snapshots[:-keep]:
        try:
            old.unlink()
        except FileNotFoundError:
            pass
        old_key = old.with_suffix('.ai-secret.key')
        try:
            old_key.unlink()
        except FileNotFoundError:
            pass

    return {'database_backup': str(target), 'key_backup': str(key_backup) if key_backup else None}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', default=os.getenv('MATH_DB_PATH') or 'data/math.db')
    parser.add_argument('--output-dir', default='data/backups')
    parser.add_argument('--keep', type=int, default=14)
    args = parser.parse_args()
    try:
        result = backup_database(args.database, args.output_dir, args.keep)
        print('Backup created: {}'.format(result['database_backup']))
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.exit(1, 'Backup failed: {}\n'.format(error))
