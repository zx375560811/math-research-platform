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
source TEXT NOT NULL CHECK(source IN ('library','mathematics','series','math-to-ai')),
completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
PRIMARY KEY(username,document_id));
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
CREATE TABLE IF NOT EXISTS ai_study_books (
 course TEXT NOT NULL REFERENCES ai_study_courses(slug) ON DELETE CASCADE,
 document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 sort_order INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(course,document_id));
INSERT OR IGNORE INTO ai_study_courses VALUES
('calculus','数学分析重点','foundation','极限与连续；多元微积分；偏导数与梯度；链式法则；Taylor 展开','推导线性回归损失的梯度，用有限差分核对结果。',10),
('linear-algebra','高等代数重点','foundation','向量与矩阵；线性映射；特征值；正交投影；奇异值分解与半正定矩阵','用 NumPy 实现最小二乘，并比较正规方程与数值解。',20),
('probability','概率与统计','foundation','条件概率与 Bayes 公式；随机变量；期望与方差；常用分布；参数估计与抽样','模拟随机样本，比较样本均值、方差与理论值。',30),
('python','Python 与 NumPy','foundation','Python 基础；数组与广播；函数与模块；数据处理；可视化与随机种子','用 NumPy 读入小数据集，完成清洗、划分和可视化。',40),
('optimization','优化基础','core','目标函数与约束；梯度下降；学习率；凸性直觉；数值稳定性','实现梯度下降，观察不同学习率对收敛的影响；可与机器学习入门交叉学习。',50),
('machine-learning','机器学习','core','线性与逻辑回归；决策树；训练验证测试划分；过拟合与正则化；评价指标','完成一个分类基线，避免数据泄漏，报告验证和测试结果。',60),
('deep-learning','深度学习','core','多层网络；反向传播；激活函数；损失函数；优化器与训练诊断','推导简单网络的反向传播，并与自动微分结果核对。',70),
('pytorch','PyTorch 实践','support','Tensor 与设备；自动微分；Dataset 与 DataLoader；训练循环；模型保存与加载','与深度学习并行：训练一个小型网络，保存后重新加载并验证预测。',75),
('nlp','自然语言处理','core','文本预处理；分词与词表；向量表示；语言建模；注意力机制与文本评估','训练小型文本分类或语言模型，比较不同分词和表示方法。',80),
('transformer','Transformer','core','自注意力与多头注意力；位置表示；掩码；编码器与解码器；自回归训练','实现带因果掩码的注意力，验证未来 token 不影响当前位置。',90),
('llm','LLM','core','预训练与指令微调；推理与采样；参数高效微调；检索增强生成；评估与幻觉','使用小模型或 API 完成一个可复现任务，分别评估正确性、成本和失败案例；无需从零训练大模型。',100);
