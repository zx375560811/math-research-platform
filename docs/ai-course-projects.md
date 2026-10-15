# 数学到人工智能：配套实验

每个实验按 **跟着做 → 自己补全 → 独立完成** 展开。教材负责概念与推导，实验负责把它们变成能解释、能检查的操作。GitHub 与官方教程放在参考资料中。

网页先显示课程教材，随后显示配套实验。四个入口分别为实验指导、下载练习文件、查看提示、核对结果。阶段勾选是用户自行确认的学习记录，按账号保存在数据库中，重新进入或跨设备登录后可以继续。勾选不会触发代码执行，也不代表平台已批改程序。

## 在电脑上开始

建议 Python 3.11 或 3.12，并为练习单独建立环境。下载 .ipynb 文件，按开头的命令安装相应库，再用 `jupyter notebook` 打开。

1. 先运行“跟着做”，解释输入与输出。
2. 在“自己补全”填写 TODO，重新运行函数和检查单元。初始模板返回 None，显示“待完成”，不会假装通过。
3. 在“独立完成”更换数据或条件，独立实现并解释结果。
4. 完成数值检查和复盘后，再勾选对应阶段。

文件包含示例、数据、检查单元与文件末尾的参考解答。计算在学习者自己的电脑运行，网页服务器不执行用户代码、不需要安装训练环境。机器学习与深度学习的数据由 scikit-learn 安装包提供，不额外下载大型数据集或模型。

## 实验与教材

| 课程 | 实验 | 教材范围与先修 | 成果 |
| --- | --- | --- | --- |
| 数学分析 | 函数、切线与数值导数 | 导数与切线；Python、NumPy、基础绘图 | 曲线、切线、差分误差 |
| 高等代数 | 矩阵如何变换平面 | Strang 的矩阵运算与线性变换；Python/NumPy | 旋转、拉伸、投影及组合 |
| Python | 我的学习记录统计 | 《Python 编程：从入门到实践》的字典、文件与可视化 | 日期和课程时长统计 |
| 机器学习 | 一步步完成鸢尾花分类 | Müller、Guido 第 1 章；Python/NumPy | 预测、准确率、混淆矩阵、错误样本 |
| 深度学习 | 两层网络识别手写数字 | 斋藤康毅第 1—5 章；矩阵、链式法则 | 梯度核对、损失曲线、数字识别 |
| PyTorch | 线性回归的完整训练过程 | D2L PyTorch 第 2 章、3.1—3.3 节 | 参数恢复与独立测试误差 |
| NLP | 教材简介关键词检索 | NLP in Action 第二版第 2—3 章 | TF-IDF 检索与边界处理 |
| LLM | 教材简介整理助手 | Hands-On LLM 的 Prompt Engineering 章；JSON | 格式校验与原文核对 |

概率继续保留教材练习，暂不放独立实验。数学课的编程实验先完成 Python 基础。自动求导和 SVD 可在相应知识完成后另加，当前不作为第一项实验。原有推荐教材关联不改动。

## 鸢尾花样板

跟着做：观察 150×4 的数据，固定种子得到 112 条训练和 38 条测试，运行 k=1 分类器，查看预测、新样本类别、混淆矩阵和错误样本。

自己补全：返回 model、predictions 和 accuracy，检查模型训练样本数量、预测形状及准确率计算。还需自己解释训练与测试为何分开。

独立完成：预先固定 k=3 和另一随机种子，独立实现并分析错误。不要求分数提高，不根据测试分数反复选择 k。程序检查不能替代对数据泄漏与泛化的理解。

## 数据和模型调用

学习记录与教材简介是明确标注的教学数据，不连接用户真实记录或文献库。数字识别使用 scikit-learn 内置的 8×8 手写数字，网络由 NumPy 实现，库只提供数据和划分。数据来源见 [官方 load_digits 文档](https://scikit-learn.org/stable/modules/generated/sklearn.datasets.load_digits.html)。

LLM Notebook 默认只读取示例响应，不联网、不计费。离线检查只验证解析逻辑，不能证明真实模型表现。真实实验可以在平台教材阅读器用默认或个人 API 提问，将回答粘贴进 Notebook；也可以在自己的电脑配置个人兼容 API，主动调用 call_model。密钥从环境变量或不回显输入读取，不保存到 Notebook 或 Git，不复制管理员默认密钥。

格式正确后仍需逐项核对原文，未提及的字段保持 null。无可用 API 时，真实模型部分仍未完成。

## 维护与验证

界面代码：frontend/learning-labs.js。文件目录：frontend/labs。登录后通过受限接口下载。重建文件：

```bash
python tools/build_learning_labs.py
```

验证八份 Notebook：

```bash
python -m pip install -r frontend/labs/requirements.txt
python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
python backend/tests/learning_notebooks.py
```

检查运行示例、未完成模板、参考答案和部分错误实现，阻止外部请求。Java 接口测试检查登录、CSRF、下载内容和用户隔离。数据库脚本还按实际服务语句边界检查启动和重复升级。

教材参考：[Müller、Guido 第 1 章](https://github.com/amueller/introduction_to_ml_with_python/blob/main/01-introduction.ipynb)、[斋藤康毅第 5 章](https://github.com/oreilly-japan/deep-learning-from-scratch/tree/master/ch05)、[D2L 线性回归](https://zh.d2l.ai/chapter_linear-networks/linear-regression-concise.html)、[Hands-On LLM](https://github.com/HandsOnLLM/Hands-On-Large-Language-Models)。
