# Java 后端与管理员文献库

网页应用以文献库为内容来源；文献管理不向公共用户开放。文献 HTTP 接口只读，管理员在服务器通过本地脚本入库；账号服务独立负责注册和登录。

## 编译与运行

```bash
cd /opt/math-platform/backend
./mvnw -B package
java -jar target/math-server.jar
```

依赖：Java 17（OpenJDK）和 curl 或 wget。Maven Wrapper 固定 Maven 3.9.11，首次构建下载工具和依赖并校验工具 SHA-256。无需服务器全局安装 Maven。Spring Boot 4.1.1 提供 HTTP 服务，SQLite JDBC 3.53.4.0 访问原有数据库。管理员本地维护脚本继续使用 Python 3 标准库。

代码分层：`PublicController` 接口与静态页面、`ResearchService` 应用内容、`LibraryRepository` 共享文献库、`PublicBoundary` 公共只读约束。文献请求数据库连接设置 `PRAGMA query_only=ON`；账号注册通过独立 UserRepository 写入 users 表，启动执行幂等 schema 初始化。AI 接口继续预留，未加入模型调用。

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

文献和应用内容的 HTTP 写入方法返回 405，包括原先的 POST /api/documents 和猜测的管理员接口。账号 POST 接口仅允许注册、登录和退出，并校验 CSRF。数据库和管理脚本不能经静态文件路由访问。服务不能生成文献摘要或数学知识；目前应用展示真实资料标题、作者和原文。

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
| POST | /api/auth/register | JSON username/password，创建固定 USER 账号 |
| POST | /api/auth/login | 登录，轮换会话 ID，保存 Spring Security 上下文 |
| GET | /api/auth/me | 当前登录状态，不返回密码哈希 |
| POST | /api/auth/logout | 清除会话和 Cookie |

POST 必须携带同一会话 GET /api/auth/csrf 返回的 header/token；每次提交前重新获取，登录会轮换 token。Cookie HttpOnly、SameSite=Lax，仅使用 Cookie 追踪会话。网站入口直接显示独立登录/注册表单，登录后才能进入工作台。研究方向 /api/subjects 和资料接口 /api/documents 及其子路径未登录返回 401；健康状态、账号入口和必要的网页资产公开。账号哈希保存在同一个 math.db 的 users 表。没有默认账号、默认密码或网页管理员。注册不赋予底层文献管理能力。

注册按来源地址限制每小时 10 次提交，登录每 15 分钟 30 次提交（含成功和失败），返回 429。限制为单进程内存状态，重启会重置；后续代理部署时再配置可信来源地址。
