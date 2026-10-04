const $ = id => document.getElementById(id);
const languages = { zh: '中文', en: '英文', und: '语种未标注' };
function el(tag, text, className) { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; }
export function createLibrary({ api, write }) {
  let categories = [], generation = 0, stopReader = null, offset = 0, current = '', ownsReader = false;
  function close() { ++generation; $('library-view').setAttribute('aria-busy', 'false'); if (stopReader) stopReader(); stopReader = null; $('library-view').hidden = true; if (ownsReader) { $('reader-view').hidden = true; document.body.classList.remove('reading-page'); } ownsReader = false; }
  function filterUrl() { return new URLSearchParams({ module: $('library-module').value, direction: $('library-direction').value, language: $('library-language').value, q: $('library-query').value.trim() }); }
  function directionOptions(selected = '') {
    const module = categories.find(module => module.slug === $('library-module').value); $('library-direction').replaceChildren();
    for (const direction of [{ slug: '', name: '所有方向' }, ...(module?.directions || categories.flatMap(module => module.directions)), { slug: 'unclassified', name: '尚未分类' }]) { const option = el('option', direction.name); option.value = direction.slug; $('library-direction').append(option); }
    $('library-direction').value = selected;
  }
  async function load(version = generation) {
    $('library-view').setAttribute('aria-busy', 'true'); $('library-status').textContent = '正在加载文献…'; const params = filterUrl(); params.set('offset', offset);
    try {
      const body = await api('/api/library/documents?' + params); if (version !== generation) return;
      const list = $('library-documents'); list.replaceChildren(); const names = new Map(categories.flatMap(module => module.directions).map(direction => [direction.slug, direction.name]));
      for (const doc of body.documents) {
        const row = el('article', null, 'library-document'), info = el('div', null, 'library-document-info'); info.append(el('span', languages[doc.language] || '语种未标注', 'document-language'), el('h2', doc.title), el('p', doc.authors || '作者未填写'), el('p', (doc.directions || []).map(slug => names.get(slug) || slug).join('、') || '尚未分类', 'document-directions'));
        const link = el('a', doc.progress ? `继续阅读 · 第 ${doc.progress.page} 页` : '开始阅读', 'button primary'); link.href = `#/library/read/${doc.id}?${filterUrl()}`; link.dataset.document = doc.id; row.append(info, link); list.append(row);
      }
      $('library-status').textContent = body.documents.length ? '' : '暂无文献';
      $('library-prev').disabled = offset === 0; $('library-next').disabled = body.documents.length < 20; $('library-page').textContent = `第 ${offset / 20 + 1} 页`;
    } catch (error) { if (version === generation) $('library-status').textContent = error instanceof TypeError ? '连接失败，请重试。' : error.message; }
    finally { if (version === generation) $('library-view').setAttribute('aria-busy', 'false'); }
  }
  async function navigate(hash) {
    close(); current = hash; const version = generation, [path, query = ''] = hash.split('?'), params = new URLSearchParams(query), reading = path.match(/^#\/library\/read\/(\d+)$/);
    ownsReader = !!reading;
    $('library-view').hidden = !!reading; $('reader-view').hidden = !reading;
    try {
      if (reading) { document.body.classList.add('reading-page'); const reader = await import('./reader.js'); if (version !== generation) return; const controller = reader.openReader(Number(reading[1]), { api, write, basePath: '/api/library/documents', backHref: '#/library?' + params, backLabel: '← 返回文档库' }); stopReader = controller.close; await controller.ready; return; }
      if (!categories.length) { categories = (await api('/api/library/categories')).modules; if (version !== generation) return; $('library-module').replaceChildren(); const all = el('option', '所有模块'); all.value = ''; $('library-module').append(all); for (const module of categories) { const option = el('option', module.name); option.value = module.slug; $('library-module').append(option); } }
      $('library-module').value = params.get('module') || ''; directionOptions(params.get('direction') || ''); $('library-language').value = params.get('language') || ''; $('library-query').value = params.get('q') || ''; offset = 0; await load(version);
    } catch (error) { if (version === generation) $(reading ? 'reader-status' : 'library-status').textContent = error.message; }
  }
  $('library-filter').addEventListener('submit', event => { event.preventDefault(); offset = 0; location.hash = '#/library?' + filterUrl(); if (location.hash === current) load(); });
  $('library-module').addEventListener('change', () => { directionOptions(); offset = 0; location.hash = '#/library?' + filterUrl(); });
  for (const id of ['library-direction', 'library-language']) $(id).addEventListener('change', () => { offset = 0; location.hash = '#/library?' + filterUrl(); });
  $('library-prev').addEventListener('click', () => { offset = Math.max(0, offset - 20); load(); }); $('library-next').addEventListener('click', () => { offset += 20; load(); }); $('library-retry').addEventListener('click', () => load());
  return { navigate, close };
}
