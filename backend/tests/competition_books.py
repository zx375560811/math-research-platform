"""Local competition books: large PDFs and one volume shared by two courses."""
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
from import_competition_books import apply, classify, preview


def main():
    previous = Path.cwd()
    with tempfile.TemporaryDirectory() as temporary:
        try:
            os.chdir(temporary)
            Path('data/files').mkdir(parents=True)
            original = b'%PDF-1.4\nExisting analysis volume\n'
            Path('data/files/upload-original').write_bytes(original)
            source = Path('imports/数学竞赛'); source.mkdir(parents=True)
            upper = source / '全国大学生数学竞赛解析教程(上册)——数学分析 (Z-Library).pdf'
            lower = source / '全国大学生数学竞赛解析教程(下册)——高等代数与解析几何.pdf'
            upper.write_bytes(original)
            with lower.open('wb') as stream:
                stream.write(b'%PDF-1.4\nCombined algebra and geometry volume\n')
                stream.truncate(21 * 1024 * 1024)
            with closing(sqlite3.connect('data/math.db')) as db:
                db.executescript((backend / 'src/main/resources/schema.sql').read_text(encoding='utf-8'))
                db.execute("INSERT INTO documents(id,title,authors,file_path,file_size) VALUES(41,'Original title','Author','data/files/upload-original',?)", (len(original),))
                db.execute("INSERT INTO users(username,password_hash) VALUES('reader','test')")
                db.execute("INSERT INTO document_progress(username,document_id,page,total_pages) VALUES('reader',41,3,12)")
                db.commit()
                plan = preview(source)
                assert plan['summary']['files'] == 2
                assert plan['summary']['courses'] == {'数学分析':1,'高等代数':1,'解析几何':1}
                assert all('(Z-Library)' not in row['title'] for row in plan['documents'])
                with redirect_stdout(io.StringIO()):
                    first = apply(plan)
                    again = apply(preview(source))
                assert first['new_documents'] == 1 and first['new_course_links'] == 3
                assert again['new_documents'] == 0 and again['new_course_links'] == 0
                linked = db.execute("SELECT document_id FROM competition_books WHERE course IN ('algebra','geometry')").fetchall()
                assert len(linked) == 2 and linked[0] == linked[1]
                assert db.execute('SELECT count(*) FROM ai_study_books').fetchone()[0] == 0
                assert db.execute('SELECT count(*) FROM series_documents').fetchone()[0] == 0
                assert db.execute('SELECT title FROM documents WHERE id=41').fetchone()[0] == 'Original title'
                assert db.execute('SELECT page FROM document_progress').fetchone()[0] == 3
                with mock.patch('import_series.shutil.copyfileobj', side_effect=AssertionError('Move copied a large book')):
                    with redirect_stdout(io.StringIO()):
                        moved = apply(preview(source), move=True)
                assert moved['new_documents'] == 0 and moved['source_files_removed'] == 2
                assert not upper.exists() and not lower.exists()
                assert all(Path(row[0]).exists() for row in db.execute('SELECT file_path FROM documents'))
                assert db.execute('PRAGMA foreign_key_check').fetchall() == []
                assert classify(Path('解析几何/Unknown.pdf')) == ['geometry']
                try:
                    classify(Path('Unknown.pdf'))
                    raise AssertionError('Unknown book assigned silently')
                except ValueError:
                    pass
        finally:
            os.chdir(previous)
    print('Competition textbooks: large PDF, combined-volume links, deduplication, move, namespace isolation and existing progress passed.')


if __name__ == '__main__':
    main()
