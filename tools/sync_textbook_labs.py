"""Fetch pinned, licensed textbook code for read-only previews. Never execute upstream code.

The catalogue is the allowlist. Notebook prose, HTML, outputs, images, weights and
datasets are excluded. Full experiments are downloaded from their original host.
Run this explicitly when updating sources, never at service startup.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'tools/textbook_lab_sources.json'
DEST = ROOT / 'frontend/labs/upstream'
CACHE = ROOT / 'frontend/tests/artifacts/textbook-source-cache'


def read_url(url):
    if urllib.parse.urlsplit(url).hostname != 'raw.githubusercontent.com':
        raise ValueError('Only reviewed GitHub raw sources may be mirrored')
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / hashlib.sha256(url.encode()).hexdigest()
    if cached.exists():
        return cached.read_bytes()
    request = urllib.request.Request(url, headers={'User-Agent': 'Axiom-textbook-companions'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                body = response.read(16 * 1024 * 1024 + 1)
            break
        except OSError:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
    if len(body) > 16 * 1024 * 1024:
        raise ValueError('Source exceeds preview limit: ' + url)
    cached.write_bytes(body)
    return body


def raw(book, path):
    repo = book['repository'].removeprefix('https://github.com/')
    return 'https://raw.githubusercontent.com/' + repo + '/' + book['commit'] + '/' + urllib.parse.quote(path, safe='/')


def preview(book, chapter):
    files = []
    for path in chapter['files']:
        url = raw(book, path)
        body = read_url(url)
        if path.endswith('.ipynb'):
            notebook = json.loads(body)
            cells = [''.join(cell.get('source', [])) for cell in notebook['cells'] if cell['cell_type'] == 'code']
        elif path.endswith('.py'):
            cells = [body.decode('utf-8-sig')]
        else:
            raise ValueError('Unsupported code format: ' + path)
        origin = book['repository'] + '/blob/' + book['commit'] + '/' + urllib.parse.quote(path, safe='/')
        files.append({'path': path, 'url': origin, 'sha256': hashlib.sha256(body).hexdigest(),
                      'cells': [source for source in cells if source.strip()]})
    if not any(item['cells'] for item in files):
        raise ValueError('No original code cells: ' + chapter['id'])
    result = {'book': book['id'], 'chapter': chapter['id'], 'commit': book['commit'], 'files': files}
    target = DEST / book['id'] / (chapter['id'] + '.json')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


def main():
    catalogue = json.loads(SOURCES.read_text(encoding='utf8'))
    jobs = []
    for book in catalogue['books']:
        if not re.fullmatch(r'[a-z0-9-]+', book['id']) or not re.fullmatch(r'[a-f0-9]{40}', book['commit']):
            raise ValueError('Invalid pinned source')
        if not book.get('mirror'):
            continue
        # Licence is kept alongside every mirrored source, with its exact origin.
        licence = read_url(book['license_raw_url'])
        directory = DEST / book['id']
        directory.mkdir(parents=True, exist_ok=True)
        (directory / 'LICENSE.txt').write_bytes(licence)
        (directory / 'NOTICE.txt').write_text(book['title'] + '\n' + book['authors'] + '\n' + book['repository'] +
            '\nCommit: ' + book['commit'] + '\nLicence: ' + book['license_url'] +
            '\nOnly code cells are extracted for previews. Original code is not rewritten.\n', encoding='utf8')
        jobs.extend((book, chapter) for chapter in book['chapters'])
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda pair: preview(*pair), jobs))
    # Include only public presentation metadata in the API catalogue.
    result = json.loads(json.dumps(catalogue))
    for book in result['books']:
        book.pop('license_raw_url', None)
        for chapter in book['chapters']:
            chapter.pop('files', None)
            chapter['preview'] = bool(book.get('mirror'))
    (ROOT / 'backend/src/main/resources/textbook-labs.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print('Synced %d original-code chapter previews across %d textbooks.' % (len(jobs), len(catalogue['books'])))


if __name__ == '__main__':
    main()
