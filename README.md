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

前端使用 HTML/CSS/JavaScript 和本地 Morphicons，由 C 后端提供，不需要服务器 Node.js。视觉依据见 [设计说明](frontend/DESIGN.md)。

## 部署和更新

Alibaba Cloud Linux 3：

```bash
dnf install -y git gcc make pkgconf-pkg-config sqlite-devel libmicrohttpd-devel python3
git clone https://github.com/zx375560811/math-research-platform.git /opt/math-platform
cd /opt/math-platform/backend
make
make run
```

首次启动初始化数据库。服务仅监听 127.0.0.1:8080。常驻配置见 [后端说明](backend/README.md#systemd-常驻运行)。公网反向代理与 HTTPS 尚未配置。

已配置 systemd 的服务器更新：

```bash
cd /opt/math-platform
git pull --ff-only
systemctl stop math-platform
cd backend
make && systemctl start math-platform
```

这次必须重新编译并重启，才能关闭旧版上传接口。Git 更新不会修改 `backend/data/`，该目录必须单独备份。

## 在电脑打开网站

在电脑 PowerShell 执行，保持窗口开启：

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18080:127.0.0.1:8080 root@你的服务器公网IP
```

浏览器访问 `http://127.0.0.1:18080/`。

## 管理员维护文献库

见 [本地入库命令](backend/README.md#管理员入库)。不要将后台管理写入功能接入公共应用。将来添加管理界面时，应独立设计身份认证、授权和发布流程。
