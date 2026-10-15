# 数学到人工智能：配套项目与先修核对

核对日期：2026-10-15。依据是用户本地“数学文献/人工智能”中的实际教材目录，以及下文链接的作者仓库、官方教程与具体源码。服务器当前绑定了哪些教材，本轮尚未核实。

项目的完成范围以下文任务为准。配套仓库中其他章节、其他模型、部署功能不属于必做内容。数学分析和高代的编程实践需要先学 Python 基础；数学课本本身不承担编程教学。概率统计暂不推荐项目。

本轮完成教材内容与源码的静态核对，未在每个第三方仓库的完整环境中运行训练。旧书的环境和数据下载需要单独检查，不能将“教材覆盖知识”表述为“所有旧代码现在都能直接运行”。以下任务将额外软件、数据和算力条件逐项列明。

## 核对后调整

| 课程 | 原推荐的问题 | 本次必做项目 |
| --- | --- | --- |
| 数学分析 | micrograd 的反向计算图还需要图遍历、递归和 Python 运算符重载；数学分析不教授这些内容 | 本平台编写的单变量前向自动微分练习 |
| 高等代数 | SVD 属于 Strang 第 7 章，不能学过矩阵乘法就直接做；官方示例还有图像与 SciPy 数据处理 | 保留 SVD，只处理小型数值矩阵 |
| Python | NumPy 100 后段涉及底层数组技巧，整套并非基础 Python 项目 | 实际教材第 15 章的随机漫步 |
| 机器学习 | 房价预测、从零实现多种算法范围过大，且不是已下载书籍的对应案例 | Müller、Guido 第 1 章鸢尾花分类 |
| 深度学习 | 整套 D2L 横跨多个后续课程，无法作为单个入门项目 | 斋藤康毅第 5 章 NumPy 两层网络 |
| PyTorch | 官方 MNIST 使用卷积、Dropout 等网络知识，不适合刚接触框架 | D2L 第 3.3 节线性回归的 PyTorch 分支 |
| NLP | 原 Practical NLP 项目与本地 NLP in Action 不是同一本书 | 本平台按第 2—3 章编写的词袋、TF-IDF 检索练习 |
| LLM | 从零训练 GPT 与知识库问答各自是更大的课题，额外涉及训练、检索和框架 | 使用现有 API 完成提示词对照实验 |

未继续推荐完整 Transformer 实现；现有数据中的 Transformer 课程和教材关联不作删除。四列学习路线、按钮动效与阅读器不在本次调整范围内。

## 开始前

在自己的电脑编程，服务器继续用于阅读和管理文献。使用单独的 Python 虚拟环境，并记录 `python --version`、所用库版本、随机种子和运行命令。这里不要求在磁盘紧张的服务器上安装训练环境。

完成的共同标准：能脱离教程重新组织自己的脚本，说明每个输入和输出的含义，完成指定检查，并保留结果；只运行作者给出的代码不算独立完成。不额外要求网页、数据库、容器、云部署或 GPU。

<a id="calculus"></a>
## 数学分析：用链式法则做自动求导

这是本平台编写的任务，不是 micrograd 的简化搬运。数学依据是数学分析中的导数、乘积法则、链式法则。编程先修只有 Python 的函数、元组、条件与循环；不会编程时先学 Python 基础。

**目标**：用一对数 `(v, d)` 代表某个中间表达式的值，以及它对唯一自变量 x 的导数。输入 x 记为 `(x, 1)`，常数 c 记为 `(c, 0)`。

写出以下普通函数，均输入、输出这样的数对，不要求类和运算符重载：

- `add(a, b)`：输出 `(a.v + b.v, a.d + b.d)`。
- `mul(a, b)`：输出 `(a.v * b.v, a.d * b.v + a.v * b.d)`。
- `power(a, n)`：n 是非负整数；n=0 输出 `(1, 0)`，否则使用幂函数求导法则。
- `sine(a)`：输出 `(sin(a.v), cos(a.v) * a.d)`，三角函数来自标准库 `math`。

把复合表达式写成这些函数的调用。中间步骤只使用上一层传来的值和导数；对照答案时才使用手算公式。

| 函数 | x | 函数值 | 导数 |
| --- | ---: | ---: | ---: |
| x³ + 2x | 2 | 12 | 14 |
| (x² + 1)³ | 1 | 8 | 24 |
| x sin(x) | 0.5 | 0.2397127693 | 0.9182168195 |
| x × x | -2 | 4 | -4 |

**验收**：函数值、导数与上表的绝对误差均小于 1e-8；再用普通数值函数计算中心差分 `(f(x+h)-f(x-h))/(2h)`，h=1e-5，与自动导数的绝对误差小于 1e-6。同时验证常数导数为 0、x 的导数为 1、x=0 时的零次幂。

**运行条件**：Python 标准库、CPU，无数据。这里不涉及反向传播、拓扑排序、多变量梯度或神经网络。

原项目源码核对入口：[micrograd/engine.py](https://github.com/karpathy/micrograd/blob/master/micrograd/engine.py)。它不是本任务的实现要求。

<a id="linear-algebra"></a>
## 高等代数：矩阵分解与低秩重建

**教材**：Strang《线性代数导论》第五版，第 2 章矩阵运算、第 4 章正交性、第 6 章特征值、第 7 章奇异值分解。编程需 Python 与 NumPy 数组、切片、矩阵乘法；这些应在 Python/NumPy 基础中先完成。

**源码依据**：[NumPy 官方 SVD 教程](https://github.com/numpy/numpy-tutorials/blob/main/content/tutorial-svd.md)。使用其二维矩阵分解知识，不要求图像示例中的颜色通道处理、SciPy 数据集和绘图。

只安装 NumPy。取矩阵：

```text
A = [[3, 1, 0],
     [0, 2, 1],
     [1, 0, 1]]
```

1. 用 `np.linalg.svd(A, full_matrices=False)` 得到 U、s、Vh，逐个输出形状。解释 Vh 与 V 的关系。
2. 用 `U @ np.diag(s) @ Vh` 重建 A，计算 Frobenius 范数误差。
3. 分别保留前 k 个奇异值，k=1、2、3，重建低秩矩阵。注意同时截取 U 的列与 Vh 的行。
4. 记录每个 k 的误差，与舍弃奇异值的平方和开方进行比较。

**验收**：完整重建误差小于 1e-10；k 增大时误差不增（允许 1e-10 浮点容差）；误差与舍弃奇异值的公式相符。说明低秩重建与截断哪些方向有关，而不只是粘贴库函数输出。

**运行条件**：Python + NumPy、CPU，无外部数据。这里只实现和验证已学过的分解，不要求证明最优低秩近似定理。

<a id="python"></a>
## Python：随机漫步可视化

**教材**：用户现有《Python 编程：从入门到实践》第一版，基础部分（列表、循环、函数、类、模块），以及第 15 章随机漫步部分。

**作者源码**：[chapter_15](https://github.com/ehmatthes/pcc/tree/master/chapter_15)，关注 `random_walk.py` 与 `rw_visual.py`。该仓库对应第一版且已经归档，不要求跟随旧书安装整套开发环境。

1. 用两个列表保存 x、y 坐标，起点均为 0。
2. 每个方向的符号从 -1、1 中选取，距离从 0—4 中选取；两个方向都为 0 时重选。
3. 保留包含起点在内的 5,000 个点。实现后先打印前几个坐标检查。
4. 用 Matplotlib 的散点图画轨迹，用颜色表示步数，并突出起点、终点，保存为 PNG。

**验收**：两个列表长度均为 5,000；首点为 (0,0)；相邻点不重合，每个坐标轴的单步变化绝对值不超过 4；保存图像。固定随机种子后能重新生成相同坐标。

**运行条件**：Python 标准库 `random` 与 Matplotlib、CPU。不要求 NumPy、概率极限定理、游戏开发或 Django。第 15 章其他项目不是必做项。

<a id="machine-learning"></a>
## 机器学习：鸢尾花分类完整小项目

**教材**：Müller、Guido《Python 机器学习基础教程》第 1 章，做到鸢尾花案例的训练与评估。应理解样本、特征、标签、训练/测试划分、k 近邻与准确率。

**作者源码**：[01-introduction.ipynb](https://github.com/amueller/introduction_to_ml_with_python/blob/main/01-introduction.ipynb)，重点是鸢尾花的首个完整应用。原 Notebook 的 `preamble` 加载了额外演示依赖；独立脚本直接导入本任务所需模块，不运行全部演示单元。

只需 NumPy、scikit-learn。用到的直接导入为：

```python
import numpy as np
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
```

1. 调用 `load_iris()`，输出数据形状、特征名称与类别名称。
2. 设置 `test_size=0.25, random_state=0` 划分训练和测试集。
3. 建立 `KNeighborsClassifier(n_neighbors=1)`，仅用训练集 `fit`。
4. 输出测试集 `score`，再对四维新样本 `[5.0, 2.9, 1.0, 0.2]` 预测并转成类别名。
5. 报告数据划分数量、准确率和样本预测。解释为什么测试标签不能参加训练。

**验收**：输入共有 150 个样本、4 个特征；划分为 112 个训练样本与 38 个测试样本；预测与类别名正确对应，结果能重复。不得用训练准确率代替测试准确率，也不因单次高分宣称模型普遍可靠。

**运行条件**：Python + NumPy + scikit-learn、CPU；数据随库提供，不下载 Kaggle 文件。无需神经网络、网格搜索或后续深度学习课程。

<a id="deep-learning"></a>
## 深度学习：NumPy 两层网络识别手写数字

**教材**：斋藤康毅《深度学习入门：基于 Python 的理论与实现》第 1—5 章，特别是损失函数、数值微分、误差反向传播和两层网络。先修是 NumPy、矩阵乘法与链式法则。

**作者源码**：[ch05](https://github.com/oreilly-japan/deep-learning-from-scratch/tree/master/ch05)，主要是 `two_layer_net.py`、`train_neuralnet.py`。`common` 和 `dataset` 是本书配套辅助代码，不是要求学习的另一套框架；保留仓库目录关系，从 `ch05` 运行脚本。

1. 按书中推导实现 Affine、ReLU、SoftmaxWithLoss 的正向与反向计算，以及两层网络的参数更新。
2. 先用小网络（输入 4、隐藏 3、输出 2，批量 3）比较解析梯度和中心差分梯度。避免在 784×50 的完整网络上逐参数数值微分。
3. 再用 MNIST 的展平输入、归一化、one-hot 标签训练 784→50→10 的两层网络。可以先取训练集前 5,000 条、测试集前 1,000 条，进行 500 次迭代验证流程；之后延长训练并记录迭代次数。
4. 固定随机种子，保存训练损失和训练/测试准确率。训练集与测试集不能混用。

**验收**：小网络梯度的相对范数误差 `norm(解析-数值)/(norm(解析)+norm(数值)+1e-7)` 小于 1e-4；记录完整训练设置和损失变化，输出独立测试准确率；解释 W1、b1、W2、b2 的形状。随机初始化恰落在 ReLU 折点时换一组输入再检查。初始小规模运行只检查训练流程，不承诺固定识别率。

**运行条件**：Python + NumPy、CPU；首次需联网下载 MNIST，原始文件、缓存和内存另占空间。核对时作者的 [dataset/mnist.py](https://github.com/oreilly-japan/deep-learning-from-scratch/blob/master/dataset/mnist.py) 使用公开镜像。下载可达性和完整训练未在本轮实测。

第 7 章 CNN 与其他仓库中的 PyTorch 实现不在本任务范围内；第 5 章知识足以解释这里的训练算法。

<a id="pytorch"></a>
## PyTorch：完成线性回归训练循环

**教材**：《动手学深度学习》第二版 PyTorch 版，第 2 章预备知识、3.1—3.3 节线性回归。先理解线性模型、均方误差和梯度下降，再用框架表达相同过程。

**教材源码**：[linear-regression-concise.md](https://github.com/d2l-ai/d2l-zh/blob/master/chapter_linear-networks/linear-regression-concise.md)。该源文件混合多个框架分支，只使用 PyTorch 部分，不将整份 Markdown 当成可运行 Python 文件。

只安装 PyTorch。本任务自行生成数据，替代 `d2l.synthetic_data`，避免为了两个辅助函数安装旧版本整套 `d2l`：

1. `torch.manual_seed(0)`；生成 1,000×2 的标准正态特征 X，真实权重设为 `[2.0, -3.4]`，偏置 4.2。
2. 按 `y = X @ w + b + 0.01 * 标准正态噪声` 生成标签，整理成 N×1。另生成 200 条测试数据，不参加训练。
3. 用 `TensorDataset`、`DataLoader` 读取训练数据，batch_size=10。
4. 建立 `nn.Linear(2, 1)`，使用 `nn.MSELoss` 与 `torch.optim.SGD(lr=0.03)`。
5. 每一批执行梯度清零、前向、损失、反向、更新；训练 10 轮。注意 X、权重与标签保持一致的浮点 dtype。
6. 用 `torch.no_grad()` 测试。比较训练前后 MSE、学得的权重与偏置。

**验收**：学得参数与真实参数的最大绝对误差小于 0.1；独立测试 MSE 小于 0.01；说明 `zero_grad`、`backward`、`step` 各自做什么。记录随机种子、版本和损失；CPU 上执行，不依赖 CUDA。

无需 CNN、MNIST、Dropout、学习率调度器或模型部署。保存/加载模型属于教材后续章节，本次不额外要求。

<a id="nlp"></a>
## NLP：用 TF-IDF 检索短文

这是本平台按《Natural Language Processing in Action》第二版第 2—3 章编写的独立练习，不冒充该书作者的配套仓库。第 2 章学习分词与词袋，第 3 章学习 TF-IDF、向量相似度；Python 需要字符串、字典、循环和 `math`。

使用以下固定英文短文，不涉及中文分词、PDF 解析或网页抓取：

```text
analysis: limit derivative integral function
algebra: matrix vector basis linear
probability: random event probability distribution
```

1. 小写并按空白切词；从三篇文档构造词表。
2. TF 取词项原始出现次数；规定 `idf(t)=1+log((N+1)/(df(t)+1))`，其中 N=3，df 是包含该词的文档数量。明确这一公式，避免不同库的平滑约定导致结果混淆。
3. 为文档和查询分别计算 TF-IDF；查询使用同一文档词表与 IDF。词表外词忽略。
4. 用余弦相似度排序，只返回分数大于 0 的文档；零向量查询直接返回空列表，避免除零。

**验收**：`derivative integral` 的首条为 analysis；`matrix vector` 为 algebra；`random probability` 为 probability；空字符串与 `banana` 均返回空结果。自行加入第四条短文后重新建立词表和 IDF，解释 df 改变造成的影响。

**运行条件**：Python 标准库、CPU。只处理给出的短文；不安装 NLTK 数据包，不调用 embedding 模型，不需要神经网络、Transformer、API 或向量数据库。

<a id="llm"></a>
## LLM：提示词效果对照实验

这是本平台依据《Hands-On Large Language Models》的 Prompt Engineering 一章设计的应用实验。用户本地版本与公开仓库的章节编号存在差异，因此按章名定位，不硬套编号。

**教材对应**：[作者仓库](https://github.com/HandsOnLLM/Hands-On-Large-Language-Models)。作者示例包含本地模型与 GPU 环境，本任务不要求运行整本 Notebook。使用平台已有的管理员默认 API 或个人 API，通过聊天界面即可完成，无需模型训练代码。

准备六条独立输入及其人工标签：

| 描述 | 标准标签 |
| --- | --- |
| 从驻点和二阶导数判断函数局部极值 | 分析 |
| 用定积分计算曲线围成区域的面积 | 分析 |
| 研究向量空间的基与维数 | 代数 |
| 求矩阵的特征值与特征向量 | 代数 |
| 计算独立事件同时发生的概率 | 概率 |
| 使用条件概率分析检验结果 | 概率 |

分别设计三种提示，每种对这六条输入各调用一次：

1. **直接提问**：询问课程描述属于分析、代数或概率中的哪类。
2. **格式约束**：明确只输出 `{"category":"分析|代数|概率之一"}`，category 的值必须是一个标签，不输出 Markdown 代码围栏。
3. **示例提示**：保留格式约束，加入三个不与测试题重复的输入/输出示例，如级数收敛→分析、群的单位元→代数、正态分布尾概率→概率。

每次调用前清空对话，避免上一个问题及回答进入上下文。固定模型与服务商；记录模型名称、日期、提示原文、输入、原始回答、分类是否正确、是否为合法 JSON 且 category 值在规定集合内。无需在报告中保存 API 密钥。

**验收**：得到 18 条记录，分三组统计分类正确数与格式合格数，解释二者区别。模型结果具有随机性，不要求示例提示一定优于直接提问，也不能用这六道题宣称普遍有效。

**运行条件**：联网、一个可访问模型的 API 和可用额度；可能产生服务商费用。如果默认 API 未配置且自己也没有 API，当前不能完成实验，应先解决这一明确条件。本任务不需要 GPU、下载模型权重、训练 GPT、微调、RAG 或 LangChain。

## 源码核对索引

除各任务已链接源码外，本轮用于排查超出范围的原推荐包括：

- [PyTorch 官方 MNIST](https://github.com/pytorch/examples/blob/main/mnist/main.py)：实际使用卷积、Dropout 等，不能把它当作只学 Tensor 的练习。
- [LLMs from scratch](https://github.com/rasbt/LLMs-from-scratch)：自建语言模型是独立教材路线，本地现有应用教材不能自动替代这条路线。
- [LLM Universe](https://github.com/datawhalechina/llm-universe)：知识库问答有额外应用框架与检索环节，留待明确学习这些内容后另设项目。

前端项目数据集中在 `frontend/ai-learning.js` 的 `aiCourseProjects`。以后新增推荐必须同时写出教材范围、编程先修、具体任务、验收和运行条件，不能只给仓库首页。
