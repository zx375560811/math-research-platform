"""Server owner: grant or revoke administrator access for an existing account."""
import argparse
from pathlib import Path
import re
import sqlite3


def grant_admin(username, database='data/math.db', revoke=False):
    if not re.fullmatch(r'[A-Za-z0-9_]{3,32}', username):
        raise ValueError('Invalid username')
    if not Path(database).is_file():
        raise ValueError('Start the updated server first')
    name = username.lower()
    with sqlite3.connect(database, timeout=10) as db:
        db.execute('PRAGMA foreign_keys=ON')
        if not db.execute('SELECT 1 FROM users WHERE username=?', (name,)).fetchone():
            raise ValueError('Account does not exist: register with an invitation first')
        if revoke:
            db.execute('DELETE FROM administrators WHERE username=?', (name,))
        else:
            db.execute('INSERT OR IGNORE INTO administrators(username) VALUES(?)', (name,))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('username')
    parser.add_argument('--database', default='data/math.db')
    parser.add_argument('--revoke', action='store_true')
    args = parser.parse_args()
    try:
        grant_admin(args.username, args.database, args.revoke)
        print('Administrator access revoked' if args.revoke else 'Administrator access granted; log out and log in again')
    except (ValueError, sqlite3.Error) as error:
        parser.exit(1, str(error) + '\n')
