import { mountIcons } from './icons.js';
import { createLearningLabs } from './learning-labs.js';
import { createPracticalLearningRoute } from './practical-learning.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const option=(text,value)=>{const n=el('option',text);n.value=value;return n;};
function bookRow(book,href,planButton){const row=el('article',null,'ai-study-book'),info=el('div');info.append(el('h3',book.title));if(book.authors)info.append(el('p',book.authors,'muted'));const link=el('a',book.progress?'继续学习':'开始阅读','button compact');link.href=href;const actions=el('div',null,'study-book-actions');actions.append(link,planButton(book,'math-to-ai'));row.append(info,actions);return row;}
function pageHeading(page){
 const entry=page==='entry',header=el('div',null,'ai-study-heading'),back=el('a',entry?'← 应用工作台':'← 学习入口','back-link'),title=el('h1',entry?'数学到人工智能':page==='practice'?'实战学习':'理论学习');back.href=entry?'#/':'#/apps/math-to-ai';if(entry)title.className='sr-only';header.append(back,title);return header;
}
function learningChoices(course,practice){
 const choices=el('div',null,'ai-learning-choices');
 for(const [kind,title,icon]of [['theory','理论学习','book'],['practice','实战学习','spark']]){
  const card=el('a',null,'ai-learning-choice '+kind),params=new URLSearchParams({course});if(kind==='practice'&&practice)params.set('practice',practice);card.href='#/apps/math-to-ai/'+kind+'?'+params;
  const badge=el('span',null,'ai-choice-icon');badge.dataset.icon=icon;badge.setAttribute('aria-hidden','true');card.append(badge);
  const art=el('div',null,'ai-choice-art');art.setAttribute('aria-hidden','true');
  art.innerHTML=kind==='theory'?'<svg viewBox="0 0 400 220" focusable="false"><path class="ai-choice-axis" d="M40 176H370M82 198V30"/><path class="ai-choice-guide" d="M82 70H262V176M82 123H192V176"/><path class="ai-choice-curve" d="M46 163C100 161 126 154 159 139S224 101 260 70S313 28 359 24"/><circle cx="192" cy="120" r="6"/><circle cx="262" cy="69" r="6"/></svg>':'<svg viewBox="0 0 400 220" focusable="false"><path class="ai-choice-link" d="M76 113H156Q172 113 172 97V61H237M172 97V165H237"/><rect x="38" y="91" width="54" height="44" rx="10"/><rect x="237" y="39" width="67" height="44" rx="10"/><rect x="237" y="143" width="67" height="44" rx="10"/><path class="ai-choice-code" d="M59 104L50 113L59 122M72 104L81 113L72 122M251 54H289M251 66H275M251 158H289M251 170H275"/></svg>';
  const caption=el('div',null,'ai-choice-caption'),arrow=el('span',null,'ai-choice-arrow');arrow.dataset.icon='forward';arrow.setAttribute('aria-hidden','true');caption.append(el('h2',title),arrow);card.append(art,caption);choices.append(card);
 }
 return choices;
}
export function createAiLearning({api,write,planButton}){
 const root=document.getElementById('ai-learning-view'),labs=createLearningLabs({api,write});let version=0,stop=null,reading=false,lastCourse='calculus',lastPractice=null;
 function close(){++version;stop?.();stop=null;root.hidden=true;if(reading){document.getElementById('reader-view').hidden=true;document.body.classList.remove('reading-page');}reading=false;}
 async function navigate(hash){close();root.hidden=false;const mine=version,params=new URLSearchParams(hash.split('?')[1]||''),course=params.get('course')||lastCourse,match=hash.match(/^#\/apps\/math-to-ai\/read\/(\d+)/);lastCourse=course;
  if(match){root.hidden=true;reading=true;document.getElementById('reader-view').hidden=false;document.body.classList.add('reading-page');const {openReader}=await import('./reader.js');if(mine!==version)return;const control=openReader(Number(match[1]),{api,write,basePath:'/api/library/documents',backHref:'#/apps/math-to-ai/theory?course='+encodeURIComponent(course),backLabel:'← 返回理论学习'});stop=control.close;await control.ready;return;}
  const path=hash.split('?')[0],page=path==='#/apps/math-to-ai'?'entry':path==='#/apps/math-to-ai/practice'?'practice':'theory';root.setAttribute('aria-label',page==='entry'?'数学到人工智能':page==='practice'?'实战学习':'理论学习');root.replaceChildren(pageHeading(page));
  if(page==='entry'){root.append(learningChoices(lastCourse,lastPractice));mountIcons();return;}
  if(page==='practice'){root.append(createPracticalLearningRoute(params.get('practice')||lastPractice,selected=>{lastPractice=selected;}));mountIcons();return;}
  mountIcons();
  const loading=el('p','正在加载学习路线…','muted');root.append(loading);
  try{const [{courses}]=await Promise.all([api('/api/ai-learning'),labs.load()]);if(mine!==version)return;loading.remove();
   const chosen=courses.find(c=>c.slug===course)||courses[0];if(!chosen){root.append(el('p','课程暂不可用','muted'));return;}
   const detail=el('section',null,'ai-study-detail');let selected='';
   function selectCourse(slug,updateUrl=false){const course=courses.find(c=>c.slug===slug);if(!course||selected===slug)return;selected=slug;
    for(const node of root.querySelectorAll('[data-ai-course]')){const active=node.dataset.aiCourse===slug;node.classList.toggle('selected',active);if(active)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');}
    detail.replaceChildren(el('h2',course.name));const context=el('div',null,'ai-study-context'),topics=el('div'),list=el('ul');topics.append(el('h3','学习重点'));for(const text of course.topics.split('；'))list.append(el('li',text));topics.append(list);const practice=el('div');practice.append(el('h3','动手练习'),el('p',course.practice));context.append(topics,practice);detail.append(context);
    detail.append(el('h3','课程教材'));for(const book of course.books)detail.append(bookRow(book,`#/apps/math-to-ai/read/${book.id}?course=${course.slug}`,planButton));if(!course.books.length)detail.append(el('p','暂无关联教材','muted'));
    const experiments=labs.section(course);if(experiments)detail.append(experiments);
    lastCourse=slug;if(updateUrl){const params=new URLSearchParams(location.hash.split('?')[1]||'');params.set('course',slug);history.replaceState(history.state,'','#/apps/math-to-ai/theory?'+params);}mountIcons();
   }
   root.append(aiRoadmap(courses,chosen.slug,slug=>selectCourse(slug,true)),detail);selectCourse(chosen.slug);

  }catch(error){if(mine===version){loading.remove();root.append(el('p',error.message||'加载失败，请刷新重试。','notice error'));}}
 }
 return {navigate,close};
}

export function createAdminAiLearning({api,write,message}){
 const root=document.getElementById('ai-learning-view');let courses=[],selected='calculus',offset=0,version=0,busy=false;
 root.innerHTML='<div class="admin-heading"><h1>数学到人工智能 · 教材配置</h1></div><div class="ai-admin-courses" aria-label="选择课程"></div><section class="admin-editor"><h2 id="ai-study-course-title"></h2><form id="ai-study-search" class="series-search"><input type="search" id="ai-study-query" placeholder="搜索文献标题或作者" aria-label="搜索文献"><button class="button">搜索</button></form><div class="series-admin-associate"><select id="ai-study-folder" aria-label="文档库目录"></select><select id="ai-study-document" aria-label="选择课程教材"></select><button class="button primary" id="ai-study-add">添加教材</button></div><div class="series-pager"><button class="button compact" id="ai-study-prev">上一页</button><span id="ai-study-page"></span><button class="button compact" id="ai-study-next">下一页</button></div><div id="ai-study-books"></div></section>';
 const $=id=>root.querySelector('#'+id);
 function render(){const nav=root.querySelector('.ai-admin-courses');nav.replaceChildren();for(const c of courses){const b=el('button',c.name,'button compact');b.disabled=busy;b.setAttribute('aria-pressed',String(c.slug===selected));b.onclick=()=>{selected=c.slug;render();};nav.append(b);}const course=courses.find(c=>c.slug===selected);if(!course)return;$('ai-study-course-title').textContent=course.name;$('ai-study-books').replaceChildren();for(const book of course.books){const row=el('article',null,'ai-study-book'),info=el('div');info.append(el('h3',book.title),el('p',book.authors||'','muted'));const actions=el('div',null,'series-member-actions'),order=el('input');order.type='number';order.min=0;order.max=1000000;order.value=book.sort_order;order.setAttribute('aria-label','排序 '+book.title);const save=el('button','保存顺序','button compact'),remove=el('button','移除','button compact');save.onclick=()=>action(()=>write(`/api/admin/ai-learning/${selected}/books/${book.id}`,{sort_order:Number(order.value)},'PATCH'));remove.onclick=()=>action(()=>write(`/api/admin/ai-learning/${selected}/books/${book.id}`,{},'DELETE'));actions.append(order,save,remove);row.append(info,actions);$('ai-study-books').append(row);}if(!course.books.length)$('ai-study-books').append(el('p','暂无关联教材','muted'));}
 async function documents(){const mine=++version,body=await api('/api/admin/documents?'+new URLSearchParams({q:$('ai-study-query').value.trim(),collection:$('ai-study-folder').value,offset}));if(mine!==version)return;$('ai-study-document').replaceChildren(option('请选择文献',''),...body.documents.map(d=>option(d.title,d.id)));$('ai-study-prev').disabled=offset===0;$('ai-study-next').disabled=offset+body.limit>=body.total;$('ai-study-page').textContent=`第 ${offset/20+1} / ${body.total_pages} 页 · 共 ${body.total} 本`;$('ai-study-add').disabled=true;}
 async function load(){const [body,archive]=await Promise.all([api('/api/admin/ai-learning'),api('/api/admin/collections')]);courses=body.courses;if(!courses.some(c=>c.slug===selected))selected=courses[0]?.slug||'';const previous=$('ai-study-folder').value,path=f=>{const names=[],seen=new Set();while(f&&!seen.has(f.id)){seen.add(f.id);names.unshift(f.name);f=archive.collections.find(p=>p.id===f.parent_id);}return names.join(' / ');};$('ai-study-folder').replaceChildren(option('全部文献',''),...archive.collections.map(f=>option(path(f),f.id)));$('ai-study-folder').value=previous||'';if($('ai-study-folder').selectedIndex<0)$('ai-study-folder').value='';render();await documents();}
 async function action(work){if(busy)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);try{await work();message('课程教材已保存。');}catch(error){message(error.message,true);}finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);await load().catch(error=>message(error.message,true));}}
 $('ai-study-search').onsubmit=e=>{e.preventDefault();offset=0;documents().catch(e=>message(e.message,true));};$('ai-study-folder').onchange=()=>{offset=0;documents().catch(e=>message(e.message,true));};$('ai-study-document').onchange=()=>$('ai-study-add').disabled=busy||!$('ai-study-document').value;$('ai-study-add').onclick=()=>action(()=>write(`/api/admin/ai-learning/${selected}/books`,{document_id:Number($('ai-study-document').value)}));for(const [id,delta]of [['ai-study-prev',-20],['ai-study-next',20]])$(id).onclick=()=>{offset=Math.max(0,offset+delta);documents().catch(e=>message(e.message,true));};
 return {load};
}

// Keep the AI route in the same visual language as the analysis course map.
function aiRoadmap(courses, chosen, onChoose) {
 const ns='http://www.w3.org/2000/svg';
 const make=(tag,attrs={},text)=>{const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;return node;};
 const box=document.createElement('nav');box.className='ai-study-map';box.setAttribute('aria-label','数学到人工智能学习路线');
 const svg=make('svg',{viewBox:'0 0 1080 226',class:'analysis-map-canvas ai-map-canvas',role:'group','aria-label':'从左向右分四列：第一列数学分析、高等代数、概率统计；第二列机器学习、Python；第三列深度学习、PyTorch 实践；第四列自然语言处理、LLM。'});
 const defs=make('defs');
 const gradient=(id,colors)=>{const node=make('linearGradient',{id,x1:'0%',y1:'0%',x2:'100%',y2:'100%'});colors.forEach((color,index)=>node.append(make('stop',{offset:index/(colors.length-1)*100+'%','stop-color':color})));defs.append(node);};
 gradient('ai-map-night',['#152a52','#121d3c','#24395d']);
 const palettes={math:['#4867da','#2942aa'],algebra:['#7545b2','#493076'],probability:['#147b7c','#105054'],code:['#23789b','#16455e'],learning:['#5156b3','#34356f'],deep:['#7545b2','#493076'],language:['#147b7c','#105054'],model:['#395b9a','#243c6b']};
 for(const [kind,colors]of Object.entries(palettes))gradient('ai-node-'+kind,colors);
 const light=make('radialGradient',{id:'ai-map-light'});light.append(make('stop',{offset:'0%','stop-color':'#7097ff','stop-opacity':'.25'}),make('stop',{offset:'100%','stop-color':'#7097ff','stop-opacity':0}));defs.append(light);
 const marker=make('marker',{id:'ai-route-arrow',viewBox:'0 0 8 8',refX:7,refY:4,markerWidth:6,markerHeight:6,orient:'auto'});marker.append(make('path',{d:'M1 1L7 4L1 7',fill:'none',stroke:'#9db7e7','stroke-width':1.4}));defs.append(marker);svg.append(defs);
 const backdrop=make('g',{'aria-hidden':'true'});backdrop.append(make('rect',{width:1080,height:226,rx:14,fill:'url(#ai-map-night)'}),make('ellipse',{cx:180,cy:85,rx:180,ry:80,fill:'url(#ai-map-light)'}),make('ellipse',{cx:870,cy:90,rx:220,ry:80,fill:'url(#ai-map-light)'}));
 for(let i=0;i<68;i++)backdrop.append(make('circle',{cx:12+(i*137)%1056,cy:8+(i*47)%210,r:i%7===0?1.2:.65,fill:'#b2caff',opacity:i%3===0?.42:.2}));
 for(const [x,y]of [[350,20],[710,197],[1043,30]])backdrop.append(make('path',{d:`M${x-3} ${y}h6M${x} ${y-3}v6`,stroke:'#adceff','stroke-width':.7,opacity:.4}));svg.append(backdrop);
 const nodes=[
  ['calculus','∫',24,8,'math','foundation',154,42],['linear-algebra','ℝⁿ',24,92,'algebra','foundation',154,42],['probability','ℙ',24,176,'probability','foundation',154,42],
  ['python','Py',316,142,'code','foundation',154,42],['machine-learning','ƒ',316,50,'learning','core',154,42],
  ['deep-learning','⊗',608,50,'deep','core',154,42],['pytorch','Py',608,142,'code','support',154,42],['nlp','文',900,50,'language','core',154,42],
  ['llm','✦',900,142,'deep','core',154,42]
 ];
 const available=new Set(courses.map(course=>course.slug));
 const sharedFoundations=['calculus','linear-algebra','probability','machine-learning'].every(slug=>available.has(slug));
 if(sharedFoundations){
  svg.append(make('path',{class:'analysis-route-edge',d:'M178 29H237Q247 29 247 39V187Q247 197 237 197H178M178 113H247',fill:'none','aria-hidden':'true'}),make('path',{class:'analysis-route-edge',d:'M247 71H316',fill:'none','marker-end':'url(#ai-route-arrow)','aria-hidden':'true'}),make('circle',{cx:247,cy:71,r:2.5,fill:'#9db7e7',opacity:.85,'aria-hidden':'true'}));
 }
 const edges=[
  ['calculus','machine-learning','M178 29H237Q247 29 247 39V71H316'],
  ['linear-algebra','machine-learning','M178 113H247V71H316'],
  ['probability','machine-learning','M178 197H237Q247 197 247 187V71H316'],
  ['machine-learning','deep-learning','M470 71H608'],['deep-learning','nlp','M762 71H900'],
  ['nlp','llm','M977 92V142'],
  ['python','machine-learning','M393 142V92'],
  ['python','pytorch','M470 163H608'],['pytorch','deep-learning','M685 142V92',true]
 ];
 for(const [index,[from,to,d,optional]]of edges.entries())if(available.has(from)&&available.has(to)){
  // Draw the shared trunk once; retain each complete route for its moving light.
  const shared=sharedFoundations&&to==='machine-learning'&&from!=='python';
  svg.append(make('path',{class:'analysis-route-edge',d,fill:'none','marker-end':'url(#ai-route-arrow)','data-from':from,'data-to':to,...(optional?{'stroke-dasharray':'5 5'}:{}),...(shared?{'stroke-opacity':0,'marker-end':'none','pointer-events':'none'}:{})}));
  const spark=make('circle',{class:'analysis-route-spark',r:1.8,fill:'#d7f1ff','aria-hidden':'true'});spark.append(make('animateMotion',{path:d,dur:'6s',begin:-index*.7+'s',repeatCount:'indefinite'}));svg.append(spark);
 }
 const groups={foundation:make('g',{class:'ai-study-foundations'}),core:make('g',{class:'ai-study-main'}),support:make('g',{class:'ai-study-support'})};
 for(const [slug,symbol,x,y,kind,phase,width,height]of nodes){
  const course=courses.find(item=>item.slug===slug);if(!course)continue;
  const cy=y+height/2,iconX=x+25,radius=12,titleX=x+48;
  const node=make('a',{class:'analysis-course ai-course-node'+(slug===chosen?' selected':''),href:'#/apps/math-to-ai?course='+slug,'data-ai-course':slug,'aria-label':course.name,tabindex:0,...(slug===chosen?{'aria-current':'step'}:{})});
  node.append(make('title',{},course.name),make('rect',{class:'analysis-course-card',x,y,width,height,rx:11,style:'fill:url(#ai-node-'+kind+')'}),make('path',{class:'analysis-course-shine',d:`M${x+11} ${y+1}H${x+width-11}M${x+width-5} ${y+12}V${y+height-12}`}),make('circle',{class:'analysis-course-orbit',cx:iconX,cy,r:radius+3}),make('circle',{class:'analysis-course-icon',cx:iconX,cy,r:radius}),make('text',{class:'analysis-course-symbol',x:iconX,y:cy,'text-anchor':'middle','dominant-baseline':'central'},symbol),make('text',{class:'analysis-course-title',x:titleX,y:cy,'dominant-baseline':'central',...(slug==='python'?{textLength:96,lengthAdjust:'spacingAndGlyphs'}:{})},course.name),make('path',{class:'analysis-course-picked',d:`M${x+width-10} ${y+6}l3 3-3 3-3-3Z`}));
  node.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();onChoose(slug);});
  node.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));}});
  groups[phase].append(node);
 }
 svg.append(...Object.values(groups));box.append(svg);return box;
}
