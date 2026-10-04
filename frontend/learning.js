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
function analysisRoadmap() {
  const ns = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs, text) => {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const svg = make('svg', {viewBox:'0 0 940 170',role:'img','aria-label':'分析学习路线：数学分析通向复分析、实分析与测度论及常微分方程；实分析与测度论和高等代数通向泛函分析，再到偏微分方程。常微分方程建议先于偏微分方程学习。'});
  const defs=make('defs', {});
  const gradient=(id, colors) => {
    const value=make('linearGradient',{id,x1:'0%',y1:'0%',x2:'100%',y2:'100%'});
    if (id==='analysis-edge-fill') for (const [key,val] of Object.entries({gradientUnits:'userSpaceOnUse',x1:0,y1:0,x2:940,y2:0})) value.setAttribute(key,val);
    colors.forEach((color,i)=>value.append(make('stop',{offset:(i/(colors.length-1)*100)+'%','stop-color':color})));defs.append(value);
  };
  gradient('analysis-foundation-fill',['#7186f1','#4355c8']);
  gradient('analysis-course-fill',['#ffffff','#f7f9ff']);
  gradient('analysis-edge-fill',['#8495e1','#8ebcb5']);
  const pattern=make('pattern',{id:'analysis-map-dots',width:18,height:18,patternUnits:'userSpaceOnUse'});
  pattern.append(make('circle',{cx:2,cy:2,r:.8,fill:'#b5c5e6'}));defs.append(pattern);
  const marker=make('marker',{id:'analysis-route-arrow',viewBox:'0 0 8 8',refX:'7',refY:'4',markerWidth:'6',markerHeight:'6',orient:'auto-start-reverse'});
  marker.append(make('path',{d:'M1 1 L7 4 L1 7',fill:'none',stroke:'#8298c6','stroke-width':'1.4'}));defs.append(marker);svg.append(defs);
  svg.append(make('rect',{x:0,y:0,width:940,height:170,rx:12,fill:'url(#analysis-map-dots)',opacity:'.4'}));
  const edges=[
    ['M208 85 C242 85 236 22 270 22',false],['M208 85 H270',false],['M208 85 C242 85 236 148 270 148',false],
    ['M485 85 H550',false],['M630 43 V64',false],['M710 85 H760',false],['M485 148 H825 Q845 148 845 128 V106',true]
  ];
  for (const [d,optional] of edges) svg.append(make('path',{class:'analysis-route-edge',d,fill:'none',stroke:'url(#analysis-edge-fill)','stroke-width':'2','marker-end':'url(#analysis-route-arrow)',...(optional ? {'stroke-dasharray':'5 5'} : {})}));
  for (const [name,symbol,x,y,width,kind] of [
    ['数学分析','∫',28,64,180,'foundation'],['复分析','ℂ',270,1,215,'complex'],['实分析与测度论','μ',270,64,215,'real'],
    ['常微分方程','y′',270,127,215,'ode'],['高等代数','ℝⁿ',550,1,160,'support'],['泛函分析','‖f‖',550,64,160,'functional'],['偏微分方程','∂',760,64,170,'pde']
  ]) {
    const group=make('g',{'class':'analysis-course '+kind,'data-course':name});
    group.append(make('title',{},name),make('rect',{class:'analysis-course-card',x,y,width,height:42,rx:11}),
      make('circle',{class:'analysis-course-icon',cx:x+28,cy:y+21,r:14}),
      make('text',{class:'analysis-course-symbol',x:x+28,y:y+21,'text-anchor':'middle','dominant-baseline':'central'},symbol),
      make('text',{class:'analysis-course-title',x:x+53,y:y+21,'dominant-baseline':'central'},name));svg.append(group);
  }
  const box=el('div','analysis-roadmap');box.append(svg);return box;
}
export function createLearning({ api, write }) {
  let directions = [], generation = 0, stopReader = null, current = '', ownsReader = false;
  function close() { ++generation; if (stopReader) stopReader(); stopReader = null; if (ownsReader) { $('reader-view').hidden = true; document.body.classList.remove('reading-page'); } ownsReader = false; }
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
    ownsReader = !!reading;
    const detail = hash.match(/^#\/apps\/mathematics\/directions\/([a-z-]+)$/);
    $('reader-view').hidden = !reading; $('module-view').hidden = !!reading;
    $('direction-overview').hidden = !!detail; $('direction-detail').hidden = !detail;
    try {
      if (reading) {
        document.body.classList.add('reading-page');
        $('reader-status').textContent = '正在打开教材…'; $('reader-save-status').textContent = '';
        const reader = await import('./reader.js'); if (version !== generation) return;
        const book = await api('/api/learning/books/' + reading[1]); if (version !== generation) return;
        const controller = book.selected_document_id
          ? reader.openReader(book.selected_document_id, { api, write, basePath:'/api/library/documents', backHref:'#/apps/mathematics/directions/' + book.direction, backLabel:'← 返回教材' })
          : reader.openReader(Number(reading[1]), { api, write }); stopReader = controller.close;
        await controller.ready;
      } else if (detail) {
        $('textbook-list').replaceChildren(); $('direction-introduction').replaceChildren(); $('direction-title').textContent = '正在加载…';
        const direction = await api('/api/learning/directions/' + detail[1]); if (version !== generation) return;
        $('direction-title').textContent = direction.name;
        const analysisFlow = direction.slug === 'analysis';
        $('direction-introduction').classList.remove('analysis-flow');
        $('direction-introduction').classList.toggle('analysis-route', analysisFlow);
        if (analysisFlow) {
          const item=el('div','analysis-route-item'), content=el('dd','analysis-route-content');
          content.append(analysisRoadmap());item.append(el('dt','sr-only','学习路线'),content);
          $('direction-introduction').append(item);
        }
        else for (const [field,label] of [['research_object','研究对象'],['core_content','核心内容'],['prerequisites','需要基础']]) {
          const item = el('div','introduction-item');
          item.append(el('dt','',label),el('dd','',direction.introduction?.[field] || '方向介绍暂未配置。'));
          $('direction-introduction').append(item);
        }
        function renderBook(target, book, i, previous = null) {
          const row = el('article', 'textbook-row'); row.dataset.recommendation = book.id; const spine = el('div', 'book-spine'); spine.append(el('span', '', String(i + 1).padStart(2, '0')), el('span', '', symbols[direction.slug] || 'ℳ'));
          const info = el('div', 'textbook-info'); info.append(el('span', 'book-stage', book.stage), el('h3', '', book.title), el('p', '', book.authors), el('p', 'book-prerequisites', book.selected_document_id ? '个人自选文献' : '需要基础：' + book.prerequisites));
          const actions = el('div', 'textbook-actions'), readingActions = el('div', 'book-reading-actions');
          if (book.available) { const link = el('a', 'button primary', book.progress ? `继续学习 · 第 ${book.progress.page} 页` : '开始学习'); link.href = `#/apps/mathematics/read/${book.id}`; link.dataset.book = book.id; readingActions.append(link); }
          else readingActions.append(el('span', 'book-unavailable', 'PDF 待接入'));
          const choose = el('button', 'button book-library-choice', '文献库自选'); choose.type = 'button'; choose.setAttribute('aria-expanded','false'); readingActions.append(choose); actions.append(readingActions);
          const picker = el('div', 'book-picker'); picker.hidden = true; picker.id = 'book-picker-' + book.id; choose.setAttribute('aria-controls',picker.id);
          const search = el('form', 'book-picker-search'), query = el('input'); query.type = 'search'; query.placeholder = '搜索标题或作者'; query.setAttribute('aria-label','搜索本方向文献'); const searchButton = el('button','button','搜索'); searchButton.type = 'submit'; search.append(query,searchButton);
          const label = el('label','','选择本方向文献'), select = el('select','book-picker-select'); select.id = 'book-choice-' + book.id; label.htmlFor = select.id;
          const status = el('p','book-picker-status'); status.setAttribute('role','status');
          const paging = el('div','book-picker-paging'), prev = el('button','button','上一页'), next = el('button','button','下一页'), page = el('span'); prev.type = next.type = 'button'; prev.disabled = next.disabled = true; paging.append(prev,page,next);
          picker.append(search,label,select,status,paging); let offset = 0, serial = 0;
          async function loadChoices() {
            const request = ++serial; select.disabled = true; prev.disabled = next.disabled = true; status.textContent = '正在加载文献…';
            try {
              const result = await api('/api/library/documents?' + new URLSearchParams({module:'mathematics',direction:direction.slug,q:query.value.trim(),offset}));
              if (request !== serial || version !== generation) return;
              const candidates = result.documents.filter(doc => doc.language === (book.language || 'en') || doc.language === 'und');
              const placeholder = el('option','','请选择文献'); placeholder.value = ''; select.replaceChildren(placeholder);
              if (book.selected_document_id && !candidates.some(doc => doc.id === book.selected_document_id)) { const current = el('option','',book.title); current.value = book.selected_document_id; select.append(current); }
              for (const doc of candidates) { const option = el('option','',doc.title + (doc.authors ? ' — ' + doc.authors : '') + (doc.language === 'und' ? '（语种未标注）' : '')); option.value = doc.id; select.append(option); }
              select.value = book.selected_document_id || ''; select.disabled = !candidates.length; prev.disabled = offset === 0; next.disabled = result.documents.length < 20; page.textContent = '第 ' + (offset / 20 + 1) + ' 页';
              status.textContent = candidates.length ? '选取后将替换此卡片，作为你的个人学习教材。' : next.disabled ? '本页没有匹配文献，可搜索其他关键词或查看上一页。' : '本页没有匹配文献，可查看下一页或搜索。';
            } catch (error) { if (request === serial && version === generation) status.textContent = error instanceof TypeError ? '连接失败，请重试。' : error.message; }
          }
          async function saveChoice(document) {
            ++serial; for (const control of picker.querySelectorAll('button,input,select')) control.disabled = true; choose.disabled = true; status.textContent = '正在保存选择…';
            try {
              const selected = await write('/api/learning/books/' + book.id + '/selection', {document_id:document}, 'PUT');
              if (version !== generation) return; renderBook(target,selected,i,row);
            } catch (error) { if (version === generation) { for (const control of picker.querySelectorAll('button,input,select')) control.disabled = false; prev.disabled = offset === 0; choose.disabled = false; status.textContent = error instanceof TypeError ? '连接失败，请重新选择。' : error.message; } }
          }
          choose.addEventListener('click', () => { picker.hidden = !picker.hidden; choose.setAttribute('aria-expanded',String(!picker.hidden)); if (!picker.hidden) loadChoices(); });
          search.addEventListener('submit',event => { event.preventDefault(); offset = 0; loadChoices(); });
          prev.addEventListener('click',()=>{ offset = Math.max(0,offset - 20); loadChoices(); }); next.addEventListener('click',()=>{ offset += 20; loadChoices(); });
          select.addEventListener('change',()=>{ if (select.value) saveChoice(Number(select.value)); });
          if (book.selected_document_id) { const restore = el('button','book-restore','恢复推荐'); restore.type = 'button'; restore.addEventListener('click',()=>{ picker.hidden = false; choose.setAttribute('aria-expanded','true'); restore.disabled = true; saveChoice(null).finally(()=>restore.disabled = false); }); actions.append(restore); }
          const source = el('a', 'book-source', '教材信息 ↗'); source.href = book.source_url; source.target = '_blank'; source.rel = 'noopener noreferrer'; if (book.source_url) actions.append(source);
          row.append(spine, info, actions, picker); if (previous) { previous.replaceWith(row); choose.focus(); } else target.append(row);
        }
        for (const [index, stage] of ['基础入门', '核心理论', '进阶学习'].entries()) {
          const section = el('section', 'textbook-stage'); section.dataset.stage = stage;
          const heading = el('div', 'stage-heading'); heading.append(el('span', 'stage-number', String(index + 1)), el('h3', '', stage)); section.append(heading);
          const columns = el('div', 'recommendation-columns');
          for (const [language, label] of [['zh', '中文推荐'], ['en', '英文推荐']]) {
            const group = el('section', 'recommendation-language'); group.dataset.language = language; group.append(el('h4', '', label));
            const books = direction.books.filter(book => book.stage === stage && (book.language || 'en') === language);
            books.forEach((book, i) => renderBook(group, book, i));
            if (!books.length) group.append(el('p', 'recommendation-empty', '暂无推荐'));
            columns.append(group);
          }
          section.append(columns); $('textbook-list').append(section);
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
