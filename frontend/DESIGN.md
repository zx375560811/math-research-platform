---
name: Axiom 数学研究平台
description: 清晰内容、精确操作与连续阅读组成的数学研究工作台
colors:
  canvas: "#ffffff"
  white: "#ffffff"
  ink: "#252831"
  muted: "#626674"
  blue: "#4e54c8"
  soft-blue: "#eeeffb"
  line: "#e7e8ed"
  control-border: "#d9dbe4"
  rail: "#242733"
  rail-ink: "#eef0f6"
  rail-muted: "#bec4d5"
  panel: "#f7f8fa"
  primary-hover: "#4045b2"
  control-hover: "#f4f5f9"
  nav-active: "#45485e"
  nav-active-ink: "#ffffff"
  nav-hover: "#343848"
  field-placeholder: "#6b6f7c"
  surface-subtle: "#fafbfc"
  composer-focus: "#888ed6"
typography:
  display:
    fontFamily: "system-ui, 'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: "36px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "system-ui, 'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: "34px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "-0.03em"
  title:
    fontFamily: "system-ui, 'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "system-ui, 'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "system-ui, 'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.7
  math:
    fontFamily: "'Cambria Math', Georgia, serif"
rounded:
  control: "7px"
  badge: "5px"
  reader-control: "6px"
  container: "12px"
  flat: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  section: "24px"
  wide: "32px"
  desktop: "48px"
components:
  button:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
    height: "40px"
  button-hover:
    backgroundColor: "{colors.control-hover}"
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "42px"
  navigation-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.nav-active-ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  filter-container:
    backgroundColor: "transparent"
    rounded: "{rounded.flat}"
    padding: "0 0 24px"
  composer:
    backgroundColor: "{colors.surface-subtle}"
    rounded: "{rounded.container}"
    padding: "8px"
---

# Design System: Axiom 数学研究平台

## Overview

**Creative North Star: “数学研究工作台”**

用户确认的 canon 方向结合内容排版的清晰、控件的精确和文献组织的秩序。白色正文、炭灰导航、炭黑文字与克制的靛蓝操作色形成安静、可信、适合长时间阅读的工作空间。参考 [Notion](https://www.notion.com/)、[Linear](https://linear.app/) 与 [Zotero](https://www.zotero.org/) 的方向由用户确认；这里使用自己的品牌与现有组件，不复制其资产。

内容通过标题、段落留白、列表和细分隔线组织，操作通过适度圆角、清晰状态和可见焦点表达。沿用用户确认的连笔 Axiom 字标及“公理”副标题；品牌是 SVG，数学插图是现有代码图形，本轮没有新增栅格素材。Morphicons 沿用既有互动实现。

**Key Characteristics:**
- 正文优先，辅助信息清楚可读。
- 内容条目平坦组织，控件精确而克制。
- 用户工作区与管理后台使用同一视觉语言。
- PDF、笔记与 AI 共用连续白色阅读表面。

规范值以本文件 frontmatter 为准；`.impeccable/design.json` 补充焦点、深度、响应式与可直接预览的组件。代码依据为 [style.css](style.css)、[admin.css](admin.css)；产品约束见 [PRODUCT.md](PRODUCT.md)，本次页面表达见 [surface-brief.md](.impeccable/surface-brief.md)。当代码存在旧声明及覆盖声明时，以文件末尾有效覆盖为依据。

## Colors

靛蓝是操作墨色，冷灰是组织材料，白色是内容本身。

### Primary
- **操作靛蓝**：主按钮、链接、焦点、输入光标及选段提问的有效状态。
- **浅靛蓝**：语言标识与轻量状态，保持低饱和面积。
- **深靛蓝**：主按钮悬停反馈。

### Neutral
- **纸白**：正文画布、PDF 区、笔记和 AI 面板。
- **炭黑**：正文及品牌字标。
- **冷灰文字**：说明、导航和元数据。
- **炭灰导航 / 浅色文字**：用户与管理侧栏共用深色底，品牌与辅助文字分别使用 rail-ink 与 rail-muted。
- **冷灰面板**：管理编辑容器；文献筛选为透明底。
- **分隔灰与控件灰**：前者分隔内容，后者勾勒可操作输入。
- **近白表面**：轻量悬停、AI 上下文与设置。

**The Content First Rule.** 颜色区分操作、状态与正文层次；阅读器静止分界不能成为占据空间的色带。高亮黄、蓝、粉沿用各自标注语义，方向图形的局部色彩不升级为全站操作色。

## Typography

**Display Font / Body Font:** 系统无衬线，提供 Microsoft YaHei 和 PingFang SC 中文回退。标题不再采用旧宋体展示体系。**Math Font:** Cambria Math / Georgia，限数学符号；PDF 保留原文档字体。

字体层次来自字号、字重与段落节奏，而不是装饰字体或大写标签。

### Hierarchy
- **Display**：工作台标题采用固定桌面字号与较紧字距，手机为（29px）；方向详情桌面（36px），手机（29px）。
- **Headline**：模块主标题；管理标题采用自己的已实现尺寸，仍使用同一字体与字重。
- **Title**：段落和阶段标题；书名、文献名保留各自内容层次。
- **Body**：应用正文采用 frontmatter 的正文值；介绍段落常用较宽行高（1.8），行长上限（65ch），详细介绍上限（75ch）。
- **Label**：辅助、标签与控件文字；普通辅助文字最低（14px）。阅读器标题可以因紧凑空间调整，但正文和输入保持（16px）。

**The Readable Text Rule.** 不通过缩小正文或辅助文字换取密度；PDF 和数学公式按原文排版与缩放处理。

## Layout

桌面应用使用固定左侧导航（216px）、顶部栏（60px）和居中内容区（最大 1280px）。首页应用与真实方向入口组成双列工作台（1.2fr / 0.8fr），间距（44px），方向入口位于浅底面板。方向概览为横向索引，图形、名称、介绍、入口依次排列。方向详情采用左侧介绍（240px）与右侧阶段教材，介绍桌面粘附顶部（24px），中英文教材按阶段组织。

文档库搜索与按钮为主行，模块、方向、语种为次行；真实书目按文件类型、书名与作者、方向、语种、阅读操作五列对齐（42px / minmax(0,1fr) / 130px / 62px / 150px），间距（18px）。管理区正文上限（1700px），目录在左，编辑器在右（360px），两区间距（36px）。认证页仅呈现居中品牌与登录 / 注册模块，模块上限（430px），白底无阴影，当前标签用下划线。

在（1100px）内容留白及列距收窄，介绍列为（210px），教材语言列转单列，文档库五列为（36px / minmax(0,1fr) / 90px / 52px / 140px），后台编辑列为（300px）。在（900px）应用导航转顶部横向导航，首页与方向详情转单列，介绍取消粘附。管理区在（800px）转单列并恢复编辑区、目录区的文档顺序。手机（650px）左右留白（20px），方向图形仍在条目左侧；文档库表头隐藏，方向、语种及操作堆在书名下，分类次行为两列加一整行。品牌另有（380px）的窄屏适配。断点描述当前实现边界。

**The Continuous Paper Rule.** 阅读器独立于普通内容容器，占满可用高度，PDF 直达底部。目录默认关闭；标题行只保留目录、适合宽度、全屏操作。右侧笔记与 AI 同层延伸全高，桌面列为 PDF、拖动热区（6px）、右侧面板；桌面宽度及上下拖动几何沿用现有实现，笔记初始比例（35%）。手机右侧笔记优先初始宽度（184px），仍受可用空间与已保存尺寸约束。手机 AI 标题允许换行，来源控件收窄，操作行占满下一行。

高亮标记固定每行（30 个），每个方块（28px），间距（4px），展开按钮紧接第 30 个；窄面板在标记条自身横向滚动。AI 输入右侧始终是问 AI、发送两个上下紧邻按钮；窄容器将操作列收窄，不改变上下排列。选段按实际容器宽度自然换行，PDF 换行不强迫窄句。

## Elevation & Depth

常规内容依靠留白、轻微底色与细分隔线表达深度；应用条目、方向介绍和文献记录不增加外层浮起卡片。阅读器 PDF 页无阴影，静止拖动边界透明，悬停、聚焦或拖动时才显现。认证面板与标签无阴影；选中高亮编号保留内描边。具体阴影在 sidecar 中记录，不加入 frontmatter 的组件 schema。

**The Flat Workspace Rule.** 平坦内容是默认状态，阴影仅沿用现有状态提示，不成为每个区域的装饰。

## Shapes

控件使用 control 圆角，标签采用 badge 圆角，阅读器小控件采用 reader-control 圆角；编辑、方向辅助面板与输入组合用 container 圆角，筛选与认证模块直边无外框。内容条目通常直边无外框，局部圆角表面用于组织或输入。细线用于分区，避免重复嵌套边框。品牌字标不加底色胶囊或新的图形徽章。

## Components

### Buttons

克制、明确、可预测。普通按钮白底与细描边，主按钮为操作靛蓝；主按钮悬停使用深靛蓝，普通悬停轻微变灰。紧凑按钮最小高度（32px），普通按钮最小高度（40px），阅读器组合操作最小高度（38px）；frontmatter height 表达基准最小高度，不要求强制固定高度。禁用按钮降低透明度，保留禁用语义。

全局键盘焦点为操作靛蓝外描边（2px），偏移（3px）；品牌焦点偏移（5px），高亮编号沿用专门焦点样式。保留 Morphicons 的既有悬停与键盘焦点互动，不另加动画体系；减少动画偏好保留。

### Cards / Containers

文献、应用和管理记录以内容行及下分隔线组织；方向图形与正文作为相邻条目列。首页方向面板、方向介绍与管理编辑区用浅冷灰底，文献筛选透明，认证模块白底无阴影。AI 助手回答为平坦正文，不再套一层回答卡片；用户消息可用轻底色表达说话者。

### Inputs / Fields

白底、控件灰描边、control 圆角，普通输入使用正文尺寸。占位文字颜色单独记录，输入光标用操作色。认证输入聚焦边框变操作靛蓝；AI 组合输入聚焦使用 composer-focus 边框，textarea 的焦点由外框承接。错误提示与禁用态沿用已有语义，不能仅靠新装饰表达。

### Navigation

炭灰侧栏，当前项白字与较亮炭灰底，悬停白字与中间炭灰底。手机上导航保留自身横向滚动，不缩小导航字。管理员同用品牌、文字和控件色，布局仍服务于已有管理任务。

### Reading workspace

目录、笔记、AI 均使用白色。拖动时边界提供操作反馈，静止时连续。编号按标注颜色识别，展开内容位于编号行下方。选段区、AI 上下文与组合输入采用轻底色容器；问 AI 仅在有效选段状态显示有效主操作。富文本表格、公式、代码在自己的容器内滚动，不撑开面板。

## Do's and Don'ts

### Do:
- **Do** 从最终有效 CSS 提取与维护规范 token，更新文档时同步 sidecar。
- **Do** 保持正文和辅助文字的可读基准，使用留白与层次组织密度。
- **Do** 保留连续白色阅读表面、可见键盘焦点及减少动画偏好。
- **Do** 使用现有 Axiom SVG 品牌、数学图形和 Morphicons 互动。
- **Do** 根据已有内容与操作构建组件，让真实文献信息承担页面层次。

### Don't:
- **Don't** 恢复旧宋体展示标题、深蓝画布或多层浮起卡片体系。
- **Don't** 在 PDF 与侧栏之间添加静止色带、页阴影或底部占高的状态栏。
- **Don't** 改变 30 标记一行、默认关闭目录、右侧双竖排操作或桌面拖动几何。
- **Don't** 为视觉填充新增统计、上传入口、未实现应用或栅格素材。
