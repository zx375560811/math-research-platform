import { mountIcons } from './icons.js';

const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
const projects=[
 {id:'python',name:'Python 基础',short:'Python-100-Days',title:'Python-100-Days',phase:'编程起点',symbol:'Py',colors:['#23789b','#16455e'],
  repository:'https://github.com/jackfrued/Python-100-Days',learn:'https://github.com/jackfrued/Python-100-Days/tree/master/Day01-20',
  description:'从变量、条件、循环与函数开始，把读懂代码推进到自己编写小程序。先学 Python 基础，再按需要进入文件处理、数据分析和可视化。',
  topics:['变量、列表、字典、条件、循环与函数','文件读写、异常处理与模块使用','面向数据分析的 NumPy、pandas 与绘图'],
  prior:'无需编程基础。先安装 Python，能编辑和运行一个 .py 文件。',
  goal:'自己读取一份 CSV，汇总数据并绘图；更换输入后，能修改程序并检查结果。',
  focus:'从 Day01–20 开始。网页开发、爬虫等内容可按自己的目标选学。'},
 {id:'microsoft-ml',name:'机器学习入门',short:'微软中文课程',title:'ML-For-Beginners',phase:'传统机器学习主线',symbol:'ƒ',colors:['#5156b3','#34356f'],
  repository:'https://github.com/microsoft/ML-For-Beginners',learn:'https://github.com/microsoft/ML-For-Beginners/blob/main/translations/zh-CN/README.md',
  description:'通过逐步项目学习回归、分类和聚类。课程配有讲解、代码、作业和测验，把数据处理、训练与评价放在同一个学习过程里。',
  topics:['清理、探索和可视化数据','回归、分类、聚类与基础评价','完成课程作业，再修改数据或模型进行比较'],
  prior:'会基础 Python、列表和函数，能读懂简单表格与图表。',
  goal:'独立完成一个小型分类或回归任务，说明数据如何划分、模型如何训练，以及测试结果代表什么。',
  focus:'先做回归和分类部分。中文内容为自动翻译，术语不清楚时对照原文。'},
 {id:'ailearning',name:'算法实战补充',short:'AiLearning',title:'ApacheCN AiLearning',phase:'算法补充',symbol:'Σ',colors:['#147b7c','#105054'],
  repository:'https://github.com/apachecn/AiLearning',learn:'https://github.com/apachecn/AiLearning/tree/master/docs',
  description:'围绕常见算法补充中文解释与实战代码。适合在主线课程学到某个算法后，再对照一份实现，检查自己是否理解输入、参数和输出。',
  topics:['回归、k 近邻、决策树与支持向量机','聚类、降维与常见算法实现','对照原理检查参数变化和实验结果'],
  prior:'先完成一个基本分类或回归流程，再选相同主题补充。',
  goal:'选一个已经学过的算法复现实验，能解释关键参数，并比较修改前后的测试结果。',
  focus:'作为支线按算法查阅，不要求整库读完。运行前核对相应示例的依赖版本。'},
 {id:'d2l',name:'动手学深度学习',short:'D2L · PyTorch 版',title:'动手学深度学习',phase:'深度学习主线',symbol:'⊗',colors:['#7545b2','#493076'],
  repository:'https://github.com/d2l-ai/d2l-zh',learn:'https://zh.d2l.ai/',
  description:'用中文讲解、数学推导和代码逐步进入神经网络。从线性回归与多层感知机开始，再学习卷积网络、序列模型和注意力机制。',
  topics:['自动微分、损失、优化与训练过程','多层感知机、卷积网络和序列模型','注意力与 Transformer'],
  prior:'会 Python 与 NumPy，具备矩阵运算、导数和基础概率知识。',
  goal:'复现一个小型神经网络训练，解释损失曲线、预测结果和错误样本，再修改一个实验条件进行比较。',
  focus:'统一选择 PyTorch 版本。按章完成示例和习题，后续训练按需要准备 GPU。'},
 {id:'pytorch',name:'PyTorch 实操',short:'深入浅出 PyTorch',title:'深入浅出 PyTorch',phase:'配套框架练习',symbol:'Py',colors:['#23789b','#16455e'],
  repository:'https://github.com/datawhalechina/thorough-pytorch',learn:'https://github.com/datawhalechina/thorough-pytorch/tree/main/source',
  description:'配合深度学习章节练习框架操作。把 Tensor、数据加载、模型、训练循环以及保存和加载连成完整过程。',
  topics:['Tensor、自动微分与数据加载','模型、损失函数、优化器和训练循环','模型保存、加载与预测'],
  prior:'会 Python；开始学习 D2L 的线性回归后，可同步练习对应框架操作。',
  goal:'独立写出数据加载、前向计算、反向传播和参数更新，并保存模型、重新加载后进行预测。',
  focus:'按 D2L 当前章节选练。仓库说明建议优先查看 source 目录中的文档。'},
 {id:'happy-llm',name:'大模型进阶',short:'Happy-LLM',title:'Happy-LLM',phase:'大模型原理与实践',symbol:'✦',colors:['#395b9a','#243c6b'],
  repository:'https://github.com/datawhalechina/happy-llm',learn:'https://datawhalechina.github.io/happy-llm/',
  description:'在深度学习和 PyTorch 基础上，逐步学习语言模型、Transformer、预训练与微调，并通过代码理解模型的构建和使用过程。',
  topics:['文本表示、注意力与 Transformer','语言模型的预训练和微调','小模型构建、推理与相关实践'],
  prior:'能用 PyTorch 完成基础训练，理解注意力与 Transformer；训练实验按章节准备算力。',
  goal:'完成一个小模型示例，解释从分词到生成的过程，区分预训练、微调和推理，并记录实际结果。',
  focus:'先学基础原理，再运行对应代码。按实验规模准备 GPU、模型和数据。'}
];

function link(text,url,glyph){const node=el('a',text,'button compact');node.href=url;node.target='_blank';node.rel='noopener noreferrer';const icon=el('span');icon.dataset.icon=glyph;icon.setAttribute('aria-hidden','true');node.append(icon);return node;}

export function createPracticalLearningRoute(initial){
 const root=el('section',null,'practical-learning-route');root.id='practical-learning-route';root.setAttribute('aria-labelledby','practical-route-title');
 const title=el('h2','实战学习路线');title.id='practical-route-title';root.append(title);
 const map=el('div',null,'practical-route-map'),ns='http://www.w3.org/2000/svg';map.setAttribute('role','group');map.setAttribute('aria-label','实战学习路线图');
 const make=(tag,attrs={},text)=>{const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;return node;};
 const svg=make('svg',{viewBox:'0 0 1080 226',class:'analysis-map-canvas practical-route-canvas','aria-label':'主线从左向右：Python 基础、微软机器学习、动手学深度学习、Happy-LLM。AiLearning 与深入浅出 PyTorch 为虚线连接的配套练习。',role:'group'});
 const defs=make('defs');
 const gradient=(id,colors)=>{const paint=make('linearGradient',{id,x1:'0%',y1:'0%',x2:'100%',y2:'100%'});colors.forEach((color,i)=>paint.append(make('stop',{offset:i/(colors.length-1)*100+'%','stop-color':color})));defs.append(paint);};
 gradient('practical-route-night',['#152a52','#121d3c','#24395d']);for(const project of projects)gradient('practical-node-'+project.id,project.colors);
 const light=make('radialGradient',{id:'practical-route-light'});light.append(make('stop',{offset:'0%','stop-color':'#7097ff','stop-opacity':'.23'}),make('stop',{offset:'100%','stop-color':'#7097ff','stop-opacity':0}));defs.append(light);
 const arrow=make('marker',{id:'practical-route-arrow',viewBox:'0 0 8 8',refX:7,refY:4,markerWidth:6,markerHeight:6,orient:'auto'});arrow.append(make('path',{d:'M1 1L7 4L1 7',fill:'none',stroke:'#9db7e7','stroke-width':1.4}));defs.append(arrow);svg.append(defs);
 const backdrop=make('g',{'aria-hidden':'true'});backdrop.append(make('rect',{width:1080,height:226,rx:14,fill:'url(#practical-route-night)'}),make('ellipse',{cx:150,cy:120,rx:210,ry:100,fill:'url(#practical-route-light)'}),make('ellipse',{cx:880,cy:80,rx:230,ry:90,fill:'url(#practical-route-light)'}));
 for(let i=0;i<58;i++)backdrop.append(make('circle',{cx:12+(i*137)%1056,cy:8+(i*47)%210,r:i%7===0?1.2:.65,fill:'#b2caff',opacity:i%3===0?.42:.2}));svg.append(backdrop);
 const edges=[
  ['python','microsoft-ml','M220 113H248Q258 113 258 103V65Q258 55 268 55H300',false],
  ['microsoft-ml','d2l','M496 55H578',false],
  ['d2l','happy-llm','M774 55H802Q812 55 812 65V103Q812 113 822 113H856',false],
  ['microsoft-ml','ailearning','M398 83V143',true],
  ['d2l','pytorch','M676 83V143',true]
 ];
 for(const [i,[from,to,path,support]]of edges.entries()){
  svg.append(make('path',{class:'analysis-route-edge',d:path,fill:'none','marker-end':'url(#practical-route-arrow)','data-practical-from':from,'data-practical-to':to,'data-route-kind':support?'support':'main',...(support?{'stroke-dasharray':'5 5'}:{})}));
  if(!support){const spark=make('circle',{class:'analysis-route-spark',r:1.8,fill:'#d7f1ff','aria-hidden':'true'});spark.append(make('animateMotion',{path,dur:'6s',begin:-i*.7+'s',repeatCount:'indefinite'}));svg.append(spark);}
 }
 const positions={'python':[24,85],'microsoft-ml':[300,27],ailearning:[300,143],d2l:[578,27],pytorch:[578,143],'happy-llm':[856,85]},buttons=new Map();
 for(const project of projects){
  const [x,y]=positions[project.id],node=make('g',{class:'analysis-course practical-route-node',role:'button',tabindex:0,'data-practical-project':project.id,'aria-label':project.title,'aria-pressed':'false','aria-controls':'practical-route-detail'});
  node.append(make('title',{},project.title+' · '+project.phase),make('rect',{class:'analysis-course-card',x,y,width:196,height:56,rx:11,style:'fill:url(#practical-node-'+project.id+')'}),make('path',{class:'analysis-course-shine',d:`M${x+11} ${y+1}H${x+185}M${x+191} ${y+12}V${y+44}`}),make('circle',{class:'analysis-course-orbit',cx:x+25,cy:y+28,r:16}),make('circle',{class:'analysis-course-icon',cx:x+25,cy:y+28,r:13}),make('text',{class:'analysis-course-symbol',x:x+25,y:y+28,'text-anchor':'middle','dominant-baseline':'central'},project.symbol),make('text',{class:'analysis-course-title',x:x+49,y:y+22,'dominant-baseline':'central'},project.name),make('text',{class:'practical-route-subtitle',x:x+49,y:y+41},project.short),make('path',{class:'analysis-course-picked',d:`M${x+186} ${y+6}l3 3-3 3-3-3Z`}));
  node.addEventListener('click',()=>choose(project.id,true));node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(project.id,true);}});svg.append(node);buttons.set(project.id,node);
 }
 map.append(svg);const legend=el('div',null,'practical-route-legend');legend.append(el('span','主线','practical-main-key'),el('span','配套练习','practical-support-key'));
 const detail=el('article',null,'practical-route-detail');detail.id='practical-route-detail';root.append(map,legend,detail);
 let selected;
 function choose(id,updateUrl=false){
  const project=projects.find(item=>item.id===id)||projects[0];if(selected===project.id)return;selected=project.id;
  for(const [key,node]of buttons){const active=key===selected;node.classList.toggle('selected',active);node.setAttribute('aria-pressed',String(active));}
  detail.dataset.project=selected;detail.replaceChildren();
  const heading=el('div',null,'practical-project-heading'),name=el('h3',project.title);name.id='practical-project-title';detail.setAttribute('aria-labelledby',name.id);heading.append(name,el('span',project.phase,'practical-project-phase'));
  const description=el('p',project.description,'practical-project-description'),content=el('div',null,'practical-project-content'),topics=el('div'),list=el('ul');topics.append(el('h4','学习内容'));for(const text of project.topics)list.append(el('li',text));topics.append(list);
  const target=el('div');target.append(el('h4','开始前'),el('p',project.prior),el('h4','完成目标'),el('p',project.goal));content.append(topics,target);
  const footer=el('div',null,'practical-project-footer'),actions=el('div',null,'practical-project-actions');actions.append(link('开始学习',project.learn,'book'),link('GitHub 仓库',project.repository,'forward'));footer.append(actions,el('p',project.focus));detail.append(heading,description,content,footer);mountIcons();
  if(updateUrl){const params=new URLSearchParams(location.hash.split('?')[1]||'');params.set('practice',selected);history.replaceState(history.state,'','#/apps/math-to-ai?'+params);}
 }
 choose(initial);return root;
}
