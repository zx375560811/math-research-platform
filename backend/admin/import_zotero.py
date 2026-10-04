"""Preview or import an exported Zotero RDF and its local PDF and DJVU attachments."""
import argparse
from collections import Counter, defaultdict
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from document_format import detect, remember
from zotero_collections import folders, link as link_collection
from urllib.parse import unquote
import xml.etree.ElementTree as ET

NS = {'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'z': 'http://www.zotero.org/namespaces/export#',
      'dc': 'http://purl.org/dc/elements/1.1/',
      'link': 'http://purl.org/rss/1.0/modules/link/',
      'dcterms': 'http://purl.org/dc/terms/',
      'foaf': 'http://xmlns.com/foaf/0.1/', 'bib': 'http://purl.org/net/biblio#'}
ABOUT, RESOURCE = ('{' + NS['rdf'] + '}' + name for name in ('about', 'resource'))
DIRECTIONS = {'analysis', 'algebra', 'geometry-topology', 'number-theory',
              'probability-statistics', 'computational', 'optimization', 'discrete-foundations'}
MAPPING = {
    '分析': ['analysis'], '数学分析': ['analysis'], '數學分析習題': ['analysis'],
    '实分析': ['analysis'], '复分析': ['analysis'], '泛函分析': ['analysis'],
    '变分法': ['analysis'], '高数': ['analysis'], '多变量微积分': ['analysis'],
    '多变量微积分-流形上的微积分': ['analysis', 'geometry-topology'],
    '鲁丁实分析与复分析讲义': ['analysis'], '幂级数相关内容': ['analysis'],
    '代数': ['algebra'], '高等代数': ['algebra'], '近世代数': ['algebra'],
    '代数入门': ['algebra'], '线性代数课程': ['algebra'],
    '代数几何': ['algebra', 'geometry-topology'],
    '代数几何微分拓扑前沿': ['algebra', 'geometry-topology'],
    '几何分析': ['analysis', 'geometry-topology'], '黎曼几何': ['geometry-topology'],
    '微分几何': ['geometry-topology'], '拓扑学': ['geometry-topology'],
    '基础拓扑': ['geometry-topology'], '代数拓扑': ['geometry-topology'],
    '几何拓扑': ['geometry-topology'], '拓扑中的连续函数': ['geometry-topology'],
    '集合论': ['discrete-foundations'],
}


def compact(text):
    return re.sub(r'\s+', ' ', text or '').strip()


def within(path, directory):
    """Path.is_relative_to equivalent for Alibaba Cloud Linux's older Python."""
    try:
        path.relative_to(directory)
        return True
    except ValueError:
        return False


def field(text, warnings, name):
    value = ''.join(c for c in compact(text) if ord(c) >= 32 and ord(c) != 127)
    if len(value.encode('utf-8')) > 500:
        warnings.append(name + '超过 500 字节，展示字段已截短，原文保留在来源记录')
        value = value.encode('utf-8')[:500].decode('utf-8', errors='ignore')
    return value


def language(value, filename):
    value = (value or '').lower().replace('_', '-')
    if value == 'eng' or value == 'en' or value.startswith('en-'):
        return 'en'
    if value == 'chi' or value == 'zho' or value == 'zh' or value.startswith('zh-'):
        return 'zh'
    # An explicit third language is not mislabeled as English or Chinese.
    if value:
        return 'und'
    return 'zh' if re.search(r'[\u3400-\u9fff]', filename) else 'und'


def attachment_path(directory, value):
    if not value:
        raise ValueError('附件没有本地路径')
    value = value.replace('\\', '/')
    if value.startswith('/') or re.match(r'^[A-Za-z][A-Za-z0-9+.-]*:', value):
        raise ValueError('附件路径必须是导出目录内的相对路径')
    for candidate in (value, unquote(value)):
        path = (directory / candidate).resolve()
        if not within(path, directory):
            raise ValueError('附件路径越过导出目录')
        if path.is_file():
            return path
    raise ValueError('附件文件不存在')


def preview(rdf, mapping=None, verify_files=True):
    rdf = Path(rdf).resolve()
    xml = rdf.read_bytes()
    if b'<!DOCTYPE' in xml.upper() or b'<!ENTITY' in xml.upper():
        raise ValueError('不支持含 DTD 或实体声明的 RDF')
    root = ET.fromstring(xml)
    if root.tag != '{' + NS['rdf'] + '}RDF':
        raise ValueError('请选择 Zotero 导出的 RDF 文件')
    if mapping is not None and not isinstance(mapping, dict):
        raise ValueError('分类映射必须是 JSON 对象')
    mapping = {**MAPPING, **(mapping or {})}
    for name, values in mapping.items():
        if not isinstance(values, list) or not all(isinstance(v, str) and v in DIRECTIONS for v in values):
            raise ValueError('分类映射无效：' + name)
    nodes = {node.get(ABOUT): node for node in root if node.get(ABOUT)}
    attachments = [node for node in root if node.findtext('z:itemType', namespaces=NS) == 'attachment']
    items = [node for node in root if node.findtext('z:itemType', namespaces=NS) not in (None, 'attachment', 'note')]
    collections, memberships, parents = {}, defaultdict(set), defaultdict(list)
    for node in root.findall('z:Collection', NS):
        collections[node.get(ABOUT)] = (compact(node.findtext('dc:title', namespaces=NS)) or '未命名文件夹',
                                       [part.get(RESOURCE) for part in node.findall('dcterms:hasPart', NS)])
    def walk(key, names, seen):
        if key in seen:
            raise ValueError('Zotero 分类存在循环引用')
        name, children = collections[key]
        chain = names + [name]
        for child in children:
            if child in collections:
                walk(child, chain, seen | {key})
            else:
                memberships[child].add(tuple(chain))
    for key in collections:
        walk(key, [], set())
    nested = {child for name, children in collections.values() for child in children if child in collections}
    tree = []
    def collect_tree(key, path):
        name, children = collections[key]
        path = path + [name or '未命名文件夹']
        if path not in tree:
            tree.append(path)
        for child in children:
            if child in collections:
                collect_tree(child, path)
    for key in collections:
        if key not in nested:
            collect_tree(key, [])
    for item in items:
        for link in item.findall('link:link', NS):
            key = link.get(RESOURCE)
            if key in nodes and nodes[key].findtext('z:itemType', namespaces=NS) == 'attachment':
                parents[key].append(item)
    rows = []
    for attachment in attachments:
        key = attachment.get(ABOUT)
        path_node = attachment.find('z:path', NS)
        raw_path = path_node.get(RESOURCE) if path_node is not None else ''
        sources = parents[key]
        source = sources[0] if sources else attachment
        chains = set(memberships[key])
        for item in sources:
            chains.update(memberships[item.get(ABOUT)])
        # Keep the most informative full paths instead of their redundant suffixes.
        paths = sorted(chain for chain in chains if not any(len(other) > len(chain) and other[-len(chain):] == chain for other in chains))
        directions = sorted({slug for chain in paths for name in chain for slug in mapping.get(name, [])})
        people = source.findall('bib:authors/rdf:Seq/rdf:li/foaf:Person', NS)
        authors = '; '.join(compact(' '.join(filter(None, [person.findtext('foaf:givenName', namespaces=NS), person.findtext('foaf:surname', namespaces=NS), person.findtext('foaf:name', namespaces=NS)]))) for person in people)
        title = compact(source.findtext('dc:title', namespaces=NS))
        if not sources:
            title = re.sub(r'(?i)\.(pdf|djvu|djv)$', '', title)
        warnings = []
        if not authors:
            warnings.append('作者待补充')
        if not sources:
            warnings.append('独立附件，以附件标题入库')
        if len(sources) > 1:
            warnings.append('附件关联多个书目，展示使用第一个，全部来源保留')
        original_language = source.findtext('z:language', default='', namespaces=NS)
        row = {'attachment': key, 'path': raw_path, 'title': field(title or Path(raw_path).stem or '未命名文献', warnings, '标题'),
               'authors': field(authors, warnings, '作者'), 'language': language(original_language, title or raw_path),
               'directions': directions, 'collection_paths': [list(chain) for chain in paths], 'collections': [' / '.join(chain) for chain in paths],
               'warnings': warnings, 'status': 'ready', 'size': 0,
               'metadata': {'original_title': title, 'original_authors': authors, 'original_language': original_language,
                            'items': [ET.tostring(item, encoding='unicode') for item in sources]}}
        if not directions:
            warnings.append('方向待分类')
        if row['language'] == 'und':
            warnings.append('语种待标注或为其他语种')
        if not verify_files:
            rows.append(row)
            continue
        try:
            path = attachment_path(rdf.parent, raw_path)
            if path.suffix.lower() not in ('.pdf', '.djvu', '.djv'):
                row['status'] = 'skipped'; row['reason'] = '暂不支持 ' + path.suffix.lower()
            else:
                row['size'] = path.stat().st_size
                with path.open('rb') as stream:
                    row['format'] = detect(stream.read(16))
        except (OSError, ValueError) as error:
            row['status'] = 'failed'; row['reason'] = str(error)
        rows.append(row)
    return {'rdf': str(rdf), 'collection_count': len(collections), 'item_count': len(items),
            'mapping': mapping, 'collection_tree': tree, 'documents': rows}


def digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def report(value, destination):
    value['summary'] = dict(Counter(row['status'] for row in value['documents']))
    value['pdf_bytes'] = sum(row['size'] for row in value['documents'] if row.get('format') == 'pdf')
    value['document_bytes'] = sum(row['size'] for row in value['documents'] if row['status'] != 'skipped')
    value['formats'] = dict(Counter(row['format'] for row in value['documents'] if row.get('format')))
    target = Path(destination).resolve(); target.parent.mkdir(parents=True, exist_ok=True)
    temp = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=target.parent, prefix='.zotero-report-', delete=False) as output:
            temp = Path(output.name)
            json.dump(value, output, ensure_ascii=False, indent=2)
            output.write('\n'); output.flush(); os.fsync(output.fileno())
        os.replace(temp, target)
    finally:
        if temp and temp.exists():
            temp.unlink()


def apply(value, database, destination):
    database = Path(database).resolve()
    if not database.is_file():
        raise ValueError('数据库不存在，请先启动平台初始化数据库')
    directory = Path(value['rdf']).parent
    storage = Path('data/files').resolve()
    storage.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(str(database), timeout=30)) as db:
        db.execute('PRAGMA foreign_keys=ON')
        required = {'documents', 'subjects', 'document_catalog', 'document_directions', 'learning_directions'}
        if not required.issubset({name for name, in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}):
            raise ValueError('请先运行最新平台，初始化文档库分类表')
        db.executescript('''
            CREATE TABLE IF NOT EXISTS zotero_import_hashes (
                sha256 TEXT PRIMARY KEY, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS zotero_import_sources (
                document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                source TEXT NOT NULL, attachment TEXT NOT NULL, sha256 TEXT NOT NULL,
                metadata_json TEXT NOT NULL, collections_json TEXT NOT NULL,
                imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
                PRIMARY KEY(document_id,source,attachment));
        ''')
        collection_ids = folders(db, value)
        db.commit()
        known = dict(db.execute('SELECT sha256,document_id FROM zotero_import_hashes'))
        indexed = set(known.values())
        for doc_id, stored in db.execute('SELECT id,file_path FROM documents').fetchall():
            if doc_id in indexed:
                continue
            path = Path(stored).resolve()
            if not within(path, storage) or not path.is_file():
                continue
            sha = digest(path)
            db.execute('INSERT OR IGNORE INTO zotero_import_hashes VALUES(?,?)', (sha, doc_id))
        db.commit()
        valid = {slug for slug, in db.execute('SELECT slug FROM learning_directions')}
        subject_ids = dict(db.execute('SELECT slug,id FROM subjects'))
        for index, row in enumerate(value['documents'], 1):
            if row['status'] != 'ready':
                continue
            saved = None; committed = False
            try:
                if not set(row['directions']).issubset(valid):
                    raise ValueError('平台尚未配置对应研究方向')
                path = attachment_path(directory, row['path'])
                # Copy and hash the same byte stream, preventing metadata/file drift.
                checksum = hashlib.sha256(); size = 0
                with path.open('rb') as original:
                    kind = detect(original.read(16))
                    original.seek(0)
                    with tempfile.NamedTemporaryFile(prefix='upload-', dir=storage, delete=False) as output:
                        saved = Path(output.name)
                        for chunk in iter(lambda: original.read(65536), b''):
                            output.write(chunk); checksum.update(chunk); size += len(chunk)
                        output.flush(); os.fsync(output.fileno())
                sha = checksum.hexdigest()
                db.execute('BEGIN IMMEDIATE')
                existing = db.execute('SELECT document_id FROM zotero_import_hashes WHERE sha256=?', (sha,)).fetchone()
                if existing:
                    doc_id = existing[0]
                    stored = db.execute('SELECT file_path FROM documents WHERE id=?', (doc_id,)).fetchone()[0]
                    existing_path = Path(stored).resolve()
                    if not within(existing_path, storage) or not existing_path.is_file():
                        raise ValueError('现有重复文献的文件缺失，请先修复文献 #' + str(doc_id))
                    # Never overwrite existing classifications, textbook bindings or personal reading state.
                    row['status'] = 'duplicate'
                else:
                    cursor = db.execute('INSERT INTO documents(title,authors,file_path,file_size) VALUES(?,?,?,?)',
                                        (row['title'], row['authors'], 'data/files/' + saved.name, size))
                    doc_id = cursor.lastrowid
                    remember(db, doc_id, kind)
                    ids = {subject_ids.get(slug, subject_ids['other']) for slug in row['directions']} or {subject_ids['other']}
                    db.executemany('INSERT INTO document_subjects VALUES(?,?)', [(doc_id, sid) for sid in sorted(ids)])
                    db.execute('INSERT INTO document_catalog(document_id,module,language) VALUES(?,?,?)', (doc_id, 'mathematics', row['language']))
                    db.executemany('INSERT INTO document_directions VALUES(?,?)', [(doc_id, slug) for slug in row['directions']])
                    db.execute('INSERT INTO zotero_import_hashes VALUES(?,?)', (sha, doc_id))
                    row['status'] = 'imported'
                link_collection(db, collection_ids, row, doc_id)
                provenance = {key: row[key] for key in ('title', 'authors', 'language', 'directions', 'metadata', 'path', 'collection_paths')}
                db.execute('INSERT OR IGNORE INTO zotero_import_sources(document_id,source,attachment,sha256,metadata_json,collections_json) VALUES(?,?,?,?,?,?)',
                           (doc_id, Path(value['rdf']).name, row['attachment'], sha, json.dumps(provenance, ensure_ascii=False), json.dumps(row['collections'], ensure_ascii=False)))
                db.commit(); committed = True
                row.update(document_id=doc_id, sha256=sha, size=size)
            except (OSError, ValueError, sqlite3.Error) as error:
                db.rollback(); row['status'] = 'failed'; row['reason'] = str(error)
            finally:
                if saved and (not committed or row['status'] == 'duplicate'):
                    saved.unlink()
            report(value, destination)
            print(f"[{index}/{len(value['documents'])}] {row['status']}: {row['title']}", flush=True)
    report(value, destination)
    return value


def sync_collections(value, database):
    if not Path(database).is_file():
        raise ValueError('数据库不存在，请先启动平台初始化数据库')
    with closing(sqlite3.connect(str(database), timeout=30)) as db:
        db.execute('PRAGMA foreign_keys=ON')
        ids = folders(db, value)
        source = Path(value['rdf']).name
        existing = dict(db.execute('SELECT attachment,document_id FROM zotero_import_sources WHERE source=?', (source,)))
        count = 0
        for row in value['documents']:
            if row['attachment'] in existing:
                link_collection(db, ids, row, existing[row['attachment']]); count += 1
        db.commit()
        return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('rdf', help='Exported RDF path; keep its files directory alongside it')
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument('--collections-only', action='store_true', help='Restore collection structure and links without copying or importing files')
    actions.add_argument('--apply', action='store_true', help='Import; without this flag only write a preview')
    parser.add_argument('--database', default=os.getenv('MATH_DB_PATH') or 'data/math.db')
    parser.add_argument('--mapping', help='Optional JSON object: collection names to direction slug lists')
    parser.add_argument('--report', help='JSON report path (defaults to data/zotero-preview.json or data/zotero-import.json)')
    args = parser.parse_args()
    args.report = args.report or ('data/zotero-import.json' if args.apply else 'data/zotero-preview.json')
    try:
        mapping = json.loads(Path(args.mapping).read_text(encoding='utf-8')) if args.mapping else None
        value = preview(args.rdf, mapping, verify_files=not args.collections_only)
        report(value, args.report)
        if args.collections_only:
            print(json.dumps({'linked_attachments': sync_collections(value, args.database), 'folders': len(value['collection_tree'])}, ensure_ascii=False))
        elif args.apply:
            apply(value, args.database, args.report)
        print(json.dumps({'summary': value['summary'], 'pdf_GiB': round(value['pdf_bytes'] / 1024**3, 2), 'document_GiB': round(value['document_bytes'] / 1024**3, 2), 'formats': value['formats'],
                          'report': str(Path(args.report).resolve())}, ensure_ascii=False))
        return 1 if any(row['status'] == 'failed' for row in value['documents']) else 0
    except (OSError, ValueError, sqlite3.Error, ET.ParseError) as error:
        parser.exit(1, 'Import failed: ' + str(error) + '\n')


if __name__ == '__main__':
    raise SystemExit(main())
