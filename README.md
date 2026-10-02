# 数学研究平台

面向用户的网站是应用平台，文献库是共享底层，由服务器管理员维护。

```text
数学研究平台
├─ 应用工作台
├─ 数学与应用数学
│  └─ 专题阅读：按研究方向阅读参考资料，追溯原文
├─ 后续研发应用（规划中）
└─ 共享底层（不在公共网页提供管理功能）
   ├─ 文献元数据与 PDF
   ├─ 研究方向分类
   └─ AI 接口预留
```

当前提供一个可用应用：数学与应用数学的专题阅读。内容直接来自管理员维护的文献库；知识条目、研究工具、内容提炼与 AI 问答尚未实现。首页展示应用入口，不展示最近入库列表或文献管理表单。用户只能阅读和获取应用引用的原文。

公共 HTTP 服务仅支持 GET；POST/PUT/PATCH/DELETE 均返回 405，没有管理员 HTTP 上传入口。文献管理采用服务器本地命令，不依赖浏览器或公开 API。已有 SQLite 数据和 PDF 不迁移、不删除。

前端使用 HTML/CSS/JavaScript 和本地 Morphicons，由 Java / Spring Boot 后端提供，不需要服务器 Node.js。视觉依据见 [设计说明](frontend/DESIGN.md)。

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
