# 数学研究平台

面向用户的网站是应用平台，文献库是共享底层，由服务器管理员维护。

新服务器从零部署、六个系列上传和导入、管理员创建及旧数据迁移，见 [部署与文献导入手册](docs/新服务器部署与文献导入.md)。

```text
数学研究平台
├─ 应用工作台
├─ 文档库：按模块、方向和语种查看与阅读
├─ 数学与应用数学
│  ├─ 研究方向：仅展示实际关联文献的方向，空方向预留在后台
│  ├─ 方向介绍与中英文递进教材
│  └─ PDF 学习：个人进度、高亮与笔记
├─ 后续研发应用（规划中）
└─ 共享底层（不在公共网页提供管理功能）
   ├─ 文献元数据与 PDF
   ├─ 研究方向分类
   └─ AI 对话与模型适配
```

登录后的工作台先展示“文档库”，按应用模块、研究方向和语种筛选全部文献，可搜索并直接阅读；普通用户只能阅读，管理员负责导入和分类。

当前学习应用是数学与应用数学模块，推荐入口仅使用分析、几何、代数三类；文献库保留完整细分目录。用户选择研究方向，查看方向介绍，再按基础入门、核心理论、进阶学习选择中文或英文推荐教材。每个阶段分别显示两种语种，推荐来自底层文献库的对应方向。点击“开始学习”进入 PDF 阅读器，可保存阅读位置、选中文字高亮和写个人笔记，支持同账号跨设备继续阅读。同一 PDF 从文档库或教材入口打开，共用个人进度、高亮和笔记。阅读器右侧上方显示个人高亮笔记，下方为 AI 对话；可选择管理员默认 API 或个人 API，选中 PDF 文字后点击“问 AI”附带文献选段。知识条目与全库内容检索尚未实现。

网站入口只显示登录与邀请码注册，登录后进入应用工作台。教材通过管理员关联底层文献库，推荐区仅展示已关联实际文献的教材，未关联的预设书目不展示。普通用户的文献接口保持只读；独立 `/admin` 后台供管理员导入 PDF、编辑元数据、配置教材和管理邀请码。管理写入、个人进度和标注均校验 CSRF，原有文献和 PDF 保留。

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

### 六个系列批量追加导入

上传目录 `/opt/math-platform/imports/series` 下保留 GSM、GTM、Lecture Notes in Mathematics、London Mathematical Society Student Texts、SMM、UTM 六个目录及原有子目录。进入 `backend` 后预览：

```bash
sudo -u math-platform python3 admin/import_series.py /opt/math-platform/imports/series
```

确认后停止服务，执行同一命令加 `--apply`，无论导入成功或失败都重新启动服务。先更新并启动一次 Java 后端以初始化系列数据表。工具自动备份数据库及 AI 加密密钥，追加 PDF/DJVU、保留子目录并关联系列；按内容 SHA-256 复用现有文件，重复执行不会重复入库。不修改旧文献、阅读进度、笔记或推荐教材。非 PDF/DJVU 文件在预览中计入 skipped，不导入。

见 [本地入库命令](backend/README.md#管理员入库)。不要将后台管理写入功能接入公共应用。管理界面位于独立 `/admin`，管理员身份由服务器所有者授权，后端逐次校验管理权限。

## 用户注册与登录

首页右上角提供登录/注册。用户先注册普通账号，再登录使用数学应用。用户名为 3–32 位字母、数字或下划线，按小写保存且不区分大小写；密码至少 12 个字符、最多 72 个 UTF-8 字节，以 BCrypt 哈希保存。

参考资料列表、元数据和 PDF 下载均要求登录。注册账号固定为 USER，注册不赋予文献上传、管理员权限或修改资料的能力。服务器所有者可用 `admin/grant_admin.py` 为指定账号授予后台权限。账号保存在原 SQLite 数据库中新建的 users 表，启动自动创建，原有文献不变。登录会话保留在服务器内存，30 分钟无活动后到期，重启后需要重新登录。

本阶段提供用户名/密码注册与登录；尚未加入邮箱、找回密码和第三方登录。当前通过 SSH 隧道访问，公网部署的 HTTPS 仍按后续部署步骤配置。注册和登录有进程内频率限制，当前按服务器看到的来源地址计数，尚未配置反向代理来源解析。

更新部署：git pull 后在 backend 运行 ./mvnw -B package，成功后 systemctl restart math-platform。浏览器 Ctrl+F5 刷新，入口直接登录/注册。邀请注册首次迁移删除旧开放注册账号；后续升级保留新账号。


## 教材接入

启动新版本后，在 backend 目录用服务账号导入两本作者公开的非商业开放教材：

```bash
runuser -u math-platform -- python3 admin/install_open_textbooks.py
```

完成后可在“分析”和“代数”中开始 PDF 学习。其他推荐教材等待管理员接入对应 PDF。详细接口、教材绑定方式与使用范围见 [后端说明](backend/README.md#数学与应用数学学习模块)。


## 阅读器 AI 与管理员 API 设置

在独立管理平台 `/admin#ai` 配置默认 API 地址、模型名、密钥，并勾选启用。用户在 PDF 阅读器下方的 AI 对话区选择“管理员默认 API”；也可点“设置”保存个人 API，个人配置仅作用于自己的账号。接口支持 OpenAI 兼容 Chat Completions 格式。

API 密钥保存在服务器，读取接口不回显；`backend/data/ai-secret.key` 用于加密数据库中的密钥，备份时应连同数据库一起保存。对话目前仅保留在当前阅读页面，离开后清空；提问发送当前对话和主动附加的选段，不自动读取或上传整份 PDF。

阅读助手支持 Markdown 富文本与 LaTeX 公式；“问 AI”与“发送”在输入框右侧上下紧邻排列。右侧高亮笔记与 AI 可上下拖动调整高度并记住布局，应用与管理界面统一采用可读字号。AI 不主动设置输出 token 预算，也不按字符或对话轮数裁剪输入、历史和正式回答；服务商自身限制仍适用。
