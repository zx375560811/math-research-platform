# 前端设计说明

依据已安装的 Anthropic frontend-design 技能重设计。
来源：https://github.com/anthropics/skills/tree/main/skills/frontend-design

## 设计计划

数学专业研究工作台面向需要收集、阅读数学论文的人；专业方向是入口，文献是共用底层。

- 颜色：画布 #F3F6FB、内容 #FFFFFF、正文 #172D48、强调 #365BD8、淡蓝 #E6EDFF、次级文字 #61738B。
- 字体：中文优先等线与微软雅黑，拉丁使用 Trebuchet MS，数学符号使用 Cambria Math。
- 布局：桌面侧栏常驻，主区域左对齐；专业入口采用带说明的目录行；专业页并列文献与上传区域。手机将导航变为顶部可滚动列表。
- 原则：专业模块是主体，参数曲面感线稿作为单一视觉重点，文献与数量来自真实接口。

```text
专业导航 | 数学方向说明       数学线稿
         | 专业目录           未来应用说明
         | 最近加入的文献

专业导航 | 专业名称
         | 文献列表           上传表单
```

## 计划复核

原稿的宣传标题、统一卡片、重复眉题和装饰箭头容易成为通用展示页。新稿改为常驻导航与专业目录，减少装饰文字和无意义编号。保留上传状态、错误恢复、键盘焦点和手机适配，不加入尚未实现的研究项目、搜索或 AI 操作。

以截图复核桌面和手机排版，并运行导航、上传、下载、分页、错误恢复与内容转义检查。


## Morphicons redesign

Use Morphicons 1.7.1 DOM adapter, self-hosted with its MIT license. It animates paths; the mathematical and action paths in icons.js are original project artwork. Keep all icons on a 24×24 grid with round strokes. Morph the persistent file indicator: upload → document when selected, upload → check on success, warning on validation/network failure. Labels remain visible; no looping or hover-only animation. Set reducedMotion to user.

Palette: canvas #F3F6FB, paper #FFFFFF, ink #172D48, research blue #365BD8, soft blue #E6EDFF, secondary text #61738B. Typography: DengXian/Microsoft YaHei body; Trebuchet Latin; Cambria Math identity and equations. Left-align text.

Layout:
```
professional navigation | mathematical surface + reading invitation
                        | professional directory | future applications
                        | recent literature with download actions
professional navigation | subject title
                        | literature list | PDF intake and state feedback
```

Review: retain the surface mesh as the single memorable visual. Remove the decorative hero eyebrow; make the headline about research through reading. Differentiate the directory, future applications and upload form through spacing and surfaces. Do not expose a nonfunctional search or AI action. Mobile preserves the horizontal subject selector and stacks the upload form above literature.

## Stronger visual direction

Feedback: the pale blue workbench feels too quiet. Create a mathematical atlas: a substantial blue surface drawing, a midnight navigation rail, and a professional directory with visible mathematical notation.

Palette: midnight #152D50, atlas blue #254FCE, paper #FFFFFF, canvas #EDF1F7, warm section curve #FFC596, muted text #526783. Body: Microsoft YaHei/PingFang SC for a clear sans-serif Chinese voice; Cambria Math for mathematical notation only. Hero headline 44–50px desktop, 32px mobile. Left alignment throughout.

```text
midnight rail | headline + high-contrast saddle surface z=xy
              | professional atlas tiles | future applications
              | recent literature
```

Review before building: a dark navigation rail alone would still be a generic dashboard. Use a correctly projected hyperbolic paraboloid, including its highlighted cross-section, as the visual anchor. Give subject tiles notation derived from their disciplines. Keep the literature list and forms quiet and readable. No artificial metrics, fake features, neon, or automatic background animation. Retain Morphicons for actual upload state changes and respect reduced motion.


## Application boundary correction

The public homepage is an application launcher, not the literature library. Mathematics and Applied Mathematics contains subject reading, driven by the shared library. Remove all upload controls and browser write code. Public HTTP is read-only; literature ingestion belongs to a server administrator command. Retain the blue mathematical surface, midnight rail and Morphicons static action artwork; upload animation is no longer part of the public experience. Do not imply summaries, AI or knowledge extraction already exist.


## Accounts

Keep the application homepage. Put login/register and the signed-in name in the topbar. The account view pairs the mathematical blue identity with a simple white form; it stacks on mobile. Login-required application visits return to their original topic after authentication. Registration creates an ordinary application reader, never a literature administrator. No upload or admin entry is reintroduced.
