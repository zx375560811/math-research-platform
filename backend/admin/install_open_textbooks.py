"""Import two Axler open-access textbooks from their author's official website."""
import argparse
from pathlib import Path
import sqlite3
import tempfile
import urllib.request
from import_document import import_document
from link_textbook import link_textbook

BOOKS = [
    (2, 3, 'Measure, Integration & Real Analysis', 'https://measure.axler.net/MIRA.pdf'),
    (7, 1, 'Linear Algebra Done Right', 'https://linear.axler.net/LADR4e.pdf'),
]


def install(database):
    if not Path(database).is_file():
        raise ValueError('Start the updated server once')
    for book, subject, title, url in BOOKS:
        with sqlite3.connect(database) as db:
            row = db.execute('SELECT document_id FROM learning_books WHERE id=?', (book,)).fetchone()
        if not row:
            raise ValueError('Start the updated server once to initialize the learning catalog')
        if row[0] is not None:
            print(title + ': already linked')
            continue
        with tempfile.TemporaryDirectory(prefix='math-open-book-') as directory:
            source = Path(directory) / 'book.pdf'
            request = urllib.request.Request(url, headers={'User-Agent': 'MathResearchPlatform/1.0'})
            with urllib.request.urlopen(request, timeout=60) as response, source.open('wb') as output:
                while True:
                    chunk = response.read(65536)
                    if not chunk:
                        break
                    output.write(chunk)
            result = import_document(source, title, 'Sheldon Axler', subject, database)
            link_textbook(book, result['id'], database)
        print(title + ': ready to read')
    print('Author and source links are shown with each textbook. Retain the original PDF and its license; these open editions are for noncommercial use.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', default='data/math.db')
    args = parser.parse_args()
    try:
        install(args.database)
    except (ValueError, sqlite3.Error, OSError) as error:
        parser.exit(1, str(error) + '\n')
