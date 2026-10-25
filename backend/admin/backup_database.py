"""Online hot backup for SQLite database and AI encryption key with rotation."""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import os
from pathlib import Path
import shutil
import sqlite3


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
    temp = dest_dir / f'.math-{stamp}.db.tmp'
    try:
        with closing(sqlite3.connect(str(src), timeout=10)) as source_db, \
                closing(sqlite3.connect(str(temp), timeout=10)) as backup_db:
            source_db.backup(backup_db)
        if os.name != 'nt':
            temp.chmod(0o600)
        temp.replace(target)
    finally:
        if temp.exists():
            temp.unlink()

    key_file = src.parent / 'ai-secret.key'
    key_backup = None
    if key_file.is_file():
        key_backup = dest_dir / f'math-{stamp}.ai-secret.key'
        shutil.copy2(key_file, key_backup)
        if os.name != 'nt':
            key_backup.chmod(0o600)

    snapshots = sorted(dest_dir.glob('math-*.db'))
    for old in snapshots[:-keep]:
        old.unlink(missing_ok=True)
        old_key = old.with_suffix('.ai-secret.key')
        old_key.unlink(missing_ok=True)

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
