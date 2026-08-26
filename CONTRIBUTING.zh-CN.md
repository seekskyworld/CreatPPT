# 参与贡献 CreatPPT

[English](CONTRIBUTING.md)

感谢你帮助改进 CreatPPT。项目是 Agent-first、Web-first 的演示稿工作区：语义内容先编译为网页工作区，只有用户点击“导出 PPT”后才生成 PPTX。

## 开始之前

- 先阅读 [README](README.zh-CN.md)、[架构说明](docs/architecture.md) 和 [Agent Skill 契约](SKILL.md)。
- 行为变化建议先创建 Issue，明确 DeckSpec 和用户可见契约。
- PR 不要包含 `.golutra/`、`project/`、`node_modules/`、`dist/`、本地交付目录、凭据或生成的 PPTX。

## 本地设置

要求 Node.js 20 或更高版本。

```bash
git clone https://github.com/seekskyworld/CreatPPT.git
cd CreatPPT
npm ci
npm run check
```

常用检查命令：

```bash
npm test                    # 单元与契约测试
npm run typecheck           # Vue 与 TypeScript 检查
npm run build               # 生产网页客户端与 Node CLI
npm run test:e2e            # 开发浏览器检查
npm run test:e2e:built      # 生产浏览器检查
npm run test:serve:built    # serve/health/stop 生命周期
npm run package:smoke       # 隔离 npm 包与 npx 冒烟
npm run audit:release       # 生产依赖审计
```

## 设计与代码边界

- `deck.json` 是语义真源；不要把截图或预生成 PPTX 作为生成契约。
- 共享规划、schema、几何和质量逻辑放在 `src/domain/`；编辑器状态放在 `src/editor/` 和 Vue 组件。
- 保持 `signal`、`editorial`、`studio` 三套视觉语法的差异。模板变化应影响构图和图片角色，而不只是换颜色。
- 所有可见编辑器文本都要在 `src/i18n.ts` 的两个语言目录中补齐，并检查浏览器语言、手动切换、`<html lang>` 和持久化选择。
- 新 starter 图片必须记录来源并确认再分发许可。提 PR 前运行 `npm run assets:compress`、`npm run check` 和 `npm run package:smoke`。
- Web 与 PPTX 渲染器保持结构对齐；Office 应用级风险写入 `docs/compatibility-matrix.md`，不要承诺逐像素一致。

## PR 检查清单

- [ ] 有明确 Issue 或问题描述。
- [ ] 用户可见行为已写入 README 或对应 `docs/` 文档。
- [ ] 领域逻辑或导出改动有单元/契约测试。
- [ ] 编辑器、语言或交互改动有浏览器 E2E 覆盖。
- [ ] 相关 UI 文本同时提供 English 和简体中文。
- [ ] `npm run check`、`npm run audit:release`、`npm run package:smoke` 均通过。
- [ ] 没有提交密钥、生成交付物、未授权媒体或无关重构。

CI 会在 Linux、macOS、Windows 和 Node 20、22 上重复质量门。版本升级、tag、npm provenance 发布和 GitHub Release 由维护者负责；贡献者不要使用个人 token 发布。

## 报告问题与提出功能

请使用 [Issue 列表](https://github.com/seekskyworld/CreatPPT/issues)，提供系统、Node 版本、包/源码版本、完整命令、浏览器、最小 brief 或 DeckSpec，以及最小复现结果。不要上传私人演示稿或凭据。

安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，不要创建公开 Issue。社区参与遵循 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
