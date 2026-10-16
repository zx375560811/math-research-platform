import { mountIcons } from './icons.js';

const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const noticeUrl = 'https://shuxue.yangtzeu.edu.cn/info/1064/3987.htm';
function external(text, href) {
  const a = el('a', text, 'competition-source');
  a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
  return a;
}

export function createCompetition({ api, write, planButton }) {
  const root = document.getElementById('competition-view');
  let generation=0, stop=null, reading=false, lastCourse='analysis';
  function close() {
    ++generation;const flushed=stop?.();stop=null;root.hidden=true;
    if(reading){document.getElementById('reader-view').hidden=true;document.body.classList.remove('reading-page');}
    reading=false;return flushed;
  }
  async function navigate(hash) {
    const flushed=close(),mine=generation,params=new URLSearchParams(hash.split('?')[1]||'');
    lastCourse=params.get('course')||lastCourse;await flushed;if(mine!==generation)return;
    const match=hash.match(/^#\/apps\/competition\/read\/(\d+)(?:\?|$)/);
    if(match){reading=true;document.getElementById('reader-view').hidden=false;document.body.classList.add('reading-page');
      const {openReader}=await import('./reader.js');if(mine!==generation)return;
      const control=openReader(Number(match[1]),{api,write,basePath:'/api/library/documents',backHref:'#/apps/competition?'+params,backLabel:'← 返回数学竞赛'});stop=control.close;await control.ready;return;
    }
    root.hidden=false;const back=el('a','← 应用工作台','back-link');back.href='#/';
    const heading=el('header',null,'competition-heading'),title=el('div');title.append(el('h1','数学竞赛'),el('span','大学生 · 数学专业类','competition-scope'));heading.append(title,external('竞赛范围 ↗',noticeUrl));
    const loading=el('p','正在加载备赛资料…','muted');loading.setAttribute('role','status');root.replaceChildren(back,heading,loading);
    try{
      const [{courses},{resources}]=await Promise.all([api('/api/competition'),api('/api/competition/resources')]);if(mine!==generation)return;loading.remove();
      const tabs=el('nav',null,'competition-tabs');tabs.setAttribute('aria-label','竞赛资料分类');
      const foundation=el('div'),detail=el('section',null,'competition-detail'),catalog=el('section',null,'competition-catalog');catalog.setAttribute('aria-label','大纲与历年试卷');
      let section=['syllabus','preliminary','final'].includes(params.get('section'))?params.get('section'):'foundation';
      if(!params.has('section')&&lastCourse==='past-papers')section='preliminary';
      let group=params.get('group')||'a',year=params.get('year')||'all',selected;
      const urlParams=()=>{const p=new URLSearchParams({section,course:lastCourse});if(section==='preliminary'||section==='final'){p.set('group',group);p.set('year',year);}return p;};
      const updateUrl=()=>history.replaceState(history.state,'','#/apps/competition?'+urlParams());
      function readButton(book){const a=el('a',book.progress?'继续学习':'开始学习','button compact');a.href=`#/apps/competition/read/${book.id}?${urlParams()}`;return a;}
      function selectCourse(slug,update=false){const course=courses.find(c=>c.slug===slug);if(!course)return;selected=slug;lastCourse=slug;
        for(const n of root.querySelectorAll('[data-competition-course]')){const active=n.dataset.competitionCourse===slug;n.classList.toggle('selected',active);n.setAttribute('aria-pressed',String(active));}
        const head=el('div',null,'competition-detail-heading');head.append(el('h2',course.name),el('span',course.phase==='foundation'?'共同基础':'备赛训练','competition-phase'));
        const context=el('div',null,'competition-context'),focus=el('div'),list=el('ul'),training=el('div');focus.append(el('h3','学习重点'));for(const text of course.topics.split('；').filter(Boolean))list.append(el('li',text));focus.append(list);training.append(el('h3','怎么练'),el('p',course.practice));context.append(focus,training);
        const books=el('div',null,'competition-books');books.append(el('h3',slug==='training'?'专题题集':slug==='past-papers'?'原有真题资料':'课程教材'));
        for(const book of course.books){const row=el('article',null,'competition-book'),info=el('div'),actions=el('div',null,'study-book-actions');info.append(el('h4',book.title));if(book.authors)info.append(el('p',book.authors,'muted'));actions.append(readButton(book),planButton(book,'competition'));row.append(info,actions);books.append(row);}
        if(!course.books.length)books.append(el('p','暂无关联资料，待管理员从文献库添加。','competition-empty'));
        detail.replaceChildren(head,context,books);if(update)updateUrl();mountIcons();
      }
      function showSection(value,update=true){section=value;
        if(section==='preliminary'&&!['a','b'].includes(group))group='a';if(section==='final'&&!['junior','senior'].includes(group))group='junior';
        foundation.hidden=section!=='foundation';catalog.hidden=section==='foundation';
        for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.section===section));
        if(section==='foundation')selectCourse(selected||lastCourse);else renderResources();if(update)updateUrl();mountIcons();
      }
      function renderResources(){catalog.replaceChildren();
        const heading=el('div',null,'competition-catalog-heading');heading.append(el('h2',section==='syllabus'?'考试大纲':section==='preliminary'?'初赛真题':'决赛真题'));
        const controls=el('div',null,'competition-resource-controls');
        if(section!=='syllabus'){
          const groups=el('div',null,'competition-groups');groups.setAttribute('aria-label',section==='preliminary'?'初赛类别':'决赛组别');
          for(const [key,label]of section==='preliminary'?[['a','数学 A 类'],['b','数学 B 类']]:[['junior','低年级组'],['senior','高年级组']]){const b=el('button',label,'button compact');b.type='button';b.setAttribute('aria-pressed',String(key===group));b.onclick=()=>{group=key;renderResources();updateUrl();};groups.append(b);}controls.append(groups);
          const years=[...new Set(resources.filter(r=>r.stage===section&&r.group_key===group).map(r=>r.year))].sort((a,b)=>b-a),filter=el('select');filter.setAttribute('aria-label','试卷年份');for(const [value,label]of [['all','全部年份'],...years.map(y=>[String(y),y?y+' 年':'年份待核（按届次）'])]){const o=el('option',label);o.value=value;filter.append(o);}filter.value=year;if(filter.selectedIndex<0){year='all';filter.value='all';}filter.onchange=()=>{year=filter.value;renderResources();updateUrl();};controls.append(filter);
        }
        heading.append(controls);catalog.append(heading);
        const items=resources.filter(r=>r.stage===section&&(section==='syllabus'||r.group_key===group&&(year==='all'||String(r.year)===year)));
        const list=el('div',null,'competition-resource-list');list.setAttribute('aria-live','polite');
        for(const item of items){const row=el('article',null,'competition-resource'),info=el('div'),meta=el('div',null,'competition-resource-meta');row.dataset.resource=item.id;
          if(item.year)meta.append(el('span',item.year+' 年'));if(item.edition)meta.append(el('span','第 '+item.edition+' 届'));meta.append(el('span',({syllabus:'考试内容',paper:'试卷',answer:'参考答案',combined:'试题与参考答案'})[item.kind]));info.append(meta,el('h3',item.title));
          const actions=el('div',null,'study-book-actions');if(item.document){actions.append(readButton(item.document),planButton(item.document,'competition'));}else if(item.download_url){const file=external('原站 PDF ↗',item.download_url);file.className='button compact';actions.append(file);}else info.append(el('p','来源为网页资料','muted'));
          if(item.source_url)actions.append(external('查看来源 ↗',item.source_url));row.append(info,actions);list.append(row);
        }
        if(!items.length)list.append(el('p','暂无该类别资料。','competition-empty'));catalog.append(list);if(section==='preliminary')catalog.append(external('第 1—17 届初赛资料汇总 ↗','https://www.cmathc.org.cn/st/560.html'));mountIcons();
      }
      for(const [key,label]of [['foundation','共同基础'],['syllabus','考试大纲'],['preliminary','初赛真题'],['final','决赛真题']]){const b=el('button',label,'button');b.type='button';b.dataset.section=key;b.onclick=()=>showSection(key);tabs.append(b);}
      foundation.append(roadmap(courses,slug=>{selectCourse(slug);if(slug==='past-papers')showSection('preliminary');else updateUrl();}),detail,finalsGuide());root.append(tabs,foundation,catalog);
      selectCourse(courses.some(c=>c.slug===lastCourse)?lastCourse:courses[0]?.slug);showSection(section,false);
    }catch(error){if(mine!==generation)return;loading.remove();const retry=el('button','重新加载','button compact');retry.type='button';retry.onclick=()=>navigate(location.hash);root.append(el('p',error.message||'加载失败，请重试。','notice error'),retry);}
  }
  return{navigate,close};
}

function finalsGuide() {
  const guide = el('details', null, 'competition-finals');
  guide.append(el('summary', '决赛如何衔接'));
  const content = el('div');
  content.append(el('p', '低年级：在初赛三科基础上补常微分方程。'), el('p', '高年级：再从实变函数、复变函数、抽象代数、数值分析、微分几何、概率论等科目中准备选做科目。'));
  const link = el('a', '前往数学与应用数学补基础', 'button compact'); link.href = '#/apps/mathematics';
  content.append(link, external('查看当届通知与具体范围 ↗', noticeUrl)); guide.append(content);
  return guide;
}

function roadmap(courses, onChoose) {
  const ns = 'http://www.w3.org/2000/svg';
  const svgNode = (tag, attrs = {}, text) => {
    const n = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, value);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const frame = el('nav', null, 'competition-map'); frame.setAttribute('aria-label', '数学专业类备赛路线');
  const svg = svgNode('svg', { viewBox: '0 0 1080 226', class: 'competition-map-canvas', role: 'group', 'aria-label': '数学分析、高等代数、解析几何并行学习，汇入专题训练，再做历年真题。' });
  const defs = svgNode('defs');
  for (const [id, a, b] of [['analysis', '#4b65b7', '#293c76'], ['algebra', '#805ba5', '#4e3a77'], ['geometry', '#297d88', '#225263'], ['training', '#896635', '#674c31'], ['past-papers', '#536fc5', '#354792']]) {
    const grad = svgNode('linearGradient', { id: 'competition-' + id, x2: '1', y2: '1' });
    grad.append(svgNode('stop', { 'stop-color': a }), svgNode('stop', { offset: '1', 'stop-color': b })); defs.append(grad);
  }
  const arrow = svgNode('marker', { id: 'competition-arrow', viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '5', markerHeight: '5', orient: 'auto' });
  arrow.append(svgNode('path', { d: 'M1 1L7 4L1 7', fill: 'none', stroke: '#92afde', 'stroke-width': '1.4' })); defs.append(arrow); svg.append(defs);
  // Geometry and constellation details are local SVG, shared with the platform's course maps.
  svg.append(svgNode('rect', { width: '1080', height: '226', rx: '12', fill: '#152a52' }));
  const stars = svgNode('g', { fill: '#96b3e4', opacity: '.45', 'aria-hidden': 'true' });
  for (let i = 0; i < 52; i++) stars.append(svgNode('circle', { cx: (i * 173 + 37) % 1060 + 10, cy: (i * 67 + 19) % 210 + 8, r: i % 7 === 0 ? 1.4 : .7 }));
  svg.append(stars);
  const edges = svgNode('g', { fill: 'none', stroke: '#92afde', 'stroke-width': '1.5', 'marker-end': 'url(#competition-arrow)' });
  for (const path of ['M238 49H355Q372 49 372 66V96Q372 113 389 113H463', 'M238 113H463', 'M238 177H355Q372 177 372 160V130Q372 113 389 113H463', 'M617 113H842']) edges.append(svgNode('path', { d: path }));
  svg.append(edges);
  const positions = { analysis: [84, 28, '∫'], algebra: [84, 92, 'V'], geometry: [84, 156, '△'], training: [463, 92, 'Σ'], 'past-papers': [842, 92, 'π'] };
  for (const course of courses) {
    const p = positions[course.slug]; if (!p) continue;
    const [x, y, symbol] = p;
    const node = svgNode('g', { transform: `translate(${x} ${y})`, role: 'button', tabindex: '0', 'aria-label': course.name, 'aria-pressed': 'false', 'data-competition-course': course.slug, class: 'competition-course' });
    node.append(svgNode('title', {}, course.name), svgNode('rect', { class: 'competition-node-body', width: '154', height: '42', rx: '11', fill: `url(#competition-${course.slug})` }), svgNode('path', { d: 'M11 4H143M149 12V30', fill: 'none', stroke: '#fff', opacity: '.18' }), svgNode('circle', { cx: '25', cy: '21', r: '12', fill: '#fff', opacity: '.12' }), svgNode('text', { x: '25', y: '22', class: 'competition-symbol', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'aria-hidden': 'true' }, symbol), svgNode('text', { x: '48', y: '21', 'dominant-baseline': 'central', class: 'competition-node-title' }, course.name));
    node.addEventListener('click', () => onChoose(course.slug));
    node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChoose(course.slug); } });
    svg.append(node);
  }
  frame.append(svg); return frame;
}
