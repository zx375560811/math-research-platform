"""Run the shipped CPU exercises, including their reference checks, without network/API calls."""
import contextlib
import io
import json
import os
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault('MPLBACKEND', 'Agg')
os.environ.setdefault('OMP_NUM_THREADS', '1')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
root = Path(__file__).resolve().parents[2]
slugs = {'calculus', 'linear-algebra', 'python', 'machine-learning', 'deep-learning', 'pytorch', 'nlp', 'llm'}
assert {p.stem for p in (root / 'frontend/labs').glob('*.ipynb')} == slugs
for slug in sorted(slugs):
    notebook = json.loads((root / 'frontend/labs' / (slug + '.ipynb')).read_text(encoding='utf-8'))
    assert notebook['nbformat'] == 4 and notebook['metadata']['axiom']['lab'] == slug
    assert notebook['metadata']['axiom']['live_api_default'] is False
    scope = {'__name__': '__main__'}
    output = io.StringIO()
    with contextlib.redirect_stdout(output), patch('urllib.request.urlopen', side_effect=AssertionError('An exercise attempted a network call')):
        for cell in notebook['cells']:
            if cell['cell_type'] == 'code':
                assert cell['execution_count'] is None and cell['outputs'] == []
                exec(compile(''.join(cell['source']), slug + ':' + cell['id'], 'exec'), scope)
    assert '待完成' in output.getvalue(), 'An unfilled template must not claim completion'
    if slug == 'machine-learning':
        import numpy as np
        # A report fitted on the test set must be rejected, even if its score looks good.
        leaked = scope['demo_report'](scope['X_test'], scope['X_test'], scope['y_test'], scope['y_test'])
        try:
            scope['check_report'](leaked, 1, scope['X_train'], scope['X_test'], scope['y_train'], scope['y_test'])
        except AssertionError:
            pass
        else:
            raise AssertionError('The report accepted a model fitted on the test data')
    if slug == 'deep-learning':
        import numpy as np
        try:
            scope['check_gradients'](lambda p, X, y: {key: np.zeros_like(value) for key, value in p.items()})
        except AssertionError:
            pass
        else:
            raise AssertionError('The gradient check accepted zero gradients')
    import matplotlib.pyplot as plt
    plt.close('all')
    print(slug + ': examples, unfinished templates and reference checks passed')
print('All 8 notebooks ran locally on CPU without external requests.')
