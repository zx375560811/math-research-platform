# 数学研究平台：C 后端起步版

当前接口：

- `/api/health`：服务与数据库运行状态。
- `/api/subjects`：从 SQLite 返回五个数学专业分类。
- `/api/ai/status`：明确返回尚未接入 AI，不调用模型。
- `POST /api/documents`：上传 PDF 并保存标题、作者、所属专业。
- `GET /api/documents`：文献列表，支持专业筛选与分页。
- `GET /api/documents/{id}`：文献详情。
- `GET /api/documents/{id}/file`：下载 PDF。

尚未实现登录、前端和实际 AI 问答。服务只监听本机。

## 文献上传与查询

启动时自动增加文献表及文献与专业的关联表，保留已有专业和文献数据。PDF 存在工作目录下的 `data/files/`，数据库只保存元数据和文件关联。备份时需同时备份数据库与文件目录。

本阶段每次上传选择一个已有专业，底层关联表允许以后扩展为多个专业。文件不超过 20 MiB，检查 `application/pdf` 类型和 `%PDF-` 文件头；这不是完整 PDF 内容解析。标题必填，作者可省略，两者各最多 500 个 UTF-8 字节。文件名由服务器生成，与上传文件名及标题无关。

元数据放在 URL 参数中（非 ASCII 内容需 URL 编码），请求体为 PDF 原始字节，不使用 multipart。前端接入时可用 `URLSearchParams` 构造参数，以 `File` 作为请求体。

把 `/root/paper.pdf` 替换为服务器上实际存在的 PDF 路径，在 SSH 终端执行：

```bash
curl -fsS -X POST \
  -H 'Content-Type: application/pdf' \
  --data-binary @/root/paper.pdf \
  'http://127.0.0.1:8080/api/documents?title=Test%20paper&authors=Author&subject_id=1'
```

成功返回 HTTP 201 和文献编号，例如 `{"id":1,"file_url":"/api/documents/1/file"}`。再查询或下载（编号替换为实际返回值）：

```bash
curl -fsS 'http://127.0.0.1:8080/api/documents?subject_id=1'
curl -fsS 'http://127.0.0.1:8080/api/documents/1'
curl -fS 'http://127.0.0.1:8080/api/documents/1/file' -o /root/downloaded-paper.pdf
```

列表按编号倒序，每页最多 20 条；下一页使用 `offset=20`，再下一页 `offset=40`。无 `subject_id` 时返回所有专业的文献。

文件传输完成后才写入数据库；数据库事务失败或上传连接中断时清理本次临时文件。进程被强制终止或服务器掉电仍可能留下未关联文件，当前版本尚无自动清理工具。API 尚无修改、删除或去重功能。

### 已配置 systemd 的服务器更新

先拉取源码；成功后停止服务、编译，只有编译成功才启动：

```bash
cd /opt/math-platform
git pull --ff-only
systemctl stop math-platform
cd backend
make && systemctl start math-platform
systemctl status math-platform --no-pager
curl -fsS http://127.0.0.1:8080/api/health
```

停止服务后编译是为了避免覆盖正在使用的可执行文件。编译失败时修正错误，再执行 `make && systemctl start math-platform`。

## Alibaba Cloud Linux 3

先安装开发依赖（以 root 在服务器执行）：

```bash
dnf install -y gcc make pkgconf-pkg-config sqlite-devel libmicrohttpd-devel
```

若提示找不到软件包，停止此步并提供完整输出及 `dnf repolist`，根据实际仓库处理，勿直接替换系统软件源。

把本目录全部上传到服务器，例如 `/opt/math-platform/backend`，然后：

```bash
cd /opt/math-platform/backend
make
make run
```

在服务器第二个终端执行：

```bash
curl -fsS http://127.0.0.1:8080/api/health
curl -fsS http://127.0.0.1:8080/api/subjects
curl -fsS http://127.0.0.1:8080/api/ai/status
```

前台启动后保持运行，Ctrl+C 停止。当前只监听服务器本机，不需要开放安全组端口。常驻运行见下节；公网访问与 HTTPS 后续配置。

可选环境变量：`MATH_PORT`（默认 8080）、`MATH_DB_PATH`（默认 `data/math.db`，自定义父目录须已存在）。专业列表初次启动自动初始化，重启不覆盖已有名称。

## systemd 常驻运行

以下命令由服务器 root 执行，适用于项目位于 `/opt/math-platform` 的情况。

先回到正在运行 `make run` 的窗口按 Ctrl+C 停止。如果先前按了 Ctrl+Z，先执行 `fg`，再按 Ctrl+C。避免前台程序与服务同时占用 8080 端口。

```bash
cd /opt/math-platform
git pull --ff-only
cd backend
make
```

创建仅用于运行后端的系统账户，并把现有数据库交给该账户管理。以下操作只调整运行数据的归属，不删除数据，也不改变源码归属：

```bash
id math-platform >/dev/null 2>&1 || useradd --system --user-group --no-create-home --shell /sbin/nologin math-platform
mkdir -p /opt/math-platform/backend/data
chown -R math-platform:math-platform /opt/math-platform/backend/data
```

安装服务配置、检查配置并启动：

```bash
install -m 0644 /opt/math-platform/backend/deploy/math-platform.service /etc/systemd/system/math-platform.service
systemd-analyze verify /etc/systemd/system/math-platform.service
systemctl daemon-reload
systemctl enable --now math-platform
systemctl status math-platform --no-pager
curl -fsS http://127.0.0.1:8080/api/health
```

预期看到 `active (running)` 和 `{"status":"ok","database":"ok"}`。启动失败时查看：

```bash
journalctl -u math-platform -n 50 --no-pager
```

服务以专用账户运行，只允许写入数据目录。正常关闭 SSH 不会停止服务，开机也会启动。今后更新源码并成功执行 `make` 后，使用 `systemctl restart math-platform` 启用新程序。不要再用 `make run` 同时启动第二个进程。

## 验证

在服务器启动服务后，若安装了 Python 3，可以运行：

```bash
python3 tests/smoke.py
```

脚本验证数据库状态、分类、错误路由、请求方法及 AI 未配置状态。用户已在 Alibaba Cloud Linux 3 完成旧版编译、运行状态与专业列表验证，并启用 systemd 服务。

新增的完整集成检查使用临时目录和独立端口，不修改服务器的正式数据库：

```bash
python3 tests/schema.py
python3 tests/integration.py
```

GitHub Actions 也执行 C 编译、数据库检查和上传/查询/下载集成检查。新增功能是否通过，以实际检查结果为准。
