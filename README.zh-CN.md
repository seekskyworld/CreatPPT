# CreatPPT

<p align="center">
  <a href="README.md">English</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/seekskyworld/CreatPPT/main/docs/assets/cover-cn.png" alt="CreatPPT 产品封面" width="1200" />
</p>

<h1 align="center">CreatPPT</h1>

<p align="center">
  <b>输入 brief，交付可编辑工作区。</b><br />
  给 Agent 一条命令，在网页中审阅和修改，确认完成后再导出 PPTX。
</p>

<p align="center">
  CreatPPT 是一个 Agent-first、Web-first 的演示稿工作区，把主题或 brief 变成结构化、可编辑的演示稿。
</p>

<p align="center">
  <a href="https://github.com/seekskyworld/CreatPPT/actions/workflows/ci.yml"><img src="https://github.com/seekskyworld/CreatPPT/actions/workflows/ci.yml/badge.svg" alt="CI 状态" /></a>
  <a href="https://github.com/seekskyworld/CreatPPT/actions/workflows/release.yml"><img src="https://github.com/seekskyworld/CreatPPT/actions/workflows/release.yml/badge.svg" alt="发布状态" /></a>
  <a href="https://www.npmjs.com/package/@seekskyworld/creatppt"><img src="https://img.shields.io/npm/v/%40seekskyworld%2Fcreatppt?logo=npm&logoColor=white" alt="npm 版本" /></a>
  <a href="https://www.npmjs.com/package/@seekskyworld/creatppt"><img src="https://img.shields.io/npm/dm/%40seekskyworld%2Fcreatppt?logo=npm&logoColor=white" alt="npm 下载量" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-3da639" alt="Apache License 2.0" /></a>
  <img src="https://img.shields.io/badge/platform-Web%20%7C%20macOS%20%7C%20Linux%20%7C%20Windows-2f7af8" alt="Web、macOS、Linux、Windows" />
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%E2%89%A520-339933?logo=nodedotjs&logoColor=white" alt="Node.js 20 或更高版本" /></a>
  <a href="https://vuejs.org/"><img src="https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white" alt="Vue 3" /></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white" alt="Vite 7" /></a>
  <img src="https://img.shields.io/badge/export-按需导出%20PPTX-f97316" alt="按需导出 PPTX" />
</p>

<p align="center">
  <a href="#zh-screenshots">界面截图</a> ·
  <a href="#zh-features">核心特性</a> ·
  <a href="#zh-architecture">架构</a> ·
  <a href="#zh-quick-start">快速开始</a> ·
  <a href="#zh-agent-workflow">Agent 使用</a> ·
  <a href="#zh-contributing">参与贡献</a> ·
  <a href="#zh-links">相关链接</a>
</p>

---

<a id="zh-screenshots"></a>

## 界面截图

<p align="center">
  <img src="https://raw.githubusercontent.com/seekskyworld/CreatPPT/main/docs/assets/flowchart-cn.png" alt="CreatPPT 生成与导出流程" width="1200" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/seekskyworld/CreatPPT/4674630/docs/assets/example-1.png" alt="CreatPPT 工作区示例 1" width="1200" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/seekskyworld/CreatPPT/4674630/docs/assets/example-2.png" alt="CreatPPT 工作区示例 2" width="1200" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/seekskyworld/CreatPPT/4674630/docs/assets/example-3.png" alt="CreatPPT 工作区示例 3" width="1200" />
</p>

第一屏就是已经完成的网页工作区，不是空白编辑器。Agent 负责叙事和排版，人只在需要确认、修改和导出时进入工作台。

<a id="zh-features"></a>

## 核心特性

### Agent 优先生成

- 支持标题、Markdown、HTML、纯文本 brief 和 DeckSpec JSON。
- 在渲染前规划受众、目的、叙事、布局、图片和质量约束。
- 交付 `deck.json` 与本地 `assets/`，不交付半成品页面，也不在生成阶段预生成 PPTX。

### 网页优先编辑

- 在 `1600 x 900` 画布中直接编辑文字、图片、矩形、圆形、线条和箭头。
- 支持拖拽、缩放、旋转、锁定、复制、删除、排序、对齐、吸附、框选和键盘微调。
- 内置自动保存、撤销/重做、页面排序、模板切换、演示模式和打印/PDF。

### 三套真正不同的视觉语法

`signal`、`editorial`、`studio` 在构图节奏、字体、信息密度、图片角色和证据呈现上各自不同。切换模板会改变视觉表达，同时保留用户内容和自定义素材。

### 用户确认后才导出

网页编辑器和 PPTX 导出器共享同一份语义 `DeckSpec`。用户点击“导出 PPT”后，文字、图片、形状、线条和图表才会生成原生 PPTX；Agent 生成阶段不会声称已经有 PPTX。

### 多格式交付与降级策略对比表

CreatPPT 支持 `web`、`pptx`、`pdf` 和 `png` 4 种交付格式。每种元素类型均有完整的 Web 表达能力与明确的 PPTX 降级策略：

| 元素类型 | Web 表达能力 | PPTX 降级策略 | PDF | PNG |
| --- | --- | --- | --- | --- |
| `text` | 完整富文本编辑与样式 | 原生 PPTX Text 文本框 | ✅ | ✅ |
| `image` | 自由变换与 Object Fit 适应 | 原生 PPTX Picture 图片对象 | ✅ | ✅ |
| `rect` / `ellipse` / `line` / `arrow` | 矢量形状与边框 | 原生 PPTX 矢量 Shape | ✅ | ✅ |
| `table` | 单元格编辑、公式联动计算与合并 | 原生 PPTX Table (导出计算后的数值) | ✅ | ✅ |
| `chart` | 交互 Tooltip (柱/饼/折线/散点/面积) | 原生 PPTX Chart 图表对象 | ✅ | ✅ |
| `form` | HTML 表单控件与数据提交 | 静态文本标签 + `[___]` 占位 | ✅ | ✅ |
| `embed` | 沙盒 iframe 嵌入与 Fallback | 降级图片 / 超链接文本 | ✅ | ✅ |
| `animation` | IntersectionObserver + CSS 动画 | 注入 OpenXML `<p:timing>` 节点 | 静态 | 静态 |
| `action` | 页面跳转与 URL 路由导航 | 原生 PPTX Shape/Text Hyperlink 超链接 | ✅ | 静态 |

### 完整国际化

编辑器支持 English 和简体中文。首次打开时读取 `navigator.languages` / `navigator.language`，用户手动选择后写入本地存储，并同步 `<html lang>`。

### npm / npx 快速交付

浏览器客户端在构建期打包，Node CLI 内联 schema，公开包运行时只保留 `commander`。starter 摄影素材已压缩为 JPEG，npm/npx 会自动下载和解包，不需要 Agent 手动处理。

### Agent 与 CI 质量门

发布链路包含 schema 校验、showcase 检查、素材检查、`serve/health/stop` 生命周期检查、包 smoke、依赖审计、桌面/移动端 E2E，以及 Linux/macOS/Windows + Node 20/22 矩阵。

<a id="zh-architecture"></a>

## 架构

```text
brief.md / deck.json / stdin
              |
              v
        CLI 输入与规划
              |
       DeckSpec v2 + 素材
              |
              v
   validate -> quality -> create
              |
              v
       网页交付工作区
       （deck.json + assets/）
              |
       用户编辑 / 自动保存
              |
              v
       浏览器 PPTX 导出器
              |
              v
          可编辑 .pptx
```

主要边界保持清晰：

| 层 | 职责 |
| --- | --- |
| `src/domain/` | DeckSpec schema、输入、规划、模板、布局、几何和质量规则 |
| `src/cli.ts` | Agent 编排用的 `create`、`import`、`plan`、`validate`、`serve`、`health`、`stop` |
| `src/components/` | 网页编辑器、画布交互、检查器、页面列表和演示模式 |
| `src/editor/` | 选择、历史、自动保存、自由元素和模板状态 |
| `src/export/` | 用户触发的按需 PPTX 生成 |
| `src/server/` | 本地交付文件 API 与静态工作区服务 |
| `starter/` | 压缩后的模板素材 |

`deck.json` 是持久化语义源。网页和 PPTX 共享内容模型与几何令牌，但使用两个渲染器；项目承诺结构有效、基础元素可编辑和视觉语言一致，不承诺所有 Office 版本逐像素一致。

<a id="zh-quick-start"></a>

## 快速开始

要求：Node.js 20 或更高版本，`npx` 随 npm 提供。

### 使用公开 npm 包

```bash
npx @seekskyworld/creatppt@latest create "产品发布方案" \
  --out ./delivery \
  --template editorial \
  --slides 11 \
  --background --open --json
```

命令会创建完整网页工作区并输出 URL。打开网页，检查页面，修改需要修改的内容，确认后点击“导出 PPT”。生成命令只写 `deck.json` 和 `assets/`。

### 从 brief 开始

```bash
cat > brief.md <<'EOF'
---
audience: 产品与设计负责人
purpose: 对齐下一次发布
template: studio
language: zh-CN
---

# 一份聚焦的发布计划

> 每页一个决定，并给出证据和下一步。
EOF

npx @seekskyworld/creatppt@latest create --from ./brief.md \
  --out ./delivery --serve --open --json
```

如果只想先创建文件、之后再打开，可以去掉 `--serve --open`，再运行 `npx @seekskyworld/creatppt@latest serve ./delivery --open`。

### 在 DeepSeek Harness 中使用

CreatPPT 同时作为可安装的 DeepSeek Harness bundle 发布。使用 Harness CLI 安装到 profile：

```bash
dsh plugin --profile web add @seekskyworld/creatppt
```

bundle 会注册一个可供模型调用的 `create_presentation` 工具。传入标题或 brief 后，它复用同一条 CreatPPT 流程，并返回交付目录、网页工作区 URL、页数、图片摘要和警告。普通 `npx` 命令仍然可用；bundle 不会增加第二套确认流程，也不提供额外的原生 Harness UI。

本地开发时先构建仓库，再将当前 checkout 安装到 profile：

```bash
npm ci
npm run build
dsh plugin --profile web add .
```

bundle 清单位于 `package.json` 的 `dsh.bundle`，`cordis.patch.yml` 负责挂载 `@seekskyworld/creatppt/dsh` 入口。DeepSeek Harness 目前仍是技术预览版，发布新的 bundle 版本前请针对兼容的 Harness 版本进行验证。

### 从源码运行

```bash
npm ci
npm run build
node dist/node/cli.js create --from ./brief.md \
  --out ./delivery --serve --open --json
```

<a id="zh-agent-workflow"></a>

## Agent 使用流程

Agent 应在 CreatPPT 源码目录之外工作，把结构化结果交给人或下一个 Agent：

```bash
npx @seekskyworld/creatppt@latest validate ./work/deck.json --showcase --json
npx @seekskyworld/creatppt@latest create --from ./work/deck.json \
  --out ./delivery --variants 3 --json
npx @seekskyworld/creatppt@latest serve ./delivery \
  --host 127.0.0.1 --port auto --background --json
npx @seekskyworld/creatppt@latest health ./delivery --json
# 网页审阅完成后
npx @seekskyworld/creatppt@latest stop ./delivery --json
```

JSON 结果包含 `projectDir`、`deckPath`、schema 版本、质量摘要、URL、PID，以及固定的 `pptxGenerated: false`。Agent 不应打开空白编辑器让人审批，不应手动解压 starter 素材，也不应在用户要求前导出 PPTX。

每个模板拥有 6 张 starter 图片。自动填充只使用当前模板图片池，按稳定顺序分配，并保证同一 deck 内自动插入的图片不重复。其余 starter 图片被复制到交付目录，只是为了后续切换模板时本地资源仍然可用。Agent 或用户明确指定的图片按原样保留，不参与自动去重。网页审阅完成前请保留返回的 URL；执行 `stop` 后该 URL 会失效。

JSON 响应包含 `media.total`、`media.automatic`、`media.manual` 和 `media.uniqueSources`，Agent 可以据此汇报页面实际使用的图片，而不是把复制到目录的完整 starter 图片库当成已使用素材。维护者新增模板时增加一个注册对象和 6 张图片，然后运行常规测试和构建命令。

### 人与 Agent 的职责

| 人 | Agent |
| --- | --- |
| 确认含义、品牌、图片和最终措辞 | 理解 brief 并规划叙事 |
| 在网页工作区做高价值修改 | 校验 schema、素材、密度和布局 |
| 审阅后点击“导出 PPT” | 返回交付目录和可选本地 URL |

### 模板与页面意图

| 模板 | 视觉语言 | 适合表达 |
| --- | --- | --- |
| `signal` | 深色、高对比、证据导向 | 产品策略和技术叙事 |
| `editorial` | 明亮、克制、重阅读 | 研究、复盘和观点报告 |
| `studio` | 明快、留白、强调过程 | 品牌提案和创意工作坊 |

支持的页面意图包括 `cover`、`agenda`、`statement`、`metrics`、`split`、`comparison`、`chart`、`timeline`、`gallery`、`quote` 和 `closing`。

<a id="zh-contributing"></a>

## 参与贡献

```bash
npm ci
npm run check
npm run audit:release
npm run test:e2e
npm run test:e2e:built
npm run test:serve:built
npm run package:smoke
npm pack --dry-run
```

提交 PR 时请说明用户可见行为，保持 DeckSpec 契约，并为布局、导出、编辑器交互或发布边界变化补充测试。界面改动应同时检查 English/简体中文以及桌面/移动端。

提交 PR 或报告敏感问题前，请阅读[贡献指南](CONTRIBUTING.zh-CN.md)、[安全策略](SECURITY.md)和[行为准则](CODE_OF_CONDUCT.md)。

Pull Request 和 `main` 推送会在 Linux、macOS、Windows 以及 Node 20、22 上运行质量矩阵。匹配 `v<package.version>` 的 tag 会继续执行浏览器与包检查、依赖审计、GitHub Actions OIDC npm provenance 发布和 GitHub Release 创建。

<a id="zh-links"></a>

## 相关链接

- [项目仓库](https://github.com/seekskyworld/CreatPPT)
- [npm 包](https://www.npmjs.com/package/@seekskyworld/creatppt)
- [Releases](https://github.com/seekskyworld/CreatPPT/releases)
- [Issues](https://github.com/seekskyworld/CreatPPT/issues)
- [Linux.do - 社区讨论](https://linux.do/)
- [架构与实际链路](docs/architecture.md)
- [Agent Skill 契约](SKILL.md)
- [贡献指南](CONTRIBUTING.zh-CN.md)
- [安全策略](SECURITY.md)
- [行为准则](CODE_OF_CONDUCT.md)

## 许可证

CreatPPT 代码和文档以 [Apache License 2.0](LICENSE) 发布。第三方依赖、字体、图片、品牌资产和用户提供的素材分别遵循自己的许可证；发布演示稿或 starter 素材前请确认再分发权利。

公开包名为 `@seekskyworld/creatppt`。npm 和 npx 会自动解包运行时与压缩后的 starter 素材；包内不包含 `.golutra/`、`project/`、构建缓存或生成交付目录。
