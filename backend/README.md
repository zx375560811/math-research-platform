# Java 后端与管理员文献库

## 独立管理后台

`/admin` 提供文献 PDF 导入（最多 20 MiB）、标题/作者/分类编辑、已有教材的阶段/前置知识/排序/文献关联，以及邀请码创建/使用记录/撤销。管理员也能返回普通应用学习。未登录访问后台跳转到登录，普通用户返回 403；管理 API 校验 ADMIN 会话和数据库中的管理员资格，写入还校验 CSRF。撤销管理员资格后，即使旧会话仍在，管理 API 也立即拒绝访问。

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
| POST | /api/admin/documents?title=...&authors=...&subject_id=1 | 原始 PDF 请求体，Content-Type: application/pdf |
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
| GET | /api/documents/1/file | 获取原文 PDF |
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

标题和作者各不超过 500 个 UTF-8 字节，不允许控制字符。必须为具有 `%PDF-` 头部的文件，最大 20 MB；该检查不代替完整 PDF 解析。专业 ID 必须存在，入库失败会清理新文件并回滚数据库。现有文献 ID、路径和关联保持兼容。入库成功后应用自动读取同一数据库，刷新即可。

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

入口突出分析、几何与拓扑、代数，保留另外五个方向。每个方向先展示方向介绍，再展示基础入门、核心理论、进阶学习三个阶段，每阶段并排展示中文与英文推荐。初始目录含 48 条推荐；仅提供教材信息，未接入的 PDF 明确标注待接入。中英文是分别推荐，未必为互译版本；阶段划分可由管理员调整。教材目录保存在 `learning_books`，通过 `document_id` 关联共享文献库；研究论文不会自动变成教材。初始推荐覆盖各方向的一条学习线，并非该方向的全部分支。

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

可在服务器用 sqlite3/Python 查询 `SELECT id,title,document_id FROM learning_books` 获取教材 ID。绑定后用户看到“开始学习”，无 PDF 时显示“PDF 待接入”。已有绑定禁止换成不同文献，避免旧进度和标注错位。

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
