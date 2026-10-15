"""Offline audit of source identity, licence scope and inert code-only snapshots."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import unittest.mock

ROOT = Path(__file__).resolve().parents[2]
source = json.loads((ROOT / 'tools/textbook_lab_sources.json').read_text(encoding='utf8'))
public = json.loads((ROOT / 'backend/src/main/resources/textbook-labs.json').read_text(encoding='utf8'))
assert len(source['books']) == 8
assert sum(len(book['chapters']) for book in public['books']) == 103
assert len({book['id'] for book in source['books']}) == 8
spec = importlib.util.spec_from_file_location('sync_textbook_labs', ROOT / 'tools/sync_textbook_labs.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)
total = 0
for book, exposed in zip(source['books'], public['books']):
    assert book['id'] == exposed['id']
    assert re.fullmatch('[a-f0-9]{40}', book['commit'])
    assert book['commit'] in book['download_url']
    assert all(course not in ['calculus', 'linear-algebra', 'probability'] for course in book['courses'])
    assert len({chapter['id'] for chapter in book['chapters']}) == len(book['chapters'])
    assert len(book['chapters']) == len(exposed['chapters'])
    if book['mirror']:
        directory = ROOT / 'frontend/labs/upstream' / book['id']
        assert (directory / 'LICENSE.txt').stat().st_size > 900
        assert book['commit'] in (directory / 'NOTICE.txt').read_text(encoding='utf8')
    for chapter, entry in zip(book['chapters'], exposed['chapters']):
        assert book['commit'] in chapter['source_url']
        assert entry['preview'] == book['mirror']
        if not book['mirror']:
            continue
        preview = json.loads((directory / (chapter['id'] + '.json')).read_text(encoding='utf8'))
        assert preview['book'] == book['id'] and preview['chapter'] == chapter['id']
        assert preview['commit'] == book['commit']
        assert [file['path'] for file in preview['files']] == chapter['files']
        for file in preview['files']:
            assert re.fullmatch('[a-f0-9]{64}', file['sha256'])
            assert set(file) == {'path', 'url', 'sha256', 'cells'}
            assert all(isinstance(cell, str) for cell in file['cells'])
            # When a developer's raw cache is available, verify every code cell
            # and its original-file digest, rather than just trusting the snapshot.
            url = sync.raw(book, file['path'])
            cache = sync.CACHE / hashlib.sha256(url.encode()).hexdigest()
            if cache.exists():
                raw = cache.read_bytes()
                assert hashlib.sha256(raw).hexdigest() == file['sha256']
                if file['path'].endswith('.py'):
                    expected = [raw.decode('utf-8-sig')]
                else:
                    expected = [''.join(cell['source']) for cell in json.loads(raw)['cells'] if cell['cell_type'] == 'code']
                assert file['cells'] == [cell for cell in expected if cell.strip()]
        total += 1
assert total == 49
# Preview construction must discard executable HTML and stored notebook outputs.
sample = {'cells': [{'cell_type': 'markdown', 'source': ['<script>bad()</script>']},
                   {'cell_type': 'code', 'source': ['print("original")'], 'outputs': [{'text': 'unsafe output'}]}]}
with unittest.mock.patch.object(sync, 'read_url', return_value=json.dumps(sample).encode()), \
     unittest.mock.patch.object(sync, 'DEST', ROOT / 'frontend/tests/artifacts/preview-audit'):
    sync.preview({'id': 'safe', 'repository': 'https://github.com/example/book', 'commit': 'a' * 40},
                 {'id': 'ch01', 'files': ['test.ipynb'], 'source_url': 'https://github.com/example/book'})
    result = json.loads((sync.DEST / 'safe/ch01.json').read_text(encoding='utf8'))
    assert result['files'][0]['cells'] == ['print("original")']
    assert 'script' not in json.dumps(result) and 'unsafe output' not in json.dumps(result)
print('8 textbooks, 103 pinned chapter entries and 49 inert original-code previews verified.')
