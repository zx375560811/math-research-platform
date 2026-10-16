PRAGMA foreign_keys=ON;
BEGIN;
CREATE TABLE IF NOT EXISTS subjects (
id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL);
INSERT OR IGNORE INTO subjects(id,slug,name) VALUES
(1,'algebra','代数'),
(2,'number-theory','数论'),
(3,'analysis','分析'),
(4,'geometry-topology','几何与拓扑'),
(5,'other','其他数学方向');
CREATE TABLE IF NOT EXISTS documents (
id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, authors TEXT NOT NULL DEFAULT '',
file_path TEXT NOT NULL UNIQUE, file_size INTEGER NOT NULL CHECK(file_size > 0),
created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS document_subjects (
document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
subject_id INTEGER NOT NULL REFERENCES subjects(id),
PRIMARY KEY(document_id,subject_id));
CREATE INDEX IF NOT EXISTS idx_document_subjects_subject 
ON document_subjects(subject_id,document_id);
CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
username TEXT NOT NULL UNIQUE,
password_hash TEXT NOT NULL,
role TEXT NOT NULL DEFAULT 'USER' CHECK(role='USER'),
created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS invitations (
code_hash TEXT PRIMARY KEY,
expires_at INTEGER,
used_at TEXT,
used_by TEXT REFERENCES users(username) ON DELETE SET NULL,
created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS account_migrations (
name TEXT PRIMARY KEY,
applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS administrators (
username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS invitation_revocations (
code_hash TEXT PRIMARY KEY REFERENCES invitations(code_hash) ON DELETE CASCADE,
revoked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS learning_directions (
slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS learning_questions (
direction TEXT NOT NULL REFERENCES learning_directions(slug), position INTEGER NOT NULL, question TEXT NOT NULL, PRIMARY KEY(direction,position));
CREATE TABLE IF NOT EXISTS learning_direction_introductions (
direction TEXT PRIMARY KEY REFERENCES learning_directions(slug) ON DELETE CASCADE,
research_object TEXT NOT NULL, core_content TEXT NOT NULL, prerequisites TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS learning_books (
id INTEGER PRIMARY KEY, direction TEXT NOT NULL REFERENCES learning_directions(slug), title TEXT NOT NULL, authors TEXT NOT NULL,
stage TEXT NOT NULL, prerequisites TEXT NOT NULL, sort_order INTEGER NOT NULL, source_url TEXT NOT NULL,
document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS learning_progress (
username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE, book_id INTEGER NOT NULL REFERENCES learning_books(id),
page INTEGER NOT NULL CHECK(page>0), total_pages INTEGER NOT NULL CHECK(total_pages>=page),
position REAL NOT NULL DEFAULT 0, zoom REAL NOT NULL DEFAULT 1,
updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), PRIMARY KEY(username,book_id));
CREATE TABLE IF NOT EXISTS learning_marks (
id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
book_id INTEGER NOT NULL REFERENCES learning_books(id), page INTEGER NOT NULL CHECK(page>0),
quote TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', color TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE INDEX IF NOT EXISTS idx_learning_marks_owner ON learning_marks(username,book_id);
CREATE TABLE IF NOT EXISTS learning_mark_rects (
mark_id INTEGER NOT NULL REFERENCES learning_marks(id) ON DELETE CASCADE, position INTEGER NOT NULL,
x REAL NOT NULL, y REAL NOT NULL, width REAL NOT NULL, height REAL NOT NULL, PRIMARY KEY(mark_id,position));
CREATE TABLE IF NOT EXISTS document_catalog (
document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
module TEXT NOT NULL DEFAULT 'mathematics', language TEXT NOT NULL DEFAULT 'und' CHECK(language IN ('zh','en','und')));
CREATE TABLE IF NOT EXISTS document_directions (
document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
direction TEXT NOT NULL REFERENCES learning_directions(slug), PRIMARY KEY(document_id,direction));
CREATE TABLE IF NOT EXISTS learning_book_details (
book_id INTEGER PRIMARY KEY REFERENCES learning_books(id) ON DELETE CASCADE,
language TEXT NOT NULL DEFAULT 'en' CHECK(language IN ('zh','en')));
CREATE TABLE IF NOT EXISTS document_progress (
username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
page INTEGER NOT NULL CHECK(page>0), total_pages INTEGER NOT NULL CHECK(total_pages>=page),
position REAL NOT NULL DEFAULT 0, zoom REAL NOT NULL DEFAULT 1,
updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), PRIMARY KEY(username,document_id));
CREATE TABLE IF NOT EXISTS study_plan (
username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
source TEXT NOT NULL CHECK(source IN ('library','mathematics','series','math-to-ai','competition')),
completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
PRIMARY KEY(username,document_id));
CREATE TABLE IF NOT EXISTS competition_courses (
slug TEXT PRIMARY KEY, name TEXT NOT NULL, phase TEXT NOT NULL,
topics TEXT NOT NULL, practice TEXT NOT NULL, sort_order INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS competition_books (
course TEXT NOT NULL REFERENCES competition_courses(slug) ON DELETE CASCADE,
document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
sort_order INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(course,document_id));
CREATE TABLE IF NOT EXISTS competition_resources (
id TEXT PRIMARY KEY, title TEXT NOT NULL,
stage TEXT NOT NULL CHECK(stage IN ('syllabus','preliminary','final')),
group_key TEXT NOT NULL CHECK(group_key IN ('common','a','b','junior','senior')),
year INTEGER NOT NULL DEFAULT 0, edition INTEGER NOT NULL DEFAULT 0,
kind TEXT NOT NULL CHECK(kind IN ('syllabus','paper','answer','combined')),
source_url TEXT NOT NULL DEFAULT '', download_url TEXT NOT NULL DEFAULT '',
document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0,1)),
sort_order INTEGER NOT NULL DEFAULT 0,
CHECK((stage='syllabus' AND group_key='common' AND kind='syllabus') OR
 (stage='preliminary' AND group_key IN ('a','b') AND kind IN ('paper','answer','combined')) OR
 (stage='final' AND group_key IN ('junior','senior') AND kind IN ('paper','answer','combined'))));
INSERT OR IGNORE INTO competition_courses VALUES
('analysis','数学分析','foundation','极限与连续：用定义、等价无穷小和数列方法分析收敛；微分与中值定理：构造辅助函数，运用 Taylor 展开与极值条件；积分与级数：判断收敛，掌握估计、换元与逐项运算条件；多元分析：偏导与可微、重积分、含参积分与一致收敛','先按教材补齐定义与定理条件，再做极限、中值定理、积分和级数专题。每题先独立写完整证明，核对答案后重写关键步骤。',10),
('algebra','高等代数','foundation','多项式：整除、根、重因式与因式分解；矩阵与方程组：行列式、秩、线性相关与解空间；向量空间与线性变换：基、维数、核与像、不变子空间；特征值与二次型：相似、对角化、内积与正定性','从计算题进入结构证明，优先练习秩与维数、线性变换和矩阵多项式。用低阶例子检查猜想，再给一般情形的证明，不能以算例代替证明。',20),
('geometry','解析几何','foundation','向量与坐标：数量积、向量积及坐标变换；直线与平面：位置关系、夹角、距离和投影；二次曲线与曲面：标准形、几何性质与截面；代数化处理：在几何条件和方程之间转化','先画示意图并选合适坐标系，再列方程计算。重点练习直线与平面、二次曲面及坐标变换，完成后用几何意义核对结果。',30),
('training','专题训练','practice','分析专题：极限估计、中值定理、积分不等式与级数；代数专题：矩阵秩、特征值、线性空间与多项式；几何专题：空间位置、二次曲面与坐标变换；复盘方法：区分概念缺漏、方法选择、计算失误与证明漏洞','每次只选一个专题，先独立完成一组题，再对照解析归纳共同方法。把错题写成“卡在哪里、为什么、如何改”，隔一段时间不看答案重做。',40),
('past-papers','历年真题','practice','分卷练习：选数学专业类初赛试卷，核对届次与组别；限时整卷：按试卷标明的时间独立完成，记录未完成题；对照解析：检查定理条件、关键推理与表达完整性；回到专题：把失分点对应回三科基础，复习后重做','先做较早的真题熟悉题型，再留近年的试卷检验备赛效果。第一遍独立限时做，第二遍对照解析补全，第三遍重做错题；不把打开试卷当作完成训练。',50);
CREATE TABLE IF NOT EXISTS document_marks (
id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, page INTEGER NOT NULL CHECK(page>0),
quote TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', color TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE INDEX IF NOT EXISTS idx_document_marks_owner ON document_marks(username,document_id);
CREATE TABLE IF NOT EXISTS document_mark_rects (
mark_id INTEGER NOT NULL REFERENCES document_marks(id) ON DELETE CASCADE, position INTEGER NOT NULL,
x REAL NOT NULL, y REAL NOT NULL, width REAL NOT NULL, height REAL NOT NULL, PRIMARY KEY(mark_id,position));
CREATE TABLE IF NOT EXISTS learning_selections (
username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
book_id INTEGER NOT NULL REFERENCES learning_books(id) ON DELETE CASCADE,
document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
PRIMARY KEY(username,book_id));
COMMIT;

CREATE TABLE IF NOT EXISTS ai_provider_settings (
    owner TEXT PRIMARY KEY,
    username TEXT REFERENCES users(username) ON DELETE CASCADE,
    base_url TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    api_key TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    daily_limit INTEGER NOT NULL DEFAULT 50,
    CHECK ((owner='default' AND username IS NULL) OR owner='user:' || username)
);
CREATE TABLE IF NOT EXISTS ai_preferences (
    username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('default','custom'))
);
CREATE TABLE IF NOT EXISTS ai_usage (
    username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    day TEXT NOT NULL,
    daily_count INTEGER NOT NULL,
    minute INTEGER NOT NULL,
    minute_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS document_formats (document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE, format TEXT NOT NULL CHECK(format IN ('pdf','djvu')));

CREATE TABLE IF NOT EXISTS library_collections (
 id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, path_key TEXT NOT NULL,
 parent_id INTEGER REFERENCES library_collections(id) ON DELETE CASCADE,
 name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, UNIQUE(source,path_key)
);
CREATE TABLE IF NOT EXISTS document_collections (
 document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 collection_id INTEGER NOT NULL REFERENCES library_collections(id) ON DELETE CASCADE,
 PRIMARY KEY(document_id,collection_id)
);
CREATE INDEX IF NOT EXISTS document_collection_lookup ON document_collections(collection_id,document_id);
CREATE INDEX IF NOT EXISTS collection_parent_lookup ON library_collections(parent_id);

CREATE TABLE IF NOT EXISTS library_file_cleanup (path TEXT PRIMARY KEY);

CREATE TABLE IF NOT EXISTS ai_library_jobs (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
 source TEXT NOT NULL CHECK(source IN ('custom','default')), state TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_library_one_running ON ai_library_jobs((1)) WHERE state='running';
CREATE TABLE IF NOT EXISTS ai_library_items (
 job_id TEXT NOT NULL REFERENCES ai_library_jobs(id) ON DELETE CASCADE,
 document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 title TEXT NOT NULL, authors TEXT NOT NULL,
 before_folders TEXT NOT NULL, before_directions TEXT NOT NULL,
 after_folders TEXT NOT NULL DEFAULT '', after_directions TEXT NOT NULL DEFAULT '',
 state TEXT NOT NULL DEFAULT 'pending', direction TEXT NOT NULL DEFAULT '', topic TEXT NOT NULL DEFAULT '',
 confidence REAL NOT NULL DEFAULT 0, reason TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(job_id,document_id)
);
CREATE INDEX IF NOT EXISTS ai_library_pending ON ai_library_items(job_id,state,document_id);

CREATE TABLE IF NOT EXISTS library_settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS learning_course_config (direction TEXT NOT NULL REFERENCES learning_directions(slug), name TEXT NOT NULL, sort_order INTEGER NOT NULL, PRIMARY KEY(direction,name));
CREATE TABLE IF NOT EXISTS book_series (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS series_documents (series_id INTEGER NOT NULL REFERENCES book_series(id) ON DELETE CASCADE, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, sort_order INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(series_id,document_id));
CREATE INDEX IF NOT EXISTS series_document_order ON series_documents(series_id,sort_order,document_id);
INSERT OR IGNORE INTO book_series(name,sort_order) SELECT name,sorting FROM (SELECT 'Graduate Studies in Mathematics (GSM)' AS name,10 AS sorting UNION ALL SELECT 'Graduate Texts in Mathematics (GTM)',20 UNION ALL SELECT 'Lecture Notes in Mathematics',30 UNION ALL SELECT 'London Mathematical Society Student Texts',40 UNION ALL SELECT 'SMM 系列',50 UNION ALL SELECT 'UTM 系列',60) WHERE NOT EXISTS(SELECT 1 FROM account_migrations WHERE name='book_series_v1');
INSERT OR IGNORE INTO account_migrations(name) VALUES('book_series_v1');

CREATE TABLE IF NOT EXISTS ai_study_courses (
 slug TEXT PRIMARY KEY, name TEXT NOT NULL, phase TEXT NOT NULL,
 topics TEXT NOT NULL, practice TEXT NOT NULL, sort_order INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS learning_lab_progress (
 username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
 lab TEXT NOT NULL CHECK(lab IN ('calculus','linear-algebra','python','machine-learning','deep-learning','pytorch','nlp','llm')),
 stages INTEGER NOT NULL DEFAULT 0 CHECK(stages BETWEEN 0 AND 7),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 PRIMARY KEY(username,lab));
CREATE TABLE IF NOT EXISTS textbook_lab_progress (
 username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
 book TEXT NOT NULL, chapter TEXT NOT NULL,
 completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 PRIMARY KEY(username,book,chapter));
CREATE TABLE IF NOT EXISTS ai_study_books (
 course TEXT NOT NULL REFERENCES ai_study_courses(slug) ON DELETE CASCADE,
 document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 sort_order INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(course,document_id));
INSERT OR IGNORE INTO ai_study_courses VALUES
('calculus','数学分析重点','foundation','极限与连续：理解函数趋近、连续及导数和定积分的定义；一元微分：熟练运用乘积法则与链式法则，手算复合函数的导数；多元微分：掌握偏导数、梯度和方向导数，分清输入与输出的维度；局部近似：用一阶、二阶 Taylor 展开描述函数，理解梯度与 Hessian 的作用；极值与下降方向：判断简单函数的极值，解释非零负梯度为何是局部下降方向；掌握目标：能推导简单复合函数的导数，用有限差分核对，并解释自动求导中的链式法则','按教材完成极限、微分与积分习题，先理解定义与证明，再学习自动微分所需的链式法则。',10),
('linear-algebra','高等代数重点','foundation','矩阵与线性方程：掌握矩阵乘法、转置、逆与秩，先核对维度再计算；向量空间与映射：理解线性相关、基、维数、列空间与零空间；内积与正交：理解长度、夹角、正交投影和最小二乘的几何意义；特征值与二次型：掌握特征向量、对称矩阵的正交对角化与半正定性；奇异值分解：理解 U、奇异值与 V 的含义，用截断 SVD 做低秩近似；掌握目标：能解释矩阵如何变换向量，区分特征分解与 SVD，并验证矩阵重建及误差','按教材完成矩阵运算、线性变换、正交投影与特征值习题，核对维度和计算过程。',20),
('probability','概率与统计','foundation','概率与条件：掌握条件概率、全概率与 Bayes 公式，区分独立和互斥；随机变量与分布：区分离散与连续变量，理解分布函数、概率质量与概率密度；期望与相关性：计算期望、方差和协方差，理解不相关与独立的区别；采样与极限定理：在有限方差的独立同分布情形下，区分大数定律与中心极限定理的结论；统计推断：理解点估计、置信区间与假设检验，区分总体参数与样本统计量；掌握目标：能完成基本概率与估计计算，解释样本波动，避免把一次实验的结果当成普遍规律','先完成教材中的条件概率、期望方差和参数估计练习，再用小规模采样观察样本均值的波动。',30),
('python','Python 与 NumPy','foundation','基础语法：熟练使用数值、字符串、列表、字典、条件与循环表达计算步骤；程序组织：用函数、类和模块组织代码，掌握文件读写、异常与基本调试；NumPy 数组：分清 shape、轴和 dtype，掌握索引、切片、广播与矩阵乘法；数据整理：读取小型表格，检查缺失、重复与数据类型，保留可追溯的处理步骤；可视化与复现：绘图时写清坐标含义，设置随机种子并记录运行环境；掌握目标：能从空文件写出读取、处理、检查和绘图脚本，读懂报错并定位问题','按所选教材逐章运行原配示例，从基础语法到文件与绘图；数据分析教材使用第二版配套代码。',40),
('machine-learning','机器学习','core','学习任务：区分分类、回归与聚类，明确输入特征、目标和要解决的问题；数据划分：理解训练、验证与测试集的用途，所有处理与选择都避免泄漏测试信息；基础模型：掌握 k 近邻、线性回归、逻辑回归和决策树的输入、输出与适用场景；泛化能力：识别欠拟合和过拟合，理解模型复杂度、正则化与学习曲线；评价方法：按任务选择准确率、精确率、召回率或回归误差，结合基线与错误样本解释结果；掌握目标：独立完成小数据集的训练与留出评估，说明结果如何得到、哪里可能失效','选择正在阅读的教材，按章运行作者的原始 Notebook，从数据、训练和预测开始，随后学习评估与比较。',60),
('deep-learning','深度学习','core','前向计算：理解全连接层、激活函数与批量输入，逐层核对张量和参数形状；输出与损失：理解回归误差、Softmax 与交叉熵，区分模型输出和训练目标；反向传播：用链式法则推导各层梯度，说明梯度怎样从损失传到参数；参数更新：掌握小批量梯度下降与学习率，串起前向、求损失、反向和更新；训练诊断：用数值梯度、损失曲线和独立测试集检查实现，识别过拟合与数值不稳定；掌握目标：用 NumPy 实现两层全连接网络，解释一个批次内四组参数如何更新','按斋藤康毅教材运行原配 Python 文件，先理解前向计算，再核对反向传播，随后训练神经网络。',70),
('pytorch','PyTorch 实践','support','张量操作：掌握形状、dtype、设备与广播，分清逐元素运算和矩阵运算；自动微分：理解 requires_grad、backward、梯度累积与清零，知道何时关闭梯度记录；批量数据：使用 Dataset 与 DataLoader 组织样本，分开训练数据和测试数据；模型与训练：用 nn.Module、损失函数和优化器写出完整训练循环，说明每一步的作用；评估与复现：区分 train、eval 与 no_grad，记录随机种子并学习参数保存和恢复；掌握目标：在 CPU 上独立完成线性回归训练，检查权重、偏置和独立测试误差','按《动手学深度学习》第二版的 PyTorch 原始 Notebook，从 Tensor 和自动微分到线性回归，再进入多层网络。',75),
('nlp','自然语言处理','core','文本与分词：理解文本清理、词元、词表和未登录词，说明预处理会保留或丢失哪些信息；词袋与 TF-IDF：掌握计数、文档频率与权重计算，解释常见词和区分性词的作用；向量与相似度：把文本表示为同一词表中的向量，用余弦相似度比较相关程度；基础任务：将文本特征用于检索或分类，词表和统计量只从允许使用的训练语料构建；评价与误差：检查相关文本能否被找到、类别是否混淆，分析分词、歧义与语料差异造成的失败；掌握目标：独立完成短文本 TF-IDF 检索，解释从原文到排序结果的每一步，再衔接神经语言模型','按《Natural Language Processing in Action》第二版的原配代码，从分词、词袋与 TF-IDF 开始，后续实验随对应章节推进。',80),
('transformer','Transformer','core','序列表示：理解 token、嵌入和位置信息，明确批量、序列长度与特征维度；注意力计算：解释 Q、K、V、缩放点积与 Softmax，核对各次矩阵乘法的形状；多头与网络层：理解多头拼接、前馈层、残差连接和层归一化的作用；掩码与结构：区分填充掩码和因果掩码，理解编码器、解码器及其信息可见范围；自回归学习：理解下一 token 预测、训练目标与逐步生成的区别；掌握目标：能追踪一层注意力的数据流，检查因果掩码，说明后续 token 为什么不能影响当前位置','在已学深度学习和 PyTorch 后实现小规模注意力计算，验证形状与因果掩码，不将完整 Transformer 训练列为入门必做项目。',90),
('llm','LLM','core','分词与上下文：理解 token、上下文窗口和下一 token 预测，知道历史对话必须作为输入传入；提示词设计：把任务、材料、输出约束与示例写清楚，比较零样本和少样本提示；生成与调用：理解采样随机性，记录模型、输入与参数，区分 API 调用和本地推理；输出检查：分别检查事实正确性、格式和引用依据，识别幻觉与不能验证的回答；方法边界：区分预训练、指令微调与检索增强，知道哪些需求靠提示、哪些需要额外数据或训练；掌握目标：使用现有 API 完成有对照的实验，记录原始结果、错误与成本，不以几次成功概括模型能力','按 Hands-On Large Language Models 的原始 Notebook 复现实验，先核对章节主题，再准备相应 GPU、模型或 API 环境。',100);
-- Remove the retired course associations while preserving the shared documents.
DELETE FROM ai_study_books WHERE course='optimization';
DELETE FROM ai_study_courses WHERE slug='optimization';
UPDATE ai_study_courses SET practice='用计算图实现复合函数的自动求导，对比手算导数与有限差分，验证链式法则。' WHERE slug='calculus' AND practice='推导线性回归损失的梯度，用有限差分核对结果。';
UPDATE ai_study_courses SET practice='用 NumPy 练习矩阵转置、乘法、范数和奇异值分解，再做矩阵重建与低秩近似。' WHERE slug='linear-algebra' AND practice='用 NumPy 实现最小二乘，并比较正规方程与数值解。';

-- Refresh only shipped default copy while preserving course links and administrator edits.
UPDATE ai_study_courses SET topics='极限与连续：理解函数趋近、连续及导数和定积分的定义；一元微分：熟练运用乘积法则与链式法则，手算复合函数的导数；多元微分：掌握偏导数、梯度和方向导数，分清输入与输出的维度；局部近似：用一阶、二阶 Taylor 展开描述函数，理解梯度与 Hessian 的作用；极值与下降方向：判断简单函数的极值，解释非零负梯度为何是局部下降方向；掌握目标：能推导简单复合函数的导数，用有限差分核对，并解释自动求导中的链式法则' WHERE slug='calculus' AND topics='极限与连续；多元微积分；偏导数与梯度；链式法则；Taylor 展开';
UPDATE ai_study_courses SET practice='用函数值与导数组成的数对实现单变量前向自动求导，对照手算和中心差分检查加法、乘法、幂函数与复合函数。' WHERE slug='calculus' AND practice='用计算图实现复合函数的自动求导，对比手算导数与有限差分，验证链式法则。';
UPDATE ai_study_courses SET topics='矩阵与线性方程：掌握矩阵乘法、转置、逆与秩，先核对维度再计算；向量空间与映射：理解线性相关、基、维数、列空间与零空间；内积与正交：理解长度、夹角、正交投影和最小二乘的几何意义；特征值与二次型：掌握特征向量、对称矩阵的正交对角化与半正定性；奇异值分解：理解 U、奇异值与 V 的含义，用截断 SVD 做低秩近似；掌握目标：能解释矩阵如何变换向量，区分特征分解与 SVD，并验证矩阵重建及误差' WHERE slug='linear-algebra' AND topics='向量与矩阵；线性映射；特征值；正交投影；奇异值分解与半正定矩阵';
UPDATE ai_study_courses SET practice='用 NumPy 对小型数值矩阵做 SVD，比较完整重建与秩 1、2、3 近似的 Frobenius 误差。' WHERE slug='linear-algebra' AND practice='用 NumPy 练习矩阵转置、乘法、范数和奇异值分解，再做矩阵重建与低秩近似。';
UPDATE ai_study_courses SET topics='概率与条件：掌握条件概率、全概率与 Bayes 公式，区分独立和互斥；随机变量与分布：区分离散与连续变量，理解分布函数、概率质量与概率密度；期望与相关性：计算期望、方差和协方差，理解不相关与独立的区别；采样与极限定理：在有限方差的独立同分布情形下，区分大数定律与中心极限定理的结论；统计推断：理解点估计、置信区间与假设检验，区分总体参数与样本统计量；掌握目标：能完成基本概率与估计计算，解释样本波动，避免把一次实验的结果当成普遍规律' WHERE slug='probability' AND topics='条件概率与 Bayes 公式；随机变量；期望与方差；常用分布；参数估计与抽样';
UPDATE ai_study_courses SET practice='先完成教材中的条件概率、期望方差和参数估计练习，再用小规模采样观察样本均值的波动。' WHERE slug='probability' AND practice='模拟随机样本，比较样本均值、方差与理论值。';
UPDATE ai_study_courses SET topics='基础语法：熟练使用数值、字符串、列表、字典、条件与循环表达计算步骤；程序组织：用函数、类和模块组织代码，掌握文件读写、异常与基本调试；NumPy 数组：分清 shape、轴和 dtype，掌握索引、切片、广播与矩阵乘法；数据整理：读取小型表格，检查缺失、重复与数据类型，保留可追溯的处理步骤；可视化与复现：绘图时写清坐标含义，设置随机种子并记录运行环境；掌握目标：能从空文件写出读取、处理、检查和绘图脚本，读懂报错并定位问题' WHERE slug='python' AND topics='Python 基础；数组与广播；函数与模块；数据处理；可视化与随机种子';
UPDATE ai_study_courses SET practice='按《Python 编程：从入门到实践》的随机漫步案例生成二维轨迹，检查坐标并保存可视化结果。' WHERE slug='python' AND practice='用 NumPy 读入小数据集，完成清洗、划分和可视化。';
UPDATE ai_study_courses SET topics='学习任务：区分分类、回归与聚类，明确输入特征、目标和要解决的问题；数据划分：理解训练、验证与测试集的用途，所有处理与选择都避免泄漏测试信息；基础模型：掌握 k 近邻、线性回归、逻辑回归和决策树的输入、输出与适用场景；泛化能力：识别欠拟合和过拟合，理解模型复杂度、正则化与学习曲线；评价方法：按任务选择准确率、精确率、召回率或回归误差，结合基线与错误样本解释结果；掌握目标：独立完成小数据集的训练与留出评估，说明结果如何得到、哪里可能失效' WHERE slug='machine-learning' AND topics='线性与逻辑回归；决策树；训练验证测试划分；过拟合与正则化；评价指标';
UPDATE ai_study_courses SET practice='先完成《Python 机器学习基础教程》第 1 章的鸢尾花 k 近邻分类，报告数据划分、测试准确率和新样本预测。' WHERE slug='machine-learning' AND practice='完成一个分类基线，避免数据泄漏，报告验证和测试结果。';
UPDATE ai_study_courses SET topics='前向计算：理解全连接层、激活函数与批量输入，逐层核对张量和参数形状；输出与损失：理解回归误差、Softmax 与交叉熵，区分模型输出和训练目标；反向传播：用链式法则推导各层梯度，说明梯度怎样从损失传到参数；参数更新：掌握小批量梯度下降与学习率，串起前向、求损失、反向和更新；训练诊断：用数值梯度、损失曲线和独立测试集检查实现，识别过拟合与数值不稳定；掌握目标：用 NumPy 实现两层全连接网络，解释一个批次内四组参数如何更新' WHERE slug='deep-learning' AND topics='多层网络；反向传播；激活函数；损失函数；优化器与训练诊断';
UPDATE ai_study_courses SET practice='按斋藤康毅教材第 5 章实现 NumPy 两层网络，先做小网络梯度检查，再进行 MNIST 训练与测试。' WHERE slug='deep-learning' AND practice='推导简单网络的反向传播，并与自动微分结果核对。';
UPDATE ai_study_courses SET topics='张量操作：掌握形状、dtype、设备与广播，分清逐元素运算和矩阵运算；自动微分：理解 requires_grad、backward、梯度累积与清零，知道何时关闭梯度记录；批量数据：使用 Dataset 与 DataLoader 组织样本，分开训练数据和测试数据；模型与训练：用 nn.Module、损失函数和优化器写出完整训练循环，说明每一步的作用；评估与复现：区分 train、eval 与 no_grad，记录随机种子并学习参数保存和恢复；掌握目标：在 CPU 上独立完成线性回归训练，检查权重、偏置和独立测试误差' WHERE slug='pytorch' AND topics='Tensor 与设备；自动微分；Dataset 与 DataLoader；训练循环；模型保存与加载';
UPDATE ai_study_courses SET practice='按《动手学深度学习》的 PyTorch 线性回归章节生成数据，使用 DataLoader、损失和优化器恢复已知权重与偏置。' WHERE slug='pytorch' AND practice='与深度学习并行：训练一个小型网络，保存后重新加载并验证预测。';
UPDATE ai_study_courses SET topics='文本与分词：理解文本清理、词元、词表和未登录词，说明预处理会保留或丢失哪些信息；词袋与 TF-IDF：掌握计数、文档频率与权重计算，解释常见词和区分性词的作用；向量与相似度：把文本表示为同一词表中的向量，用余弦相似度比较相关程度；基础任务：将文本特征用于检索或分类，词表和统计量只从允许使用的训练语料构建；评价与误差：检查相关文本能否被找到、类别是否混淆，分析分词、歧义与语料差异造成的失败；掌握目标：独立完成短文本 TF-IDF 检索，解释从原文到排序结果的每一步，再衔接神经语言模型' WHERE slug='nlp' AND topics='文本预处理；分词与词表；向量表示；语言建模；注意力机制与文本评估';
UPDATE ai_study_courses SET practice='按《Natural Language Processing in Action》第 2—3 章的知识，对固定短文实现词袋、TF-IDF 与余弦检索，处理空查询和词表外查询。' WHERE slug='nlp' AND practice='训练小型文本分类或语言模型，比较不同分词和表示方法。';
UPDATE ai_study_courses SET topics='序列表示：理解 token、嵌入和位置信息，明确批量、序列长度与特征维度；注意力计算：解释 Q、K、V、缩放点积与 Softmax，核对各次矩阵乘法的形状；多头与网络层：理解多头拼接、前馈层、残差连接和层归一化的作用；掩码与结构：区分填充掩码和因果掩码，理解编码器、解码器及其信息可见范围；自回归学习：理解下一 token 预测、训练目标与逐步生成的区别；掌握目标：能追踪一层注意力的数据流，检查因果掩码，说明后续 token 为什么不能影响当前位置' WHERE slug='transformer' AND topics='自注意力与多头注意力；位置表示；掩码；编码器与解码器；自回归训练';
UPDATE ai_study_courses SET practice='在已学深度学习和 PyTorch 后实现小规模注意力计算，验证形状与因果掩码，不将完整 Transformer 训练列为入门必做项目。' WHERE slug='transformer' AND practice='实现带因果掩码的注意力，验证未来 token 不影响当前位置。';
UPDATE ai_study_courses SET topics='分词与上下文：理解 token、上下文窗口和下一 token 预测，知道历史对话必须作为输入传入；提示词设计：把任务、材料、输出约束与示例写清楚，比较零样本和少样本提示；生成与调用：理解采样随机性，记录模型、输入与参数，区分 API 调用和本地推理；输出检查：分别检查事实正确性、格式和引用依据，识别幻觉与不能验证的回答；方法边界：区分预训练、指令微调与检索增强，知道哪些需求靠提示、哪些需要额外数据或训练；掌握目标：使用现有 API 完成有对照的实验，记录原始结果、错误与成本，不以几次成功概括模型能力' WHERE slug='llm' AND topics='预训练与指令微调；推理与采样；参数高效微调；检索增强生成；评估与幻觉';
UPDATE ai_study_courses SET practice='使用平台现有 AI API，对六条课程描述比较直接提问、格式约束和示例提示，分别统计分类正确数与 JSON 格式合格数。' WHERE slug='llm' AND practice='使用小模型或 API 完成一个可复现任务，分别评估正确性、成本和失败案例；无需从零训练大模型。';

-- Align the shipped practice descriptions with the staged experiments.
UPDATE ai_study_courses SET practice='画出函数与切线，用中心差分核对手算导数，比较不同步长的数值误差。' WHERE slug='calculus' AND practice='用函数值与导数组成的数对实现单变量前向自动求导，对照手算和中心差分检查加法、乘法、幂函数与复合函数。';
UPDATE ai_study_courses SET practice='用 NumPy 对平面点集做旋转、拉伸和投影，画图并核对组合变换的先后顺序。' WHERE slug='linear-algebra' AND practice='用 NumPy 对小型数值矩阵做 SVD，比较完整重建与秩 1、2、3 近似的 Frobenius 误差。';
UPDATE ai_study_courses SET practice='读取教学用学习记录 CSV，按日期和课程汇总分钟数并绘图，检查新数据下的结果。' WHERE slug='python' AND practice='按《Python 编程：从入门到实践》的随机漫步案例生成二维轨迹，检查坐标并保存可视化结果。';
UPDATE ai_study_courses SET practice='先运行两层 NumPy 网络，再补全梯度并做数值检查，使用内置小型手写数字数据训练与测试。' WHERE slug='deep-learning' AND practice='按斋藤康毅教材第 5 章实现 NumPy 两层网络，先做小网络梯度检查，再进行 MNIST 训练与测试。';
UPDATE ai_study_courses SET practice='用教学用教材简介建立词袋与 TF-IDF 索引，补全余弦相似度，检验新增简介与空查询。' WHERE slug='nlp' AND practice='按《Natural Language Processing in Action》第 2—3 章的知识，对固定短文实现词袋、TF-IDF 与余弦检索，处理空查询和词表外查询。';
UPDATE ai_study_courses SET practice='先用离线示例练习简介信息抽取与 JSON 校验，再用可用 API 对照真实回答，缺失信息保持 null。' WHERE slug='llm' AND practice='使用平台现有 AI API，对六条课程描述比较直接提问、格式约束和示例提示，分别统计分类正确数与 JSON 格式合格数。';

-- Textbook companion descriptions replace only the previous shipped defaults.
UPDATE ai_study_courses SET practice='按教材完成极限、微分与积分习题，先理解定义与证明，再学习自动微分所需的链式法则。' WHERE slug='calculus' AND practice='画出函数与切线，用中心差分核对手算导数，比较不同步长的数值误差。';
UPDATE ai_study_courses SET practice='按教材完成矩阵运算、线性变换、正交投影与特征值习题，核对维度和计算过程。' WHERE slug='linear-algebra' AND practice='用 NumPy 对平面点集做旋转、拉伸和投影，画图并核对组合变换的先后顺序。';
UPDATE ai_study_courses SET practice='按所选教材逐章运行原配示例，从基础语法到文件与绘图；数据分析教材使用第二版配套代码。' WHERE slug='python' AND practice='读取教学用学习记录 CSV，按日期和课程汇总分钟数并绘图，检查新数据下的结果。';
UPDATE ai_study_courses SET practice='选择正在阅读的教材，按章运行作者的原始 Notebook，从数据、训练和预测开始，随后学习评估与比较。' WHERE slug='machine-learning' AND practice='先完成《Python 机器学习基础教程》第 1 章的鸢尾花 k 近邻分类，报告数据划分、测试准确率和新样本预测。';
UPDATE ai_study_courses SET practice='按斋藤康毅教材运行原配 Python 文件，先理解前向计算，再核对反向传播，随后训练神经网络。' WHERE slug='deep-learning' AND practice='先运行两层 NumPy 网络，再补全梯度并做数值检查，使用内置小型手写数字数据训练与测试。';
UPDATE ai_study_courses SET practice='按《动手学深度学习》第二版的 PyTorch 原始 Notebook，从 Tensor 和自动微分到线性回归，再进入多层网络。' WHERE slug='pytorch' AND practice='按《动手学深度学习》的 PyTorch 线性回归章节生成数据，使用 DataLoader、损失和优化器恢复已知权重与偏置。';
UPDATE ai_study_courses SET practice='按《Natural Language Processing in Action》第二版的原配代码，从分词、词袋与 TF-IDF 开始，后续实验随对应章节推进。' WHERE slug='nlp' AND practice='用教学用教材简介建立词袋与 TF-IDF 索引，补全余弦相似度，检验新增简介与空查询。';
UPDATE ai_study_courses SET practice='按 Hands-On Large Language Models 的原始 Notebook 复现实验，先核对章节主题，再准备相应 GPU、模型或 API 环境。' WHERE slug='llm' AND practice='先用离线示例练习简介信息抽取与 JSON 校验，再用可用 API 对照真实回答，缺失信息保持 null。';
