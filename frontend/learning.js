const $ = id => document.getElementById(id);
const analysisCourses = ['数学分析','高等代数','复分析','实分析与测度论','常微分方程','泛函分析','偏微分方程'];
const folderAnalysisCourses = ['分析','复分析','测度论','实分析','常微分方程','高等代数','抽象代数','泛函分析','偏微分方程'];
function el(tag, className, text) { const value = document.createElement(tag); if (className) value.className = className; if (text !== undefined) value.textContent = text; return value; }
function analysisRoadmap(onChoose, courses = analysisCourses, custom = false) {
  const ns = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs, text) => {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const svg = make('svg', {viewBox:'0 0 940 170',role:'group','aria-label':custom ? '分析学习路线：数学分析通向复分析、测度论和常微分方程；测度论指向第三列的实分析；高等代数通向抽象代数及泛函分析；抽象代数以虚线关联泛函分析，作为补充知识；实分析通向泛函分析，再到偏微分方程。常微分方程建议先于偏微分方程学习。' : '分析学习路线：数学分析通向复分析、实分析与测度论及常微分方程；实分析与测度论和高等代数通向泛函分析，再到偏微分方程。常微分方程建议先于偏微分方程学习。'});
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
  const customEdges = [
    ['分析','复分析','M172 85 H180 Q188 85 188 77 V37 Q188 29 196 29 H204'],
    ['分析','测度论','M172 85 H204'],
    ['分析','常微分方程','M172 85 H180 Q188 85 188 93 V133 Q188 141 196 141 H204'],
    ['测度论','实分析','M360 85 H392'],
    ['实分析','泛函分析','M548 85 H580'],
    ['高等代数','泛函分析','M548 29 H552 Q564 29 564 41 V73 Q564 85 576 85 H580'],
    ['高等代数','抽象代数','M548 29 H580'],
    ['抽象代数','泛函分析','M658 50 V64',true],
    ['泛函分析','偏微分方程','M736 85 H768'],
    ['常微分方程','偏微分方程','M360 141 H838 Q846 141 846 133 V106',true]
  ];
  const edges=custom ? customEdges.map(([from,to,d,optional=false])=>[d,optional,from,to]) : [
    ['M208 85 C242 85 236 22 270 22',false],['M208 85 H270',false],['M208 85 C242 85 236 148 270 148',false],
    ['M485 85 H550',false],['M630 43 V64',false],['M710 85 H760',false],['M485 148 H825 Q845 148 845 128 V106',true]
  ];
  for (const [d,optional,from,to] of edges) svg.append(make('path',{class:'analysis-route-edge',d,fill:'none',stroke:'url(#analysis-edge-fill)','stroke-width':'2','marker-end':'url(#analysis-route-arrow)',...(from ? {'data-from':from,'data-to':to} : {}),...(optional ? {'stroke-dasharray':'5 5'} : {})}));
  const nodes = custom ? [
    ['分析','∫',16,64,156,'foundation'],['复分析','ℂ',204,8,156,'complex'],
    ['测度论','μ',204,64,156,'real'],['实分析','ℝ',392,64,156,'real'],
    ['常微分方程','y′',204,120,156,'ode'],['高等代数','ℝⁿ',392,8,156,'support'],
    ['抽象代数','𝔾',580,8,156,'complex'],['泛函分析','‖f‖',580,64,156,'functional'],['偏微分方程','∂',768,64,156,'pde']
  ] : [
    ['数学分析','∫',28,64,180,'foundation'],['复分析','ℂ',270,1,215,'complex'],['实分析与测度论','μ',270,64,215,'real'],
    ['常微分方程','y′',270,127,215,'ode'],['高等代数','ℝⁿ',550,1,160,'support'],['泛函分析','‖f‖',550,64,160,'functional'],['偏微分方程','∂',760,64,170,'pde']
  ];
  for (const [name,symbol,x,y,width,kind] of nodes) {
    const group=make('g',{'class':'analysis-course '+kind,'data-course':name,role:'button',tabindex:0,'aria-pressed':'false','aria-controls':'textbook-list'});
    group.append(make('title',{},name),make('rect',{class:'analysis-course-card',x,y,width,height:42,rx:11}),
      make('circle',{class:'analysis-course-icon',cx:x+28,cy:y+21,r:14}),
      make('text',{class:'analysis-course-symbol',x:x+28,y:y+21,'text-anchor':'middle','dominant-baseline':'central'},symbol),
      make('text',{class:'analysis-course-title',x:x+53,y:y+21,'dominant-baseline':'central'},custom && name==='分析' ? '数学分析' : name));
    group.addEventListener('click',()=>onChoose(name));
    group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onChoose(name);}});
    svg.append(group);
  }
  const box=el('div','analysis-roadmap');box.append(svg);
  const layout=el('div','analysis-route-layout');layout.append(box);return layout;
}
export function createLearning({ api, write }) {
  let generation = 0, stopReader = null, current = '', ownsReader = false;
  function close() { ++generation; if (stopReader) stopReader(); stopReader = null; if (ownsReader) { $('reader-view').hidden = true; document.body.classList.remove('reading-page'); } ownsReader = false; }
  async function navigate(hash) {
    close(); current = hash; const version = generation;
    $('learning-status').textContent = ''; $('retry-learning').hidden = true;
    const reading = hash.match(/^#\/apps\/mathematics\/read\/(\d+)$/);
    ownsReader = !!reading;
    const detail = hash.match(/^#\/apps\/mathematics\/directions\/([a-z-]+)$/) || (/^#\/apps\/mathematics\/?$/.test(hash) ? ['', 'analysis'] : null);
    $('reader-view').hidden = !reading; $('module-view').hidden = !!reading;
    $('direction-detail').hidden = !detail;
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
        direction.books = direction.books.filter(book => book.available);
        if (direction.slug === 'analysis' && direction.custom_courses) {
          try {
            const algebra = await api('/api/learning/directions/algebra');if (version !== generation) return;
            direction.books.push(...algebra.books.filter(book=>book.available && ['高等代数','抽象代数'].includes(book.stage)));
          } catch { if (version !== generation) return; /* The empty panel retains its algebra entry point. */ }
        }
        $('direction-title').textContent = direction.slug === 'analysis' ? '数学与应用数学' : direction.name;
        const analysisFlow = direction.slug === 'analysis';
        const configuredCourses = direction.courses || (analysisFlow ? analysisCourses : ['基础入门','核心理论','进阶学习']);
        const courses = analysisFlow && direction.custom_courses ? [...new Set([...folderAnalysisCourses,...configuredCourses])] : configuredCourses;
        $('direction-introduction').hidden = !!direction.custom_courses && !analysisFlow;
        $('direction-introduction').closest('.direction-intro-section').hidden = !!direction.custom_courses && !analysisFlow;
        let selectCourse = () => {};
        $('textbook-list').classList.toggle('analysis-textbooks',analysisFlow);
        $('direction-introduction').classList.remove('analysis-flow');
        $('direction-introduction').classList.toggle('analysis-route', analysisFlow);
        if (analysisFlow) {
          const item=el('div','analysis-route-item'), content=el('dd','analysis-route-content');
          content.append(analysisRoadmap(name=>selectCourse(name),courses,!!direction.custom_courses));item.append(el('dt','sr-only','学习路线'),content);
          $('direction-introduction').append(item);
        }
        else if (!direction.custom_courses) for (const [field,label] of [['research_object','研究对象'],['core_content','核心内容'],['prerequisites','需要基础']]) {
          const item = el('div','introduction-item');
          item.append(el('dt','',label),el('dd','',direction.introduction?.[field] || '方向介绍暂未配置。'));
          $('direction-introduction').append(item);
        }
        function renderBook(target, book, i) {
          const row = el('article', 'textbook-row'); row.dataset.recommendation = book.id;
          const index = el('span','textbook-number',String(i+1).padStart(2,'0'));
          const info = el('div','textbook-info'); info.append(el('h3','',book.title));
          if (book.authors) info.append(el('p','textbook-author',book.authors));
          const actions = el('div','textbook-actions');
          if (book.available) {
            const link=el('a','button primary',book.progress ? '继续学习' : '开始学习');
            link.href=`#/apps/mathematics/read/${book.id}`;link.dataset.book=book.id;
            link.setAttribute('aria-label',(book.progress ? '继续学习' : '开始学习')+'：'+book.title);
            if(book.progress) link.title='已读至第 '+book.progress.page+' 页';
            actions.append(link);
          }
          row.append(index,info,actions);target.append(row);
        }
        const unclassified = analysisFlow && direction.books.some(book=>!courses.includes(book.stage));
        const groups = unclassified ? [...courses,'待归类教材'] : courses;
        const list = $('textbook-list'); list.classList.add('textbook-browser','compact-recommendations');
        const navigation = el(analysisFlow ? 'ol' : 'nav', 'textbook-course-nav'); navigation.hidden=analysisFlow; navigation.setAttribute('aria-label', '教材课程');
        const panels = el('div', 'textbook-course-panels');
        for (const [index, stage] of groups.entries()) {
          const section = el('section', 'textbook-stage'); section.dataset.stage = stage;
          section.id = 'textbook-panel-' + direction.slug + '-' + index; section.hidden = true;
          const button = el(analysisFlow ? 'li' : 'button', analysisFlow ? 'course-heading-label' : 'course-heading-button'); button.dataset.course = stage;
          button.id = section.id + '-control';
          if (!analysisFlow) { button.type = 'button'; button.setAttribute('aria-controls', section.id); button.setAttribute('aria-pressed', 'false'); }
          button.append(el('span', 'course-index', String(index + 1).padStart(2, '0')), el('span', '', stage));
          if (!analysisFlow) button.addEventListener('click', () => selectCourse(stage)); navigation.append(button);
          section.setAttribute('aria-labelledby', section.id+'-heading');
          const heading = el('div', 'stage-heading'); heading.append(el('h3', '', stage));
          const count = direction.books.filter(book => stage === '待归类教材' ? !courses.includes(book.stage) : book.stage === stage).length;
          heading.querySelector('h3').id=section.id+'-heading';heading.append(el('p', 'course-panel-meta', count + ' 本推荐教材')); section.append(heading);
          const columns = el('div', 'recommendation-columns');
          if(analysisFlow) columns.id='analysis-books-'+index;
          const books = direction.books.filter(book => stage === '待归类教材' ? !courses.includes(book.stage) : book.stage === stage);
          books.forEach((book,i)=>renderBook(columns,book,i));
          if (!books.length) columns.append(el('p','recommendation-empty','暂无推荐教材'));
          if (analysisFlow && direction.custom_courses && ['高等代数','抽象代数'].includes(stage) && !count) {
            const algebraLink=el('a','button compact','查看代数方向教材');algebraLink.href='#/apps/mathematics/directions/algebra';columns.append(algebraLink);
          }
          section.append(columns); panels.append(section);
        }
        list.append(navigation, panels);
        const storageKey = 'axiom:textbook-course:' + direction.slug;
          selectCourse = name => {
            if (!groups.includes(name)) return;
            for (const section of panels.children) {
              const selected=section.dataset.stage===name;section.hidden=!selected;section.classList.toggle('course-collapsed',!selected);
            }
            for (const button of navigation.children) {
              const selected = button.dataset.course === name; button.classList.toggle('is-current', selected);
              if (analysisFlow) { if (selected) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current'); }
              else button.setAttribute('aria-pressed', String(selected));
            }
            for (const node of $('direction-introduction').querySelectorAll('[data-course]')) {
              const selected = node.dataset.course === name;
              node.setAttribute('aria-pressed',String(selected)); node.classList.toggle('selected',selected);
            }
            try { sessionStorage.setItem(storageKey, name); } catch {}
          };
          if (!analysisFlow) navigation.addEventListener('keydown', event => {
            const buttons = [...navigation.children], index = buttons.indexOf(event.target); if (index < 0) return;
            let next;
            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % buttons.length;
            else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = buttons.length - 1;
            else return;
            event.preventDefault(); buttons[next].focus(); selectCourse(buttons[next].dataset.course);
          });
          if (unclassified) {
            const pending=el('button','button compact unclassified-books','待归类教材');pending.type='button';
            pending.addEventListener('click',()=>selectCourse('待归类教材'));$('direction-introduction').querySelector('.analysis-route-content').append(pending);
          }
          let remembered; try { remembered = sessionStorage.getItem(storageKey); } catch {}
          selectCourse(groups.includes(remembered) ? remembered : groups[0]);

      }
    } catch (error) {
      if (version !== generation) return;
      const message = error instanceof TypeError ? '连接失败，请检查连接后重试。' : error.message;
      $(reading ? 'reader-status' : 'learning-status').textContent = message;
      $('retry-learning').hidden = !!reading;
    }
  }
  $('retry-learning').addEventListener('click', () => navigate(current));
  return { navigate, close };
}
