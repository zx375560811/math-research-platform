import { mountIcons } from './icons.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const option=(text,value)=>{const n=el('option',text);n.value=value;return n;};
function bookRow(book,href,planButton){const row=el('article',null,'ai-study-book'),info=el('div');info.append(el('h3',book.title));if(book.authors)info.append(el('p',book.authors,'muted'));const link=el('a',book.progress?'继续学习':'开始阅读','button compact');link.href=href;const actions=el('div',null,'study-book-actions');actions.append(link,planButton(book,'math-to-ai'));row.append(info,actions);return row;}
const aiProjects={
 numpy:{name:'NumPy 100',repo:'rougier/numpy-100',description:'用数组创建、索引、切片、广播和向量化练习，熟悉 Python 数值计算的基本操作。'},
 matrix:{name:'NumPy 矩阵运算与 SVD',repo:'numpy/numpy-tutorials/blob/main/content/tutorial-svd.md',description:'NumPy 官方线性代数教程：用数组表示矩阵，练习转置、矩阵乘法、范数和奇异值分解，再用低秩矩阵重建图像。'},
 homemade:{name:'从零实现机器学习',repo:'trekhleb/homemade-machine-learning',description:'用 Python 从零实现回归、分类和聚类，配合数学说明与交互示例理解算法。'},
 handson:{name:'端到端机器学习项目',repo:'ageron/handson-ml3/blob/main/02_end_to_end_machine_learning_project.ipynb',description:'通过房价预测完成数据清洗、特征处理、模型训练、调参和评估，形成完整的机器学习流程。'},
 torch:{name:'PyTorch 从零到项目',repo:'mrdbourke/pytorch-deep-learning',description:'从 Tensor 和训练流程起步，逐步完成分类、计算机视觉和迁移学习项目。'},
 d2l:{name:'动手学深度学习',repo:'d2l-ai/d2l-zh',description:'中文教材与可运行代码相结合，通过回归、神经网络、注意力等例子学习深度学习。'},
 micrograd:{name:'micrograd 自动求导',repo:'karpathy/micrograd/blob/master/micrograd/engine.py',description:'从标量运算构建计算图，用链式法则计算复合函数的导数与偏导数。入口直接定位到自动微分引擎源码。'},
 examples:{name:'PyTorch 官方 MNIST 项目',repo:'pytorch/examples/tree/main/mnist',description:'用 PyTorch 完成手写数字识别，练习数据加载、训练循环、验证、设备选择及模型保存。'},
 nlp:{name:'自然语言处理：文本分类',repo:'practical-nlp/practical-nlp-code/tree/master/Ch4',description:'《Practical NLP》配套文本分类代码，将文本预处理、特征表示、分类器与评估串成一个自然语言处理项目。'},
 transformer:{name:'The Annotated Transformer',repo:'harvardnlp/annotated-transformer',description:'带逐步注释的 Transformer 实现，覆盖自注意力、多头注意力、位置编码、编码器与解码器，并用序列任务检验结构。'},
 scratch:{name:'从零构建大语言模型',repo:'rasbt/LLMs-from-scratch',description:'按章节实现分词、注意力、GPT、训练与微调，逐步理解语言模型内部结构。'},
 universe:{name:'LLM Universe 知识库问答',repo:'datawhalechina/llm-universe',description:'面向初学者的大模型应用教程，将文档处理、检索和回答组织成知识库问答应用。'}
};
const aiCourseProjects={
 calculus:[['micrograd','实践','从加法、乘法和幂函数开始，搭建复合函数的计算图；对比手算、自动求导与有限差分，验证链式法则。']],
 'linear-algebra':[['matrix','实践','先用 Python 完成矩阵转置、乘法与范数计算，再做 SVD 分解、矩阵重建和低秩近似。']],
 python:[['numpy','入门','练习数组创建、索引、切片和广播，逐步用向量化操作替代循环。']],
 'machine-learning':[['handson','入门','完成第 2 章端到端项目，记录数据处理、调参和评估结果。'],['homemade','进阶','自己实现回归或聚类，再与库函数的结果比较。']],
 'deep-learning':[['d2l','实践','完成多层感知机与卷积神经网络实验，记录网络结构、损失、训练曲线及过拟合现象。']],
 pytorch:[['torch','入门','按 00—03 节完成 Tensor、训练流程和分类练习。'],['examples','进阶','独立运行 MNIST，练习模型保存、加载和预测。']],
 nlp:[['nlp','实践','完成文本预处理、特征向量化与文本分类，比较不同文本表示下的分类效果。']],
 transformer:[['transformer','实践','逐步实现缩放点积注意力、多头注意力、位置编码和编解码器，运行示例检验掩码与输出维度。']],
 llm:[['scratch','进阶','构建小型 GPT，完成文本生成、权重加载与指令微调，理解大语言模型的训练和推理。'],['universe','应用','用数学文档搭建带来源的知识库问答，检查检索证据与回答是否一致。']]
};
function projectSection(slug){const projects=aiCourseProjects[slug];if(!projects?.length)return null;const section=el('section',null,'ai-study-projects'),heading=el('div',null,'ai-study-projects-heading');heading.append(el('h3','配套实践项目'));section.append(heading);const grid=el('div',null,'ai-project-grid');for(const [key,level,task]of projects){const project=aiProjects[key],card=el('article',null,'ai-project-card'),head=el('div',null,'ai-project-card-heading');card.dataset.project=key;head.append(el('h4',project.name),el('span',level,'ai-project-level'));const link=el('a','打开项目','button compact');link.href='https://github.com/'+project.repo;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','在新标签页打开 '+project.name);const glyph=el('span');glyph.dataset.icon='forward';glyph.setAttribute('aria-hidden','true');link.append(glyph);card.append(head,el('p',project.description,'ai-project-description'),el('p',task,'ai-project-task'),link);grid.append(card);}section.append(grid);return section;}
export function createAiLearning({api,write,planButton}){
 const root=document.getElementById('ai-learning-view');let version=0,stop=null,reading=false;
 function close(){++version;stop?.();stop=null;root.hidden=true;if(reading){document.getElementById('reader-view').hidden=true;document.body.classList.remove('reading-page');}reading=false;}
 async function navigate(hash){close();root.hidden=false;const mine=version,params=new URLSearchParams(hash.split('?')[1]||''),course=params.get('course')||'calculus',match=hash.match(/^#\/apps\/math-to-ai\/read\/(\d+)/);
  if(match){root.hidden=true;reading=true;document.getElementById('reader-view').hidden=false;document.body.classList.add('reading-page');const {openReader}=await import('./reader.js');if(mine!==version)return;const control=openReader(Number(match[1]),{api,write,basePath:'/api/library/documents',backHref:'#/apps/math-to-ai?course='+encodeURIComponent(course),backLabel:'← 返回数学到人工智能'});stop=control.close;await control.ready;return;}
  root.replaceChildren(el('p','正在加载学习路线…','muted'));
  try{const {courses}=await api('/api/ai-learning');if(mine!==version)return;root.replaceChildren();const header=el('div',null,'ai-study-heading'),back=el('a','← 应用工作台','back-link');back.href='#/';header.append(back,el('h1','数学到人工智能'));root.append(header);
   const chosen=courses.find(c=>c.slug===course)||courses[0];if(!chosen){root.append(el('p','课程暂不可用','muted'));return;}
   const detail=el('section',null,'ai-study-detail');let selected='';
   function selectCourse(slug,updateUrl=false){const course=courses.find(c=>c.slug===slug);if(!course||selected===slug)return;selected=slug;
    for(const node of root.querySelectorAll('[data-ai-course]')){const active=node.dataset.aiCourse===slug;node.classList.toggle('selected',active);if(active)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');}
    detail.replaceChildren(el('h2',course.name));const context=el('div',null,'ai-study-context'),topics=el('div'),list=el('ul');topics.append(el('h3','学习重点'));for(const text of course.topics.split('；'))list.append(el('li',text));topics.append(list);const practice=el('div');practice.append(el('h3','动手练习'),el('p',course.practice));context.append(topics,practice);detail.append(context);const projects=projectSection(course.slug);if(projects)detail.append(projects);detail.append(el('h3','课程教材'));for(const book of course.books)detail.append(bookRow(book,`#/apps/math-to-ai/read/${book.id}?course=${course.slug}`,planButton));if(!course.books.length)detail.append(el('p','暂无关联教材','muted'));
    if(updateUrl)history.replaceState(history.state,'','#/apps/math-to-ai?course='+encodeURIComponent(slug));mountIcons();
   }
   root.append(aiRoadmap(courses,chosen.slug,slug=>selectCourse(slug,true)),detail);selectCourse(chosen.slug);

  }catch(error){if(mine===version)root.replaceChildren(el('p',error.message||'加载失败，请刷新重试。','notice error'));}
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
 const svg=make('svg',{viewBox:'0 0 1330 248',class:'analysis-map-canvas ai-map-canvas',role:'group','aria-label':'从左向右：数学分析、高等代数、概率统计与 Python 打基础，依次学习机器学习、深度学习、自然语言处理、Transformer 和 LLM。Python 支持 PyTorch 实践，PyTorch 与深度学习配合学习。'});
 const defs=make('defs');
 const gradient=(id,colors)=>{const node=make('linearGradient',{id,x1:'0%',y1:'0%',x2:'100%',y2:'100%'});colors.forEach((color,index)=>node.append(make('stop',{offset:index/(colors.length-1)*100+'%','stop-color':color})));defs.append(node);};
 gradient('ai-map-night',['#152a52','#121d3c','#24395d']);
 const palettes={math:['#4867da','#2942aa'],algebra:['#7545b2','#493076'],probability:['#147b7c','#105054'],code:['#23789b','#16455e'],learning:['#5156b3','#34356f'],deep:['#7545b2','#493076'],language:['#147b7c','#105054'],model:['#395b9a','#243c6b']};
 for(const [kind,colors]of Object.entries(palettes))gradient('ai-node-'+kind,colors);
 const light=make('radialGradient',{id:'ai-map-light'});light.append(make('stop',{offset:'0%','stop-color':'#7097ff','stop-opacity':'.25'}),make('stop',{offset:'100%','stop-color':'#7097ff','stop-opacity':0}));defs.append(light);
 const marker=make('marker',{id:'ai-route-arrow',viewBox:'0 0 8 8',refX:7,refY:4,markerWidth:6,markerHeight:6,orient:'auto'});marker.append(make('path',{d:'M1 1L7 4L1 7',fill:'none',stroke:'#9db7e7','stroke-width':1.4}));defs.append(marker);svg.append(defs);
 const backdrop=make('g',{'aria-hidden':'true'});backdrop.append(make('rect',{width:1330,height:248,rx:14,fill:'url(#ai-map-night)'}),make('ellipse',{cx:230,cy:100,rx:280,ry:180,fill:'url(#ai-map-light)'}),make('ellipse',{cx:1100,cy:160,rx:290,ry:160,fill:'url(#ai-map-light)'}));
 for(let i=0;i<68;i++)backdrop.append(make('circle',{cx:12+(i*137)%1306,cy:8+(i*47)%232,r:i%7===0?1.2:.65,fill:'#b2caff',opacity:i%3===0?.42:.2}));
 for(const [x,y]of [[374,35],[735,204],[1090,47]])backdrop.append(make('path',{d:`M${x-3} ${y}h6M${x} ${y-3}v6`,stroke:'#adceff','stroke-width':.7,opacity:.4}));svg.append(backdrop);
 const nodes=[
  ['calculus','∫',24,40,'math','foundation'],['linear-algebra','ℝⁿ',24,164,'algebra','foundation'],['probability','ℙ',212,40,'probability','foundation'],
  ['python','Py',212,164,'code','foundation'],['machine-learning','ƒ',400,102,'learning','core'],
  ['deep-learning','⊗',588,40,'deep','core'],['pytorch','Py',400,164,'code','support'],['nlp','文',776,164,'language','core'],
  ['transformer','QK',964,40,'model','core'],['llm','✦',1152,102,'deep','core']
 ];
 const available=new Set(courses.map(course=>course.slug));
 const edges=[
  ['calculus','machine-learning','M178 61H186Q194 61 194 69V115Q194 123 202 123H400'],
  ['linear-algebra','machine-learning','M178 185H186Q194 185 194 177V131Q194 123 202 123H400'],
  ['probability','machine-learning','M366 61H374Q382 61 382 69V115Q382 123 390 123H400'],
  ['machine-learning','deep-learning','M554 123C574 123 568 61 588 61'],['deep-learning','nlp','M742 61C762 61 756 185 776 185'],
  ['nlp','transformer','M930 185C950 185 944 61 964 61'],['transformer','llm','M1118 61C1138 61 1132 123 1152 123'],
  ['python','machine-learning','M366 185H374Q382 185 382 177V131Q382 123 390 123H400'],
  ['python','pytorch','M366 185H400'],['pytorch','deep-learning','M554 185C574 185 568 75 588 75',true]
 ];
 for(const [index,[from,to,d,optional]]of edges.entries())if(available.has(from)&&available.has(to)){
  svg.append(make('path',{class:'analysis-route-edge',d,fill:'none','marker-end':'url(#ai-route-arrow)','data-from':from,'data-to':to,...(optional?{'stroke-dasharray':'5 5'}:{})}));
  const spark=make('circle',{class:'analysis-route-spark',r:1.8,fill:'#d7f1ff','aria-hidden':'true'});spark.append(make('animateMotion',{path:d,dur:'6s',begin:-index*.7+'s',repeatCount:'indefinite'}));svg.append(spark);
 }
 const groups={foundation:make('g',{class:'ai-study-foundations'}),core:make('g',{class:'ai-study-main'}),support:make('g',{class:'ai-study-support'})};
 for(const [slug,symbol,x,y,kind,phase]of nodes){
  const course=courses.find(item=>item.slug===slug);if(!course)continue;
  const node=make('a',{class:'analysis-course ai-course-node'+(slug===chosen?' selected':''),href:'#/apps/math-to-ai?course='+slug,'data-ai-course':slug,'aria-label':course.name,tabindex:0,...(slug===chosen?{'aria-current':'step'}:{})});
  node.append(make('title',{},course.name),make('rect',{class:'analysis-course-card',x,y,width:154,height:42,rx:11,style:'fill:url(#ai-node-'+kind+')'}),make('path',{class:'analysis-course-shine',d:`M${x+11} ${y+1}H${x+143}M${x+149} ${y+12}V${y+30}`}),make('circle',{class:'analysis-course-orbit',cx:x+25,cy:y+21,r:15.5}),make('circle',{class:'analysis-course-icon',cx:x+25,cy:y+21,r:12}),make('text',{class:'analysis-course-symbol',x:x+25,y:y+21,'text-anchor':'middle','dominant-baseline':'central'},symbol),make('text',{class:'analysis-course-title',x:x+48,y:y+21,'dominant-baseline':'central',...(slug==='python'?{textLength:96,lengthAdjust:'spacingAndGlyphs'}:{})},course.name),make('path',{class:'analysis-course-picked',d:`M${x+144} ${y+6}l3 3-3 3-3-3Z`}));
  node.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();onChoose(slug);});
  node.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));}});
  groups[phase].append(node);
 }
 svg.append(...Object.values(groups));box.append(svg);return box;
}
