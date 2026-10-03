"""Server administrator only: import into the existing library without an HTTP write API."""
import argparse
import json
import os
from pathlib import Path
import sqlite3
import tempfile


def metadata(value, required=False):
    if len(value.encode('utf-8')) > 500 or any(ord(c) < 32 or ord(c) == 127 for c in value) or (required and not value.strip()):
        raise ValueError('Invalid title/authors: up to 500 UTF-8 bytes, no control characters')
    return value


def import_document(source, title, authors, subject, database='data/math.db'):
    metadata(title, True)
    metadata(authors)
    db_path = Path(database)
    if not db_path.is_file():
        raise ValueError('Start math-server once to initialize the database')
    saved_path = None
    committed = False
    with sqlite3.connect(str(db_path), timeout=3) as db:
        db.execute('PRAGMA foreign_keys=ON')
        if not db.execute('SELECT 1 FROM subjects WHERE id=?', (subject,)).fetchone():
            raise ValueError('Unknown subject')
        try:
            with Path(source).open('rb') as original:
                if original.read(5) != b'%PDF-':
                    raise ValueError('File must have a PDF header')
                original.seek(0)
                with tempfile.NamedTemporaryFile(prefix='upload-', dir='data/files', delete=False) as output:
                    saved_path = Path(output.name)
                    size = 0
                    while True:
                        chunk = original.read(65536)
                        if not chunk:
                            break
                        size += len(chunk)
                        if size > 20 * 1024 * 1024:
                            raise ValueError('PDF exceeds 20 MB')
                        output.write(chunk)
                    output.flush()
                    os.fsync(output.fileno())
            # Preserve the existing storage naming convention and document IDs.
            stored = 'data/files/' + saved_path.name
            db.execute('BEGIN IMMEDIATE')
            cursor = db.execute('INSERT INTO documents(title,authors,file_path,file_size) VALUES(?,?,?,?)', (title, authors, stored, size))
            doc_id = cursor.lastrowid
            db.execute('INSERT INTO document_subjects(document_id,subject_id) VALUES(?,?)', (doc_id, subject))
            if db.execute("SELECT 1 FROM sqlite_master WHERE name='document_catalog'").fetchone():
                db.execute('INSERT INTO document_catalog(document_id) VALUES(?)', (doc_id,))
                db.execute('INSERT OR IGNORE INTO document_directions SELECT ?,d.slug FROM subjects s JOIN learning_directions d ON d.slug=s.slug WHERE s.id=?', (doc_id, subject))
            db.commit()
            committed = True
            return {'id': doc_id, 'file_url': '/api/documents/{}/file'.format(doc_id)}
        finally:
            if saved_path and not committed:
                saved_path.unlink()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf')
    parser.add_argument('--title', required=True)
    parser.add_argument('--authors', default='')
    parser.add_argument('--subject-id', type=int, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(import_document(args.pdf, args.title, args.authors, args.subject_id, os.getenv('MATH_DB_PATH') or 'data/math.db'), ensure_ascii=False))
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.exit(1, 'Import failed: {}\n'.format(error))
