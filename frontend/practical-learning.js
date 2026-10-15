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

// First lessons are tied to reviewed source revisions, rather than a moving README.
const guideSources={
 python:{revision:'44b2575bf42a02d0a38d9dada3f60335c95c5ec2',version:'3.12',root:'看到 Day01-20 文件夹的这一层',lesson:'Day01-20/02.第一个Python程序.md',next:'Day01-20/03.Python语言中的变量.md'},
 'microsoft-ml':{revision:'de2d4e12236445198213a0711855e348e7253cd4',version:'3.12',root:'看到 2-Regression 文件夹的这一层',lesson:'translations/zh-CN/2-Regression/1-Tools/README.md',next:'translations/zh-CN/2-Regression/2-Data/README.md'},
 ailearning:{revision:'26f415083e2354335a3fa9e8ba9d39d8d3ef9a7f',version:'3.12',root:'同时看到 src、data、docs 文件夹的这一层',lesson:'docs/ml/2.md',next:'docs/ml/3.md'},
 d2l:{revision:'10243a27370ebfa2bd6c3d8ef127e37c829b3051',version:'3.12',root:'看到 chapter_preliminaries 文件夹的这一层',lesson:'chapter_preliminaries/ndarray.ipynb',next:'chapter_preliminaries/linear-algebra.ipynb',codeRepository:'https://github.com/d2l-ai/d2l-zh-pytorch-colab'},
 pytorch:{revision:'4fe55664dc6b37dd32d551a96e317a61ba69e83e',version:'3.12',root:'看到 source 文件夹的这一层',lesson:'source/第二章/2.1 张量.md',next:'source/第二章/2.2 自动求导.md'},
 'happy-llm':{revision:'1e0b3a1e6f8936b8ba4bbd0673e8e2227d196c96',version:'3.11',root:'看到 docs 文件夹的这一层',lesson:'docs/chapter1/第一章 NLP基础概念.md',next:'docs/chapter2/第二章 Transformer架构.md'}
};
const sourceUrl=(project,path)=>{const source=guideSources[project.id];return (source.codeRepository||project.repository)+'/blob/'+source.revision+'/'+path.split('/').map(encodeURIComponent).join('/');};
const guideStepLabels=['下载课程','准备环境','运行示例','检查结果'];

function firstLessonSteps(project,os){
 const source=guideSources[project.id],windows=os==='windows',python=windows?'.\\.venv\\Scripts\\python.exe':'.venv/bin/python';
 const launcher=windows?'py -'+source.version:'python'+source.version;
 const command=(label,value,kind='terminal')=>({label,value,kind});
 const install=packages=>command('安装本课依赖',python+' -m pip install '+packages);
 const torchInstall=version=>install('torch'+(version?'=='+version:'')+(os==='macos'?'':' --index-url https://download.pytorch.org/whl/cpu'));
 const notebook=command('启动 Notebook',python+' -m notebook');
 const steps=[
  {title:'先下载，再打开第一课',intro:'不需要安装 Git。下载 ZIP，解压到自己的“学习实验”文件夹；不要在压缩包内直接运行。',items:[source.root+'，就是下文所说的“课程根目录”。','先打开第一课，阅读概念，再按后面的步骤运行。'],links:[['下载课程 ZIP',(source.codeRepository||project.repository)+'/archive/'+source.revision+'.zip'],['第一课原文',sourceUrl(project,source.lesson)]],path:source.lesson},
  {title:'给这门课准备独立环境',intro:'下面的命令在你自己的电脑执行。'+(windows?'打开解压后的课程根目录，在地址栏输入 powershell 并回车。':'在终端切换到解压后的课程根目录。'),items:['先安装 Python '+source.version+'；每个代码块单独复制执行，等上一条结束再继续。','使用独立 .venv，不需要激活脚本，也不会混入其他课程的依赖。'],links:[['安装 Python','https://www.python.org/downloads/']],commands:[command('检查 Python 版本',launcher+' --version'),command('创建本课环境',launcher+' -m venv .venv'),command('更新安装工具',python+' -m pip install --upgrade pip')],note:'这些命令不要在网站服务器的 SSH 窗口里执行。'},
  {},{}
 ];
 switch(project.id){
 case 'python':
  steps[2]={title:'运行你自己的第一个程序',intro:'在课程根目录新建 hello.py，用记事本或代码编辑器填入下面两行并保存。文件名必须是 hello.py，而不是 hello.py.txt。',commands:[command('hello.py 文件内容','print("Hello, Axiom!")\nprint(1 + 2 + 3)','file'),command('回到刚才的终端运行',python+' hello.py')],path:'hello.py'};
  steps[3]={title:'看到结果，再自己改一次',result:'终端依次显示 Hello, Axiom! 和 6。',items:['把问候语改成自己的名字，再次运行。','把 1 + 2 + 3 改成 2 * 3，确认输出为什么仍是 6。','接着学变量、条件、循环和函数；先完成 Day01–20，不必跳到爬虫或网页开发。'],links:[['下一课：变量',sourceUrl(project,source.next)]]};break;
 case 'microsoft-ml':
  steps[1].commands.push(install('notebook numpy matplotlib scikit-learn'));
  steps[2]={title:'运行官方的第一个回归实验',intro:'启动后会打开本机的 Notebook 网页。这是本地代码工具，不是我们的学习网站。',commands:[notebook],path:'2-Regression/1-Tools/solution/notebook.ipynb',items:['在 Notebook 文件列表按上方路径打开完整版示例。','从最上面的单元格开始，逐个按 Shift + Enter。左侧 [*] 消失后再运行下一格。','观察导入数据、划分训练与测试数据、拟合模型和绘图四个步骤。'],links:[['对照官方实验',sourceUrl(project,'2-Regression/1-Tools/solution/notebook.ipynb')]],note:'练习版 notebook.ipynb 与 solution 里的完整版不同。第一次先跑通完整版；数据由 scikit-learn 自带，无需另外下载。'};
  steps[3]={title:'用一个小改动检查是否理解',result:'数据初始形状为 (442, 10)；最后出现黑色散点和蓝色回归线。',items:['回到 train_test_split 所在单元格，加入 random_state=42，再从该格往下运行，让每次划分一致。','将 test_size=0.33 改成 0.2，观察散点数量和回归线的变化。','能说清输入 X、目标 y、训练集和测试集的区别后，再做同目录的练习版。'],links:[['下一课：准备数据',sourceUrl(project,source.next)]]};break;
 case 'ailearning':
  steps[1].commands.push(install('numpy==1.26.4'));steps[1].note='这是较早的教程，本课固定 NumPy 1.26.4，避免旧接口与 NumPy 2 不兼容。';
  steps[2]={title:'先分类四个点，不急着识别手写数字',intro:'读完 k 近邻的距离与投票规则后，在课程根目录运行下方命令。它调用官方示例的函数，不会启动完整手写数字实验。',path:'src/py3.x/ml/2.KNN/kNN.py',commands:[command('运行官方四点分类例子',python+' -c "import runpy; m=runpy.run_path(\'src/py3.x/ml/2.KNN/kNN.py\'); x,y=m[\'createDataSet\'](); print(m[\'classify0\']([0,0],x,y,3))"')],links:[['查看对应代码',sourceUrl(project,'src/py3.x/ml/2.KNN/kNN.py')]],note:'直接运行整个 kNN.py 会进入手写数字识别，并读取 data 目录；那是后续实验。'};
  steps[3]={title:'解释分类结果，比运行成功更重要',result:'终端输出 B。',items:['将命令中的 [0,0] 改成 [1,1]，应输出 A。','打开代码找到 createDataSet 和 classify0，对照坐标解释最近的三个点如何投票。','再完成本章的数据归一化与手写数字示例，保留完整 data 目录；理解后进入决策树。'],links:[['下一章：决策树',sourceUrl(project,source.next)]]};break;
 case 'd2l':
  steps[0].items[1]='这里下载的是官方 PyTorch Notebook 版本，第一课是“2.1 数据操作”。';steps[0].links[1]=['第一课讲解','https://zh.d2l.ai/chapter_preliminaries/ndarray.html'];
  steps[1].commands.push(torchInstall(),install('notebook'));steps[1].note='第 2.1 节只用 torch。后续需要 d2l 包的章节，请按官方完整安装说明另建环境，不要直接混装旧版依赖。';steps[1].links.push(['D2L 完整安装说明','https://zh.d2l.ai/chapter_installation/index.html']);
  steps[2]={title:'按单元格学习张量操作',intro:'启动 Notebook，在文件列表打开下面的官方文件。每读完一小段，就按 Shift + Enter 运行其后的代码。',commands:[notebook],path:source.lesson,items:['从 import torch 开始，依次运行 arange、shape、reshape 和算术运算。','先观察每一步的值和形状，再继续索引、切片与广播。','这一节 CPU 即可；下载的代码已经是 PyTorch 版本。'],links:[['对照第一课代码',sourceUrl(project,source.lesson)]]};
  steps[3]={title:'改变形状，确认元素没有丢',result:'torch.arange(12) 生成从 0 到 11 的张量；reshape(3, 4) 得到 3 行 4 列。',items:['把 reshape(3, 4) 改成 reshape(2, 6)，解释为什么仍有 12 个元素。','试着改成 reshape(5, 3)，读懂元素数不匹配的错误，再改回正确形状。','继续线性代数、微积分与自动微分，再进入线性回归；不要直接从大模型开始。'],links:[['下一课：线性代数',sourceUrl(project,source.next)]]};break;
 case 'pytorch':
  steps[1].commands.push(torchInstall());
  steps[2]={title:'先在 CPU 上确认张量与维度',intro:'先阅读“2.1 张量”的创建和运算部分，再运行这个小练习。后续把原文例子逐段复制到自己的 .py 文件中，边改边运行。',path:source.lesson,commands:[command('检查 PyTorch 与设备',python+' -c "import torch; print(torch.__version__); print(torch.cuda.is_available())"'),command('创建矩阵并按行求和',python+' -c "import torch; x=torch.arange(6,dtype=torch.float32).reshape(2,3); print(x); print(x.sum(dim=1))"')],links:[['打开张量这一节',sourceUrl(project,source.lesson)]],note:'没有 NVIDIA GPU 时，cuda.is_available() 返回 False 是正常结果，本课仍能运行。'};
  steps[3]={title:'分清形状与求和方向',result:'先显示一个 2×3 矩阵，再显示 tensor([ 3., 12.])。',items:['将 sum(dim=1) 改成 sum(dim=0)，应得到 tensor([3., 5., 7.])。','解释为什么前者有 2 个结果，后者有 3 个结果。','然后学自动求导，再配合 D2L 写训练循环、保存模型与重新加载预测。'],links:[['下一节：自动求导',sourceUrl(project,source.next)]]};break;
 case 'happy-llm':
  steps[0].items[1]='先读第一章 NLP，再读第二章注意力与 Transformer；学过基础深度学习后再运行第二章代码。';
  steps[1].commands.push(torchInstall('2.7.0'),install('-r docs/chapter2/code/requirements.txt'));steps[1].note='本指引只准备第二章环境，按官方建议使用 Python 3.11。其他章节要分别准备环境。';steps[1].links.push(['官方环境说明',sourceUrl(project,'docs/学习与环境准备.md')]);
  steps[2]={title:'运行第二章的 Transformer 示例',intro:'先读第二章的模型实现，再在课程根目录运行脚本。首次运行需要联网，从 Hugging Face 下载 bert-base-chinese 分词器。',path:'docs/chapter2/code/transformer.py',commands:[command('运行官方第二章代码',python+' docs/chapter2/code/transformer.py')],links:[['先读第二章',sourceUrl(project,source.next)],['查看脚本',sourceUrl(project,'docs/chapter2/code/transformer.py')]],note:'分词器下载失败属于网络或缓存问题；先解决下载，再重试，不要把它当成 Transformer 代码错误。'};
  steps[3]={title:'先看数据流，不要求它回答问题',result:'脚本打印输入分词及模型输出；这个随机初始化的示例没有经过语言训练，输出不通顺是正常的。',items:['沿着代码找出分词器、位置编码、编码器和解码器各自的输入与输出。','换一句简短中文，观察分词与张量形状如何变化。','完成前四章原理后，再按第五章的依赖、数据与硬件要求搭建小模型；第二章环境不能直接代替所有章节。'],links:[['继续课程目录',project.learn],['分章环境要求',sourceUrl(project,'docs/学习与环境准备.md')]]};break;
 }
 return steps;
}

function commandBlock(command){
 const block=el('div',null,'practical-command'),heading=el('div',null,'practical-command-heading'),code=el('code',command.value),pre=el('pre'),copy=el('button','复制','button compact');copy.type='button';copy.setAttribute('aria-label','复制'+command.label);pre.tabIndex=0;pre.append(code);heading.append(el('span',command.label),copy);block.append(heading,pre);
 const status=el('p',null,'practical-copy-status');status.setAttribute('role','status');block.append(status);
 copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(command.value);copy.textContent='已复制';status.textContent='';}catch{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(code);selection.removeAllRanges();selection.addRange(range);pre.focus();status.textContent='自动复制不可用，内容已选中。请按 Ctrl+C（Mac：⌘C）复制。';}});return block;
}

function createBeginnerGuide(project,state,onClose){
 const root=el('section',null,'practical-beginner-guide');root.setAttribute('aria-label',project.title+'入门指引');
 const toolbar=el('div',null,'practical-guide-toolbar'),back=el('button','返回项目介绍','button compact'),device=el('label',null,'practical-guide-device'),select=el('select');back.type='button';back.addEventListener('click',onClose);device.append(el('span','我的电脑'));
 for(const [value,text]of [['windows','Windows'],['macos','macOS（Apple 芯片）'],['linux','Linux']]){const option=el('option',text);option.value=value;select.append(option);}select.value=state.os;device.append(select);toolbar.append(back,device);
 const tabs=el('nav',null,'practical-guide-steps');tabs.setAttribute('aria-label','第一课步骤');const panel=el('div',null,'practical-guide-panel');panel.id='practical-first-lesson';
 const buttons=guideStepLabels.map((text,index)=>{const button=el('button');button.type='button';button.append(el('span',String(index+1)),el('strong',text));button.setAttribute('aria-controls',panel.id);button.addEventListener('click',()=>{state.step=index;render(true);});tabs.append(button);return button;});
 root.append(toolbar,tabs,panel);select.addEventListener('change',()=>{state.os=select.value;render(false);});
 function render(focus){
  const step=firstLessonSteps(project,state.os)[state.step];buttons.forEach((button,index)=>{if(index===state.step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});panel.replaceChildren();
  const heading=el('h4',step.title);heading.tabIndex=-1;panel.append(heading);if(step.intro)panel.append(el('p',step.intro));
  if(step.path){const path=el('p',null,'practical-guide-path');path.append(el('span','文件位置'),el('code',step.path));panel.append(path);}
  if(step.result){const result=el('div',null,'practical-guide-result');result.append(el('strong','应该看到'),el('p',step.result));panel.append(result);}
  const appendCommands=()=>{for(const command of step.commands||[])panel.append(commandBlock(command));};if(state.step===2)appendCommands();
  if(step.items){const list=el('ol');for(const text of step.items)list.append(el('li',text));panel.append(list);}
  if(step.links){const links=el('div',null,'practical-guide-links');for(const [text,url]of step.links)links.append(link(text,url,'forward'));panel.append(links);}
  if(state.step!==2)appendCommands();if(step.note)panel.append(el('p',step.note,'practical-guide-note'));
  if(state.step===1||state.step===2){const help=el('details',null,'practical-guide-help');help.append(el('summary','命令报错了怎么办？'));const list=el('ul');for(const text of ['找不到 py / python：安装上方指定的 Python 版本后，关闭并重新打开终端。','找不到文件：回到课程根目录，并确认 ZIP 已完整解压；保留原文件夹结构。','提示 No module named：用指引中的 .venv Python 安装依赖，避免装到另一个 Python 里。'])list.append(el('li',text));help.append(list);panel.append(help);}
  const footer=el('div',null,'practical-guide-navigation'),prev=el('button','上一步','button compact'),next=el('button','下一步','button primary compact');prev.type=next.type='button';prev.disabled=state.step===0;prev.addEventListener('click',()=>{state.step--;render(true);});next.disabled=state.step===3;next.addEventListener('click',()=>{state.step++;render(true);});footer.append(prev,el('span','第 '+(state.step+1)+' / 4 步'),next);panel.append(footer);mountIcons();if(focus)heading.focus();
 }
 render(false);return root;
}

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
 let selected;const guideStates=new Map();
 function choose(id,updateUrl=false){
  const project=projects.find(item=>item.id===id)||projects[0];if(selected===project.id)return;selected=project.id;
  for(const [key,node]of buttons){const active=key===selected;node.classList.toggle('selected',active);node.setAttribute('aria-pressed',String(active));}
  detail.dataset.project=selected;renderProject(project);
  if(updateUrl){const params=new URLSearchParams(location.hash.split('?')[1]||'');params.set('practice',selected);history.replaceState(history.state,'','#/apps/math-to-ai?'+params);}
 }
 function renderProject(project){
  detail.replaceChildren();
  const heading=el('div',null,'practical-project-heading'),name=el('h3',project.title);name.id='practical-project-title';detail.setAttribute('aria-labelledby',name.id);heading.append(name,el('span',project.phase,'practical-project-phase'));
  detail.append(heading);let state=guideStates.get(project.id);if(!state){state={open:false,step:0,os:/Mac/i.test(navigator.platform)?'macos':/Linux/i.test(navigator.platform)&&!/Android/i.test(navigator.userAgent)?'linux':'windows'};guideStates.set(project.id,state);}
  if(state.open){detail.append(createBeginnerGuide(project,state,()=>{state.open=false;renderProject(project);detail.querySelector('.practical-start').focus();}));mountIcons();return;}
  const description=el('p',project.description,'practical-project-description'),content=el('div',null,'practical-project-content'),topics=el('div'),list=el('ul');topics.append(el('h4','学习内容'));for(const text of project.topics)list.append(el('li',text));topics.append(list);
  const target=el('div');target.append(el('h4','开始前'),el('p',project.prior),el('h4','完成目标'),el('p',project.goal));content.append(topics,target);
  const footer=el('div',null,'practical-project-footer'),actions=el('div',null,'practical-project-actions'),start=el('button','开始学习','button primary compact practical-start'),icon=el('span');start.type='button';icon.dataset.icon='book';icon.setAttribute('aria-hidden','true');start.append(icon);start.addEventListener('click',()=>{state.open=true;renderProject(project);detail.querySelector('.practical-guide-panel h4').focus();});actions.append(start,link('GitHub 仓库',project.repository,'forward'));footer.append(actions,el('p',project.focus));detail.append(description,content,footer);mountIcons();
 }
 choose(initial);return root;
}
