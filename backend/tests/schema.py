"""Validate the embedded SQL and repeat startup without resetting edits."""
import ast
import re
import sqlite3
from pathlib import Path

sql = (Path(__file__).resolve().parents[1] / 'src/main/resources/schema.sql').read_text(encoding='utf-8')
with sqlite3.connect(':memory:') as db:
    db.executescript(sql)
    db.executescript((Path(__file__).resolve().parents[1] / 'src/main/resources/learning.sql').read_text(encoding='utf-8'))
    assert db.execute('SELECT COUNT(*) FROM learning_books').fetchone()[0] == 48
    coverage = db.execute("SELECT direction,stage,COALESCE(language,'en') FROM learning_books b LEFT JOIN learning_book_details d ON d.book_id=b.id").fetchall()
    assert len(set(coverage)) == 8 * 3 * 2
    db.execute("UPDATE learning_books SET title='管理员修改' WHERE id=7")
    db.commit()
    db.executescript((Path(__file__).resolve().parents[1] / 'src/main/resources/learning.sql').read_text(encoding='utf-8'))
    assert db.execute('SELECT title FROM learning_books WHERE id=7').fetchone()[0] == '管理员修改'
    assert db.execute('SELECT COUNT(*) FROM subjects').fetchone()[0] == 5
    db.execute("UPDATE subjects SET name = '代数研究' WHERE id = 1")
    db.commit()
    db.executescript(sql)
    assert db.execute('SELECT COUNT(*) FROM subjects').fetchone()[0] == 5
    assert db.execute('SELECT name FROM subjects WHERE id = 1').fetchone()[0] == '代数研究'
    db.execute("INSERT INTO documents(title,authors,file_path,file_size) VALUES ('测试文献','作者','data/files/test',10)")
    db.execute('INSERT INTO document_subjects VALUES (1,1)')
    db.execute('INSERT INTO document_subjects VALUES (1,2)')
    db.commit()
    db.executescript(sql)
    assert db.execute('SELECT COUNT(*) FROM documents').fetchone()[0] == 1
    assert db.execute('SELECT COUNT(*) FROM document_subjects').fetchone()[0] == 2
    try:
        db.execute('INSERT INTO document_subjects VALUES (1,999)')
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError('Unknown subjects must be rejected')
    try:
        db.execute("INSERT INTO subjects(slug,name) VALUES ('algebra','重复')")
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError('Duplicate slugs must be rejected')
print('Schema initialization, restart preservation and uniqueness checks passed.')
