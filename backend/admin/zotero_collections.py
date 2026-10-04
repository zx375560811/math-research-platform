"""Save the exported collection hierarchy separately from learning directions."""
import json
from pathlib import Path


def folders(db, value):
    db.execute('''CREATE TABLE IF NOT EXISTS library_collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, path_key TEXT NOT NULL,
      parent_id INTEGER REFERENCES library_collections(id) ON DELETE CASCADE,
      name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, UNIQUE(source,path_key))''')
    db.execute('''CREATE TABLE IF NOT EXISTS document_collections (
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      collection_id INTEGER NOT NULL REFERENCES library_collections(id) ON DELETE CASCADE,
      PRIMARY KEY(document_id,collection_id))''')
    source = Path(value['rdf']).name
    ids = {}
    paths = [[]] + value.get('collection_tree', [])
    for order, path in enumerate(paths):
        key = json.dumps(path, ensure_ascii=False, separators=(',', ':'))
        name = path[-1] if path else Path(source).stem
        parent = ids[tuple(path[:-1])] if path else None
        db.execute('INSERT OR IGNORE INTO library_collections(source,path_key,parent_id,name,sort_order) VALUES(?,?,?,?,?)',
                   (source, key, parent, name, order))
        db.execute('UPDATE library_collections SET sort_order=? WHERE source=? AND path_key=?', (order, source, key))
        ids[tuple(path)] = db.execute('SELECT id FROM library_collections WHERE source=? AND path_key=?', (source, key)).fetchone()[0]
    keep = {json.dumps(list(path), ensure_ascii=False, separators=(',', ':')) for path in ids}
    for folder, key in db.execute('SELECT id,path_key FROM library_collections WHERE source=?', (source,)).fetchall():
        if key not in keep:
            db.execute('DELETE FROM library_collections WHERE id=?', (folder,))
    return ids


def link(db, ids, row, document):
    paths = row.get('collection_paths') or [[]]
    for path in paths:
        if tuple(path) in ids:
            db.execute('INSERT OR IGNORE INTO document_collections VALUES(?,?)', (document, ids[tuple(path)]))
