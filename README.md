# 数学研究平台

面向用户的网站是应用平台，文献库是共享底层，由服务器管理员维护。

新服务器从零部署、六个系列上传和导入、管理员创建及旧数据迁移，见 [部署与文献导入手册](docs/新服务器部署与文献导入.md)；公网域名、HTTPS、备份、监控与发布回滚见 [上线运维手册](docs/上线运维.md)。

```text
数学研究平台
├─ 应用工作台
├─ 文档库：按模块、方向和语种查看与预览
├─ 数学与应用数学
│  ├─ 研究方向：仅展示实际关联文献的方向，空方向预留在后台
│  ├─ 方向介绍与中英文递进教材
│  └─ PDF 学习：个人进度、高亮与笔记
├─ 后续研发应用（规划中）
├─ 数学竞赛：大学生数学竞赛数学专业类备赛
├─ 讨论：共享话题、教材交流与数学公式回复
└─ 共享底层（不在公共网页提供管理功能）
   ├─ 文献元数据与 PDF
   ├─ 研究方向分类
   └─ AI 对话与模型适配
```

登录后的工作台先展示“文档库”，按应用模块、研究方向和语种筛选全部文献，可搜索并直接预览；预览每次从第一页打开，不保存或覆盖阅读进度，管理员负责导入和分类。

当前学习应用是数学与应用数学模块，推荐入口仅使用分析、几何、代数三类；文献库保留完整细分目录。用户选择研究方向，查看方向介绍，再按基础入门、核心理论、进阶学习选择中文或英文推荐教材。每个阶段分别显示两种语种，推荐来自底层文献库的对应方向。点击“开始学习”进入 PDF 阅读器，可保存阅读位置、选中文字高亮和写个人笔记，支持同账号跨设备继续阅读。同一 PDF 从教材、系列书籍或学习计划入口打开，共用个人进度、高亮和笔记；文档库预览不记录进度，主动保存的高亮笔记仍可共用。阅读器右侧上方显示个人高亮笔记，下方为 AI 对话；可选择管理员默认 API 或个人 API，选中 PDF 文字后点击“问 AI”附带文献选段。知识条目与全库内容检索尚未实现。

网站入口只显示登录与邀请码注册，登录后进入应用工作台。教材通过管理员关联底层文献库，推荐区仅展示已关联实际文献的教材，未关联的预设书目不展示。普通用户的文献接口保持只读；独立 `/admin` 后台供管理员导入 PDF、编辑元数据、配置教材和管理邀请码。管理写入、个人进度和标注均校验 CSRF，原有文献和 PDF 保留。

前端使用 HTML/CSS/JavaScript、本地 Morphicons 与 PDF.js，由 Java / Spring Boot 后端提供，不需要服务器 Node.js。视觉依据见 [设计说明](frontend/DESIGN.md)。

讨论模块支持已登录用户发布话题和回复、关联文献库教材、Markdown 与数学公式；作者可编辑或删除自己的内容，管理员可置顶、关闭回复或删除讨论。部署及数据说明见 [讨论模块](docs/讨论模块.md)。

## 部署和更新

Alibaba Cloud Linux 3：

```bash
dnf install -y git java-17-openjdk-devel curl python3
git clone https://github.com/zx375560811/math-research-platform.git /opt/math-platform
cd /opt/math-platform/backend
./mvnw -B package
java -jar target/math-server.jar
```

首次启动初始化数据库。服务仅监听 127.0.0.1:8080。常驻配置见 [后端说明](backend/README.md#systemd-常驻运行)。公网反向代理与 HTTPS 尚未在当前生产服务器启用；Caddy/Nginx 配置模板、Secure Cookie、备份恢复演练与会话限制见 [上线运维手册](docs/上线运维.md)。日常发布可用 `backend/deploy/release.sh`，构建、备份、健康检查与失败回滚一次完成。

## 从旧 C 后端迁移到 Java

前端仍为原生 HTML/CSS/JavaScript；Java 17 + Spring Boot 4.1.1 + Maven Wrapper 3.9.11 替换 C 服务。沿用 SQLite 文件、文献 ID、PDF 路径、只读 API 和服务账号。不需要转换数据库。

在服务器执行：

```bash
dnf install -y java-17-openjdk-devel curl python3
cd /opt/math-platform
git pull --ff-only
cd backend
./mvnw -B package
```

**仅当构建成功后**，备份并切换服务（新服务文件必须替换旧 ExecStart）：

```bash
systemctl stop math-platform
cp -a data "data-backup-before-java-$(date +%Y%m%d-%H%M%S)"
cp /etc/systemd/system/math-platform.service /etc/systemd/system/math-platform.service.before-java
install -m 644 deploy/math-platform.service /etc/systemd/system/math-platform.service
systemctl daemon-reload
systemctl start math-platform
systemctl status math-platform --no-pager
curl -fsS http://127.0.0.1:8080/api/health
```

服务仍使用 `/opt/math-platform/backend` 工作目录和 `data/math.db`。如果旧服务使用自定义 MATH_DB_PATH，切换前将同一配置写入新 service。服务账号必须能读写 data 目录；旧有部署已具备这些权限。管理员入库脚本保持兼容。

以后更新 Java 服务：先 git pull、`./mvnw -B package` 构建成功，再 `systemctl restart math-platform`。运行数据不进入 Git，须单独备份。

回退此次迁移：恢复 `/etc/systemd/system/math-platform.service.before-java`，daemon-reload 后重启；旧 `build/math-server` 编译产物未被更新命令删除。不要在 Java 运行时覆盖数据库备份。

## 在电脑打开网站

在电脑 PowerShell 执行，保持窗口开启：

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18080:127.0.0.1:8080 root@你的服务器公网IP
```

浏览器访问 `http://127.0.0.1:18080/`。

## 数学竞赛

**上传本地竞赛教材**：文件名或子目录包含“数学分析”“高等代数”“解析几何”时，使用 `admin/import_competition_books.py` 自动入库并关联共同基础。包含“高等代数与解析几何”的合订教材只保存一份，同时关联两门课，不写入人工智能课程或系列书籍。文件按原体积导入，没有 20 MB 限制，已有文献按哈希复用。

在 **Windows PowerShell** 上传整个文件夹（不要在 SSH 服务器窗口执行）：

```powershell
scp -r "C:\Users\你的用户名\Desktop\数学文献\数学竞赛" root@服务器公网IP:/opt/math-platform/imports/
```

上传结束后，在 **服务器 SSH 终端** 执行：

```bash
cd /opt/math-platform && git pull --ff-only && chown -R math-platform:math-platform /opt/math-platform/imports/数学竞赛 && cd backend && (systemctl stop math-platform && (sudo -u math-platform python3 admin/import_competition_books.py /opt/math-platform/imports/数学竞赛 --apply --move; task_import_status=$?; systemctl start math-platform; exit "$task_import_status"))
```

此更新只有管理脚本，无需重新编译 Java。脚本先备份数据库，导入成功后移除服务器暂存副本，保留正式文献与电脑原文件；脚本失败也会执行服务启动。导入后 Ctrl+F5，在“数学竞赛 → 共同基础”点击三科节点查看教材，后台仍可调整关联和顺序。只查看匹配结果可运行 `python3 admin/import_competition_books.py /opt/math-platform/imports/数学竞赛`，不加 `--apply`。

2026-10-16：新增“共同基础 / 考试大纲 / 初赛真题 / 决赛真题”四个页签。初赛按数学 A、B 类和年份筛选，决赛按低、高年级组筛选；阅读返回保留页签、组别和年份。原三科路线、专题题集及旧关联保留在共同基础。

资料目录根据用户提供的[大纲栏目](https://www.cmathc.org.cn/dg/)、[初赛栏目](https://www.cmathc.org.cn/csst/)、[决赛栏目](https://www.cmathc.org.cn/jsst/)核对，当前共 19 项：17 份已核对 PDF（考试内容大纲 1 份、第 12—17 届数学 A/B 类及部分补赛试题与参考答案 16 份），约 16.1 MiB；另外 2 项是第十六届决赛低/高年级的图片网页。试卷和答案合并的原文件标记为“试题与参考答案”，不伪造拆分文件；年份以原卷标注为准，保留届次和补赛标题，不能以网页发布日期替代。第 1—17 届汇总页保留为外部入口。来源站为汇集资料的平台，赛事规则仍以中国数学会原通知为准。

元数据、来源、实际核对的 SHA-256、字节数及页数保存在 `backend/src/main/resources/competition-resources.json`，PDF 不提交到 Git。Java 启动自动初始化 `competition_resources`；管理员可编辑分类、组别、年份、届次、资料类型、来源和显示状态，也可新增年度资料、搜索文献库并关联或解除文件。隐藏、解除关联或删除源文献后，资料元数据与来源保留；源文献删除通过外键清空文件关联。

**更新与直接入库（服务器 SSH 终端）**：

```bash
cd /opt/math-platform && git pull --ff-only && cd backend && ./mvnw -B package && systemctl restart math-platform && sleep 5 && sudo -u math-platform python3 admin/import_competition.py --apply
```

导入脚本仅下载清单内已核对的 17 份 PDF，直接写入共享 `data/files`，不需要先上传或人工审核，不保留第二份暂存副本。按相同体积候选文件的 SHA-256 复用已有文献，并自动建立“数学竞赛 / 考试大纲”及“数学竞赛 / 初赛真题 / 数学A类或B类 / 年份”目录。导入前备份数据库，每份文件独立提交；下载失败或源文件哈希改变时保留为待重试，不影响已成功的资料和服务。再次执行同一脚本可补齐失败项，已关联文件会跳过。退出码 2 表示部分资料需重试，最后的 JSON 报告列出具体条目；图片网页仍可查看来源或由管理员关联自己已有的文件。

预览待导入清单：`sudo -u math-platform python3 admin/import_competition.py`。该模式不下载、不改数据库。界面刷新后，已入库资料显示“开始学习 / 继续学习”和“加入计划”；未入库的 PDF 显示“原站 PDF”，图片页面显示“查看来源”，外部阅读不记录本站进度。后台入口仍为 `/admin#competition`。

资料接口：登录后的 `GET /api/competition/resources`；管理员的 `GET/POST /api/admin/competition/resources`、`PATCH /api/admin/competition/resources/{id}`（完整元数据）和 `PUT /api/admin/competition/resources/{id}/document`（`document_id`，`null` 解除关联）。写入校验管理员角色与 CSRF，普通用户不能上传或关联。

验证：`python3 backend/tests/competition.py`、`python3 backend/tests/competition_import.py`；导入测试验证去重、哈希、失败重试、目录关联和用户数据保留，用户端及管理端浏览器回归覆盖分类、年份、阅读返回与文件关联。

共同基础保留原有数学分析、高等代数、解析几何、专题训练及旧真题资料；管理员按节点关联文献，用户共用进度、高亮、笔记、阅读器 AI 和学习计划。此部分仍使用 `competition_courses`、`competition_books` 和 `/api/admin/competition/{course}/books` 的添加、排序及移除接口，不影响新资料目录或原文献。

## 数学到人工智能

第四个应用入口为 `/#/apps/math-to-ai`。路线为数学分析重点、高等代数重点、概率统计和 Python/NumPy 并行打基础，再经机器学习、深度学习、自然语言处理到 LLM；PyTorch 与深度学习并行。流程图按 3+2+2+2 排列，Transformer 不单独显示为节点。不要求先完成数学专业所有课程。

“数学到人工智能”入口 `#/apps/math-to-ai` 先显示“理论学习”和“实战学习”两个模块，点击后进入对应页面；理论学习 `#/apps/math-to-ai/theory` 保留课程路线、教材与配套实验，实战学习 `#/apps/math-to-ai/practice` 展示实战路线：Python-100-Days → 微软 ML-For-Beginners 中文课程 → D2L PyTorch 版 → Happy-LLM。AiLearning 和深入浅出 PyTorch 分别作为算法与框架配套练习，以虚线连接。点击六个项目节点直接查看逐课目录，按“第一课、第二课……”打开 GitHub 上对应的中文讲解或 Notebook；有配套代码时另设实验或代码入口。目录按官方章节分组，可搜索，本次共核对 327 个有效文件入口：Python 100、微软 ML 27、AiLearning 15、D2L 123、深入浅出 PyTorch 54、Happy-LLM 8。编号按目录顺序排列，不冒充原项目的 Day 或章节编号；排除空文件、仅有标题的占位课和重复跳转页，进阶与选学内容分组标明。链接固定源码版本；不镜像课程全文，不把打开链接记为已学完。页面内保留各项目的分组与搜索条件。Git 安装、克隆命令、VS Code Markdown 预览和原项目环境要求收在“Git 与运行准备”，实验在学习者自己的电脑执行。键盘 Enter/空格可选择项目，手机在图内横向滚动。`practice` 查询参数保留所选项目；旧的课程和实战书签会转到对应页面。实战页不请求课程教材目录，切换项目不改动教材关联。

每个节点展示学习重点、动手练习和实际关联教材。管理员在 `/admin#ai-learning` 按课程从文档库目录中搜索、选择并关联 PDF/DJVU，可排序或移除关联；不复制文件，也不影响原有数学教材配置。未关联时显示空教材状态，不生成虚假的教材或下载地址。阅读继续使用按用户和文献保存的进度、笔记及阅读器 AI。

教材配套实验直接对应作者或出版社的代码库，按教材、版本和章节组织。已核实 8 本教材的 103 个章节入口，其中 4 本提供共 49 份站内原始代码预览；可以切换教材与章节、下载固定版本的配套仓库、查看运行说明并保存个人完成记录。数学分析、高代和概率暂不添加未经核实的编程实验。代码在学习者自己的电脑或教材推荐环境运行，平台只保存小体积代码预览与进度。具体来源、版本和使用方法见 [教材配套实验说明](docs/ai-course-projects.md)。

新接口：登录后 `GET /api/ai-learning`；管理员 `GET /api/admin/ai-learning`，以及 `POST /api/admin/ai-learning/{course}/books`（document_id、可选 sort_order）、`PATCH /api/admin/ai-learning/{course}/books/{document}`（sort_order）、`DELETE` 同一路径。管理写入要求管理员资格与 CSRF。课程及教材关联存放在 `ai_study_courses`、`ai_study_books`，启动自动创建。实验接口为登录后的 `GET /api/learning-labs/catalog`、`GET /api/learning-labs/progress`、`GET /api/learning-labs/{book}/chapters/{chapter}/preview`，以及带 CSRF 的 `PUT /api/learning-labs/{book}/chapters/{chapter}/progress`（completed: 布尔值）。章节记录存放在 `textbook_lab_progress`，按账号隔离。旧自编练习文件与下载入口已移除，历史阶段记录保留，不会冒充为官方实验的完成记录。

路线依据：[Stanford CS229 先修要求](https://cs229.stanford.edu/index.html-spr26)、[Stanford CS224N](https://web.stanford.edu/class/cs224n/)、[Hugging Face LLM 课程介绍](https://huggingface.co/learn/llm-course/en/chapter1/1)。这是一条面向入门到 LLM 的建议路径，不是所有 AI 领域的唯一先修顺序。

## 管理员维护文献库

### 六个系列批量追加导入

上传目录 `/opt/math-platform/imports/series` 下保留 GSM、GTM、Lecture Notes in Mathematics、London Mathematical Society Student Texts、SMM、UTM 六个目录及原有子目录。进入 `backend` 后预览：

```bash
sudo -u math-platform python3 admin/import_series.py /opt/math-platform/imports/series
```

确认后停止服务，执行同一命令加 `--apply`，无论导入成功或失败都重新启动服务。先更新并启动一次 Java 后端以初始化系列数据表。工具自动备份数据库及 AI 加密密钥，追加 PDF/DJVU、保留子目录并关联系列；按内容 SHA-256 复用现有文件，重复执行不会重复入库。不修改旧文献、阅读进度、笔记或推荐教材。非 PDF/DJVU 文件在预览中计入 skipped，不导入。

磁盘空间不足时可改用 `--apply --move`，上传目录与正式文件目录必须在同一文件系统，并将上传目录所有权及写权限赋予 `math-platform`。该模式不复制整本文件，数据库提交后清理上传副本；失败时保留源文件。具体一行命令见部署手册第 8.2 节。

见 [本地入库命令](backend/README.md#管理员入库)。不要将后台管理写入功能接入公共应用。管理界面位于独立 `/admin`，管理员身份由服务器所有者授权，后端逐次校验管理权限。

## 用户注册与登录

首页右上角提供登录/注册。用户先注册普通账号，再登录使用数学应用。用户名为 3–32 位字母、数字或下划线，按小写保存且不区分大小写；密码至少 12 个字符、最多 72 个 UTF-8 字节，以 BCrypt 哈希保存。

参考资料列表、元数据和 PDF 下载均要求登录。注册账号固定为 USER，注册不赋予文献上传、管理员权限或修改资料的能力。服务器所有者可用 `admin/grant_admin.py` 为指定账号授予后台权限。账号保存在原 SQLite 数据库中新建的 users 表，启动自动创建，原有文献不变。登录会话保留在服务器内存，12 小时无活动后到期（页面可见时每 10 分钟自动续期，持续使用的账号不会中途退出），重启后需要重新登录。

本阶段提供用户名/密码注册与登录；尚未加入邮箱、找回密码和第三方登录。当前通过 SSH 隧道访问，公网部署的 HTTPS 仍按后续部署步骤配置。注册和登录有进程内频率限制，当前按服务器看到的来源地址计数，尚未配置反向代理来源解析。

更新部署：git pull 后在 backend 运行 ./mvnw -B package，成功后 systemctl restart math-platform。浏览器 Ctrl+F5 刷新，入口直接登录/注册。邀请注册首次迁移删除旧开放注册账号；后续升级保留新账号。


## 教材接入

启动新版本后，在 backend 目录用服务账号导入两本作者公开的非商业开放教材：

```bash
runuser -u math-platform -- python3 admin/install_open_textbooks.py
```

完成后可在“分析”和“代数”中开始 PDF 学习。其他推荐教材等待管理员接入对应 PDF。详细接口、教材绑定方式与使用范围见 [后端说明](backend/README.md#数学与应用数学学习模块)。


## 阅读器 AI 与管理员 API 设置

在独立管理平台 `/admin#ai` 配置默认 API 地址、模型名、密钥，并勾选启用。用户在 PDF 阅读器下方的 AI 对话区选择“管理员默认 API”；也可点“设置”保存个人 API，个人配置仅作用于自己的账号。接口支持 OpenAI 兼容 Chat Completions 格式。

API 密钥保存在服务器，读取接口不回显；`backend/data/ai-secret.key` 用于加密数据库中的密钥，备份时应连同数据库一起保存。对话目前仅保留在当前阅读页面，离开后清空；提问发送当前对话和主动附加的选段，不自动读取或上传整份 PDF。

阅读助手支持 Markdown 富文本与 LaTeX 公式；“问 AI”与“发送”在输入框右侧上下紧邻排列。右侧高亮笔记与 AI 可上下拖动调整高度并记住布局，应用与管理界面统一采用可读字号。AI 不主动设置输出 token 预算，也不按字符或对话轮数裁剪输入、历史和正式回答；服务商自身限制仍适用。
