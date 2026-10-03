const $ = id => document.getElementById(id);
const symbols = { analysis: '∫', 'geometry-topology': '𝒮', algebra: '𝔾' };
function el(tag, className, text) { const value = document.createElement(tag); if (className) value.className = className; if (text !== undefined) value.textContent = text; return value; }
// Each illustration describes its subject: a function, a torus, and group symmetries.
function diagram(slug) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 300 170'); svg.setAttribute('aria-hidden', 'true');
  const line = (points, kind = '') => { const path = document.createElementNS(ns, 'polyline'); path.setAttribute('points', points.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')); if (kind) path.setAttribute('class', kind); svg.append(path); };
  if (slug === 'analysis') {
    for (let x = 30; x <= 270; x += 30) line([[x,20],[x,150]], 'diagram-grid');
    for (let y = 30; y <= 150; y += 30) line([[25,y],[275,y]], 'diagram-grid');
    line([[25,125],[275,125]], 'diagram-axis'); line([[50,150],[50,20]], 'diagram-axis');
    const f = x => 100 - 48 * Math.sin((x-45)/55);
    for (let x = 60; x <= 230; x += 10) line([[x,125],[x,f(x)]], 'diagram-area');
    line(Array.from({length:101}, (_,i) => [25+i*2.5,f(25+i*2.5)]), 'diagram-focus');
  } else if (slug === 'geometry-topology') {
    const point = (u,v) => { const r = 55 + 22*Math.cos(v); return [150+r*Math.cos(u)*1.35,85+r*Math.sin(u)*.55+22*Math.sin(v)]; };
    for(let j=0;j<16;j++) line(Array.from({length:81},(_,i)=>point(i*Math.PI/40,j*Math.PI/8)));
    for(let j=0;j<24;j++) line(Array.from({length:41},(_,i)=>point(j*Math.PI/12,i*Math.PI/20)));
  } else {
    const points=Array.from({length:6},(_,i)=>[150+63*Math.cos(i*Math.PI/3-Math.PI/2),85+63*Math.sin(i*Math.PI/3-Math.PI/2)]);
    line([...points,points[0]],'diagram-focus');
    for(let i=0;i<6;i++) {line([points[i],points[(i+2)%6]]);line([points[i],[150,85]],'diagram-grid');}
    for(const [x,y] of points) {const node=document.createElementNS(ns,'circle');node.setAttribute('cx',x);node.setAttribute('cy',y);node.setAttribute('r','4');svg.append(node);}
  }
  const art = el('div', 'direction-art'); art.append(svg); return art;
}
export function createLearning({ api, write }) {
  let directions = [], generation = 0, stopReader = null, current = '';
  function close() { ++generation; if (stopReader) stopReader(); stopReader = null; $('reader-view').hidden = true; document.body.classList.remove('reading-page'); }
  async function loadDirections() {
    directions = (await api('/api/learning/directions')).directions;
    $('featured-directions').replaceChildren(); $('more-directions').replaceChildren();
    for (const direction of directions) {
      const link = el('a', direction.featured ? 'direction-card' : 'direction-small', ''); link.href = `#/apps/mathematics/directions/${direction.slug}`; link.dataset.direction = direction.slug;
      if (direction.featured) { link.append(diagram(direction.slug), el('h3', '', direction.name), el('p', '', direction.description), el('span', 'direction-enter', '进入方向')); }
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
