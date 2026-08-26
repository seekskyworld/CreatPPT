# Contributing to CreatPPT

[简体中文](CONTRIBUTING.zh-CN.md)

Thank you for helping improve CreatPPT. The project is an Agent-first, Web-first presentation workspace: semantic content is compiled into a browser workspace, and PPTX is exported only after a person clicks **Export PPT**.

## Before you start

- Read the [README](README.md), [architecture notes](docs/architecture.md), and [Agent skill contract](SKILL.md).
- For behavior changes, open an issue first so the intended DeckSpec and user-facing contract are clear.
- Do not include `.golutra/`, `project/`, `node_modules/`, `dist/`, local delivery folders, credentials, or generated PPTX files in a pull request.

## Local setup

Node.js 20 or newer is required.

```bash
git clone https://github.com/seekskyworld/CreatPPT.git
cd CreatPPT
npm ci
npm run check
```

Useful focused commands:

```bash
npm test                    # unit and contract tests
npm run typecheck           # Vue and TypeScript checks
npm run build               # production Web client and Node CLI
npm run test:e2e            # development browser checks
npm run test:e2e:built      # production browser checks
npm run test:serve:built    # managed serve/health/stop lifecycle
npm run package:smoke       # isolated npm tarball and npx smoke
npm run audit:release       # production dependency audit
```

## Design and code boundaries

- Keep `deck.json` as the semantic source of truth. Do not make a screenshot or a pre-generated PPTX the generation contract.
- Put shared planning, schema, geometry, and quality behavior in `src/domain/`; keep UI-only state in `src/editor/` and Vue components.
- Preserve the three template grammars (`signal`, `editorial`, and `studio`). A template change should affect composition and image roles, not only colors.
- Add every visible editor string to both locales in `src/i18n.ts`. Check browser-language detection, manual switching, `<html lang>`, and persisted selection.
- New starter images need provenance and redistribution permission. Run `npm run assets:compress`, `npm run check`, and `npm run package:smoke` before proposing a release.
- Keep Web and PPTX renderers structurally aligned, but document application-level Office risks in `docs/compatibility-matrix.md` rather than promising pixel identity.

## Pull request checklist

Before requesting review, confirm:

- [ ] The change has a focused issue or clear problem statement.
- [ ] User-visible behavior is documented in the README or relevant `docs/` file.
- [ ] Unit/contract tests cover domain or export changes.
- [ ] Browser E2E covers editor, language, or interaction changes.
- [ ] English and Simplified Chinese UI strings are present where applicable.
- [ ] `npm run check`, `npm run audit:release`, and `npm run package:smoke` pass.
- [ ] No secrets, generated delivery files, unlicensed media, or unrelated refactors are included.

The CI workflow repeats the quality gates on Linux, macOS, and Windows with Node 20 and 22. A maintainer owns version bumps, tags, npm provenance publication, and GitHub Releases; contributors should not publish from personal tokens.

## Reporting bugs and proposing features

Use the repository [issue tracker](https://github.com/seekskyworld/CreatPPT/issues). Include the OS, Node version, package/source revision, exact command, browser, a minimal brief or DeckSpec, and the smallest reproducible result. Do not attach private decks or credentials.

For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue. Community participation follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
