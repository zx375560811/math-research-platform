import { mountIcons } from './icons.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const option=(text,value)=>{const n=el('option',text);n.value=value;return n;};
function bookRow(book,href,planButton){const row=el('article',null,'ai-study-book'),info=el('div');info.append(el('h3',book.title));if(book.authors)info.append(el('p',book.authors,'muted'));const link=el('a',book.progress?'继续学习':'开始阅读','button compact');link.href=href;const actions=el('div',null,'study-book-actions');actions.append(link,planButton(book,'math-to-ai'));row.append(info,actions);return row;}
// Each task stops at the named textbook material. Later courses are not implicit prerequisites.
const guide='https://github.com/zx375560811/math-research-platform/blob/main/docs/ai-course-projects.md#';
export const aiCourseProjects={
 calculus:[{
  id:'forward-ad',name:'用链式法则做自动求导',level:'基础实践',
  book:'数学分析：导数、乘积法则与复合函数求导。',
  prerequisites:'先会 Python 的函数、元组和循环；完成 Python 基础后再编程。',
  description:'把函数值与导数成对传递，实现单变量的前向自动微分。',
  task:'实现加法、乘法、整数幂和 sin，核对复合函数的手算导数。',
  completion:'四组函数同时通过手算值和中心差分检查；任务页给出输入、答案和容差。',
  environment:'Python 标准库，普通 CPU，无外部数据。',
  boundary:'只做单变量前向求导；计算图遍历、反向传播和神经网络留到后续课程。',
  guide:guide+'calculus'
 }],
 'linear-algebra':[{
  id:'matrix',name:'矩阵分解与低秩重建',level:'基础实践',
  book:'Strang《线性代数导论》第 2、4、6、7 章，做到奇异值分解。',
  prerequisites:'Python 基础与 NumPy 数组、索引和矩阵乘法。',
  description:'对小型二维数值矩阵做 SVD，用不同秩重建并比较误差。',
  task:'输出 U、奇异值和 Vh 的形状，验证完整重建，再比较秩 1、2、3 的近似。',
  completion:'完整重建误差小于 1e-10；秩增加时 Frobenius 误差不增，并解释原因。',
  environment:'Python + NumPy，普通 CPU，无图片或额外数据集。',
  boundary:'教程中的图像处理、SciPy 数据下载不属于本次任务。',
  source:'numpy/numpy-tutorials/blob/main/content/tutorial-svd.md',guide:guide+'linear-algebra'
 }],
 python:[{
  id:'random-walk',name:'随机漫步可视化',level:'基础实践',
  book:'《Python 编程：从入门到实践》第一版，基础部分与第 15 章随机漫步。',
  prerequisites:'列表、循环、函数、类与模块导入；绘图库用法随第 15 章学习。',
  description:'生成一条二维轨迹，绘图并标出起点和终点。',
  task:'用 random 生成非零步长，保留每一步坐标，再用 Matplotlib 绘制轨迹。',
  completion:'得到包含起点的 5,000 个点；坐标数一致、没有零步长，并保存一张轨迹图。',
  environment:'Python + Matplotlib，普通 CPU，无数据下载。',
  boundary:'这里只练习 Python 和绘图，不要求随机过程、机器学习或网页开发。',
  source:'ehmatthes/pcc/tree/master/chapter_15',guide:guide+'python'
 }],
 'machine-learning':[{
  id:'iris',name:'鸢尾花分类完整小项目',level:'基础实践',
  book:'Müller、Guido《Python 机器学习基础教程》第 1 章鸢尾花案例。',
  prerequisites:'Python、NumPy 基础；按本章学习训练集、测试集和 k 近邻。',
  description:'使用库内置的小数据集，完成数据划分、k 近邻训练和留出集评估。',
  task:'固定划分随机种子，只在训练集拟合，输出测试准确率和一个新样本的预测。',
  completion:'脚本可重复运行；报告划分数量、准确率，以及为何不能用测试集训练。',
  environment:'Python + NumPy + scikit-learn；iris 数据随库提供，无 GPU。',
  boundary:'只做第 1 章案例；调参流水线、神经网络与深度学习不在范围内。',
  source:'amueller/introduction_to_ml_with_python/blob/main/01-introduction.ipynb',guide:guide+'machine-learning'
 }],
 'deep-learning':[{
  id:'two-layer',name:'NumPy 两层网络识别手写数字',level:'课程实践',
  book:'斋藤康毅《深度学习入门：基于 Python 的理论与实现》第 1—5 章。',
  prerequisites:'Python、NumPy、矩阵乘法、链式法则；按本书学习损失函数与反向传播。',
  description:'用书中两层全连接网络完成 MNIST 训练，理解梯度怎样更新权重。',
  task:'完成 Affine、ReLU、SoftmaxWithLoss 的正反向计算与小批量训练。',
  completion:'先做小规模梯度检查，再记录训练损失和独立测试集准确率；能解释四组参数的形状。',
  environment:'Python + NumPy，普通 CPU；首次需下载 MNIST，训练时间取决于电脑。',
  boundary:'只实现第 5 章两层网络；不要求 CNN、PyTorch、注意力或迁移学习。',
  source:'oreilly-japan/deep-learning-from-scratch/tree/master/ch05',guide:guide+'deep-learning'
 }],
 pytorch:[{
  id:'torch-regression',name:'用 PyTorch 完成线性回归',level:'基础实践',
  book:'《动手学深度学习》PyTorch 版：第 2 章、3.1—3.3 节。',
  prerequisites:'Python、线性回归和梯度下降；Tensor、自动微分随指定章节学习。',
  description:'用合成数据串起 DataLoader、模型、损失、优化器与训练循环。',
  task:'恢复两个已知权重和一个偏置，比较训练前后的均方误差。',
  completion:'固定随机种子；参数最大绝对误差小于 0.1，测试 MSE 小于 0.01。',
  environment:'Python + PyTorch，CPU；数据自己生成，无模型权重下载。',
  boundary:'选择教材的 PyTorch 分支；任务页给出数据生成办法，无需安装整套 d2l 或学习 CNN。',
  source:'d2l-ai/d2l-zh/blob/master/chapter_linear-networks/linear-regression-concise.md',guide:guide+'pytorch'
 }],
 nlp:[{
  id:'tfidf',name:'用 TF-IDF 检索短文',level:'基础实践',
  book:'《Natural Language Processing in Action》第二版，第 2—3 章。',
  prerequisites:'Python 的字符串、字典、循环；词袋、TF-IDF 与余弦相似度随章节学习。',
  description:'给少量英文短文建立词袋，用 TF-IDF 和余弦相似度返回相关文本。',
  task:'按任务页提供的语料实现分词、词频、逆文档频率和排序。',
  completion:'三组指定查询返回对应短文；空查询和词表外查询返回空结果。',
  environment:'Python 标准库，普通 CPU；语料在任务页，无外部下载。',
  boundary:'这是本平台按教材知识编写的练习；不需要词向量模型、Transformer 或向量数据库。',
  guide:guide+'nlp'
 }],
 llm:[{
  id:'prompt-lab',name:'提示词效果对照实验',level:'应用实践',
  book:'《Hands-On Large Language Models》中的 Prompt Engineering 一章。',
  prerequisites:'理解模型输入输出与示例提示；需要一个可用的管理员默认 API 或个人 API。',
  description:'用同一组文本比较直接提问、明确输出格式和提供示例三种提示。',
  task:'让模型将 6 条课程描述分类为分析、代数或概率，逐项核对标签和 JSON 格式。',
  completion:'记录同一模型的 18 次独立回答，分别统计分类正确数与格式合格数。',
  environment:'可直接使用平台 AI 对话；需联网和可用模型额度，无本地 GPU。',
  boundary:'本平台的应用实验；不要求训练 GPT、微调、RAG、LangChain 或部署模型。',
  guide:guide+'llm'
 }]
};

function projectSection(slug){
 const projects=aiCourseProjects[slug];if(!projects?.length)return null;
 const section=el('section',null,'ai-study-projects'),heading=el('div',null,'ai-study-projects-heading');heading.append(el('h3','配套实践项目'));section.append(heading);
 const grid=el('div',null,'ai-project-grid');
 for(const project of projects){
  const card=el('article',null,'ai-project-card'),head=el('div',null,'ai-project-card-heading');card.dataset.project=project.id;head.append(el('h4',project.name),el('span',project.level,'ai-project-level'));
  const book=el('p',null,'ai-project-book'),prior=el('p',null,'ai-project-prerequisites');book.append(el('strong','教材：'),document.createTextNode(project.book));prior.append(el('strong','先修：'),document.createTextNode(project.prerequisites));
  const details=el('details',null,'ai-project-details');details.append(el('summary','范围与验收'));
  for(const [label,text]of [['完成标准：',project.completion],['运行条件：',project.environment],['项目范围：',project.boundary]]){const line=el('p');line.append(el('strong',label),document.createTextNode(text));details.append(line);}
  const actions=el('div',null,'ai-project-actions');
  for(const [label,href]of [['项目任务',project.guide],...(project.source?[['配套源码','https://github.com/'+project.source]]:[])]){
   const link=el('a',label,'button compact');link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','在新标签页打开 '+project.name+' · '+label);const glyph=el('span');glyph.dataset.icon='forward';glyph.setAttribute('aria-hidden','true');link.append(glyph);actions.append(link);
  }
  card.append(head,el('p',project.description,'ai-project-description'),book,prior,el('p',project.task,'ai-project-task'),details,actions);grid.append(card);
 }
 section.append(grid);return section;
}
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
