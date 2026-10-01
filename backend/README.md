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

启动后保持运行，Ctrl+C 停止。当前只监听服务器本机，不需要开放安全组端口。公网访问、HTTPS、专用运行账户和服务常驻在下一步配置。

可选环境变量：`MATH_PORT`（默认 8080）、`MATH_DB_PATH`（默认 `data/math.db`，自定义父目录须已存在）。专业列表初次启动自动初始化，重启不覆盖已有名称。

## 验证

在服务器启动服务后，若安装了 Python 3，可以运行：

```bash
python3 tests/smoke.py
```

脚本验证数据库状态、分类、错误路由、请求方法及 AI 未配置状态。当前开发电脑没有 Linux C 编译环境，尚未完成实际编译与 HTTP 运行验证；以服务器执行结果为准。
