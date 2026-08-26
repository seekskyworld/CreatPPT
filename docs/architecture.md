# CreatPPT Architecture and Runtime Flow

This document describes the implementation that ships in CreatPPT 0.1.x. It is
the single technical reference for the repository: how an Agent request becomes
a Web presentation workspace, how edits are persisted, and how a person exports
an editable PPTX.

## 1. Product Boundary

CreatPPT is an Agent-first presentation workspace. Its durable output is a
directory containing a semantic `deck.json` and local media in `assets/`.
Generation never creates a PPTX. PPTX creation is an explicit browser action so
the person can review and edit the result first.

```text
brief or semantic JSON
        |
        v
CLI intake -> content plan -> deterministic planner -> scene elements
        |                                      |
        +------------ quality gates ----------+
        |
        v
delivery/deck.json + delivery/assets/
        |
        v
local Web workspace -> edit/autosave -> Export PPT -> editable PPTX download
```

## 2. Repository Layers

| Layer | Main locations | Responsibility |
| --- | --- | --- |
| CLI and orchestration | `src/cli.ts`, `src/cli-assets.ts` | Parse commands, read sources, materialize deliveries, start/stop servers, print JSON results |
| Semantic domain | `src/domain/` | Intake, content planning, layouts, templates, schema upgrades, asset provenance, geometry, quality and pipeline contracts |
| Web application | `src/App.vue`, `src/components/`, `src/editor/` | Render slides, select/edit elements, inspect styles, undo/redo, autosave and language switching |
| HTTP service | `src/server/` | Serve the built client and selected project directory; expose health, deck read and save endpoints |
| PPTX export | `src/export/pptx.ts` | Convert semantic slides and edited scene elements into native text, image, shape, line and chart objects |
| Build and release | `vite.config.*`, `tsup.config.ts`, `.github/workflows/` | Build browser and Node bundles, run quality matrices, package and publish the npm artifact |

The npm package contains the compiled `dist/`, starter assets, public
documentation and license. Source-only work directories, caches and generated
deliveries stay outside the package boundary.

## 3. Input and Planning Flow

### 3.1 Accepted inputs

`create --from` and `import` accept JSON, Markdown, HTML, plain text, or stdin.
JSON is classified in this order:

1. A supported semantic import shape is adapted into `DeckSpec`.
2. A `DeckSpec` is upgraded and planned.
3. Other structured content is compiled into a content plan.

Markdown and text are parsed by `src/domain/intake.ts`; headings and markers
such as Metrics, Timeline, Comparison, Gallery and Quote provide semantic hints.
An Agent supplies meaning and evidence, not pixel coordinates or exporter calls.

### 3.2 Content plan and layout candidates

`src/domain/content-plan.ts` turns input into page intents. The planner in
`src/domain/planner.ts` then:

- normalizes the document to schema version 2;
- assigns source and design context metadata;
- computes content budgets for titles, body copy, items and media;
- scores the supported layout catalogue (`cover`, `agenda`, `statement`,
  `metrics`, `split`, `comparison`, `chart`, `timeline`, `gallery`, `quote` and
  `closing`);
- preserves an explicitly authored layout as the first candidate; and
- records one to three deterministic `layoutCandidates` with localized rationale.

Templates (`editorial`, `signal`, `studio`) provide visual geometry and styling.
The selected template is recorded in the deck and can be changed in the Web
workspace without losing the semantic content.

### 3.3 Scene compilation

`ensureDeckElements` compiles semantic slide content into an optional `elements`
scene. Scene elements have stable IDs and independent geometry. Supported
editable primitives include text, image, rectangle, ellipse, line and arrow.
Existing `userEdited` elements are preserved during content-only updates.

## 4. Materialization and Assets

Before writing a delivery, the CLI creates a temporary staging directory. It
copies referenced user assets and the bundled starter library into `assets/`,
checks file signatures and dimensions, applies checksums to the asset manifest,
then writes `deck.json` and atomically renames the staging directory into place.
This prevents partially written deliveries.

Starter photographs are compressed to JPEG at build time by
`scripts/compress-starter-assets.mjs`; transparent starter PNGs remain PNG.
The published package unpacks these files automatically. User-provided media is
kept reference-driven and is not silently recompressed.

Every asset records an ID, source path, role, alt text, provenance and checksum
when available. IDs are unique across the deck, which prevents save failures
when the same visual is used in multiple contexts.

For automatic media filling, each template owns a six-image pool. The allocator
consumes that pool in a stable order and skips starter images already inserted
automatically in the current deck. It never mixes template pools or repeats an
automatic image after the pool is exhausted. Explicit Agent/user images are
preserved as authored and are not subject to this automatic de-duplication.

## 5. Quality Gates

`src/domain/pipeline.ts` combines the following checks:

- schema validity and unique slide/asset/element IDs;
- layout/content compatibility and selected-candidate consistency;
- text capacity and geometry bounds;
- required image validity, supported media type and useful alt text;
- template-specific scene geometry;
- asset existence, checksum and file-signature checks during materialization; and
- the internal showcase gate for representative cover and content pages.

Normal warnings are reported in the JSON result. `--strict` promotes warnings
to blocking failures for automation. A failed gate leaves no destination
directory behind, so the Agent can repair the source and retry.

## 6. Web Workspace Lifecycle

The CLI can serve a delivery in the foreground or as a managed background
process. `serve` records PID metadata outside the delivery directory. `health`
verifies both the process and its project path before reporting success;
`stop` refuses to signal a mismatched or unhealthy PID.

The HTTP service serves the compiled client plus the selected project files. The
browser loads `deck.json`, renders the current template, and keeps the semantic
slide model and scene model in sync. Save requests are validated server-side;
the client surfaces detailed validation errors instead of hiding a failed save.

## 7. Editing and Persistence

The editor supports direct text editing, image/text drop, drag movement,
marquee selection, multi-move, snapping guides, resize handles, rotation,
inspector-based geometry/style changes, keyboard nudges and undo/redo. Each
meaningful interaction is committed as one history transaction.

The saved document remains `deck.json`. Semantic fields remain the source of
meaning; scene elements preserve the user's visual adjustments. Before saving,
the client repairs stale layout-candidate selections and normalizes asset IDs;
the server applies the schema and cross-reference checks again.

## 8. PPTX Export Boundary

Export is intentionally outside the Agent generation path. When the person
clicks **Export PPT**, `src/export/pptx.ts` reads the current in-memory deck and
scene, maps text/media/shapes/lines/charts to native PPTX objects, and downloads
the generated file. The export path is on demand and does not change the
delivery's source-of-truth contract.

## 9. Internationalization

`src/i18n.ts` provides the English and Simplified Chinese catalogues used by the
Web UI, layout rationales, defaults, validation messages and editor controls.
The initial locale follows an explicit preference when present, otherwise the
browser language, and finally English. Switching language updates the UI without
changing deck content or asset references.

## 10. Agent Contract

The Agent-facing contract is documented in `SKILL.md` and is intentionally
semantic:

```bash
npx @seekskyworld/creatppt@latest create \
  --from ./brief.md --out ./delivery --template auto \
  --slides auto --serve --json
```

The Agent should pass a brief or semantic JSON, inspect `quality`, `warnings`,
`copiedFiles`, `url` and `pptxGenerated: false`, then hand the workspace to the
person. For an explicit lifecycle, run `create`, `serve`, `health` and `stop`
as separate commands. Agents should not author raw coordinates, HTML or PPTX
export calls.

## 11. Build, Test and Release

`npm run check` enforces dependency policy, TypeScript checking, the unit
contract suite and production builds. Browser and built-package smoke scripts
exercise the same create/serve/save path used by consumers. The release workflow
runs the quality matrix across supported operating systems and Node versions,
then publishes the public npm package and creates the matching GitHub Release.

The runtime engine requires Node.js 20 or newer. The package is Apache-2.0
licensed and exposes the `creatppt` binary through npm/npx.

## 12. Failure Recovery

- Non-empty destinations are rejected; choose a new output directory.
- Invalid or remote media should be replaced with a local JPEG, PNG or WebP.
- A quality error should be fixed at the brief, semantic JSON or asset level and
  regenerated; do not patch generated coordinates by hand.
- If a local client is missing, build the checkout before serving it.
- If a managed server is stale, use `health` and `stop`, then start a fresh
  server with an explicit project directory.

This flow keeps one durable representation, makes edits inspectable, and leaves
file generation under the person's explicit control.
