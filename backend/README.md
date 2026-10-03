# Java 后端与管理员文献库

网页应用以文献库为内容来源；文献管理不向公共用户开放。文献 HTTP 接口只读，管理员在服务器通过本地脚本入库；账号服务独立负责注册和登录。

## 编译与运行

```bash
cd /opt/math-platform/backend
./mvnw -B package
java -jar target/math-server.jar
```

依赖：Java 17（OpenJDK）和 curl 或 wget。Maven Wrapper 固定 Maven 3.9.11，首次构建下载工具和依赖并校验工具 SHA-256。无需服务器全局安装 Maven。Spring Boot 4.1.1 提供 HTTP 服务，SQLite JDBC 3.53.4.0 访问原有数据库。管理员本地维护脚本继续使用 Python 3 标准库。

代码分层：`PublicController` 接口与静态页面、`ResearchService` 应用内容、`LibraryRepository` 共享文献库、`PublicBoundary` 文献只读与受限个人写入约束、`LearningController` 学习接口、`LearningRepository` 教材/个人学习数据。文献请求数据库连接设置 `PRAGMA query_only=ON`；账号注册通过独立 UserRepository 写入 users 表，启动执行幂等 schema 初始化。AI 接口继续预留，未加入模型调用。

环境变量：`MATH_PORT` 默认 8080；`MATH_DB_PATH` 默认 `data/math.db`；`MATH_WEB_DIR` 默认 `../frontend`。工作目录必须为 backend，文件路径以此为基准。服务仅监听 127.0.0.1。

## 只读接口

| 方法 | 地址 | 用途 |
| --- | --- | --- |
| GET | /api/health | 服务与数据库状态 |
| GET | /api/subjects | 应用使用的研究方向 |
| GET | /api/documents?subject_id=1&offset=0 | 应用参考资料，每页 20 份 |
| GET | /api/documents/1 | 参考文献元数据 |
| GET | /api/documents/1/file | 获取原文 PDF |
| GET | /api/ai/status | AI 接入状态，目前未配置 |

文献 HTTP 写入方法返回 405，包括原先的 POST /api/documents 和猜测的管理员接口。账号注册/登录/退出及个人学习进度/标注写入均校验 CSRF。数据库和管理脚本不能经静态文件路由访问。服务不能生成文献摘要或数学知识；学习模块展示问题与递进教材，并提供个人 PDF 阅读。

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

POST 必须携带同一会话 GET /api/auth/csrf 返回的 header/token；每次提交前重新获取，登录会轮换 token。Cookie HttpOnly、SameSite=Lax，仅使用 Cookie 追踪会话。网站入口直接显示独立登录/注册表单，登录后才能进入工作台。研究方向 /api/subjects 和资料接口 /api/documents 及其子路径未登录返回 401；健康状态、账号入口和必要的网页资产公开。账号哈希保存在同一个 math.db 的 users 表。没有默认账号、默认密码或网页管理员。注册不赋予底层文献管理能力。

注册按来源地址限制每小时 10 次提交，登录每 15 分钟 30 次提交（含成功和失败），返回 429。限制为单进程内存状态，重启会重置；后续代理部署时再配置可信来源地址。


### 邀请注册与旧账号切换

升级到邀请注册版本后，首次启动会执行一次 `invite_only_v1` 迁移，**删除所有原有账号**。文献、文件和分类保持不变。会话不跨重启保存，旧用户必须重新获得邀请码注册。迁移记录写入同一数据库，后续重启保留新账号；不要删除迁移记录。

注册请求增加 `invitation` 字段，必须是管理员提供的有效邀请码。随机码仅保存 SHA-256 哈希，注册与消耗邀请码在同一事务内完成；过期、已用和未知码返回 `invalid_invitation`，注册失败不消耗邀请码。没有生成邀请码的公开 HTTP 接口。

先构建并重启新版本，然后在服务器执行：

```bash
cd /opt/math-platform/backend
python3 admin/create_invitation.py
```

每次输出一个仅可注册一次、默认 7 天有效的邀请码。复制给获准注册的人，也给自己生成一个。可用 `--days 30` 设置 1–365 天有效期，`--database /absolute/path/math.db` 指定数据库。完整邀请码只在生成时输出，不要提交到 GitHub。


### 数学与应用数学学习模块

入口突出分析、几何与拓扑、代数，保留另外五个方向。每个方向只展示核心大问题和按阶段排列的推荐教材。教材目录保存在 `learning_books`，通过 `document_id` 关联共享文献库；研究论文不会自动变成教材。初始推荐覆盖各方向的一条学习线，并非该方向的全部分支。

PDF.js 5.6.205 本地托管，提供连续滚动、目录、页码、缩放、选中文字高亮及高亮笔记。缩放可输入 25%–400% 的整数百分比，也支持加减按钮、适合宽度与 Ctrl/Command 滚轮；100% 对应当前阅读区域的适合宽度，进度接口中的 `zoom` 为 0.25–4 的倍率。扫描页无文字层时明确提示，当前不自动 OCR。位置按账号和教材保存，包括页码、页内滚动位置及缩放；阅读位置不等于知识掌握程度。高亮用页面归一化矩形保存，缩放后仍定位。个人进度与标注在 SQLite 中保存，同账号跨设备可继续阅读；原 PDF 不修改。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | /api/learning/directions | 八个方向及主次展示标记 |
| GET | /api/learning/directions/{slug} | 大问题、递进教材及自己的进度 |
| GET | /api/learning/books/{id} | 教材与自己的进度 |
| PUT | /api/learning/books/{id}/progress | 保存自己的阅读位置 |
| GET / POST | /api/learning/books/{id}/annotations | 读取 / 创建自己的高亮 |
| PATCH / DELETE | /api/learning/books/{id}/annotations/{mark} | 更新笔记 / 删除自己的标注 |

所有学习接口都要求登录，写入要求 CSRF。身份从会话读取，不接受指定其他用户；标注每人每书最多 1000 条，每条正文/笔记最多 4000 字符、最多 100 个矩形。写请求限制 64 KiB，包括无 Content-Length 的请求；文献 HTTP 上传与管理仍被禁用。

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
