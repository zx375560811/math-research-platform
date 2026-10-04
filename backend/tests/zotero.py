"""Zotero imports: classification, large files, provenance, resume and atomic failure cleanup."""
from contextlib import closing
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import tempfile

backend = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('import_zotero', backend / 'admin/import_zotero.py')
zotero = importlib.util.module_from_spec(spec); spec.loader.exec_module(zotero)
original = Path.cwd().resolve()


def database(path):
    with closing(sqlite3.connect(path)) as db:
        db.executescript((backend / 'src/main/resources/schema.sql').read_text(encoding='utf-8'))
        db.executescript((backend / 'src/main/resources/learning.sql').read_text(encoding='utf-8'))
        db.execute("INSERT INTO documents VALUES(1,'Existing title','Existing author','data/files/legacy',20,'2026-01-01')")
        db.execute("INSERT INTO document_subjects VALUES(1,1)")
        db.execute("INSERT INTO document_catalog VALUES(1,'mathematics','en')")
        db.execute("INSERT INTO document_directions VALUES(1,'algebra')")
        db.execute("UPDATE learning_books SET document_id=1 WHERE id=7")
        db.execute("INSERT INTO users(username,password_hash) VALUES('reader','stored-password-hash')")
        db.execute("INSERT INTO document_progress(username,document_id,page,total_pages,position,zoom) VALUES('reader',1,4,10,.3,1.2)")
        db.commit()


with tempfile.TemporaryDirectory(dir=original, prefix='zotero-test-') as folder:
    root = Path(folder).resolve()
    assert zotero.within(root, original)
    assert zotero.within(root, root)
    assert not zotero.within(root.parent / (root.name + '-outside'), root)
    try:
        os.chdir(root)
        Path('data/files').mkdir(parents=True)
        export = root / 'export'; (export / 'files').mkdir(parents=True)
        small = b'%PDF-1.4\nexisting\n'
        Path('data/files/legacy').write_bytes(small)
        (export / 'files/book.pdf').write_bytes(small)
        (export / 'files/duplicate.PDF').write_bytes(small)
        with (export / 'files/中文讲义.pdf').open('wb') as output:
            output.write(b'%PDF-1.4\n')
            for _ in range(21): output.write(b'x' * 1024**2)
        (export / 'files/invalid.pdf').write_bytes(b'not a PDF')
        (export / 'files/other.djvu').write_bytes(b'DJVU')
        rdf = export / 'collection.rdf'
        rdf.write_text('''<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
          xmlns:z="http://www.zotero.org/namespaces/export#" xmlns:dc="http://purl.org/dc/elements/1.1/"
          xmlns:link="http://purl.org/rss/1.0/modules/link/" xmlns:dcterms="http://purl.org/dc/terms/"
          xmlns:bib="http://purl.org/net/biblio#" xmlns:foaf="http://xmlns.com/foaf/0.1/">
          <bib:Book rdf:about="book"><z:itemType>book</z:itemType><dc:title>测试书目</dc:title><z:language>zh-CN</z:language>
            <bib:authors><rdf:Seq><rdf:li><foaf:Person><foaf:givenName>甲</foaf:givenName><foaf:surname>作者</foaf:surname></foaf:Person></rdf:li></rdf:Seq></bib:authors>
            <link:link rdf:resource="a1"/></bib:Book>
          <z:Attachment rdf:about="a1"><z:itemType>attachment</z:itemType><dc:title>book.pdf</dc:title><z:path rdf:resource="files/book.pdf"/></z:Attachment>
          <z:Attachment rdf:about="a2"><z:itemType>attachment</z:itemType><dc:title>中文讲义.pdf</dc:title><z:path rdf:resource="files/中文讲义.pdf"/></z:Attachment>
          <z:Attachment rdf:about="a3"><z:itemType>attachment</z:itemType><dc:title>invalid.pdf</dc:title><z:path rdf:resource="files/invalid.pdf"/></z:Attachment>
          <z:Attachment rdf:about="a4"><z:itemType>attachment</z:itemType><dc:title>missing.pdf</dc:title><z:path rdf:resource="files/missing.pdf"/></z:Attachment>
          <z:Attachment rdf:about="a5"><z:itemType>attachment</z:itemType><dc:title>other.djvu</dc:title><z:path rdf:resource="files/other.djvu"/></z:Attachment>
          <z:Attachment rdf:about="a6"><z:itemType>attachment</z:itemType><dc:title>duplicate.PDF</dc:title><z:path rdf:resource="files/duplicate.PDF"/></z:Attachment>
          <z:Attachment rdf:about="a7"><z:itemType>attachment</z:itemType><dc:title>outside.pdf</dc:title><z:path rdf:resource="../outside.pdf"/></z:Attachment>
          <z:Collection rdf:about="c1"><dc:title>分析</dc:title><dcterms:hasPart rdf:resource="c2"/></z:Collection>
          <z:Collection rdf:about="c2"><dc:title>复分析</dc:title><dcterms:hasPart rdf:resource="book"/></z:Collection>
          <z:Collection rdf:about="c3"><dc:title>代数</dc:title><dcterms:hasPart rdf:resource="a2"/></z:Collection>
        </rdf:RDF>''', encoding='utf-8')
        value = zotero.preview(rdf)
        rows = value['documents']
        assert [r['status'] for r in rows] == ['ready','ready','failed','failed','skipped','ready','failed']
        assert rows[0]['title'] == '测试书目' and rows[0]['authors'] == '甲 作者'
        assert rows[0]['collections'] == ['分析 / 复分析'] and rows[0]['directions'] == ['analysis']
        assert rows[1]['title'] == '中文讲义' and rows[1]['language'] == 'zh' and rows[1]['size'] > 20 * 1024**2
        assert zotero.language('fr-FR','中文标题') == 'und'
        assert zotero.language('', 'Lec01.pdf') == 'und'
        assert zotero.preview(rdf, {'代数':['analysis']})['documents'][1]['directions'] == ['analysis']
        zotero.report(value, 'preview.json'); assert not Path('data/math.db').exists()
        database('data/math.db')
        result = zotero.apply(value, 'data/math.db', 'result.json')
        assert result['summary'] == {'duplicate':2, 'imported':1, 'failed':3, 'skipped':1}
        with closing(sqlite3.connect('data/math.db')) as db:
            assert db.execute('SELECT COUNT(*) FROM documents').fetchone()[0] == 2
            assert db.execute('SELECT title,authors FROM documents WHERE id=1').fetchone() == ('Existing title','Existing author')
            assert db.execute('SELECT language FROM document_catalog WHERE document_id=1').fetchone()[0] == 'en'
            assert db.execute('SELECT direction FROM document_directions WHERE document_id=1').fetchone()[0] == 'algebra'
            assert db.execute('SELECT document_id FROM learning_books WHERE id=7').fetchone()[0] == 1
            assert db.execute('SELECT page,position FROM document_progress').fetchone() == (4,.3)
            imported = db.execute('SELECT id,file_path,file_size FROM documents WHERE id<>1').fetchone()
            assert imported[2] == (export / 'files/中文讲义.pdf').stat().st_size
            assert zotero.digest(imported[1]) == zotero.digest(export / 'files/中文讲义.pdf')
            assert db.execute('SELECT language FROM document_catalog WHERE document_id=?',(imported[0],)).fetchone()[0] == 'zh'
            assert db.execute('SELECT COUNT(*) FROM zotero_import_sources').fetchone()[0] == 3
        before = set(Path('data/files').iterdir())
        rerun = zotero.apply(zotero.preview(rdf), 'data/math.db', 'rerun.json')
        assert rerun['summary']['duplicate'] == 3 and set(Path('data/files').iterdir()) == before
        assert json.loads(Path('rerun.json').read_text(encoding='utf-8'))['summary']['failed'] == 3
        # Force a database failure after copying a new PDF: no orphan file or partial record.
        (export / 'files/中文讲义.pdf').write_bytes(b'%PDF-1.4\na different file')
        with closing(sqlite3.connect('data/math.db')) as db:
            db.execute("CREATE TRIGGER fail_import BEFORE INSERT ON documents BEGIN SELECT RAISE(ABORT,'forced failure'); END")
            db.commit()
        failed = zotero.apply(zotero.preview(rdf), 'data/math.db', 'failure.json')
        assert failed['documents'][1]['status'] == 'failed' and set(Path('data/files').iterdir()) == before
        malicious = export / 'malicious.rdf'
        malicious.write_text('<!DOCTYPE rdf [<!ENTITY x "boom">]><rdf/>', encoding='utf-8')
        try: zotero.preview(malicious)
        except ValueError: pass
        else: raise AssertionError('DTD accepted')
    finally:
        os.chdir(original)
print('Zotero preview, large PDFs, classification, provenance, duplicates, resume and rollback passed.')
