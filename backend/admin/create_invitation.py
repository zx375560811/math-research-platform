"""Server administrator only: issue random, single-use registration invitations."""
import argparse
import hashlib
import secrets
import sqlite3
import time
from pathlib import Path


def create_invitation(database='data/math.db', days=7):
    if not 1 <= days <= 365:
        raise ValueError('Validity must be between 1 and 365 days')
    if not Path(database).is_file():
        raise ValueError('Start the updated server once to initialize invitations')
    code = secrets.token_urlsafe(32)
    digest = hashlib.sha256(code.encode('ascii')).hexdigest()
    with sqlite3.connect(database, timeout=10) as db:
        db.execute('PRAGMA foreign_keys=ON')
        if not db.execute("SELECT 1 FROM account_migrations WHERE name='invite_only_v1'").fetchone():
            raise ValueError('Start the updated server once before issuing invitations')
        db.execute('INSERT INTO invitations(code_hash,expires_at) VALUES(?,?)', (digest, int(time.time()) + days * 86400))
    return code


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate one single-use registration invitation; only its SHA-256 hash is stored.')
    parser.add_argument('--database', default='data/math.db')
    parser.add_argument('--days', type=int, default=7)
    args = parser.parse_args()
    try:
        print(create_invitation(args.database, args.days))
    except (ValueError, sqlite3.Error) as error:
        parser.exit(1, str(error) + '\n')
