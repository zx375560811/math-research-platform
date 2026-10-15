# 数学到人工智能：教材配套实验

实验以具体教材、版本和章节为单位，使用作者或出版社提供的代码。课程流程图、教材阅读器与 Morphicons 互动继续沿用，教材列表仍在实验上方。

## 页面使用

1. 选择课程和正在阅读的教材。平台按书名识别已关联 PDF，提供“阅读这本教材”；无法确认对应 PDF 时显示“教材 PDF 待关联”，不会绑定无关文献。
2. 选择章节，查看该章的学习内容。四本教材提供站内原始代码预览，多个 Python 文件可以切换。
3. “打开原始实验”进入固定提交的章节；“下载配套代码”从原作者 GitHub / GitLab 下载该版本的完整 ZIP。保留数据、公共函数和目录结构，避免单文件下载导致导入失败。
4. 在“运行说明”中核对依赖和数据，按教材要求在自己的电脑或推荐的云端 Notebook 环境运行。
5. 完成实验后勾选“已完成”。记录按账号、教材和章节保存，可以取消，不表示平台自动批改过代码。

同一课程的不同教材各自有章节和进度，不共用旧的三阶段勾选。教材切换不会移动文献或重置阅读页码、笔记和学习计划。

## 已核实来源（2026-10-15）

| 课程 | 教材与版本 | 章节入口 | 站内预览 | 来源 |
| --- | --- | ---: | --- | --- |
| Python | Python 编程：从入门到实践，第一版 | 20 | 作者入口 | [Eric Matthes / pcc](https://github.com/ehmatthes/pcc) |
| Python | 利用 Python 进行数据分析，第二版 | 13 | 原始代码单元 | [Wes McKinney / 2nd-edition](https://github.com/wesm/pydata-book/tree/2nd-edition) |
| 机器学习 | Python 机器学习基础教程，第一版 | 7 | 作者入口 | [Müller / introduction_to_ml_with_python](https://github.com/amueller/introduction_to_ml_with_python) |
| 机器学习 | 动手学机器学习，张伟楠、赵寒烨、俞勇 | 15 | 作者入口 | [教材官网](https://hml.boyuai.com/)指向的 [boyu-ai / Hands-on-ML](https://github.com/boyu-ai/Hands-on-ML) |
| 深度学习 | 深度学习入门：基于 Python 的理论与实现，第一卷 | 8 | 原始 Python 文件 | [O’Reilly Japan](https://github.com/oreilly-japan/deep-learning-from-scratch) |
| PyTorch | 动手学深度学习，第二版 PyTorch | 16 节 | 原始代码单元 | [官方 PyTorch Notebook](https://github.com/d2l-ai/d2l-zh-pytorch-colab) |
| NLP | Natural Language Processing in Action，第二版 | 12 | 出版社入口 | [出版社](https://www.manning.com/books/natural-language-processing-in-action-second-edition)指向的 [Tangible AI / nlpia2](https://gitlab.com/tangibleai/nlpia2/) |
| LLM | Hands-On Large Language Models，2024 版配套代码 | 12 | 原始代码单元 | [作者官方仓库](https://github.com/HandsOnLLM/Hands-On-Large-Language-Models) |

合计 103 个章节入口，49 份本地代码预览，约 350 KB（含许可证与来源记录）。这些数字表示接入范围，不表示全部实验已在当前依赖环境运行成功。数学分析、高代、概率暂无核实的原配仓库，保留教材习题安排。

## 版本与运行环境

- `pcc` 是第一版资源，已归档。部分 Pygal、外部 API、Django 和部署代码依赖旧版本，不能用第三版资源替代第一版 PDF。
- 数据分析使用 `2nd-edition` 对应提交。样例数据从完整仓库获取，旧 pandas API 需匹配相应环境。
- Müller 的 README 仍提到 scikit-learn 0.20.0。运行需保留 `mglearn`、`preamble.py` 与数据文件，使用原环境或经过核验的兼容方案。
- D2L 使用官网链接的 PyTorch 生成仓库，不混入其他框架。接入 2.1—2.6、3.2、3.3、3.6、3.7、4.2、4.3、4.5、4.6、6.2、6.6 节。
- NLP 第二版官方资源在 GitLab，不能用第一版 GitHub 仓库替代。预出版 PDF 以章节标题对应。
- Hands-On LLM 作者主要在 Colab T4 16GB GPU 上测试。部分代码下载模型或调用外部 API；预出版 PDF 与仓库可能章节编号不同，按主题标题对应。

平台只预览代码，不执行安装、训练、模型下载或 API 调用。运行环境和所需额度由学习者按实际实验准备。

## 来源与授权

所有章节入口和下载固定到已核实提交，不随默认分支自动漂移。站内预览仅提取代码，保留代码顺序，不复制 Notebook 正文、HTML 输出、图片、模型或数据集。

斋藤康毅和 Wes McKinney 的代码为 MIT；D2L 和 Hands-On LLM 的代码为 Apache-2.0。D2L 的官方生成代码同时记录原始源码仓库许可证。每本镜像教材附 `LICENSE.txt` 和 `NOTICE.txt`。其他四本直接提供作者或出版社入口，不复制内容。

维护位置：

- `tools/textbook_lab_sources.json`：教材、版本、章节路径、许可证与固定提交。
- `backend/src/main/resources/textbook-labs.json`：生成后的接口目录。
- `frontend/labs/upstream/{book}/{chapter}.json`：代码快照，每个原文件附 SHA-256。

## 更新和部署

代码预览已经随 Git 保存。服务器不需要运行同步工具，也不需要安装训练环境。SSH 终端执行一整行：

```bash
cd /opt/math-platform && git pull --ff-only && cd backend && ./mvnw -B package && systemctl restart math-platform && curl --retry 15 --retry-connrefused --retry-delay 1 -fsS http://127.0.0.1:8080/api/health
```

浏览器强制刷新，进入 `/#/apps/math-to-ai`。管理端 `admin#ai-learning` 继续从文献库关联相应 PDF。

维护者更新源代码时，先核对版本与授权、修改维护清单，再手动执行（Python 3.9+）：

```bash
python tools/sync_textbook_labs.py
python backend/tests/textbook_labs.py
```

同步工具仅读取固定版本的代码，不执行上游程序。Git 忽略的下载缓存位于 `frontend/tests/artifacts/textbook-source-cache`，不需上传服务器。

## 接口与验证

| 方法 | 登录后接口 | 功能 |
| --- | --- | --- |
| GET | `/api/learning-labs/catalog` | 教材、版本、章节与固定来源 |
| GET | `/api/learning-labs/progress` | 当前账号的章节完成记录 |
| GET | `/api/learning-labs/{book}/chapters/{chapter}/preview` | 清单允许的本地原始代码 |
| PUT | `/api/learning-labs/{book}/chapters/{chapter}/progress` | 带 CSRF 的 `{ "completed": true/false }` |

`textbook_lab_progress` 按账号、教材、章节保存。旧 `learning_lab_progress` 表保留历史记录，旧自编练习文件、生成器与接口退出当前功能。

离线审计检查固定来源、授权和代码提取范围；开发缓存存在时核对每份原文件摘要与代码单元。Java 测试实际启动服务，验证登录、CSRF、全部预览及两个账号的进度隔离。浏览器验证教材识别、章节切换、原始文件选择、失败重试、代码纯文本显示、进度记忆、手机布局，以及课程切换不重建流程图。
