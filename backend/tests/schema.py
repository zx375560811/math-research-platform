"""Validate the embedded SQL and repeat startup without resetting edits."""
import ast
import re
import sqlite3
from pathlib import Path

header = (Path(__file__).resolve().parents[1] / 'src/schema.h').read_text(encoding='utf-8')
sql = ''.join(ast.literal_eval(s) for s in re.findall(r'"(?:\\.|[^"\\])*"', header))
with sqlite3.connect(':memory:') as db:
    db.executescript(sql)
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
