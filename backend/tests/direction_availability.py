"""Count actual direction documents without removing reserved classifications."""
import ast
import re
import sqlite3
from pathlib import Path

backend = Path(__file__).resolve().parents[1]
source = (backend / 'src/main/java/org/mathplatform/LearningRepository.java').read_text(encoding='utf-8')
method = source.split('public List<Map<String, Object>> directions()', 1)[1].split('return values;', 1)[0]
expression = re.search(r'String sql = (.*?);', method, re.S).group(1)
query = ''.join(ast.literal_eval(literal) for literal in re.findall(r'"(?:[^"\\]|\\.)*"', expression))
with sqlite3.connect(':memory:') as db:
    db.execute('PRAGMA foreign_keys=ON')
    for name in ['schema.sql', 'learning.sql', 'learning-courses.sql']:
        db.executescript((backend / 'src/main/resources' / name).read_text(encoding='utf-8'))
    db.row_factory = sqlite3.Row
    def counts():
        return {row['slug']: row['document_count'] for row in db.execute(query)}
    assert len(counts()) == 8 and not any(counts().values()), 'Seeded book titles are not documents'
    db.execute("INSERT INTO documents(id,title,authors,file_path,file_size) VALUES(1,'Real document','Author','data/files/test',10)")
    db.execute("INSERT INTO document_directions VALUES(1,'analysis')")
    db.execute("INSERT INTO document_directions VALUES(1,'algebra')")
    db.execute("UPDATE learning_books SET document_id=1 WHERE direction='algebra'")
    assert counts()['analysis'] == counts()['algebra'] == 1, 'One document is not counted again for each textbook'
    db.execute("INSERT INTO documents(id,title,authors,file_path,file_size) VALUES(2,'Second document','Author','data/files/test2',10)")
    db.execute("UPDATE learning_books SET document_id=2 WHERE id=7")
    assert counts()['algebra'] == 2, 'Legacy textbook links also count'
    assert counts()['geometry-topology'] == 0
    db.execute('DELETE FROM documents')
    assert not any(counts().values()) and len(counts()) == 8, 'Removing documents preserves reserved directions'
print('Direction document availability checks passed.')
