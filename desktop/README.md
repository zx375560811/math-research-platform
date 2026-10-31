# Windows 单机客户端

把现有平台打包为单用户 Windows 客户端：内置 Java 17 运行时，启动后只在 `127.0.0.1` 提供页面，数据（SQLite、PDF、进度、高亮、笔记）保存在本机，不需要服务器、账号或备案。AI 对话使用用户在阅读器“设置”中配置的第三方 OpenAI 兼容接口。

## EXE 版（推荐）

`desktop/exe/` 是一个 WinForms + WebView2 外壳：双击 `Axiom.exe` 打开独立窗口，不经过浏览器；外壳在后台启动 `app/math-server.jar`，关闭窗口时结束 Java 进程。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File desktop/exe/build-exe.ps1
# 或者已有 jar：
powershell -NoProfile -ExecutionPolicy Bypass -File desktop/exe/build-exe.ps1 -SkipBackend
```

产物：`.preview/dist/Axiom-Desktop-EXE-1.0.0.zip`。构建脚本会编译 `Axiom.exe`、下载 WebView2 SDK、复制内置 JRE 和前端，并用 `--selftest` 做一次无窗口的启动检查。运行要求：Windows 10/11 x64、.NET Framework 4.8、WebView2 Runtime（系统一般自带）。

数据在 `我的文档\Axiom`；可用 `AXIOM_DATA_DIR` 环境变量覆盖。日志在 `我的文档\Axiom\logs\client.log`。

客户端不包含管理平台；AI 在阅读器右侧“设置”里配置个人 API。窗口按 1440×900 设计宽度打开（屏幕较小时自适应），避免各模块流程图被压窄变形。

## 浏览器壳构建（备用）

前置：

- JDK 17（用于 Maven 构建）；
- 一份 Windows JRE 17（打包进客户端，避免学生安装 Java）；
- 已执行过 `cd backend && ./mvnw -B package`，或让脚本构建。

```powershell
# 使用默认的 .preview JRE 路径并重新构建后端
powershell -NoProfile -ExecutionPolicy Bypass -File desktop/build-client.ps1

# 已有 target/math-server.jar，只重新打包
powershell -NoProfile -ExecutionPolicy Bypass -File desktop/build-client.ps1 -SkipBuild

# 指定 JRE 和输出目录
powershell -NoProfile -ExecutionPolicy Bypass -File desktop/build-client.ps1 `
  -JrePath "C:\Java\jre-17" -Output "D:\Axiom-dist" -SkipBuild
```

产物：`.preview/dist/Axiom-Desktop-1.0.0.zip`（约 80 MB）。

## 客户端结构

```text
Axiom-Desktop-1.0.0/
├─ start.bat          启动并打开浏览器
├─ run-server.bat     由 start.bat 调用的实际启动脚本
├─ stop.bat           停止本客户端（按 math-server.jar 匹配进程）
├─ stop.ps1           stop.bat 调用的 PowerShell
├─ app/               math-server.jar
├─ frontend/          页面与 PDF.js / DjVu / KaTeX 本地资源
├─ runtime/           内置 JRE 17
├─ data/              首次启动创建：math.db、files、ai-secret.key
├─ temp/              Tomcat / 临时文件
└─ logs/              server.log
```

## 单机模式实现

- 启动脚本设置 `MATH_DESKTOP=1`，服务仍绑定 `127.0.0.1:18080`。
- `DesktopMode` 在首次启动时创建本地管理员 `local`；`DesktopAuthenticationFilter` 在每个请求上注入该身份，因此不需要登录。
- 前端通过 `/api/auth/me` 的 `desktop` 字段隐藏登录、注册、退出和讨论入口；管理平台保留文献导入、教材配置和 API 设置，邀请码入口隐藏。
- 数据目录就是客户端目录：`MATH_DB_PATH=data/math.db`，文献在 `data/files`，`ai-secret.key` 用于加密 API 密钥。备份整个 `data/` 即可。

## 验证

```bash
# 后端单机模式（需要 java，临时数据库）
python3 backend/tests/desktop.py

# 打包后的客户端
# EXE 版：Axiom.exe --selftest（无窗口，检查本地服务与 local 账号）
# 浏览器壳：解压 zip，双击 start.bat，确认浏览器打开 http://127.0.0.1:18080/
```

## 限制

- 仅 Windows；没有做代码签名，首次运行可能触发 SmartScreen。
- 没有教师端、班级统计、共享讨论；这些能力需要服务器。
- AI 需要学生/老师自己的第三方 API key；客户端只转发请求。
