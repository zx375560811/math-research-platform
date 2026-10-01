"""Run against the backend on localhost; Python standard library only."""
import json
import urllib.error
import urllib.request

def request(path, method='GET'):
    req = urllib.request.Request('http://127.0.0.1:8080' + path, method=method)
    try:
        response = urllib.request.urlopen(req, timeout=5)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, json.load(response)

status, body = request('/api/health')
assert status == 200 and body == {'status': 'ok', 'database': 'ok'}
status, body = request('/api/subjects')
assert status == 200
assert [(s['id'], s['slug'], s['name']) for s in body['subjects']] == [
    (1, 'algebra', '代数'), (2, 'number-theory', '数论'),
    (3, 'analysis', '分析'), (4, 'geometry-topology', '几何与拓扑'),
    (5, 'other', '其他数学方向')]
assert request('/api/ai/status') == (200, {'enabled': False, 'status': 'not_configured'})
assert request('/missing') == (404, {'error': 'not_found'})
assert request('/api/subjects', 'POST') == (405, {'error': 'method_not_allowed'})
print('All HTTP smoke checks passed.')
