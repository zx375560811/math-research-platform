# 数学研究平台

面向用户的网站是应用平台，文献库是共享底层，由服务器管理员维护。

```text
数学研究平台
├─ 应用工作台
├─ 数学与应用数学
│  ├─ 八个研究方向：突出分析、几何与拓扑、代数
│  ├─ 核心大问题与递进教材
│  └─ PDF 学习：个人进度、高亮与笔记
├─ 后续研发应用（规划中）
└─ 共享底层（不在公共网页提供管理功能）
   ├─ 文献元数据与 PDF
   ├─ 研究方向分类
   └─ AI 接口预留
```

当前应用是数学与应用数学学习模块。用户选择研究方向，查看核心大问题，再按基础入门、核心理论、进阶学习选择教材。点击“开始学习”进入 PDF 阅读器，可保存阅读位置、选中文字高亮和写个人笔记，支持同账号跨设备继续阅读。知识条目、内容提炼与 AI 问答尚未实现。

网站入口只显示登录与邀请码注册，登录后进入应用工作台。教材通过管理员关联底层文献库，无 PDF 的教材明确标注“PDF 待接入”。文献 HTTP 上传与管理请求返回 405；个人进度和标注接口要求登录与 CSRF。文献管理采用服务器本地命令，原有文献和 PDF 保留。

前端使用 HTML/CSS/JavaScript、本地 Morphicons 与 PDF.js，由 Java / Spring Boot 后端提供，不需要服务器 Node.js。视觉依据见 [设计说明](frontend/DESIGN.md)。

## 部署和更新

Alibaba Cloud Linux 3：

```bash
dnf install -y git java-17-openjdk-devel curl python3
git clone https://github.com/zx375560811/math-research-platform.git /opt/math-platform
cd /opt/math-platform/backend
./mvnw -B package
java -jar target/math-server.jar
```

首次启动初始化数据库。服务仅监听 127.0.0.1:8080。常驻配置见 [后端说明](backend/README.md#systemd-常驻运行)。公网反向代理与 HTTPS 尚未配置。

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

## 管理员维护文献库

见 [本地入库命令](backend/README.md#管理员入库)。不要将后台管理写入功能接入公共应用。将来添加管理界面时，应独立设计身份认证、授权和发布流程。

## 用户注册与登录

首页右上角提供登录/注册。用户先注册普通账号，再登录使用数学应用。用户名为 3–32 位字母、数字或下划线，按小写保存且不区分大小写；密码至少 12 个字符、最多 72 个 UTF-8 字节，以 BCrypt 哈希保存。

参考资料列表、元数据和 PDF 下载均要求登录。注册账号固定为 USER，不提供文献上传、管理员权限或修改资料的能力。后台入库仍由服务器管理员操作。账号保存在原 SQLite 数据库中新建的 users 表，启动自动创建，原有文献不变。登录会话保留在服务器内存，30 分钟无活动后到期，重启后需要重新登录。

本阶段提供用户名/密码注册与登录；尚未加入邮箱、找回密码和第三方登录。当前通过 SSH 隧道访问，公网部署的 HTTPS 仍按后续部署步骤配置。注册和登录有进程内频率限制，当前按服务器看到的来源地址计数，尚未配置反向代理来源解析。

更新部署：git pull 后在 backend 运行 ./mvnw -B package，成功后 systemctl restart math-platform。浏览器 Ctrl+F5 刷新，入口直接登录/注册。邀请注册首次迁移删除旧开放注册账号；后续升级保留新账号。


## 教材接入

启动新版本后，在 backend 目录用服务账号导入两本作者公开的非商业开放教材：

```bash
runuser -u math-platform -- python3 admin/install_open_textbooks.py
```

完成后可在“分析”和“代数”中开始 PDF 学习。其他推荐教材等待管理员接入对应 PDF。详细接口、教材绑定方式与使用范围见 [后端说明](backend/README.md#数学与应用数学学习模块)。
