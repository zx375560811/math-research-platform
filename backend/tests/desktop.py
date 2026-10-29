"""Single-user desktop mode: no login, local admin, library and AI settings."""
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

backend = Path(__file__).resolve().parents[1]
jar = backend / 'target/math-server.jar'
assert jar.is_file(), 'Build the backend before running this test'

with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
base = 'http://127.0.0.1:{}'.format(port)


def request(path):
    try:
        with urllib.request.urlopen(base + path, timeout=5) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        with error:
            return error.code, json.load(error)


with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    log = open(str(root / 'server.log'), 'w')
    env = {
        **os.environ,
        'MATH_DESKTOP': '1',
        'MATH_PORT': str(port),
        'MATH_WEB_DIR': str(backend.parent / 'frontend'),
        'MATH_DB_PATH': str(root / 'data' / 'math.db'),
    }
    process = subprocess.Popen(
        [os.environ.get('MATH_TEST_JAVA', 'java'), '-jar', str(jar)],
        cwd=str(root), env=env, stdout=log, stderr=log)
    try:
        for _ in range(120):
            try:
                if request('/api/health')[0] == 200:
                    break
            except Exception:
                pass
            time.sleep(0.25)
        else:
            raise AssertionError('Desktop server did not start')

        status, me = request('/api/auth/me')
        assert status == 200 and me['authenticated'] is True, me
        assert me['desktop'] is True, me
        assert me['user'] == {'username': 'local', 'role': 'ADMIN'}, me

        assert request('/api/admin/documents')[0] == 200
        assert request('/api/ai/status')[0] == 200
        assert request('/api/subjects')[0] == 200

        # The local account must exist in SQLite so personal progress/annotations
        # can use the normal foreign keys.
        import sqlite3
        from contextlib import closing
        with closing(sqlite3.connect(str(root / 'data' / 'math.db'))) as db:
            assert db.execute("SELECT 1 FROM users WHERE username='local'").fetchone()
            assert db.execute("SELECT 1 FROM administrators WHERE username='local'").fetchone()
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
        log.close()

print('Desktop mode: local admin, no login, libraries and AI endpoints passed.')
