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

// Each lesson is a real file in the reviewed source revision below.
const courseSources={
 python:{revision:'44b2575bf42a02d0a38d9dada3f60335c95c5ec2',environment:'Day01-20/01.初识Python.md'},
 'microsoft-ml':{revision:'de2d4e12236445198213a0711855e348e7253cd4',environment:'translations/zh-CN/2-Regression/1-Tools/README.md'},
 ailearning:{revision:'26f415083e2354335a3fa9e8ba9d39d8d3ef9a7f',environment:'README.md'},
 d2l:{revision:'10243a27370ebfa2bd6c3d8ef127e37c829b3051',codeRepository:'https://github.com/d2l-ai/d2l-zh-pytorch-colab',environmentUrl:'https://zh.d2l.ai/chapter_installation/index.html'},
 pytorch:{revision:'4fe55664dc6b37dd32d551a96e317a61ba69e83e',environment:'source/第一章/1.2 PyTorch的安装.md'},
 'happy-llm':{revision:'1e0b3a1e6f8936b8ba4bbd0673e8e2227d196c96',environment:'docs/学习与环境准备.md'}
};
const sourceUrl=(project,path,kind='blob')=>{const source=courseSources[project.id];return (source.codeRepository||project.repository)+'/'+kind+'/'+source.revision+'/'+path.split('/').map(encodeURIComponent).join('/');};

// BEGIN COURSE CATALOG
const courseCatalog={
 "python":[
  {title:"Python 基础",lessons:[
   ["初识Python","Day01-20/01.初识Python.md"],
   ["第一个Python程序","Day01-20/02.第一个Python程序.md"],
   ["Python语言中的变量","Day01-20/03.Python语言中的变量.md"],
   ["Python语言中的运算符","Day01-20/04.Python语言中的运算符.md"],
   ["分支结构","Day01-20/05.分支结构.md"],
   ["循环结构","Day01-20/06.循环结构.md"],
   ["分支和循环结构实战","Day01-20/07.分支和循环结构实战.md"],
   ["常用数据结构之列表-1","Day01-20/08.常用数据结构之列表-1.md"],
   ["常用数据结构之列表-2","Day01-20/09.常用数据结构之列表-2.md"],
   ["常用数据结构之元组","Day01-20/10.常用数据结构之元组.md"],
   ["常用数据结构之字符串","Day01-20/11.常用数据结构之字符串.md"],
   ["常用数据结构之集合","Day01-20/12.常用数据结构之集合.md"],
   ["常用数据结构之字典","Day01-20/13.常用数据结构之字典.md"],
   ["函数和模块","Day01-20/14.函数和模块.md"],
   ["函数应用实战","Day01-20/15.函数应用实战.md"],
   ["函数使用进阶","Day01-20/16.函数使用进阶.md"],
   ["函数高级应用","Day01-20/17.函数高级应用.md"],
   ["面向对象编程入门","Day01-20/18.面向对象编程入门.md"],
   ["面向对象编程进阶","Day01-20/19.面向对象编程进阶.md"],
   ["面向对象编程应用","Day01-20/20.面向对象编程应用.md"],
  ]},
  {title:"文件与数据处理",lessons:[
   ["文件读写和异常处理","Day21-30/21.文件读写和异常处理.md"],
   ["对象的序列化和反序列化","Day21-30/22.对象的序列化和反序列化.md"],
   ["Python读写CSV文件","Day21-30/23.Python读写CSV文件.md"],
   ["Python读写Excel文件-1","Day21-30/24.Python读写Excel文件-1.md"],
   ["Python读写Excel文件-2","Day21-30/25.Python读写Excel文件-2.md"],
   ["Python操作Word和PowerPoint文件","Day21-30/26.Python操作Word和PowerPoint文件.md"],
   ["Python操作PDF文件","Day21-30/27.Python操作PDF文件.md"],
   ["Python处理图像","Day21-30/28.Python处理图像.md"],
   ["Python发送邮件和短信","Day21-30/29.Python发送邮件和短信.md"],
   ["正则表达式的应用","Day21-30/30.正则表达式的应用.md"],
  ]},
  {title:"进阶与开发基础",lessons:[
   ["Python语言进阶","Day31-35/31.Python语言进阶.md"],
   ["Web前端入门","Day31-35/32-33.Web前端入门.md"],
   ["玩转Linux操作系统","Day31-35/34-35.玩转Linux操作系统.md"],
  ]},
  {title:"数据库（选学）",lessons:[
   ["关系型数据库和MySQL概述","Day36-45/36.关系型数据库和MySQL概述.md"],
   ["SQL详解之DDL","Day36-45/37.SQL详解之DDL.md"],
   ["SQL详解之DML","Day36-45/38.SQL详解之DML.md"],
   ["SQL详解之DQL","Day36-45/39.SQL详解之DQL.md"],
   ["SQL详解之DCL","Day36-45/40.SQL详解之DCL.md"],
   ["MySQL新特性","Day36-45/41.MySQL新特性.md"],
   ["视图、函数和过程","Day36-45/42.视图、函数和过程.md"],
   ["索引","Day36-45/43.索引.md"],
   ["Python接入MySQL数据库","Day36-45/44.Python接入MySQL数据库.md"],
   ["Hive实战","Day36-45/45.Hive实战.md"],
  ]},
  {title:"Web 开发（选学）",lessons:[
   ["Django快速上手","Day46-60/46.Django快速上手.md"],
   ["深入模型","Day46-60/47.深入模型.md"],
   ["静态资源和Ajax请求","Day46-60/48.静态资源和Ajax请求.md"],
   ["Cookie和Session","Day46-60/49.Cookie和Session.md"],
   ["制作报表","Day46-60/50.制作报表.md"],
   ["日志和调试工具栏","Day46-60/51.日志和调试工具栏.md"],
   ["中间件的应用","Day46-60/52.中间件的应用.md"],
   ["前后端分离开发入门","Day46-60/53.前后端分离开发入门.md"],
   ["RESTful架构和DRF入门","Day46-60/54.RESTful架构和DRF入门.md"],
   ["RESTful架构和DRF进阶","Day46-60/55.RESTful架构和DRF进阶.md"],
   ["使用缓存","Day46-60/56.使用缓存.md"],
   ["接入三方平台","Day46-60/57.接入三方平台.md"],
   ["异步任务和定时任务","Day46-60/58.异步任务和定时任务.md"],
  ]},
  {title:"数据采集（选学）",lessons:[
   ["网络数据采集概述","Day61-65/61.网络数据采集概述.md"],
   ["用Python获取网络资源-1","Day61-65/62.用Python获取网络资源-1.md"],
   ["用Python解析HTML页面-2","Day61-65/62.用Python解析HTML页面-2.md"],
   ["Python中的并发编程-1","Day61-65/63.Python中的并发编程-1.md"],
   ["Python中的并发编程-2","Day61-65/63.Python中的并发编程-2.md"],
   ["Python中的并发编程-3","Day61-65/63.Python中的并发编程-3.md"],
   ["并发编程在爬虫中的应用","Day61-65/63.并发编程在爬虫中的应用.md"],
   ["使用Selenium抓取网页动态内容","Day61-65/64.使用Selenium抓取网页动态内容.md"],
   ["爬虫框架Scrapy简介","Day61-65/65.爬虫框架Scrapy简介.md"],
  ]},
  {title:"数据分析",lessons:[
   ["数据分析概述","Day66-80/66.数据分析概述.md"],
   ["环境准备","Day66-80/67.环境准备.md"],
   ["NumPy的应用-1","Day66-80/68.NumPy的应用-1.md"],
   ["NumPy的应用-2","Day66-80/69.NumPy的应用-2.md"],
   ["NumPy的应用-3","Day66-80/70.NumPy的应用-3.md"],
   ["NumPy的应用-4","Day66-80/71.NumPy的应用-4.md"],
   ["深入浅出pandas-1","Day66-80/72.深入浅出pandas-1.md"],
   ["深入浅出pandas-2","Day66-80/73.深入浅出pandas-2.md"],
   ["深入浅出pandas-3","Day66-80/74.深入浅出pandas-3.md"],
   ["深入浅出pandas-4","Day66-80/75.深入浅出pandas-4.md"],
   ["深入浅出pandas-5","Day66-80/76.深入浅出pandas-5.md"],
   ["深入浅出pandas-6","Day66-80/77.深入浅出pandas-6.md"],
   ["数据可视化-1","Day66-80/78.数据可视化-1.md"],
   ["数据可视化-2","Day66-80/79.数据可视化-2.md"],
   ["数据可视化-3","Day66-80/80.数据可视化-3.md"],
  ]},
  {title:"机器学习",lessons:[
   ["浅谈机器学习","Day81-90/81.浅谈机器学习.md"],
   ["k最近邻算法","Day81-90/82.k最近邻算法.md"],
   ["决策树和随机森林","Day81-90/83.决策树和随机森林.md"],
   ["朴素贝叶斯算法","Day81-90/84.朴素贝叶斯算法.md"],
   ["回归模型","Day81-90/85.回归模型.md"],
   ["K-Means聚类算法","Day81-90/86.K-Means聚类算法.md"],
   ["集成学习算法","Day81-90/87.集成学习算法.md"],
   ["神经网络模型","Day81-90/88.神经网络模型.md"],
   ["自然语言处理入门","Day81-90/89.自然语言处理入门.md"],
   ["机器学习实战","Day81-90/90.机器学习实战.md"],
  ]},
  {title:"工程与项目（选学）",lessons:[
   ["团队项目开发的问题和解决方案","Day91-100/91.团队项目开发的问题和解决方案.md"],
   ["Docker容器技术详解","Day91-100/92.Docker容器技术详解.md"],
   ["MySQL性能优化","Day91-100/93.MySQL性能优化.md"],
   ["网络API接口设计","Day91-100/94.网络API接口设计.md"],
   ["使用Django开发商业项目","Day91-100/95.使用Django开发商业项目.md"],
   ["软件测试和自动化测试","Day91-100/96.软件测试和自动化测试.md"],
   ["电商网站技术要点剖析","Day91-100/97.电商网站技术要点剖析.md"],
   ["项目部署上线和性能调优","Day91-100/98.项目部署上线和性能调优.md"],
   ["面试中的公共问题","Day91-100/99.面试中的公共问题.md"],
   ["补充内容","Day91-100/100.补充内容.md"],
  ]},
 ],
 "microsoft-ml":[
  {title:"机器学习概览",lessons:[
   ["机器学习入门","translations/zh-CN/1-Introduction/1-intro-to-ML/README.md"],
   ["机器学习的发展历史","translations/zh-CN/1-Introduction/2-history-of-ML/README.md"],
   ["公平性与机器学习","translations/zh-CN/1-Introduction/3-fairness/README.md"],
   ["机器学习技术与方法","translations/zh-CN/1-Introduction/4-techniques-of-ML/README.md"],
  ]},
  {title:"回归",lessons:[
   ["回归入门与工具","translations/zh-CN/2-Regression/1-Tools/README.md","2-Regression/1-Tools/solution/notebook.ipynb"],
   ["数据清洗与可视化","translations/zh-CN/2-Regression/2-Data/README.md","2-Regression/2-Data/solution/notebook.ipynb"],
   ["线性与多项式回归","translations/zh-CN/2-Regression/3-Linear/README.md","2-Regression/3-Linear/solution/notebook.ipynb"],
   ["逻辑回归","translations/zh-CN/2-Regression/4-Logistic/README.md","2-Regression/4-Logistic/solution/notebook.ipynb"],
  ]},
  {title:"模型应用",lessons:[
   ["将模型用于 Web 应用","translations/zh-CN/3-Web-App/1-Web-App/README.md","3-Web-App/1-Web-App/solution/notebook.ipynb"],
  ]},
  {title:"分类",lessons:[
   ["分类数据准备","translations/zh-CN/4-Classification/1-Introduction/README.md","4-Classification/1-Introduction/solution/notebook.ipynb"],
   ["分类器入门","translations/zh-CN/4-Classification/2-Classifiers-1/README.md","4-Classification/2-Classifiers-1/solution/notebook.ipynb"],
   ["更多分类器与比较","translations/zh-CN/4-Classification/3-Classifiers-2/README.md","4-Classification/3-Classifiers-2/solution/notebook.ipynb"],
   ["美食分类应用","translations/zh-CN/4-Classification/4-Applied/README.md","4-Classification/4-Applied/solution/notebook.ipynb"],
  ]},
  {title:"聚类",lessons:[
   ["聚类与可视化","translations/zh-CN/5-Clustering/1-Visualize/README.md","5-Clustering/1-Visualize/solution/notebook.ipynb"],
   ["K-Means 聚类","translations/zh-CN/5-Clustering/2-K-Means/README.md","5-Clustering/2-K-Means/solution/notebook.ipynb"],
  ]},
  {title:"自然语言处理",lessons:[
   ["自然语言处理导论","translations/zh-CN/6-NLP/1-Introduction-to-NLP/README.md"],
   ["常见 NLP 任务","translations/zh-CN/6-NLP/2-Tasks/README.md"],
   ["翻译与情感分析","translations/zh-CN/6-NLP/3-Translation-Sentiment/README.md","6-NLP/3-Translation-Sentiment/solution/notebook.ipynb"],
   ["酒店评论情感分析（一）","translations/zh-CN/6-NLP/4-Hotel-Reviews-1/README.md","6-NLP/4-Hotel-Reviews-1/solution/notebook.ipynb"],
   ["酒店评论情感分析（二）","translations/zh-CN/6-NLP/5-Hotel-Reviews-2/README.md"],
  ]},
  {title:"时间序列",lessons:[
   ["时间序列预测入门","translations/zh-CN/7-TimeSeries/1-Introduction/README.md","7-TimeSeries/1-Introduction/solution/notebook.ipynb"],
   ["ARIMA 时间序列预测","translations/zh-CN/7-TimeSeries/2-ARIMA/README.md","7-TimeSeries/2-ARIMA/solution/notebook.ipynb"],
   ["SVR 时间序列预测","translations/zh-CN/7-TimeSeries/3-SVR/README.md","7-TimeSeries/3-SVR/solution/notebook.ipynb"],
  ]},
  {title:"强化学习",lessons:[
   ["Q-Learning 入门","translations/zh-CN/8-Reinforcement/1-QLearning/README.md","8-Reinforcement/1-QLearning/solution/notebook.ipynb"],
   ["强化学习与 Gym","translations/zh-CN/8-Reinforcement/2-Gym/README.md","8-Reinforcement/2-Gym/solution/notebook.ipynb"],
  ]},
  {title:"真实应用",lessons:[
   ["机器学习的真实应用","translations/zh-CN/9-Real-World/1-Applications/README.md"],
   ["RAI 仪表盘与模型调试","translations/zh-CN/9-Real-World/2-Debugging-ML-Models/README.md"],
  ]},
 ],
 "ailearning":[
  {title:"基础与分类",lessons:[
   ["机器学习基础","docs/ml/1.md"],
   ["KNN 近邻算法","docs/ml/2.md"],
   ["决策树","docs/ml/3.md"],
   ["朴素贝叶斯","docs/ml/4.md"],
   ["Logistic回归","docs/ml/5.md"],
   ["SVM 支持向量机","docs/ml/6.md"],
   ["集成方法（随机森林和 AdaBoost）","docs/ml/7.md"],
  ]},
  {title:"回归与模式挖掘",lessons:[
   ["回归","docs/ml/8.md"],
   ["树回归","docs/ml/9.md"],
   ["K-Means 聚类","docs/ml/10.md"],
   ["利用 Apriori 算法进行关联分析","docs/ml/11.md"],
   ["FP-growth 高效发现频繁项集","docs/ml/12.md"],
  ]},
  {title:"降维与大数据（进阶）",lessons:[
   ["利用 PCA 来简化数据","docs/ml/13.md"],
   ["利用 SVD 来简化数据","docs/ml/14.md"],
   ["大数据与 MapReduce","docs/ml/15.md"],
  ]},
 ],
 "d2l":[
  {title:"安装",lessons:[
   ["安装","chapter_installation/index.ipynb"],
  ]},
  {title:"符号",lessons:[
   ["符号","chapter_notation/index.ipynb"],
  ]},
  {title:"1. 引言",lessons:[
   ["引言","chapter_introduction/index.ipynb"],
  ]},
  {title:"2. 预备知识",lessons:[
   ["数据操作","chapter_preliminaries/ndarray.ipynb"],
   ["数据预处理","chapter_preliminaries/pandas.ipynb"],
   ["线性代数","chapter_preliminaries/linear-algebra.ipynb"],
   ["微积分","chapter_preliminaries/calculus.ipynb"],
   ["自动微分","chapter_preliminaries/autograd.ipynb"],
   ["概率","chapter_preliminaries/probability.ipynb"],
   ["查阅文档","chapter_preliminaries/lookup-api.ipynb"],
  ]},
  {title:"3. 线性神经网络",lessons:[
   ["线性回归","chapter_linear-networks/linear-regression.ipynb"],
   ["线性回归的从零开始实现","chapter_linear-networks/linear-regression-scratch.ipynb"],
   ["线性回归的简洁实现","chapter_linear-networks/linear-regression-concise.ipynb"],
   ["softmax回归","chapter_linear-networks/softmax-regression.ipynb"],
   ["图像分类数据集","chapter_linear-networks/image-classification-dataset.ipynb"],
   ["softmax回归的从零开始实现","chapter_linear-networks/softmax-regression-scratch.ipynb"],
   ["softmax回归的简洁实现","chapter_linear-networks/softmax-regression-concise.ipynb"],
  ]},
  {title:"4. 多层感知机",lessons:[
   ["多层感知机","chapter_multilayer-perceptrons/mlp.ipynb"],
   ["多层感知机的从零开始实现","chapter_multilayer-perceptrons/mlp-scratch.ipynb"],
   ["多层感知机的简洁实现","chapter_multilayer-perceptrons/mlp-concise.ipynb"],
   ["模型选择、欠拟合和过拟合","chapter_multilayer-perceptrons/underfit-overfit.ipynb"],
   ["权重衰减","chapter_multilayer-perceptrons/weight-decay.ipynb"],
   ["暂退法（Dropout）","chapter_multilayer-perceptrons/dropout.ipynb"],
   ["前向传播、反向传播和计算图","chapter_multilayer-perceptrons/backprop.ipynb"],
   ["数值稳定性和模型初始化","chapter_multilayer-perceptrons/numerical-stability-and-init.ipynb"],
   ["环境和分布偏移","chapter_multilayer-perceptrons/environment.ipynb"],
   ["实战Kaggle比赛：预测房价","chapter_multilayer-perceptrons/kaggle-house-price.ipynb"],
  ]},
  {title:"5. 深度学习计算",lessons:[
   ["层和块","chapter_deep-learning-computation/model-construction.ipynb"],
   ["参数管理","chapter_deep-learning-computation/parameters.ipynb"],
   ["延后初始化","chapter_deep-learning-computation/deferred-init.ipynb"],
   ["自定义层","chapter_deep-learning-computation/custom-layer.ipynb"],
   ["读写文件","chapter_deep-learning-computation/read-write.ipynb"],
   ["GPU","chapter_deep-learning-computation/use-gpu.ipynb"],
  ]},
  {title:"6. 卷积神经网络",lessons:[
   ["从全连接层到卷积","chapter_convolutional-neural-networks/why-conv.ipynb"],
   ["图像卷积","chapter_convolutional-neural-networks/conv-layer.ipynb"],
   ["填充和步幅","chapter_convolutional-neural-networks/padding-and-strides.ipynb"],
   ["多输入多输出通道","chapter_convolutional-neural-networks/channels.ipynb"],
   ["汇聚层","chapter_convolutional-neural-networks/pooling.ipynb"],
   ["卷积神经网络（LeNet）","chapter_convolutional-neural-networks/lenet.ipynb"],
  ]},
  {title:"7. 现代卷积神经网络",lessons:[
   ["深度卷积神经网络（AlexNet）","chapter_convolutional-modern/alexnet.ipynb"],
   ["使用块的网络（VGG）","chapter_convolutional-modern/vgg.ipynb"],
   ["网络中的网络（NiN）","chapter_convolutional-modern/nin.ipynb"],
   ["含并行连结的网络（GoogLeNet）","chapter_convolutional-modern/googlenet.ipynb"],
   ["批量规范化","chapter_convolutional-modern/batch-norm.ipynb"],
   ["残差网络（ResNet）","chapter_convolutional-modern/resnet.ipynb"],
   ["稠密连接网络（DenseNet）","chapter_convolutional-modern/densenet.ipynb"],
  ]},
  {title:"8. 循环神经网络",lessons:[
   ["序列模型","chapter_recurrent-neural-networks/sequence.ipynb"],
   ["文本预处理","chapter_recurrent-neural-networks/text-preprocessing.ipynb"],
   ["语言模型和数据集","chapter_recurrent-neural-networks/language-models-and-dataset.ipynb"],
   ["循环神经网络","chapter_recurrent-neural-networks/rnn.ipynb"],
   ["循环神经网络的从零开始实现","chapter_recurrent-neural-networks/rnn-scratch.ipynb"],
   ["循环神经网络的简洁实现","chapter_recurrent-neural-networks/rnn-concise.ipynb"],
   ["通过时间反向传播","chapter_recurrent-neural-networks/bptt.ipynb"],
  ]},
  {title:"9. 现代循环神经网络",lessons:[
   ["门控循环单元（GRU）","chapter_recurrent-modern/gru.ipynb"],
   ["长短期记忆网络（LSTM）","chapter_recurrent-modern/lstm.ipynb"],
   ["深度循环神经网络","chapter_recurrent-modern/deep-rnn.ipynb"],
   ["双向循环神经网络","chapter_recurrent-modern/bi-rnn.ipynb"],
   ["机器翻译与数据集","chapter_recurrent-modern/machine-translation-and-dataset.ipynb"],
   ["编码器-解码器架构","chapter_recurrent-modern/encoder-decoder.ipynb"],
   ["序列到序列学习（seq2seq）","chapter_recurrent-modern/seq2seq.ipynb"],
   ["束搜索","chapter_recurrent-modern/beam-search.ipynb"],
  ]},
  {title:"10. 注意力机制",lessons:[
   ["注意力提示","chapter_attention-mechanisms/attention-cues.ipynb"],
   ["注意力汇聚：Nadaraya-Watson 核回归","chapter_attention-mechanisms/nadaraya-waston.ipynb"],
   ["注意力评分函数","chapter_attention-mechanisms/attention-scoring-functions.ipynb"],
   ["Bahdanau 注意力","chapter_attention-mechanisms/bahdanau-attention.ipynb"],
   ["多头注意力","chapter_attention-mechanisms/multihead-attention.ipynb"],
   ["自注意力和位置编码","chapter_attention-mechanisms/self-attention-and-positional-encoding.ipynb"],
   ["Transformer","chapter_attention-mechanisms/transformer.ipynb"],
  ]},
  {title:"11. 优化算法",lessons:[
   ["优化和深度学习","chapter_optimization/optimization-intro.ipynb"],
   ["凸性","chapter_optimization/convexity.ipynb"],
   ["梯度下降","chapter_optimization/gd.ipynb"],
   ["随机梯度下降","chapter_optimization/sgd.ipynb"],
   ["小批量随机梯度下降","chapter_optimization/minibatch-sgd.ipynb"],
   ["动量法","chapter_optimization/momentum.ipynb"],
   ["AdaGrad算法","chapter_optimization/adagrad.ipynb"],
   ["RMSProp算法","chapter_optimization/rmsprop.ipynb"],
   ["Adadelta","chapter_optimization/adadelta.ipynb"],
   ["Adam算法","chapter_optimization/adam.ipynb"],
   ["学习率调度器","chapter_optimization/lr-scheduler.ipynb"],
  ]},
  {title:"12. 计算性能",lessons:[
   ["编译器和解释器","chapter_computational-performance/hybridize.ipynb"],
   ["异步计算","chapter_computational-performance/async-computation.ipynb"],
   ["自动并行","chapter_computational-performance/auto-parallelism.ipynb"],
   ["硬件","chapter_computational-performance/hardware.ipynb"],
   ["多GPU训练","chapter_computational-performance/multiple-gpus.ipynb"],
   ["多GPU的简洁实现","chapter_computational-performance/multiple-gpus-concise.ipynb"],
   ["参数服务器","chapter_computational-performance/parameterserver.ipynb"],
  ]},
  {title:"13. 计算机视觉",lessons:[
   ["图像增广","chapter_computer-vision/image-augmentation.ipynb"],
   ["微调","chapter_computer-vision/fine-tuning.ipynb"],
   ["目标检测和边界框","chapter_computer-vision/bounding-box.ipynb"],
   ["锚框","chapter_computer-vision/anchor.ipynb"],
   ["多尺度目标检测","chapter_computer-vision/multiscale-object-detection.ipynb"],
   ["目标检测数据集","chapter_computer-vision/object-detection-dataset.ipynb"],
   ["单发多框检测（SSD）","chapter_computer-vision/ssd.ipynb"],
   ["区域卷积神经网络（R-CNN）系列","chapter_computer-vision/rcnn.ipynb"],
   ["语义分割和数据集","chapter_computer-vision/semantic-segmentation-and-dataset.ipynb"],
   ["转置卷积","chapter_computer-vision/transposed-conv.ipynb"],
   ["全卷积网络","chapter_computer-vision/fcn.ipynb"],
   ["风格迁移","chapter_computer-vision/neural-style.ipynb"],
   ["实战 Kaggle 比赛：图像分类 (CIFAR-10)","chapter_computer-vision/kaggle-cifar10.ipynb"],
   ["实战Kaggle比赛：狗的品种识别（ImageNet Dogs）","chapter_computer-vision/kaggle-dog.ipynb"],
  ]},
  {title:"14. 自然语言处理：预训练",lessons:[
   ["词嵌入（word2vec）","chapter_natural-language-processing-pretraining/word2vec.ipynb"],
   ["近似训练","chapter_natural-language-processing-pretraining/approx-training.ipynb"],
   ["用于预训练词嵌入的数据集","chapter_natural-language-processing-pretraining/word-embedding-dataset.ipynb"],
   ["预训练word2vec","chapter_natural-language-processing-pretraining/word2vec-pretraining.ipynb"],
   ["全局向量的词嵌入（GloVe）","chapter_natural-language-processing-pretraining/glove.ipynb"],
   ["子词嵌入","chapter_natural-language-processing-pretraining/subword-embedding.ipynb"],
   ["词的相似性和类比任务","chapter_natural-language-processing-pretraining/similarity-analogy.ipynb"],
   ["来自Transformers的双向编码器表示（BERT）","chapter_natural-language-processing-pretraining/bert.ipynb"],
   ["用于预训练BERT的数据集","chapter_natural-language-processing-pretraining/bert-dataset.ipynb"],
   ["预训练BERT","chapter_natural-language-processing-pretraining/bert-pretraining.ipynb"],
  ]},
  {title:"15. 自然语言处理：应用",lessons:[
   ["情感分析及数据集","chapter_natural-language-processing-applications/sentiment-analysis-and-dataset.ipynb"],
   ["情感分析：使用循环神经网络","chapter_natural-language-processing-applications/sentiment-analysis-rnn.ipynb"],
   ["情感分析：使用卷积神经网络","chapter_natural-language-processing-applications/sentiment-analysis-cnn.ipynb"],
   ["自然语言推断与数据集","chapter_natural-language-processing-applications/natural-language-inference-and-dataset.ipynb"],
   ["自然语言推断：使用注意力","chapter_natural-language-processing-applications/natural-language-inference-attention.ipynb"],
   ["针对序列级和词元级应用微调BERT","chapter_natural-language-processing-applications/finetuning-bert.ipynb"],
   ["自然语言推断：微调BERT","chapter_natural-language-processing-applications/natural-language-inference-bert.ipynb"],
  ]},
  {title:"16. 附录：深度学习工具",lessons:[
   ["使用Jupyter Notebook","chapter_appendix-tools-for-deep-learning/jupyter.ipynb"],
   ["使用Amazon SageMaker","chapter_appendix-tools-for-deep-learning/sagemaker.ipynb"],
   ["使用Amazon EC2实例","chapter_appendix-tools-for-deep-learning/aws.ipynb"],
   ["选择服务器和GPU","chapter_appendix-tools-for-deep-learning/selecting-servers-gpus.ipynb"],
   ["为本书做贡献","chapter_appendix-tools-for-deep-learning/contributing.ipynb"],
   ["d2l API 文档","chapter_appendix-tools-for-deep-learning/d2l.ipynb"],
  ]},
 ],
 "pytorch":[
  {title:"前置知识（选学）",lessons:[
   ["人工智能简史","source/第零章/0.1 人工智能简史.md"],
   ["评价指标","source/第零章/0.2 评价指标.md"],
   ["Jupyter相关操作","source/第零章/0.4 Jupyter相关操作.md"],
  ]},
  {title:"简介与安装",lessons:[
   ["PyTorch简介","source/第一章/1.1 PyTorch简介.md"],
   ["PyTorch的安装","source/第一章/1.2 PyTorch的安装.md"],
   ["PyTorch相关资源","source/第一章/1.3 PyTorch相关资源.md"],
  ]},
  {title:"张量与自动求导",lessons:[
   ["张量","source/第二章/2.1 张量.md"],
   ["自动求导","source/第二章/2.2 自动求导.md"],
   ["并行计算简介","source/第二章/2.3 并行计算简介.md"],
   ["AI硬件加速设备","source/第二章/2.4 AI硬件加速设备.md"],
  ]},
  {title:"训练流程",lessons:[
   ["思考：完成深度学习的必要部分","source/第三章/3.1 思考：完成深度学习的必要部分.md"],
   ["基本配置","source/第三章/3.2 基本配置.md"],
   ["数据读入","source/第三章/3.3 数据读入.md"],
   ["模型构建","source/第三章/3.4 模型构建.md"],
   ["模型初始化","source/第三章/3.5 模型初始化.md"],
   ["损失函数","source/第三章/3.6 损失函数.md"],
   ["训练与评估","source/第三章/3.7 训练与评估.md"],
   ["可视化","source/第三章/3.8 可视化.md"],
   ["优化器","source/第三章/3.9 优化器.md"],
  ]},
  {title:"基础实战",lessons:[
   ["ResNet","source/第四章/4.1 ResNet.md"],
   ["FashionMNIST图像分类","source/第四章/4.4 FashionMNIST图像分类.md"],
  ]},
  {title:"模型定义与保存",lessons:[
   ["PyTorch模型定义的方式","source/第五章/5.1 PyTorch模型定义的方式.md"],
   ["利用模型块快速搭建复杂网络","source/第五章/5.2 利用模型块快速搭建复杂网络.md"],
   ["PyTorch修改模型","source/第五章/5.3 PyTorch修改模型.md"],
   ["PyTorch模型保存与读取","source/第五章/5.4 PyTorh模型保存与读取.md"],
  ]},
  {title:"训练技巧",lessons:[
   ["自定义损失函数","source/第六章/6.1 自定义损失函数.md"],
   ["动态调整学习率","source/第六章/6.2 动态调整学习率.md"],
   ["模型微调-timm","source/第六章/6.3 模型微调-timm.md"],
   ["模型微调-torchvision","source/第六章/6.3 模型微调-torchvision.md"],
   ["半精度训练","source/第六章/6.4 半精度训练.md"],
   ["数据增强-imgaug","source/第六章/6.5 数据增强-imgaug.md"],
   ["使用argparse进行调参","source/第六章/6.6 使用argparse进行调参.md"],
  ]},
  {title:"可视化",lessons:[
   ["可视化网络结构","source/第七章/7.1 可视化网络结构.md"],
   ["CNN卷积层可视化","source/第七章/7.2 CNN卷积层可视化.md"],
   ["使用TensorBoard可视化训练过程","source/第七章/7.3 使用TensorBoard可视化训练过程.md"],
   ["使用wandb可视化训练过程","source/第七章/7.4 使用wandb可视化训练过程.md"],
   ["使用SwanLab可视化训练过程","source/第七章/7.5 使用SwanLab可视化训练过程.md"],
  ]},
  {title:"PyTorch 生态",lessons:[
   ["本章简介","source/第八章/8.1 本章简介.md"],
   ["图像 - torchvision","source/第八章/8.2 图像 - torchvision.md"],
   ["视频 - PyTorchVideo","source/第八章/8.3 视频 - PyTorchVideo.md"],
   ["文本 - torchtext","source/第八章/8.4 文本 - torchtext.md"],
   ["音频 - torchaudio","source/第八章/8.5 音频 - torchaudio.md"],
  ]},
  {title:"模型部署",lessons:[
   ["使用ONNX进行部署并推理","source/第九章/9.1 使用ONNX进行部署并推理.md"],
  ]},
  {title:"网络解读（进阶）",lessons:[
   ["目标检测","source/第十章/10.2 目标检测.md"],
   ["LSTM解读及实战","source/第十章/LSTM解读及实战.md"],
   ["RNN详解及其实现","source/第十章/RNN详解及其实现.md"],
   ["ResNet源码解读","source/第十章/ResNet源码解读.md"],
   ["Swin-Transformer解读","source/第十章/Swin-Transformer解读.md"],
   ["Transformer 解读","source/第十章/Transformer 解读.md"],
   ["ViT解读","source/第十章/ViT解读.md"],
   ["MMYOLO 安装与入门","source/第十章/YOLO系列解读/MMYOLO实现/README.md"],
   ["MMYOLO 模型设计","source/第十章/YOLO系列解读/MMYOLO实现/model_design.md"],
   ["RTMDet 模型解读","source/第十章/YOLO系列解读/MMYOLO实现/rtmdet_description.md"],
   ["YOLOv5 模型解读","source/第十章/YOLO系列解读/MMYOLO实现/yolov5_description.md"],
  ]},
 ],
 "happy-llm":[
  {title:"NLP 与语言模型原理",lessons:[
   ["NLP基础概念","docs/chapter1/第一章 NLP基础概念.md"],
   ["Transformer架构","docs/chapter2/第二章 Transformer架构.md","docs/chapter2/code/transformer.py","blob"],
   ["预训练语言模型","docs/chapter3/第三章 预训练语言模型.md"],
   ["大语言模型","docs/chapter4/第四章 大语言模型.md"],
  ]},
  {title:"模型构建、训练与应用",lessons:[
   ["动手搭建大模型","docs/chapter5/第五章 动手搭建大模型.md","docs/chapter5/code","tree"],
   ["大模型训练流程实践","docs/chapter6/第六章 大模型训练流程实践.md","docs/chapter6/code","tree"],
   ["大模型应用","docs/chapter7/第七章 大模型应用.md","docs/chapter7/Agent","tree"],
   ["大模型强化学习","docs/chapter8/第八章 大模型强化学习.md","docs/chapter8","tree"],
  ]},
 ],
};
// END COURSE CATALOG

function lessonNumber(number){
 const digits='零一二三四五六七八九';
 if(number<10)return digits[number];
 if(number<100)return (number<20?'':digits[Math.floor(number/10)])+'十'+(number%10?digits[number%10]:'');
 const rest=number%100;return digits[Math.floor(number/100)]+'百'+(rest?(rest<10?'零':rest<20?'一':'')+lessonNumber(rest):'');
}

function commandBlock(command){
 const block=el('div',null,'practical-command'),heading=el('div',null,'practical-command-heading'),code=el('code',command.value),pre=el('pre'),copy=el('button','复制','button compact');copy.type='button';copy.setAttribute('aria-label','复制'+command.label);pre.tabIndex=0;pre.append(code);heading.append(el('span',command.label),copy);block.append(heading,pre);
 const status=el('p',null,'practical-copy-status');status.setAttribute('role','status');block.append(status);
 copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(command.value);copy.textContent='已复制';status.textContent='';}catch{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(code);selection.removeAllRanges();selection.addRange(range);pre.focus();status.textContent='自动复制不可用，内容已选中。请按 Ctrl+C（Mac：⌘C）复制。';}});return block;
}

function createGitSetup(project){
 const source=courseSources[project.id],root=el('details',null,'practical-git-setup');root.append(el('summary','Git 与运行准备'));
 const body=el('div',null,'practical-git-body');body.append(el('p','先安装 Git，再打开自己电脑上的 PowerShell（Windows）或终端（macOS / Linux）。在准备存放课程的文件夹里，逐条执行下面的命令。'));
 const links=el('div',null,'practical-course-actions');links.append(link('安装 Git','https://git-scm.com/install/','download'),link('安装 VS Code','https://code.visualstudio.com/download','download'),link('原项目环境要求',source.environmentUrl||sourceUrl(project,source.environment),'settings'));body.append(links);
 const folder='learning-'+project.id;
 for(const [label,value]of [['检查 Git','git --version'],['克隆课程代码','git clone '+(source.codeRepository||project.repository)+'.git '+folder],['进入课程文件夹','cd '+folder],['使用与目录一致的版本','git checkout --detach '+source.revision]])body.append(commandBlock({label,value}));
 body.append(el('p','课文可直接在线阅读。需要本地查看 Markdown 时，用 VS Code 打开克隆后的文件夹，打开 .md 文件并按 Ctrl+Shift+V（Mac：⌘⇧V）预览；运行实验前再按原项目要求准备 Python 和依赖。','practical-git-note'));
 body.append(el('p','这些命令在学习者自己的电脑执行。已经克隆过的课程直接打开原文件夹，不要重复克隆到同名目录。','practical-git-note'));root.append(body);return root;
}

function createCourseCatalog(project,state){
 const groups=courseCatalog[project.id],root=el('section',null,'practical-course-catalog');root.setAttribute('aria-label',project.title+'课程目录');
 let number=0;const lessons=groups.flatMap((group,index)=>group.lessons.map(lesson=>({title:lesson[0],path:lesson[1],code:lesson[2],kind:lesson[3]||'blob',group:index,number:++number})));
 const toolbar=el('div',null,'practical-catalog-toolbar'),heading=el('h3','课程目录'),count=el('span','共 '+lessons.length+' 课','practical-course-total'),search=el('input');search.type='search';search.placeholder='搜索课程';search.setAttribute('aria-label','搜索本项目课程');search.value=state.query;heading.append(count);toolbar.append(heading,search);root.append(toolbar);
 const actions=el('div',null,'practical-catalog-actions');actions.append(createGitSetup(project),link('GitHub 仓库',project.repository,'forward'));root.append(actions);
 const grid=el('div',null,'practical-catalog-grid'),nav=el('nav',null,'practical-course-groups');nav.setAttribute('aria-label','课程分组');
 const panel=el('div',null,'practical-lesson-panel'),result=el('p',null,'practical-catalog-result'),list=el('ol',null,'practical-lesson-list');result.setAttribute('role','status');result.setAttribute('aria-live','polite');list.id='practical-course-lessons';list.setAttribute('aria-label','课程列表');panel.append(result,list);grid.append(nav,panel);root.append(grid);
 const buttons=groups.map((group,index)=>{const button=el('button');button.type='button';button.dataset.courseGroup=index;button.setAttribute('aria-controls',list.id);button.append(el('span',group.title),el('small',group.lessons.length+' 课'));button.addEventListener('click',()=>{state.group=index;state.query='';search.value='';render();});nav.append(button);return button;});
 search.addEventListener('input',()=>{state.query=search.value;render();});
 function render(){
  const query=state.query.trim().toLocaleLowerCase(),shown=lessons.filter(lesson=>query?[lesson.title,lesson.path,groups[lesson.group].title,'第'+lessonNumber(lesson.number)+'课'].join(' ').toLocaleLowerCase().includes(query):lesson.group===state.group);
  buttons.forEach((button,index)=>{button.setAttribute('aria-pressed',String(!query&&index===state.group));});list.replaceChildren();
  result.textContent=query?'找到 '+shown.length+' 课':groups[state.group].title+' · '+shown.length+' 课';
  for(const lesson of shown){
   const item=el('li',null,'practical-lesson'),anchor=el('a',null,'practical-lesson-link');anchor.href=sourceUrl(project,lesson.path);anchor.target='_blank';anchor.rel='noopener noreferrer';anchor.dataset.courseLesson=lesson.number;anchor.title=lesson.path+'（在 GitHub 新窗口阅读）';
   const glyph=el('span');glyph.dataset.icon='book';glyph.setAttribute('aria-hidden','true');anchor.append(el('span','第'+lessonNumber(lesson.number)+'课','practical-lesson-number'),el('strong',lesson.title),glyph);item.append(anchor);
   if(lesson.code){const code=link(lesson.kind==='tree'?'代码':'实验',sourceUrl(project,lesson.code,lesson.kind),'forward');code.classList.add('practical-lesson-code');code.setAttribute('aria-label',lesson.title+'：'+(lesson.kind==='tree'?'配套代码':'配套实验'));item.append(code);}list.append(item);
  }
  if(!shown.length){const empty=el('li',null,'practical-catalog-empty'),clear=el('button','清空搜索','button compact');clear.type='button';clear.addEventListener('click',()=>{state.query='';search.value='';render();search.focus();});empty.append(el('p','没有找到匹配课程，换个关键词或清空搜索。'),clear);list.append(empty);}
  panel.scrollTop=0;mountIcons();
 }
 render();return root;
}

function link(text,url,glyph){const node=el('a',text,'button compact');node.href=url;node.target='_blank';node.rel='noopener noreferrer';const icon=el('span');icon.dataset.icon=glyph;icon.setAttribute('aria-hidden','true');node.append(icon);return node;}

export function createPracticalLearningRoute(initial,onChoose=()=>{}){
 const root=el('section',null,'practical-learning-route');root.id='practical-learning-route';root.setAttribute('aria-label','实战学习路线');
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
 let selected;const catalogStates=new Map();
 function choose(id,updateUrl=false){
  const project=projects.find(item=>item.id===id)||projects[0];if(selected===project.id)return;selected=project.id;
  for(const [key,node]of buttons){const active=key===selected;node.classList.toggle('selected',active);node.setAttribute('aria-pressed',String(active));}
  detail.dataset.project=selected;renderProject(project);onChoose(selected);
  if(updateUrl){const params=new URLSearchParams(location.hash.split('?')[1]||'');params.set('practice',selected);history.replaceState(history.state,'','#/apps/math-to-ai/practice?'+params);}
 }
 function renderProject(project){
  detail.replaceChildren();
  const heading=el('div',null,'practical-project-heading'),name=el('h2',project.title);name.id='practical-project-title';detail.setAttribute('aria-labelledby',name.id);heading.append(name,el('span',project.phase,'practical-project-phase'));
  detail.append(heading);let state=catalogStates.get(project.id);if(!state){state={group:0,query:''};catalogStates.set(project.id,state);}
  const description=el('p',project.description,'practical-project-description'),content=el('div',null,'practical-project-content'),topics=el('div'),list=el('ul');topics.append(el('h3','学习内容'));for(const text of project.topics)list.append(el('li',text));topics.append(list);
  const target=el('div');target.append(el('h3','开始前'),el('p',project.prior),el('h3','完成目标'),el('p',project.goal));content.append(topics,target);
  const overview=el('details',null,'practical-project-overview');overview.append(el('summary','学习说明'),content,el('p',project.focus));detail.append(description,createCourseCatalog(project,state),overview);mountIcons();
 }
 choose(initial);return root;
}
