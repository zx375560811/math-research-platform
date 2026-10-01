# 数学研究平台：C 后端起步版

本阶段只有三个 GET 接口：

- `/api/health`：服务与数据库运行状态。
- `/api/subjects`：从 SQLite 返回五个数学专业分类。
- `/api/ai/status`：明确返回尚未接入 AI，不调用模型。

尚未实现文献上传、登录、前端和实际 AI 问答。

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

脚本验证数据库状态、分类、错误路由、请求方法及 AI 未配置状态。用户已在 Alibaba Cloud Linux 3 完成编译并验证运行状态与专业列表；完整 HTTP 检查及 systemd 配置尚待服务器执行。
