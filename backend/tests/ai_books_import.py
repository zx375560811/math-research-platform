"""Course book imports must be additive, idempotent, shared and space efficient."""
from contextlib import closing, redirect_stdout
import io
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
from unittest import mock

backend = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend / 'admin'))
from import_ai_books import apply, classify, preview


def main():
    previous = Path.cwd()
    with tempfile.TemporaryDirectory() as temporary:
        try:
            os.chdir(temporary)
            Path('data/files').mkdir(parents=True)
            with closing(sqlite3.connect('data/math.db')) as db:
                db.executescript((backend / 'src/main/resources/schema.sql').read_text(encoding='utf-8'))
                old = b'%PDF-1.4\nold shared textbook\n'
                Path('data/files/upload-old').write_bytes(old)
                db.execute("INSERT INTO documents(id,title,file_path,file_size) VALUES(100,'Existing book','data/files/upload-old',?)", (len(old),))
                db.execute("INSERT INTO users(username,password_hash) VALUES('reader','test')")
                db.execute("INSERT INTO document_progress(username,document_id,page,total_pages) VALUES('reader',100,3,12)")
                db.execute("INSERT INTO study_plan(username,document_id,source) VALUES('reader',100,'library')")
                db.commit()
                source = Path('imports/AI')
                source.mkdir(parents=True)
                (source / '动手学深度学习-PyTorch.pdf').write_bytes(old)
                (source / 'Python机器学习基础教程.pdf').write_bytes(b'%PDF-1.4\nnew ML book\n')
                (source / 'Hands-On Large Language Models.pdf').write_bytes(b'%PDF-1.4\nnew language book\n')
                (source / '概率论与数理统计教程习题与解答.pdf').write_bytes(b'%PDF-1.4\nprobability exercises\n')
                (source / 'Readme.txt').write_text('ignored')
                plan = preview(source)
                assert plan['summary']['files'] == 4 and plan['summary']['skipped'] == 1
                with redirect_stdout(io.StringIO()):
                    result = apply(plan)
                    retried = apply(preview(source))
                assert result['new_documents'] == 3 and result['new_course_links'] == 7
                assert retried['new_documents'] == 0 and retried['new_course_links'] == 0
                assert db.execute('SELECT count(*) FROM documents').fetchone()[0] == 4
                assert db.execute('SELECT count(*) FROM series_documents').fetchone()[0] == 0
                assert db.execute('SELECT page FROM document_progress').fetchone()[0] == 3
                assert db.execute('SELECT document_id FROM study_plan').fetchone()[0] == 100
                assert db.execute('SELECT count(*) FROM ai_study_books WHERE document_id=100').fetchone()[0] == 3
                assert db.execute('SELECT count(*) FROM document_collections WHERE document_id=100').fetchone()[0] == 3
                assert db.execute("SELECT count(*) FROM library_collections WHERE parent_id IS NULL AND name='人工智能'").fetchone()[0] == 1
                with mock.patch('import_series.shutil.copyfileobj', side_effect=AssertionError('Copied a textbook')):
                    with redirect_stdout(io.StringIO()):
                        result = apply(preview(source), move=True)
                assert result['new_documents'] == 0 and result['source_files_removed'] == 4
                assert result['source_cleanup_pending'] == []
                assert (source / 'Readme.txt').exists() and Path('data/files/upload-old').read_bytes() == old
                assert db.execute('PRAGMA foreign_key_check').fetchall() == []
                assert classify(Path('LLM/入门/未知标题.pdf')) == ['llm']
                try:
                    classify(Path('未知标题.pdf'))
                    raise AssertionError('Unknown title assigned silently')
                except ValueError:
                    pass
        finally:
            os.chdir(str(previous))
    print('AI books: flat names, shared courses, duplicate reuse, retry, move, directory links and existing plans/progress passed.')


if __name__ == '__main__':
    main()
