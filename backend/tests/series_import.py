"""Verify additive series import, duplicate reuse, rollback and old reading records."""
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
from unittest import mock

backend = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend / 'admin'))
from import_series import apply, preview


def main():
    previous = Path.cwd()
    with tempfile.TemporaryDirectory() as temporary:
        os.chdir(temporary)
        try:
            Path('data/files').mkdir(parents=True)
            db = sqlite3.connect('data/math.db')
            db.executescript((backend / 'src/main/resources/schema.sql').read_text(encoding='utf-8'))
            old = b'%PDF-1.4\nold preserved book\n'
            Path('data/files/old').write_bytes(old)
            db.execute("INSERT INTO documents(id,title,file_path,file_size) VALUES(100,'Old book','data/files/old',?)", (len(old),))
            db.execute("INSERT INTO users(username,password_hash) VALUES('reader','test')")
            db.execute("INSERT INTO document_progress(username,document_id,page,total_pages) VALUES('reader',100,3,12)")
            db.execute("INSERT INTO document_marks(username,document_id,page,quote,note,color) VALUES('reader',100,3,'quote','private note','yellow')")
            db.commit()
            source = Path('imports/series')
            gsm = source / 'Graduate Studies in Mathematics(GSM)' / 'Subfolder'
            gtm = source / 'Graduate Texts in Mathematics(GTM)'
            gsm.mkdir(parents=True)
            gtm.mkdir(parents=True)
            (gsm / 'New (Z-Library).pdf').write_bytes(b'%PDF-1.4\nnew book\n')
            (gtm / 'Duplicate.pdf').write_bytes(b'%PDF-1.4\nnew book\n')
            (gtm / 'Old.pdf').write_bytes(old)
            (gtm / 'Native.djvu').write_bytes(b'AT&TFORM\x00\x00\x00\x04DJVU')
            (gtm / 'Readme.txt').write_text('ignored')
            plan = preview(source)
            assert plan['summary']['files'] == 4 and plan['summary']['skipped'] == 1
            assert db.execute('SELECT COUNT(*) FROM documents').fetchone()[0] == 1
            result = apply(plan)
            assert result['new_documents'] == 2 and result['new_series_links'] == 4
            assert db.execute('SELECT COUNT(*) FROM documents').fetchone()[0] == 3
            assert db.execute("SELECT COUNT(*) FROM documents WHERE title='New'").fetchone()[0] == 1
            assert db.execute('SELECT page FROM document_progress').fetchone()[0] == 3
            assert db.execute('SELECT note FROM document_marks').fetchone()[0] == 'private note'
            assert Path('data/files/old').read_bytes() == old
            assert db.execute("SELECT COUNT(*) FROM document_formats WHERE format='djvu'").fetchone()[0] == 1
            assert db.execute("SELECT COUNT(*) FROM library_collections WHERE name='Subfolder'").fetchone()[0] == 1
            count = db.execute('SELECT COUNT(*) FROM learning_books').fetchone()[0]
            assert apply(preview(source))['new_documents'] == 0
            assert apply(preview(source))['new_series_links'] == 0
            assert db.execute('SELECT COUNT(*) FROM learning_books').fetchone()[0] == count
            (gsm / 'Another.pdf').write_bytes(b'%PDF-1.4\nplanned content\n')
            changed = preview(source)
            (gsm / 'Another.pdf').write_bytes(b'%PDF-1.4\nchanged content\n')
            before_files = set(Path('data/files').iterdir())
            try:
                apply(changed)
                raise AssertionError('Changed source was accepted')
            except ValueError as error:
                assert 'Source changed' in str(error)
            assert set(Path('data/files').iterdir()) == before_files
            assert db.execute('SELECT COUNT(*) FROM documents').fetchone()[0] == 3
            assert db.execute('PRAGMA foreign_key_check').fetchall() == []
            (gsm / 'Another.pdf').unlink()
            moving = gsm / 'Move.pdf'
            moving.write_bytes(b'%PDF-1.4\nspace saving move\n')
            inode = os.stat(str(moving)).st_ino
            # This mode must not silently fall back to copying file payloads.
            with mock.patch('import_series.shutil.copyfileobj', side_effect=AssertionError('Copied a book')):
                result = apply(preview(source), move=True)
            assert result['new_documents'] == 1 and result['source_files_removed'] == 5
            assert result['source_cleanup_pending'] == [] and not moving.exists()
            stored = db.execute("SELECT file_path FROM documents WHERE title='Move'").fetchone()[0]
            assert os.stat(stored).st_ino == inode and Path(stored).read_bytes() == b'%PDF-1.4\nspace saving move\n'
            assert (gtm / 'Readme.txt').exists() and Path('data/files/old').read_bytes() == old
            assert db.execute('SELECT page FROM document_progress').fetchone()[0] == 3
            assert db.execute('SELECT note FROM document_marks').fetchone()[0] == 'private note'
            assert db.execute('SELECT COUNT(*) FROM documents').fetchone()[0] == 4
            # Failure after one staging link must retain all source files and roll back.
            first, second = gsm / 'A.pdf', gsm / 'B.pdf'
            first.write_bytes(b'%PDF-1.4\nrollback A\n')
            second.write_bytes(b'%PDF-1.4\nrollback B\n')
            before_files = set(Path('data/files').iterdir())
            original_link = os.link
            calls = []
            def fail_second(*args, **kwargs):
                calls.append(args)
                if len(calls) == 2:
                    raise OSError('Simulated hard-link failure')
                return original_link(*args, **kwargs)
            with mock.patch('import_series.os.link', side_effect=fail_second):
                try:
                    apply(preview(source), move=True)
                    raise AssertionError('Link failure was accepted')
                except OSError:
                    pass
            assert first.exists() and second.exists()
            assert set(Path('data/files').iterdir()) == before_files
            assert db.execute('SELECT COUNT(*) FROM documents').fetchone()[0] == 4
            assert db.execute('PRAGMA foreign_key_check').fetchall() == []
            original_unlink = Path.unlink
            def retain_first(path, *args, **kwargs):
                if path.resolve() == first.resolve():
                    raise PermissionError('Simulated source cleanup denial')
                return original_unlink(path, *args, **kwargs)
            with mock.patch.object(Path, 'unlink', retain_first):
                result = apply(preview(source), move=True)
            assert result['new_documents'] == 2 and result['source_files_removed'] == 1
            assert result['source_cleanup_pending'] == [first.relative_to(source).as_posix()]
            assert first.exists() and not second.exists()
            assert db.execute('SELECT COUNT(*) FROM documents').fetchone()[0] == 6
            retried = apply(preview(source), move=True)
            assert retried['new_documents'] == 0 and retried['new_series_links'] == 0
            assert retried['source_files_removed'] == 1 and not first.exists()
            db.close()
        finally:
            os.chdir(str(previous))
    print('Series import: append, hierarchy, PDF/DJVU, reuse, move without copying, source preservation on failure, reading records and rollback passed.')


if __name__ == '__main__':
    main()
