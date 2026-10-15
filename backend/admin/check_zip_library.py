"""Compare archived PDFs/DJVUs against stored bytes without extracting or changing them.

Run from backend. SQLite is opened read-only; only the optional JSON report is written.
Names are not used for matching, so legacy ZIP filename encoding does not affect hashes.
"""
import argparse
from collections import defaultdict
from contextlib import closing
import hashlib
import json
from pathlib import Path
import sqlite3
import zipfile


def digest(stream):
    value = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        value.update(block)
    return value.hexdigest()


def inside(path, root):
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def check(archive, database='data/math.db'):
    workspace = Path.cwd().resolve()
    storage = workspace / 'data' / 'files'
    database = Path(database).resolve(strict=True)
    with zipfile.ZipFile(str(archive)) as zipped, closing(sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)) as db:
        entries = [item for item in zipped.infolist() if not item.is_dir()]
        documents = [item for item in entries if Path(item.filename).suffix.lower() in ('.pdf', '.djvu', '.djv')]
        others = [item.filename for item in entries if item not in documents]
        sizes = {item.file_size for item in documents}
        known = defaultdict(list)
        unavailable = []
        print('Checking library candidates by size and SHA-256...', flush=True)
        rows = db.execute('SELECT id,file_path,file_size FROM documents').fetchall()
        for doc, stored, size in rows:
            if size not in sizes:
                continue
            path = Path(stored)
            path = path if path.is_absolute() else workspace / path
            try:
                if path.is_symlink() or not inside(path, storage) or not path.is_file() or path.stat().st_size != size:
                    raise ValueError('Missing or unmanaged stored file')
                with path.open('rb') as stream:
                    checksum = digest(stream)
                known[(size, checksum)].append(doc)
            except (OSError, ValueError):
                unavailable.append(doc)
        matched, unmatched, errors = [], [], []
        for index, item in enumerate(documents, 1):
            try:
                with zipped.open(item) as stream:
                    checksum = digest(stream)
                ids = known.get((item.file_size, checksum), [])
                row = {'name': item.filename, 'size': item.file_size, 'sha256': checksum}
                if ids:
                    row['document_ids'] = ids
                    matched.append(row)
                else:
                    unmatched.append(row)
            except (OSError, RuntimeError, ValueError, NotImplementedError, zipfile.BadZipFile) as error:
                errors.append({'name': item.filename, 'error': str(error)})
            if index % 25 == 0:
                print('Checked {}/{} archived documents'.format(index, len(documents)), flush=True)
        return {'archive': str(Path(archive).resolve()), 'documents': len(documents),
                'matched': len(matched), 'unmatched': len(unmatched), 'errors': len(errors),
                'other_files': len(others), 'all_documents_present': bool(documents) and not unmatched and not errors,
                'matched_documents': matched, 'unmatched_documents': unmatched,
                'read_errors': errors, 'other_file_names': others, 'unavailable_library_candidates': unavailable}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive')
    parser.add_argument('--database', default='data/math.db')
    parser.add_argument('--report', help='Optional report path, for example data/zip-library-check.json')
    args = parser.parse_args()
    try:
        result = check(args.archive, args.database)
        if args.report:
            report = Path(args.report)
            if report.resolve() in (Path(args.archive).resolve(), Path(args.database).resolve()) or inside(report, Path('data/files')):
                raise ValueError('Report must not overwrite source, database or managed files')
            report.parent.mkdir(parents=True, exist_ok=True)
            report.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        summary = {key: result[key] for key in ('documents', 'matched', 'unmatched', 'errors', 'other_files', 'all_documents_present')}
        summary['unmatched_names'] = [row['name'] for row in result['unmatched_documents'][:20]]
        summary['other_file_names'] = result['other_file_names'][:20]
        summary['read_errors'] = result['read_errors'][:20]
        if args.report:
            summary['report'] = args.report
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    except (OSError, ValueError, RuntimeError, sqlite3.Error, zipfile.BadZipFile) as error:
        parser.exit(1, 'ZIP check failed: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
