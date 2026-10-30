# 公理数学客户端（Windows EXE 版）

双击 `Axiom.exe` 启动。它是独立窗口，不会打开浏览器，也没有地址栏。

- 数据默认保存在 `我的文档\Axiom`（数据库、PDF、进度、高亮、笔记）。
- 便携模式：如果 `Axiom.exe` 同目录下已有 `data\math.db`，客户端自动使用这个 `data`，不再写“我的文档”；整个文件夹可以复制/移动。
- 外部书库：`data\external-root.txt` 写书籍根目录（例如 `E:\书籍`）；数据库里以 `external:` 开头的记录直接读取该目录，不复制 PDF。
- 学生默认不显示管理平台；需要导入教材或配置默认 API 时，双击 `Teacher.bat`（教师模式）。
- 学生自己的 AI：阅读器右侧 AI 面板 → “设置”，选择“我的 API”填写第三方 OpenAI 兼容接口、模型和密钥。
- 备份：关闭客户端后复制 `我的文档\Axiom` 整个目录。
- 停止：关闭客户端窗口即可；它启动的 Java 服务会一起退出。
- 要求：Windows 10/11 x64，已安装 Microsoft Edge WebView2 Runtime（系统通常自带）。
- 首次运行可能被 SmartScreen 提示；这是因为安装包未做代码签名，选择“更多信息 → 仍要运行”。

## 目录

```text
Axiom-Desktop-EXE/
├─ Axiom.exe
├─ app.ico
├─ Microsoft.Web.WebView2.Core.dll
├─ Microsoft.Web.WebView2.WinForms.dll
├─ WebView2Loader.dll
├─ app/math-server.jar
├─ frontend/
└─ runtime/          内置 Java 17
```

日志在 `我的文档\Axiom\logs\client.log`；启动失败时也看同目录的 `startup-error.log`。
