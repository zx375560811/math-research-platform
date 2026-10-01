# 数学研究平台

数学专业模块共享文献库，并为 AI 文献检索与问答预留接口。

当前阶段：数学研究工作台与 C 文献后端。首页提供数学专业入口；专业页可上传 PDF、填写标题与作者、查看分页文献列表并下载文件。AI 接口预留，登录和模型接入后续实现。

前端位于 `frontend/`，使用 HTML、CSS、JavaScript，由 C 后端直接提供页面。服务器运行网站不需要安装 Node.js 或启动额外前端服务。

前端按 Anthropic frontend-design 技能重设计为带常驻专业导航的研究工作台，手机使用顶部可滚动专业导航。设计依据见 [设计说明](frontend/DESIGN.md)。

## 在电脑浏览器打开网站

完成下方服务器部署后，在电脑的 PowerShell 中执行（将服务器地址替换为自己的）：

```powershell
ssh -N -L 127.0.0.1:18080:127.0.0.1:8080 root@你的服务器公网IP
```

保持该窗口打开，浏览器访问 `http://127.0.0.1:18080/`。此时网页和 API 都通过 SSH 隧道访问服务器。不要在服务器 SSH 会话中执行这条隧道命令。

当前仍仅监听服务器本机，尚无登录保护；公网开放与 HTTPS 在后续完成。

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

停止当前前台服务（Ctrl+C），然后执行（仅用于未启用 systemd 的情况）：

```bash
cd /opt/math-platform
git pull --ff-only
cd backend
make
make run
```

Git 更新源码后还需要重新编译、启动。运行数据保存在 `backend/data/`，已排除在 Git 之外，须单独备份。文献 PDF、密钥、环境配置和编译产物也不提交。

已配置 systemd 时，先拉取更新，然后停止服务、编译并启动，不要使用 `make run`：

```bash
cd /opt/math-platform
git pull --ff-only
systemctl stop math-platform
cd backend
make && systemctl start math-platform
```

详见 [后端说明](backend/README.md)。用户已在 Alibaba Cloud Linux 3 服务器验证旧版运行状态、专业列表与 systemd 常驻服务。新增文献功能由 GitHub Actions 编译和集成验证，部署到阿里云后仍需确认。
