# Java 后端与管理员文献库

## 独立管理后台

`/admin` 提供文献 PDF / DJVU 导入（无应用层文件大小上限）、标题/作者/分类编辑、已有教材的阶段/前置知识/排序/文献关联，以及邀请码创建/使用记录/撤销。管理员也能返回普通应用学习。未登录访问后台跳转到登录，普通用户返回 403；管理 API 校验 ADMIN 会话和数据库中的管理员资格，写入还校验 CSRF。撤销管理员资格后，即使旧会话仍在，管理 API 也立即拒绝访问。

首次部署先更新并启动服务，让新增表自动创建，再为**已有的指定账号**授权。将 `YOUR_USERNAME` 替换为自己的用户名：

```bash
cd /opt/math-platform/backend
runuser -u math-platform -- python3 admin/grant_admin.py YOUR_USERNAME
```

随后退出并重新登录，应用侧栏出现“管理平台”；也可在已有 SSH 隧道中访问 `http://127.0.0.1:18080/admin`。没有公开授予管理员权限的接口。新注册账号始终为 USER。撤销资格：

```bash
runuser -u math-platform -- python3 admin/grant_admin.py YOUR_USERNAME --revoke
```

管理员资格保存在独立 `administrators` 表，保留原 users 结构；邀请码撤销记录独立保存，注册事务会拒绝已撤销码。邀请码完整值仅生成时显示，数据库只存 SHA-256 哈希。撤销未使用码不会删除已注册账号。

教材设置选择方向、阶段与推荐语种，通过文献搜索框选择本方向的中文、英文或尚未标注语种的 PDF，保存后学习模块自动使用对应 `/api/documents/{id}/file`。文献可属于多个方向；已标注语种必须与推荐语种匹配。已关联教材禁止改绑/解绑，以保护个人进度与标注；标题等文献元数据仍可编辑。后台可修改推荐名称、作者、信息链接和学习排序，也可从文献库新增推荐；新增研究方向仍通过目录维护。

| 方法 | 管理地址 | 用途 |
| --- | --- | --- |
| GET | /api/admin/documents?q=&offset=0 | 搜索标题/作者，每页 20 份 |
| POST | /api/admin/documents?title=...&authors=...&subject_id=1 | 原始 PDF / DJVU 请求体，Content-Type: application/pdf 或 image/vnd.djvu |
| PATCH | /api/admin/documents/{id} | JSON: title、authors、subject_ids |
| GET | /api/admin/books | 教材与关联状态 |
| POST / PUT | /api/admin/books、/api/admin/books/{id} | JSON: direction、language（zh/en）、title、authors、source_url、stage、prerequisites、sort_order、document_id |
| GET | /api/admin/invitations?offset=0 | 分页使用记录，无明文邀请码 |
| POST | /api/admin/invitations | JSON: days（1–365），返回一次性明文 |
| POST | /api/admin/invitations/{hash}/revoke | 撤销未使用码 |

验证：`python3 tests/admin.py` 在临时数据库验证普通用户拒绝、管理员授予/撤销、CSRF、上传大小及文件清理、教材关联锁定和邀请码撤销；`node frontend/tests/admin.cjs` 验证真实后台界面流程、XSS 文本和手机布局（从仓库根目录执行）。

网页应用以文献库为内容来源；文献管理不向公共用户开放。普通用户文献 HTTP 接口只读，管理员可在独立 `/admin` 后台或通过服务器本地脚本入库；账号服务独立负责注册和登录。

## 编译与运行

```bash
cd /opt/math-platform/backend
./mvnw -B package
java -jar target/math-server.jar
```

依赖：Java 17（OpenJDK）和 curl 或 wget。Maven Wrapper 固定 Maven 3.9.11，首次构建下载工具和依赖并校验工具 SHA-256。无需服务器全局安装 Maven。Spring Boot 4.1.1 提供 HTTP 服务，SQLite JDBC 3.53.4.0 访问原有数据库。管理员本地维护脚本继续使用 Python 3 标准库。

代码分层：`PublicController` 接口与静态页面、`ResearchService` 应用内容、`LibraryRepository` 共享文献库、`PublicBoundary` 文献只读与受限个人写入约束、`LearningController` 学习接口、`LearningRepository` 教材/个人学习数据。文献请求数据库连接设置 `PRAGMA query_only=ON`；账号注册通过独立 UserRepository 写入 users 表，启动执行幂等 schema 初始化。AI 由 `AiController`、`AiRepository`、`AiService` 管理个人/默认配置、密钥加密及服务商调用。

环境变量：`MATH_PORT` 默认 8080；`MATH_DB_PATH` 默认 `data/math.db`；`MATH_WEB_DIR` 默认 `../frontend`。工作目录必须为 backend，文件路径以此为基准。服务仅监听 127.0.0.1。

## 只读接口

| 方法 | 地址 | 用途 |
| --- | --- | --- |
| GET | /api/health | 服务与数据库状态 |
| GET | /api/subjects | 应用使用的研究方向 |
| GET | /api/documents?subject_id=1&offset=0 | 应用参考资料，每页 20 份 |
| GET | /api/documents/1 | 参考文献元数据 |
| GET | /api/documents/1/file | 获取原始 PDF / DJVU |
| GET | /api/ai/status | 当前账号的 AI 来源与可用状态 |

文献 HTTP 写入方法返回 405，原先的 POST /api/documents 继续返回 405；独立 /api/admin/* 仅供管理员访问。账号注册/登录/退出及个人学习进度/标注写入均校验 CSRF。数据库和管理脚本不能经静态文件路由访问。服务不能生成文献摘要或数学知识；学习模块展示方向介绍与递进教材，并提供个人 PDF 阅读。

## 管理员入库

先启动一次服务，初始化数据库。入库必须在 backend 目录执行，并使用服务账号 math-platform，确保新文件可读。

例如管理员已经把 PDF 放在 `/root/paper.pdf`：

```bash
cd /opt/math-platform/backend
install -o math-platform -g math-platform -m 600 /root/paper.pdf /tmp/math-import.pdf
sudo -u math-platform python3 admin/import_document.py /tmp/math-import.pdf --title '文献真实标题' --authors '作者姓名' --subject-id 1
rm /tmp/math-import.pdf
```

未配置专用账号、前台运行时，用与服务相同的账号执行本地脚本。脚本支持 MATH_DB_PATH，与服务器配置保持一致。

标题和作者各不超过 500 个 UTF-8 字节，不允许控制字符。支持具有 `%PDF-` 头部的 PDF，以及具有 `AT&TFORM` / `DJVU` / `DJVM` 头部的原始 DJVU 文件，不设应用层文件大小上限；该检查不代替完整 PDF 解析。网页上传以流式写入磁盘，完成后再提交文献记录，不将整份文件读入 Java 内存；服务器导入脚本同样支持大 PDF。专业 ID 必须存在，入库失败会清理新文件并回滚数据库。现有文献 ID、路径和关联保持兼容。入库成功后应用自动读取同一数据库，刷新即可。

## Zotero 文件夹批量导入

无需安装 Python 第三方依赖。保持 `.rdf` 与 `files/` 的相对结构，先将整个导出目录放在 `/opt/math-platform/imports/`。命令在 `backend` 中运行，使用服务账号以保证 PDF 权限正确。

```bash
cd /opt/math-platform/backend
sudo -u math-platform python3 admin/import_zotero.py '/opt/math-platform/imports/大学数学基础/大学数学基础.rdf' --report data/zotero-preview.json
```

默认只检查文件、生成 JSON 预览，不修改数据库。预览逐项记录标题、作者、语种、原分类路径、网站方向、文件大小与待补充字段；缺失或无效 PDF 记录失败，DJVU 同样入库，EPUB/网页/压缩包记录跳过。中文独立附件可按标题标为中文，没有明确依据的语种保留未标注；其他语言不误标为英文。

确认预览后正式入库：

```bash
sudo -u math-platform python3 admin/import_zotero.py '/opt/math-platform/imports/大学数学基础/大学数学基础.rdf' --apply --report data/zotero-import.json
```

PDF / DJVU 以流式复制到现有 `data/files/`，不设文件大小上限，每个文件单独提交数据库事务。首次运行会校验现有文献文件的 SHA-256；内容相同的附件复用原文献 ID，不覆盖原有标题、语种、分类、教材关联或个人进度。重复及失败文件的暂存副本会清理；失败不影响已成功条目，可以用同一命令重跑，已导入文件自动跳过。原书目 XML、原始标题/作者/语种与 Zotero 分类路径保存在 `zotero_import_sources`；内容校验值保存在 `zotero_import_hashes`。这些来源表只供服务器管理，不新增公开上传接口，也不自动配置推荐教材。

可使用 `--mapping mapping.json` 调整映射，JSON 格式为 `{"分类名称":["analysis","geometry-topology"]}`；值必须为现有方向 slug。默认映射覆盖大学数学基础导出中的 29 个分类，未匹配的文献保留待分类。语种、标题等可在管理员文献页面继续修正。`--database` 或 `MATH_DB_PATH` 可指定数据库，但仍须在平台 `backend` 目录执行，以兼容现有文件路径。

预览/导入遇到失败返回退出码 1，详情见报告，已成功导入记录保留。报告含本地路径及原书目，保存在 `data/`，不要放到公开静态目录。上传暂存目录与正式 PDF 都需要磁盘空间；导入完成前保留原导出文件夹。

## systemd 常驻运行

使用 `deploy/math-platform.service`，服务账号 math-platform，工作目录 `/opt/math-platform/backend`。部署前创建账号并将 `backend/data/` 授权给该账号；源码与 JAR 文件只需可读。注册服务后：

```bash
systemctl daemon-reload
systemctl enable --now math-platform
systemctl status math-platform --no-pager
```

从 C 迁移时须替换 service 的 ExecStart 为 Java JAR，详见根目录 README；以后的 Java 更新先构建成功，再重启。日志：`journalctl -u math-platform -n 30 --no-pager -l`。检查 HTTP 写入已关闭：

```bash
curl -i -X POST http://127.0.0.1:8080/api/documents
```

应返回 405。旧进程没有重新启动时，旧上传接口仍会存在。

## 验证

```bash
./mvnw -B package
python3 tests/schema.py
python3 tests/integration.py
```

集成检查覆盖只读写入拒绝、管理员入库、失败清理、既有分类保留、分类过滤、原文一致性与静态文件边界。GitHub Actions 另运行真实 Java 后端浏览器测试，覆盖应用入口、分页、错误恢复、XSS 文本输出和手机布局。

## 账号接口

| 方法 | 地址 | 用途 |
| --- | --- | --- |
| GET | /api/auth/csrf | 创建/读取会话 CSRF token，返回 token 和 header 名 |
| POST | /api/auth/register | JSON username/password/invitation，凭有效邀请码创建 USER 账号 |
| POST | /api/auth/login | 登录，轮换会话 ID，保存 Spring Security 上下文 |
| GET | /api/auth/me | 当前登录状态，不返回密码哈希 |
| POST | /api/auth/logout | 清除会话和 Cookie |

POST 必须携带同一会话 GET /api/auth/csrf 返回的 header/token；每次提交前重新获取，登录会轮换 token。Cookie HttpOnly、SameSite=Lax，仅使用 Cookie 追踪会话。网站入口直接显示独立登录/注册表单，登录后才能进入工作台。研究方向 /api/subjects 和资料接口 /api/documents 及其子路径未登录返回 401；健康状态、账号入口和必要的网页资产公开。账号哈希保存在同一个 math.db 的 users 表。没有默认账号或默认密码；网页管理员必须由服务器所有者明确授权。注册不赋予底层文献管理能力。

注册按来源地址限制每小时 10 次提交，登录每 15 分钟 30 次提交（含成功和失败），返回 429。限制为单进程内存状态，重启会重置；后续代理部署时再配置可信来源地址。


### 邀请注册与旧账号切换

升级到邀请注册版本后，首次启动会执行一次 `invite_only_v1` 迁移，**删除所有原有账号**。文献、文件和分类保持不变。会话不跨重启保存，旧用户必须重新获得邀请码注册。迁移记录写入同一数据库，后续重启保留新账号；不要删除迁移记录。

注册请求增加 `invitation` 字段，必须是管理员提供的有效邀请码。随机码仅保存 SHA-256 哈希，注册与消耗邀请码在同一事务内完成；过期、已用和未知码返回 `invalid_invitation`，注册失败不消耗邀请码。没有生成邀请码的公开 HTTP 接口，管理员可通过后台创建或撤销邀请码。

先构建并重启新版本，然后在服务器执行：

```bash
cd /opt/math-platform/backend
python3 admin/create_invitation.py
```

每次输出一个仅可注册一次、默认 7 天有效的邀请码。复制给获准注册的人，也给自己生成一个。可用 `--days 30` 设置 1–365 天有效期，`--database /absolute/path/math.db` 指定数据库。完整邀请码只在生成时输出，不要提交到 GitHub。


### 数学与应用数学学习模块

入口突出分析、几何与拓扑、代数，保留另外五个方向。分析方向展示可点击的课程路线图，并按选中课程展示中英文推荐；其他方向展示方向介绍和基础入门、核心理论、进阶学习三个阶段。初始目录含 56 条推荐；仅提供教材信息，未接入的 PDF 明确标注待接入。中英文是分别推荐，未必为互译版本；阶段划分可由管理员调整。教材目录保存在 `learning_books`，通过 `document_id` 关联共享文献库；研究论文不会自动变成教材。初始推荐覆盖各方向的一条学习线，并非该方向的全部分支。

PDF.js 5.6.205 本地托管，提供连续滚动、目录、页码、缩放、选中文字高亮及高亮笔记。缩放可输入 25%–400% 的整数百分比，也支持加减按钮、适合宽度与 Ctrl/Command 滚轮；100% 对应当前阅读区域的适合宽度，进度接口中的 `zoom` 为 0.25–4 的倍率。扫描页无文字层时明确提示，当前不自动 OCR。位置按账号和文献保存，包括页码、页内滚动位置及缩放；阅读位置不等于知识掌握程度。高亮用页面归一化矩形保存，缩放后仍定位。个人进度与标注在 SQLite 中保存，同账号跨设备可继续阅读；原 PDF 不修改。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | /api/learning/directions | 八个方向及主次展示标记 |
| GET | /api/learning/directions/{slug} | 方向介绍、递进教材及自己的进度 |
| GET | /api/learning/books/{id} | 教材与自己的进度 |
| PUT | /api/learning/books/{id}/progress | 保存自己的阅读位置 |
| GET / POST | /api/learning/books/{id}/annotations | 读取 / 创建自己的高亮 |
| PATCH / DELETE | /api/learning/books/{id}/annotations/{mark} | 更新笔记 / 删除自己的标注 |

所有学习接口都要求登录，写入要求 CSRF。身份从会话读取，不接受指定其他用户；标注每人每书最多 1000 条，每条正文/笔记最多 4000 字符、最多 100 个矩形。写请求限制 64 KiB，包括无 Content-Length 的请求；普通用户文献上传与管理仍被禁用，管理员操作使用独立接口。

部署并启动后，可导入作者提供的两本开放教材：

```bash
cd /opt/math-platform/backend
runuser -u math-platform -- python3 admin/install_open_textbooks.py
```

该命令从 https://measure.axler.net/ 和 https://linear.axler.net/ 获取原版 PDF，导入底层库并关联教材，重复执行跳过已有绑定。保留作者、来源及原 PDF 许可；这两本开放版采用非商业使用许可。程序不会从第三方来源自动下载其他教材。

其他教材由管理员导入并关联，例：

```bash
runuser -u math-platform -- python3 admin/import_document.py /tmp/textbook.pdf --title '教材名称' --authors '作者' --subject-id 3
runuser -u math-platform -- python3 admin/link_textbook.py 教材ID 上一步返回的文献ID
```

可在服务器用 sqlite3/Python 查询 `SELECT id,title,document_id FROM learning_books` 获取教材 ID。绑定后用户看到“开始学习”，无 PDF 时显示“PDF 待接入”。管理员可以更换或解除推荐文献关联。阅读记录和标注始终按文献编号保存，不会移到另一份文件；用户的自选文献保持不变。

## 文档库与共用阅读记录

用户工作台的“文档库”提供模块、方向（含尚未分类）、语种与标题/作者搜索，以及每页 20 条的分页。当前应用模块为数学与应用数学，覆盖八个方向；后续模块需新增对应分类支持。普通文献与教材共用 PDF.js 阅读器及个人数据，推荐教材绑定同一 PDF 时也共用记录。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | /api/library/categories | 模块与方向 |
| GET | /api/library/documents | module、direction、language、q、offset 筛选 |
| GET | /api/library/documents/{id} | 文献与当前用户的进度 |
| PUT | /api/library/documents/{id}/progress | 保存个人位置，字段与学习接口一致 |
| GET / POST | /api/library/documents/{id}/annotations | 个人高亮列表 / 创建 |
| PATCH / DELETE | /api/library/documents/{id}/annotations/{mark} | 修改个人笔记 / 删除 |

管理员上传和编辑文献支持 module（当前 mathematics）、language（zh/en/und）和 directions（方向 slug 数组；上传为重复查询参数）。绑定教材后不能去掉教材所需的方向，也不能改为不匹配语种。

启动执行一次性事务迁移：按旧分类和教材关联补充方向，将旧教材阅读进度、高亮及坐标迁入文献记录。多个旧教材关联同一 PDF 时保留最近进度并合并高亮。迁移保留原表与管理员已有配置，重复启动不重置个人数据。此前目录是英文推荐，旧关联教材的 PDF 初始标记为英文；其他文献标记为尚未标注语种，管理员可补充分类。

## 个人自选教材

每本推荐旁的“文献库自选”展开下拉框，支持在当前方向中搜索和分页，选中后立即替换此账号的卡片标题、作者与 PDF。仅允许对应方向、对应语种或尚未标注语种的文献。`PUT /api/learning/books/{id}/selection` 接收 `{ "document_id": 文献编号 }`，返回更新后的个人教材；传 null 恢复原推荐。接口需登录并校验 CSRF，选择保存在 `learning_selections`，支持刷新和跨设备恢复，不修改管理员推荐或其他账号数据。恢复推荐不删除所选 PDF 的阅读记录。阅读自选 PDF 时固定文献编号，避免其他设备更换选择影响正在阅读的文件。

方向详情的 introduction 提供 research_object（研究对象）、core_content（核心内容）、prerequisites（需要基础）三个字段，来自 learning_direction_introductions。八个方向分别初始化简短介绍，重复启动保留既有编辑，不再展示旧问题列表。


## AI 对话与 API 配置

管理员使用 `/admin#ai` 独立设置默认 API，用户在阅读器中选择默认或个人来源。当前适配 [OpenAI Chat Completions](https://platform.openai.com/docs/api-reference/chat/create) 兼容协议：基础地址例如 `https://api.example.com/v1`，自动追加 `/chat/completions`；也可填完整接口地址。使用 Bearer 密钥鉴权，JSON `model/messages/stream=false`，不主动设置 `max_tokens` 或 `max_completion_tokens`；返回 `choices[0].message.content` 的文本。不兼容的原生供应商接口需要适配层。本版为一次返回回答，不进行流式输出。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | /api/ai/settings、/api/ai/status | 当前用户个人配置、来源及默认模型是否可用，不返回密钥 |
| PUT | /api/ai/settings | 保存个人配置与来源，需登录和 CSRF |
| POST | /api/ai/chat | 以当前账号的个人 API 或平台默认 API 提问，需登录和 CSRF |
| GET / PUT | /api/admin/ai/settings | 管理员读取/保存默认配置，每次重新检查数据库角色 |

配置字段：`source`（用户为 default/custom）、`enabled`、`base_url`、`model`、`api_key`、`clear_key`；管理员额外设置 `daily_limit`（1–1000，初始 50）。密钥留空保留原密钥，`clear_key=true` 且 `enabled=false` 删除。个人配置保存在 `ai_provider_settings`，来源在 `ai_preferences`，互不影响。默认密钥和默认地址不向普通用户返回，浏览器只向本站后端发请求。

提问示例：

```json
{"source":"default","messages":[{"role":"user","content":"这个定理如何理解？"}],"context":{"document_id":1,"page":3,"quote":"选中的 PDF 原文"}}
```

`context` 可省略；提供时查询底层文献库的文献标题，并把页码、选段附加到当前问题。当前不会解析或检索整份 PDF；选段的页码和原文来自阅读器，接口不将其当作已经核验的文献引用。扫描 PDF 若没有文字层，需要先做 OCR 才能选择文字。对话仅在当前阅读会话中保留，关闭阅读器会清空并中止浏览器请求。

密钥以 AES-256-GCM 随机 nonce 加密保存，首次启动在数据库所在目录创建 `ai-secret.key`，Linux 权限 0600。备份/恢复必须同时保存数据库和该文件，遗失后原密钥无法解密。默认 systemd 的 data 可写目录与 UMask 已满足要求；无需增加环境变量。密钥不会经读取接口、上游错误正文或正常日志返回；回答若反射正在使用的密钥会进行隐藏。

出站仅允许公网 HTTPS，禁止 URL 中用户名/密码、查询串和片段，阻止回环、内网、链路本地及云元数据地址；实际连接使用经过校验的 DNS 地址，验证 TLS，禁止重定向与自动重试。聊天请求与上游响应各保留 16 MiB 的传输保护，连接等待 10 秒，读取等待 180 秒，单次请求总时限 300 秒。应用不限制对话轮数、输入字符数或 AI 选段字符数，不自动裁剪历史；完整对话随请求发送。模型服务自身的上下文窗口与输出上限仍适用。标注接口的 4000 字符限制与 AI 选段独立。

每位用户每分钟最多 6 次模型请求，单账号只允许一个进行中的提问，全平台最多 4 个并发。默认 API 的每日额度由管理员配置，UTC 零点重置，调用失败也计入额度；个人 API 不占用默认每日额度。计数在 `ai_usage` 中持久化，重启不重置额度。当前是按提问次数控制，服务商 token 费用仍以供应商账单为准。

测试：`python3 backend/tests/ai.py` 启动隔离数据库和回环假模型，验证提供商请求、PDF 文献上下文、加密/隐藏、个人隔离、CSRF、SSRF、额度与重启恢复。仅测试环境设 `MATH_AI_TEST_ENDPOINT` 为精确的 `http://127.0.0.1:端口/v1`，允许该单一回环假模型；生产不要设置此变量。


AI 回答兼容处理：支持 `choices[0].message.content` 字符串以及 text/output_text 文本块数组。空回答、输出额度耗尽、仅推理、拒绝、工具调用、非 JSON 和真正缺失字段分别返回错误码。正式回答完整展示，不截断；非空但 finish_reason=length 的回答提示服务商输出上限可能导致回答未完成。不会把 reasoning_content 当作正式答案显示。失败时 `journalctl -u math-platform` 可查看 `AI response diagnostic`，仅记录字段类型、回答字符数、choice 数量、结束类型与错误码，不记录原文、推理正文和密钥。不设置应用输出 token 预算，不自动重试付费模型请求。

AI 回答在浏览器本地通过 Marked、DOMPurify 与 KaTeX 渲染 Markdown 和 LaTeX，支持 `$...$`、`$$...$$`、`\(...\)`、`\[...\]`。先清理 HTML，再以 `trust: false` 渲染公式；不加载回答中的图片，不允许脚本、事件属性或危险链接。依赖固定版本、完整性与许可证见 `frontend/vendor/richtext-manifest.json` 和各目录 LICENSE。CSP 仅允许公式排版所需的内联样式属性，脚本和样式表仍只允许同源。

### 分析课程教材

分析方向的教材 `stage` 表示路线图课程：数学分析、高等代数、复分析、实分析与测度论、常微分方程、泛函分析、偏微分方程。其他方向仍使用基础入门、核心理论、进阶学习。方向 API 返回 `courses`，管理员教材 API 返回 `analysis_courses`，保存时按方向验证课程。

启动时一次性执行 `learning-courses.sql`：保留原教材 ID、PDF 关联、个人选择和阅读记录，将可确认的旧默认教材归入课程，补齐七门课的中英文书目。管理员修改过标题且无法确认课程的旧条目保留，由管理员重新归类。推荐书目不自动下载 PDF，仍由管理员关联文献库文件。

### 原生 DJVU 阅读

管理员网页上传、`import_document.py` 和 Zotero RDF 批量导入支持 `.djvu`、`.djv`。
文献原始字节保持不变，不转换为 PDF。格式保存在 `document_formats`，旧 PDF 默认保持兼容；
文件下载根据实际头部返回 MIME 类型与正确扩展名。绑定推荐教材和用户自选共用文献 ID。

DjVu.js 0.5.4 及 Worker 本地托管，浏览器直接解码单文件和 bundled 多页 DJVU。
沿用连续滚动、缩放、目录、私有阅读位置、高亮笔记和选段 AI，仅渲染附近页面并释放离屏 canvas。
有 OCR 文字坐标的页支持选段与高亮；没有文字层的扫描页支持阅读，不自动做 OCR。
不自动下载 indirect DJVU 索引引用的外部文件：请先把整组文件封装成单个 DJVU（仍为 DJVU）。
源码、发布版及 GPL-2.0-or-later 许可见 `frontend/vendor/djvu/README.md`、`LICENSE`、`NOTICE.md`。

更新服务器后重新构建 Java 后端并重启，再运行原 Zotero 命令；已导入 PDF 会复用 ID，新增 DJVU 会正常入库。

### 按 Zotero 原目录浏览文档库

文档库左侧按导出的目录层级显示文件夹，右侧显示标题、作者、格式、语种和阅读入口。
点击父目录包含其子目录文献，并按文献 ID 去重；搜索在当前目录内进行。
阅读器返回保留目录、筛选和页码；手机用“目录”按钮展开文件夹。
应用的研究方向分类及教材自选约束保持独立，不以 Zotero 文件夹替代。

升级后启动服务会从已保存的 `zotero_import_sources.collections_json` 自动恢复旧目录和关联。
若要补齐原导出中的空目录和原始排序，可只同步目录，不复制或重复导入文件：

```bash
cd /opt/math-platform/backend
sudo -u math-platform python3 admin/import_zotero.py "/opt/math-platform/imports/大学数学基础/大学数学基础.rdf" --collections-only
```

目录结构存于 `library_collections`，多重归类存于 `document_collections`；未归类的服务器/网页上传文献显示在“未归入目录”。
`GET /api/library/collections` 返回目录、包含子目录的文献数量和未归目录数量；
`GET /api/library/documents?collection=ID` 支持目录筛选，`collection=unfiled` 查看未归目录文献。
以上接口仍要求登录，不公开服务器路径或导入原始 XML。新的 Zotero 批量导入自动保存完整目录。

### 管理文献和目录

管理员登录 `/admin` 的文献库，使用与用户端相同的 Zotero 目录树浏览。
- 目录：新建子目录、改名、移动、删除目录。删除目录会移除其子目录和目录归属关系，不删除任何文献、文件、笔记或阅读进度；没有其他归属的文献进入“未归入目录”。
- 文献：点击“编辑”更新元数据，“更多”可下载、改名、移动或删除；勾选文献可批量移动或删除。
- 移动只改变目录归属（替换该文献原有目录关联），不改变原文件、方向分类、阅读进度及笔记。
- 导入按钮中的 PDF / DJVU 会进入当前选中的目录。
- 删除是永久操作，会删除文件和关联的个人阅读数据；被推荐教材引用时，需勾选“同时解除推荐教材关联”。推荐条目保留，但标记为未接入文档。
- 批量删除在数据库事务内完成。文件清理失败会记录到 `library_file_cleanup`，服务器重启后重试；共享文件在仍被其他文献引用时保留。

新增接口均要求管理员权限和 CSRF：`/api/admin/collections`（GET/POST）、`/api/admin/collections/{id}`（PATCH/DELETE）、`/api/admin/collections/{id}/parent`（PUT）、`/api/admin/documents/{id}/name`（PATCH）、`/api/admin/documents/move` 与 `/api/admin/documents/batch-delete`（POST）。批量操作最多 100 篇，目录最多 30 层。

### AI 自动整理

管理员文献库的“AI 整理”按钮可以直接复用该管理员在阅读器保存的“我的 API”，也可使用管理员默认 API；不需要再次提供密钥。
选择全部文献或当前目录后，服务器每批处理 8 篇，生成“数学主题 → 分析、代数、几何与拓扑等 → 课程/领域”的目录。
第一版仅发送文献标题、作者与现有非 AI 目录名，不发送文件、聊天记录、高亮或笔记，也不声称读过全文。模型只允许返回固定分类表中的值；低于 0.8 的模型自评结果进入“待确认”。这个数值不是实测准确率。
原 Zotero 目录、原文件和阅读数据保留；可靠分类同步研究方向，并保留推荐教材与用户自选教材必需的方向关联。
任务记录在 `ai_library_jobs`/`ai_library_items`，关掉网页仍继续。服务器重启会暂停未完成任务，点击“继续”处理剩余文献。API 失败或额度不足也会暂停，已完成部分不重复调用。
暂停后进行中的模型请求可能仍计费，但其返回结果不会继续写入。整理按已有 API 配额和每分钟频率规则运行，暂停与继续不会绕过这些限制。
“撤销本次整理”恢复本次分类前的目录归属和研究方向；整理之后已手动改变分类的记录会跳过，以保留管理员调整。任务运行期间发生改名或移动的文献同样跳过。
仅一个任务同时运行。个人 API 任务只能由原管理员继续，其他管理员可以暂停或撤销。新增后台 API：`GET/POST /api/admin/library-ai` 与 `POST /api/admin/library-ai/{id}/control`，控制动作是 `pause`、`resume`、`undo`。

### 教材配置按课程管理

管理员先选择研究方向，再选择课程，分别配置中文和英文推荐；分析方向七门课与学习流程图顺序一致，其他方向保留已确定的三个阶段。新增、编辑推荐在同一表单完成，可按文献库目录、标题或作者筛选当前方向和语种的 PDF / DJVU。选中文献自动填入标题和作者，可自定义展示信息。课程内排序控制同一课程的推荐顺序。旧推荐不删除，未归类的条目单独显示并可重新归类。

`GET /api/admin/books` 额外返回 `courses`（研究方向到课程/阶段列表的映射）。更换或解除推荐文档只更新教材引用，不删除文献、用户自选记录或该文献的进度、高亮笔记。暂无文档时仍展示教材信息与用户自选入口。
