const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
const stages=[['follow','跟着做'],['fill','自己补全'],['independent','独立完成']];
const experiments={
 calculus:{title:'函数、切线与数值导数',book:'数学分析 · 导数与切线；Python 基础与绘图。',prior:'先会 Python 的函数、循环和 NumPy 数组，再开始编程。',goal:'画出函数和切线，用数值导数核对手算结果。',
  steps:['运行 x² 的示例，观察函数曲线和 x=1 处的切线。','补全中心差分函数，分别对多项式与 sin 求数值导数。','换成 x³−2x，比较不同步长的误差并解释现象。'],
  hints:['中心差分使用两侧函数值，分母是 2h。','绘制切线时，用切点的函数值加上斜率乘横坐标偏移。','步长过小也会受到浮点舍入影响，误差不保证一直下降。'],
  checks:['x² 在 x=2 的导数接近 4。','sin 在 x=0 的导数接近 1。','新函数在 x=1 的导数接近 1；保存曲线并解释误差。'],
  reference:'https://numpy.org/doc/stable/user/absolute_beginners.html'},
 'linear-algebra':{title:'矩阵如何变换平面',book:'Strang《线性代数导论》· 矩阵乘法与线性变换。',prior:'矩阵乘法、坐标向量，以及 Python / NumPy 基础。',goal:'用图形理解旋转、拉伸与投影。',
  steps:['运行正方形旋转示例，对照变换前后的顶点坐标。','补全矩阵作用于一组点的函数，检查拉伸与投影。','依次组合两个变换，比较交换顺序后的结果。'],
  hints:['本实验每个点是列向量，点集形状为 2×N。','矩阵乘法用 @，不是逐元素乘号 *。','先作用 A 再作用 B，对应 B @ A @ P。'],
  checks:['90° 旋转把 (1,0) 变为 (0,1)。','投影到横轴后所有纵坐标为 0。','说明两次变换交换顺序后是否相同，并用图和坐标验证。'],
  reference:'https://numpy.org/doc/stable/user/absolute_beginners.html'},
 python:{title:'我的学习记录统计',book:'《Python 编程：从入门到实践》· 字典、文件与数据可视化。',prior:'字符串、列表、字典、循环、函数与 CSV 读写。',goal:'读取教学用学习记录，汇总每日时长并绘图。',
  steps:['读取文件内置的 CSV 示例，查看每一列和每日统计图。','补全按日期累计分钟数的函数。','改为按课程汇总，用另一组记录检查程序。'],
  hints:['CSV 中的分钟数起初是字符串，要先转成整数。','同一天可以有多条记录，需要累计而不是覆盖。','用字典的 get(key,0) 为新日期提供起始值。'],
  checks:['同一天的多条记录正确合并。','日期和分钟数一一对应，总时长与原始记录相同。','更换记录后仍能按课程正确汇总。'],
  reference:'https://github.com/ehmatthes/pcc/tree/master/chapter_15'},
 'machine-learning':{title:'一步步完成鸢尾花分类',book:'Müller、Guido《Python 机器学习基础教程》第 1 章。',prior:'Python、NumPy；先学清楚特征、标签、训练集与测试集。',goal:'从观察数据走到训练、预测和错误样本分析。',
  steps:['查看四项特征与三种类别，运行 k=1 的完整示例。','补全模型训练、预测和准确率计算，核对训练样本数量。','预先固定 k=3 和新的划分种子，重新实现并分析错误样本。'],
  hints:['只把训练集 X_train 和 y_train 传给 fit。','predict 的输入要有样本维度，新样本也应是二维数组。','准确率用测试标签与预测标签比较；不能根据测试分数反复选 k。'],
  checks:['原始数据为 150×4，固定划分得到 112 条训练、38 条测试。','新样本输出类别名称，报告测试准确率和混淆矩阵。','列出错误样本；改变划分后结果可重复，不要求分数必然提高。'],
  reference:'https://github.com/amueller/introduction_to_ml_with_python/blob/main/01-introduction.ipynb'},
 'deep-learning':{title:'两层网络识别手写数字',book:'斋藤康毅《深度学习入门：基于 Python 的理论与实现》第 1—5 章。',prior:'Python、NumPy、矩阵乘法、链式法则与反向传播。',goal:'用 NumPy 训练两层网络，看到损失变化与预测结果。',
  steps:['运行完整示例，观察内置 8×8 手写数字与训练曲线。','补全两层网络的四组梯度，先用小网络做数值核对。','更换隐藏层宽度与随机种子，训练并检查独立测试样本。'],
  hints:['保留一个批次的中间激活值，反向时按相反顺序计算。','交叉熵与 Softmax 合并后，输出梯度为 (概率−标签)/批量大小。','先核对梯度的形状和值，再延长训练；本实验没有卷积层。'],
  checks:['小网络的解析梯度通过数值检查。','损失整体下降，输出独立测试准确率和错误数字。','解释 W1、b1、W2、b2 的形状，记录不同设置的结果。'],
  reference:'https://github.com/oreilly-japan/deep-learning-from-scratch/tree/master/ch05'},
 pytorch:{title:'线性回归的完整训练过程',book:'《动手学深度学习》PyTorch 版第 2 章、3.1—3.3 节。',prior:'Python、线性回归与梯度下降；按教材学习 Tensor 和自动微分。',goal:'使用框架恢复已知权重和偏置，检查训练与预测。',
  steps:['运行合成数据示例，观察拟合参数和训练损失。','补全每一批的清零、前向、损失、反向与更新。','换一组真实参数，重新训练并在新样本上评估。'],
  hints:['每批先 zero_grad，避免把上一批的梯度累加进来。','loss.backward 计算梯度，optimizer.step 才更新参数。','测试使用独立数据和 no_grad；输入、标签的形状应一致。'],
  checks:['权重与偏置的最大绝对误差小于 0.1。','独立测试 MSE 小于 0.01。','说明训练循环每一步的作用，替换真实参数后仍然通过检查。'],
  reference:'https://zh.d2l.ai/chapter_linear-networks/linear-regression-concise.html'},
 nlp:{title:'教材简介关键词检索',book:'《Natural Language Processing in Action》第二版第 2—3 章。',prior:'Python 字符串与字典、词袋、TF-IDF 和余弦相似度。',goal:'输入关键词，得到相关的示例教材简介及排序。',
  steps:['运行文件内的英文教学简介检索，查看分词和排序结果。','补全文本向量的余弦相似度计算。','添加一条新简介，重建索引并处理空查询与词表外查询。'],
  hints:['文档与查询必须使用相同词表和同一组 IDF。','余弦相似度的分母是两个向量长度的乘积。','零向量不能直接除以长度；新增文档后需要重新统计文档频率。'],
  checks:['derivative、matrix、probability 能找到对应简介。','空查询和 banana 返回空结果。','加入含 eigenvector 的简介后，该关键词能检索到新条目。'],
  reference:'https://www.manning.com/books/natural-language-processing-in-action-second-edition'},
 llm:{title:'教材简介整理助手',book:'《Hands-On Large Language Models》· Prompt Engineering。',prior:'Python 与 JSON；真实模型调用需要可用 API 和额度。',goal:'把一段简介整理为固定格式，并核对信息是否来自原文。',
  steps:['先用明确标注的示例响应跑通 JSON 读取和字段检查。','补全结果解析与格式校验，试着拒绝错误字段。','更换简介，检查未提及的信息是否保持 null；再用真实 API 对照。'],
  hints:['把字段名、值的类型和缺失值规则写进提示词。','合法 JSON 不等于内容正确，还要逐项对照原文。','Notebook 默认离线；真实调用用自己的 API，或在教材阅读器使用默认 API 后粘贴回答。'],
  checks:['输出包含 title、topics、prerequisites 三个字段。','不能确定的内容保持 null，不补写原文未给出的知识。','区分示例响应与真实回答，保存输入、提示词和原始结果。'],
  reference:'https://github.com/HandsOnLLM/Hands-On-Large-Language-Models'}
};

export function createLearningLabs({api,write}){
 let progress={},loadError=false,version=0;
 return {
  async load(){const mine=++version;try{const body=await api('/api/learning-labs/progress');if(mine!==version)return;progress=body.progress||{};loadError=false;}catch{if(mine===version){progress={};loadError=true;}}},
  section(slug){
   const lab=experiments[slug];if(!lab)return null;
   const section=el('section',null,'learning-labs');section.append(el('h3','配套实验'));
   const card=el('article',null,'learning-lab');card.dataset.lab=slug;
   const heading=el('div',null,'lab-heading'),count=el('span',null,'lab-count');heading.append(el('h4',lab.title),count);
   const intro=el('p',lab.goal,'lab-goal'),book=el('p','教材：'+lab.book,'lab-book'),prior=el('p','先修：'+lab.prior,'lab-prior');
   const track=el('ol',null,'lab-stages'),checks=[];
   const status=el('p',loadError?'实验进度暂时无法读取，请刷新后重试。':'完成后勾选阶段，保存个人实验进度。','lab-status');status.setAttribute('aria-live','polite');
   const update=()=>{const saved=progress[slug]||[];count.textContent=saved.length+' / 3';for(const [input,key]of checks)input.checked=saved.includes(key);};
   for(const [index,[key,title]]of stages.entries()){
    const item=el('li'),label=el('label'),input=el('input');input.type='checkbox';input.disabled=loadError;input.dataset.labStage=key;checks.push([input,key]);label.append(input,el('strong',title));item.append(label,el('p',lab.steps[index]));track.append(item);
    input.onchange=async()=>{const wanted=input.checked,mine=version;checks.forEach(([node])=>node.disabled=true);status.textContent='正在保存进度…';try{const result=await write('/api/learning-labs/'+slug+'/progress',{stage:key,completed:wanted},'PUT');if(mine!==version)return;progress[slug]=result.completed_stages;status.textContent='实验进度已保存。';}catch(error){status.textContent=error.message||'保存失败，请重试。';}finally{if(mine===version){update();checks.forEach(([node])=>node.disabled=loadError);}}};
   }
   const actions=el('div',null,'lab-actions'),panels=el('div',null,'lab-panels'),toggles=[];
   function panel(name,label,content,glyph){const body=el('div',null,'lab-panel');body.id='lab-'+slug+'-'+name;body.hidden=true;body.append(...content);panels.append(body);const button=el('button',label,'button compact');button.type='button';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',body.id);const icon=el('span');icon.dataset.icon=glyph;icon.setAttribute('aria-hidden','true');button.append(icon);toggles.push([button,body]);button.onclick=()=>{const open=body.hidden;for(const [other,target]of toggles){target.hidden=true;other.setAttribute('aria-expanded','false');}body.hidden=!open;button.setAttribute('aria-expanded',String(open));};return button;}
   const ordered=texts=>{const list=el('ol');for(const text of texts)list.append(el('li',text));return list;};
   const dependencies={calculus:'numpy matplotlib','linear-algebra':'numpy matplotlib',python:'matplotlib','machine-learning':'numpy matplotlib scikit-learn','deep-learning':'numpy matplotlib scikit-learn',pytorch:'torch',nlp:'',llm:''}[slug];
   const windows=String.raw`.\.venv\Scripts\python.exe`,unix='.venv/bin/python';
   const install=python=>slug==='pytorch'?python+' -m pip install notebook\n'+python+' -m pip install torch --index-url https://download.pytorch.org/whl/cpu':python+' -m pip install notebook '+dependencies;
   const windowsCommands=el('pre','py -m venv .venv\n'+install(windows)+'\n'+windows+' -m notebook','lab-commands');
   const other=el('details');other.append(el('summary','macOS / Linux 命令'),el('pre','python3 -m venv .venv\n'+install(unix)+'\n'+unix+' -m notebook','lab-commands'));
   const instructions=[el('h5','开始实验'),el('p','先安装 Python 3.11 或 3.12，下载 Notebook（可分步骤运行代码的练习文件）。在文件所在文件夹打开终端，Windows 可依次执行：'),windowsCommands,other,el('p','Jupyter 打开后选中下载的文件，先运行“跟着做”，再补全 TODO，最后完成独立变式。'),ordered(lab.steps),el('p','文件内附数据、检查单元与参考解答。运行检查后再勾选阶段；勾选记录由你自己确认。')];
   actions.append(panel('guide','实验指导',instructions,'book'));
   const download=el('a','下载练习文件','button compact');download.href='/api/learning-labs/'+slug+'/notebook';download.setAttribute('download','axiom-'+slug+'.ipynb');const arrow=el('span');arrow.dataset.icon='download';arrow.setAttribute('aria-hidden','true');download.append(arrow);actions.append(download,panel('hints','查看提示',[el('h5','卡住时先检查'),ordered(lab.hints)],'spark'),panel('results','核对结果',[el('h5','完成标准'),el('p','在 Notebook 中运行检查单元，并逐项核对以下结果。网页不会代替你执行代码。'),ordered(lab.checks)],'check'));
   const reference=el('details',null,'lab-reference');reference.append(el('summary','参考资料'));const source=el('a','教材或官方参考','lab-source');source.href=lab.reference;source.target='_blank';source.rel='noopener noreferrer';reference.append(source);
   update();card.append(heading,intro,book,prior,track,actions,panels,status,reference);section.append(card);return section;
  }
 };
}
