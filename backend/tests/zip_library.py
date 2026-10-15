"""ZIP inspection must match bytes, never names, and must not extract archives."""
from contextlib import closing, redirect_stdout
import io
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'admin'))
from check_zip_library import check


def main():
    previous = Path.cwd()
    with tempfile.TemporaryDirectory() as temporary:
        try:
            os.chdir(temporary)
            Path('data/files').mkdir(parents=True)
            content = b'%PDF-1.4\nactual stored bytes\n'
            Path('data/files/upload-book').write_bytes(content)
            with closing(sqlite3.connect('data/math.db')) as db:
                db.execute('CREATE TABLE documents(id INTEGER PRIMARY KEY,file_path TEXT,file_size INTEGER)')
                db.execute('INSERT INTO documents VALUES(1,?,?)', ('data/files/upload-book',len(content)))
                db.commit()
            with zipfile.ZipFile('books.zip','w',zipfile.ZIP_DEFLATED) as archive:
                archive.writestr('different-name.pdf',content)
                archive.writestr('../escape.pdf',b'%PDF-1.4\nunmatched book\n')
                archive.writestr('notes.txt','Keep me')
            before = {p.as_posix():p.read_bytes() for p in Path('.').rglob('*') if p.is_file()}
            with redirect_stdout(io.StringIO()):
                result = check('books.zip')
            assert result['matched']==1 and result['unmatched']==1 and result['other_files']==1
            assert result['matched_documents'][0]['document_ids']==[1]
            assert not result['all_documents_present'] and not Path('../escape.pdf').exists()
            assert before == {p.as_posix():p.read_bytes() for p in Path('.').rglob('*') if p.is_file()}
            with zipfile.ZipFile('duplicate.zip','w') as archive:
                archive.writestr('another-name.djvu',content)
            with redirect_stdout(io.StringIO()):
                assert check('duplicate.zip')['all_documents_present']
        finally:
            os.chdir(str(previous))
    print('ZIP library verification: content hashes, missing books, extra files and no extraction/writes passed.')


if __name__ == '__main__':
    main()
