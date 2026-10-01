# 数学研究平台

数学专业模块共享文献库，并为 AI 文献检索与问答预留接口。

当前阶段：C 后端骨架。包含运行状态、数学专业列表和 AI 未配置状态三个接口；文献上传、前端和模型接入后续实现。

## 从 GitHub 部署到 Alibaba Cloud Linux 3

在服务器安装依赖：

```bash
dnf install -y git gcc make pkgconf-pkg-config sqlite-devel libmicrohttpd-devel
```

如果找不到包，请保留错误输出，通过 `dnf repolist` 检查实际仓库。

将下面的 `<仓库地址>` 替换成实际 GitHub 克隆地址：

```bash
git clone <仓库地址> /opt/math-platform
cd /opt/math-platform/backend
make
make run
```

私有仓库需要在服务器配置有权读取该仓库的凭据，例如仅限该仓库的只读 SSH Deploy Key。

在服务器另一个终端验证：

```bash
curl -fsS http://127.0.0.1:8080/api/health
curl -fsS http://127.0.0.1:8080/api/subjects
```

服务仅监听本机，前台运行。可按 [后端说明](backend/README.md#systemd-常驻运行) 配置 systemd 常驻和开机启动；登录保护与 HTTPS 后续加入。

## 更新

停止当前前台服务（Ctrl+C），然后执行：

```bash
cd /opt/math-platform
git pull --ff-only
cd backend
make
make run
```

Git 更新源码后还需要重新编译、启动。运行数据保存在 `backend/data/`，已排除在 Git 之外，须单独备份。文献 PDF、密钥、环境配置和编译产物也不提交。

已配置 systemd 时，更新和编译后执行 `systemctl restart math-platform`，不要使用 `make run`。

详见 [后端说明](backend/README.md)。数据库初始化检查已在开发电脑验证，用户已在 Alibaba Cloud Linux 3 服务器完成编译，并验证运行状态与专业列表接口。systemd 配置尚待服务器验证。
