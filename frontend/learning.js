const $ = id => document.getElementById(id);
const symbols = { analysis: '∫', 'geometry-topology': '𝒮', algebra: '𝔾' };
function el(tag, className, text) { const value = document.createElement(tag); if (className) value.className = className; if (text !== undefined) value.textContent = text; return value; }
export function createLearning({ api, write }) {
  let directions = [], generation = 0, stopReader = null, current = '';
  function close() { ++generation; if (stopReader) stopReader(); stopReader = null; $('reader-view').hidden = true; document.body.classList.remove('reading-page'); }
  async function loadDirections() {
    directions = (await api('/api/learning/directions')).directions;
    $('featured-directions').replaceChildren(); $('more-directions').replaceChildren();
    for (const direction of directions) {
      const link = el('a', direction.featured ? 'direction-card' : 'direction-small', ''); link.href = `#/apps/mathematics/directions/${direction.slug}`; link.dataset.direction = direction.slug;
      if (direction.featured) { link.append(el('span', 'direction-art', symbols[direction.slug] || 'ℳ'), el('h3', '', direction.name), el('p', '', direction.description), el('span', 'direction-enter', '进入方向 →')); }
      else link.append(el('strong', '', direction.name));
      $(direction.featured ? 'featured-directions' : 'more-directions').append(link);
    }
  }
  async function navigate(hash) {
    close(); current = hash; const version = generation;
    $('learning-status').textContent = ''; $('retry-learning').hidden = true;
    const reading = hash.match(/^#\/apps\/mathematics\/read\/(\d+)$/);
    const detail = hash.match(/^#\/apps\/mathematics\/directions\/([a-z-]+)$/);
    $('reader-view').hidden = !reading; $('module-view').hidden = !!reading;
    $('direction-overview').hidden = !!detail; $('direction-detail').hidden = !detail;
    try {
      if (reading) {
        document.body.classList.add('reading-page');
        $('reader-status').textContent = '正在打开教材…'; $('reader-save-status').textContent = '';
        const reader = await import('./reader.js'); if (version !== generation) return;
        const controller = reader.openReader(Number(reading[1]), { api, write }); stopReader = controller.close;
        await controller.ready;
      } else if (detail) {
        $('textbook-list').replaceChildren(); $('direction-questions').replaceChildren(); $('direction-title').textContent = '正在加载…';
        const direction = await api('/api/learning/directions/' + detail[1]); if (version !== generation) return;
        $('direction-title').textContent = direction.name; $('direction-description').textContent = direction.description;
        $('direction-symbol').textContent = symbols[direction.slug] || 'ℳ';
        for (const question of direction.questions) $('direction-questions').append(el('li', '', question));
        for (const [i, book] of direction.books.entries()) {
          const row = el('article', 'textbook-row'); const spine = el('div', 'book-spine'); spine.append(el('span', '', String(i + 1).padStart(2, '0')), el('span', '', symbols[direction.slug] || 'ℳ'));
          const info = el('div', 'textbook-info'); info.append(el('span', 'book-stage', book.stage), el('h3', '', book.title), el('p', '', book.authors), el('p', 'book-prerequisites', '需要基础：' + book.prerequisites));
          const actions = el('div', 'textbook-actions');
          if (book.available) { const link = el('a', 'button primary', book.progress ? `继续学习 · 第 ${book.progress.page} 页` : '开始学习'); link.href = `#/apps/mathematics/read/${book.id}`; link.dataset.book = book.id; actions.append(link); }
          else actions.append(el('span', 'book-unavailable', 'PDF 待接入'));
          const source = el('a', 'book-source', '教材信息 ↗'); source.href = book.source_url; source.target = '_blank'; source.rel = 'noopener noreferrer'; actions.append(source);
          row.append(spine, info, actions); $('textbook-list').append(row);
        }
      } else if (!directions.length) await loadDirections();
    } catch (error) {
      if (version !== generation) return;
      const message = error instanceof TypeError ? '连接失败，请检查连接后重试。' : error.message;
      $(reading ? 'reader-status' : 'learning-status').textContent = message;
      $('retry-learning').hidden = !!reading;
    }
  }
  $('retry-learning').addEventListener('click', () => navigate(current));
  return { loadDirections, navigate, close };
}
