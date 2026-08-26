---
name: creatppt
description: Generate a finished editable Web presentation workspace from a brief or semantic content, then let the user revise it in the browser and explicitly export PPTX on demand. Use when a user asks an Agent to make a PPT, presentation, slide deck, pitch deck, report, or proposal and wants the result delivered as a Web workspace instead of a pre-generated PPTX.
---

# CreatPPT

Create a completed presentation workspace as `deck.json` plus local assets. Do not generate, save, or return a PPTX during the Agent generation flow. PPTX generation belongs exclusively to the visible “导出 PPT” action in the Web workspace.

## Prerequisites

- Node.js 20 or newer.
- For the published package, invoke `npx @seekskyworld/creatppt@latest ...` directly.
- For a local checkout, run `npm ci && npm run build` once, then invoke `node <CREATPPT_ROOT>/dist/node/cli.js ...`.
- Run published-package smoke commands from the Agent's host project or a clean temporary directory, not from the CreatPPT source checkout; npm 11 can resolve the checkout's own package context instead of injecting the published bin.
- Keep `project/` and `.golutra/` outside the installed package; the package boundary contains only the runtime bundle, starter assets, docs, and license.
- The published client is already bundled and the Node CLI embeds its schemas; npm should install only `commander` at runtime. Do not install Vue, the icon library, JSZip, PPTXGenJS, or Zod separately for an npx run.
- The 18 bundled starter photographs are distributed as compressed JPEGs (transparent starter PNGs are kept as PNG). npm and npx unpack them automatically; Agents must not add a manual unzip step. User-provided PNG/JPEG/WebP files remain unchanged.

## Fast path (default)

Use this path for ordinary Agent requests. The Agent supplies meaning; CreatPPT plans page intent, selects deterministic layouts, applies a template, checks assets, and materializes the Web workspace in one command.

```bash
npx @seekskyworld/creatppt@latest create \
  --from ./brief.md \
  --out ./delivery \
  --template auto \
  --slides auto \
  --variants 2 \
  --serve --json
```

The source can be Markdown, HTML, plain text, semantic content JSON, a DeckSpec JSON, or `-` for stdin. Lightweight headings and markers such as `## Metrics`, `## Timeline`, `## Comparison`, `## Gallery`, and `## Quote` help the planner choose page intent; the Agent does not need to write page coordinates or exporter instructions.

Useful options:

- `--assets <dir>`: explicit local JPEG, PNG, or WebP assets. If omitted, an adjacent `assets/` directory is used, then the curated starter library is used as a transparent fallback.
- Generated deliveries include the full compressed starter library so switching Signal, Editorial, or Studio later cannot point at a missing local file; user assets remain reference-driven.
- `--strict`: make quality warnings blocking for automated pipelines.
- `--explain`: include layout candidates, budgets, and source information in the JSON result.
- `--port auto|<n>`: select a free local port when serving. `--open` opens the URL after starting it.
- `--background`: explicitly start a managed background server after creation (it implies `--serve` and returns immediately).
- `--foreground`: keep the server in the current process. Without it, `create --serve` starts a managed background process and returns immediately.

The output is only:

```text
delivery/
├── deck.json
└── assets/
```

Treat `pptxGenerated: false` as an invariant of this stage. Return the delivery path and, when requested, the workspace URL; do not attach a PPTX.

## Human editing handoff

The generated Web workspace is the human editing surface. It renders a finished deck immediately, then allows direct manipulation of independent text, image, rectangle, ellipse, line, and arrow elements: click or double-click text to edit, drag to move, marquee-select and multi-move, snap to canvas/peer guides, resize with handles, rotate, drop text/images onto the canvas, use the inspector for geometry and styles, and use undo/redo or keyboard nudges for precision. Changes are autosaved to `deck.json`.

Agents should not manufacture coordinates or HTML to simulate this editor. Semantic slides are compiled into the optional `elements` scene array at creation time. If an Agent receives a deck that already contains `elements`, preserve IDs and `userEdited` objects; do not regenerate them during a content-only handoff. PPTX is still generated only after the person clicks “导出 PPT”, and edited scene elements are emitted as native editable PPTX objects.

## Agent lifecycle

For an explicit non-blocking handoff, run the commands separately:

```bash
npx @seekskyworld/creatppt@latest create --from ./brief.md --out ./delivery --json
npx @seekskyworld/creatppt@latest serve ./delivery --background --port auto --json
npx @seekskyworld/creatppt@latest health ./delivery --json
```

When the user or orchestrator is finished with the local workspace:

```bash
npx @seekskyworld/creatppt@latest stop ./delivery --json
```

`serve --foreground` is suitable for a caller that owns the process lifetime. If `--pid-file <file>` is supplied to `serve`, pass the same file to `health` and `stop`; the commands verify that the recorded service reports the requested project path before trusting the PID. PID metadata is otherwise stored in the system temporary directory, never in the delivery directory.

## Expert path (precise control)

Use this only when the Agent needs exact semantic fields or migration fidelity. It is not required for a normal brief.

```bash
npx @seekskyworld/creatppt@latest validate ./work/deck.json --showcase --json
npx @seekskyworld/creatppt@latest create --from ./work/deck.json \
  --out ./delivery --variants 3 --explain --json
```

`DeckSpec` v2 remains the precise semantic contract. Keep every slide ID and asset ID unique, preserve `assetManifest` provenance, and reference stable local media as `assets/<file>`. The Agent still must not write raw coordinates, HTML, or PptxGenJS calls into the deck.

## Import and migration inputs

- `create --from` accepts JSON, Markdown, HTML, plain text, and stdin.
- `import <file>` accepts the same sources and supported semantic Dashi-shaped goal JSON; only meaning and media references cross the boundary. Reference runtimes, templates, and exporters stay isolated.
- `plan <file> --variants 1-3 --json` inspects deterministic candidates without creating a delivery directory.
- `validate <deck.json> --showcase --json` runs the internal grammar gate. It is a quality gate, not a user approval step.

## Authoring contract

Choose one template. When unspecified, use `editorial`:

- `editorial`: readable research, review, and point-of-view rhythm.
- `signal`: high-contrast product, technology, and strategy narrative.
- `studio`: bright production language for brand, creative, and workshop decks.

The planner supports `cover`, `agenda`, `statement`, `metrics`, `split`, `comparison`, `chart`, `timeline`, `gallery`, `quote`, and `closing`. Keep one main point per page. `cover`, `split`, and `gallery` need valid images and useful `alt` text. Prefer local JPEG, PNG, or WebP; remote URLs can fail during browser export because of CORS.

## Delivery rules

- `deck.json` is the only durable content source.
- Generation writes only `deck.json` and `assets/`; it never pre-generates PPTX.
- The user opens the finished Web workspace only when review or editing is useful, then clicks “导出 PPT”.
- Never call browser export code from the Agent workflow or claim a PPTX exists before that click.
- Do not modify the CreatPPT source repository or its `project/` reference repositories for a presentation request.
- Use `--json` for machine-readable orchestration. Preserve `quality`, `warnings`, `copiedFiles`, `elapsedMs`, URL/PID fields, and `pptxGenerated: false` in handoffs.

## Failure handling

- If the destination is non-empty, choose a new delivery directory; CreatPPT does not overwrite user files.
- If a quality error is reported, repair the source or replace the invalid asset and retry. `--strict` intentionally turns warnings into failures.
- If the server says the client is not built for a local checkout, run `npm run build` in `<CREATPPT_ROOT>`.
- If `health` cannot verify the recorded project path, do not signal the PID; inspect the URL or remove the stale metadata and start a fresh server.
- If an image blocks export, replace it with a valid local JPEG, PNG, or WebP and retry from the preserved Web editor state.

Maintainers adding a new starter PNG should run `npm run assets:compress` before publishing. The command is build-time only and is intentionally not part of `prepack`.
