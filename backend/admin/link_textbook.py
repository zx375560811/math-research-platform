"""Bind a curated textbook to an existing administrator-imported library PDF."""
import argparse
import sqlite3
from pathlib import Path


def link_textbook(book, document, database='data/math.db'):
    if not Path(database).is_file():
        raise ValueError('Start the updated server once')
    with sqlite3.connect(database, timeout=10) as db:
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT document_id FROM learning_books WHERE id=?', (book,)).fetchone()
        if not row:
            raise ValueError('Unknown textbook ID')
        if row[0] is not None and row[0] != document:
            raise ValueError('This textbook already has a PDF; changing it would invalidate reading positions and annotations')
        if not db.execute('SELECT 1 FROM documents WHERE id=?', (document,)).fetchone():
            raise ValueError('Unknown library document ID')
        db.execute('UPDATE learning_books SET document_id=? WHERE id=?', (document, book))
        if db.execute("SELECT 1 FROM sqlite_master WHERE name='document_catalog'").fetchone():
            db.execute('INSERT OR IGNORE INTO document_catalog(document_id) VALUES(?)', (document,))
            db.execute('INSERT OR IGNORE INTO document_directions SELECT ?,direction FROM learning_books WHERE id=?', (document, book))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('book', type=int)
    parser.add_argument('document', type=int)
    parser.add_argument('--database', default='data/math.db')
    args = parser.parse_args()
    try:
        link_textbook(args.book, args.document, args.database)
        print('Textbook linked')
    except (ValueError, sqlite3.Error) as error:
        parser.exit(1, str(error) + '\n')
