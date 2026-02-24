# PRD: Scale to N — Universal Project Onboarding and Multi-Component Workflow

**Status:** Draft  
**Last updated:** 2026-02-24  
**Companion PRD:** `docs/prd-figma-cursor-middle-layer.md` (Phases 2–3: conduit, sync, verification)

---

## 1. Introduction / Overview

StudioFlow is currently a workflow engine — deterministic token management, sfid anchoring, conduit generation, contract verification, and proof capture — demonstrated through a single Hero component. The workflow works. The limitation is scope: one component, flat sfid namespace, content embedded in JSX, proof tied to that one page, and no path for onboarding an existing project that doesn't already use tokens.

This PRD defines the changes needed to make StudioFlow applicable to **any coded design project** at **any component count**. It introduces Universal Phase 1 (automated project onboarding), a content extraction layer, namespaced sfids, a standalone proof system, and a reactive bridge for dev-time feedback.

**Problem:** A team with an existing React project cannot adopt StudioFlow without manually tokenising their codebase, restructuring sfids, and rewiring their build. There is no automated path from "existing project with hardcoded styles" to "StudioFlow-managed project with full roundtrip capability."

**Relationship to middle-layer PRD:** The middle-layer PRD (`prd-figma-cursor-middle-layer.md`) covers Phases 2–3 (conduit generation, sync, verification, trust ledger, error taxonomy). This PRD covers Phase 1 (onboarding/tokenisation) and Phase 4 (proof at scale), plus structural changes (content layer, namespaced sfids, reactive bridge) that span all phases.

---

## 2. Goals

- **Zero-to-roundtrip onboarding:** Any React project can be scanned, mapped, and rewired into a StudioFlow-managed project through a deterministic pipeline with LLM-assisted naming.
- **Multi-component support:** sfid namespacing, component-scoped token frames, and proof capture work for N components, not just Hero.
- **Content separation:** Static content (copy, URLs, alt text) is extracted from JSX into a structured content layer so design and content concerns are independent.
- **Standalone proof:** Proof generation works for any number of pages/components and can run in CI without the demo site.
- **Reactive feedback:** Token and sfid violations surface during development, not just at gate time.

---

## 3. Architecture Context

### Current four-phase model

| Phase | Name | Current State |
|-------|------|---------------|
| 1 | **Tokenize** | Manual. `verify-no-hardcoded` and `report-token-coverage` detect violations after the fact, but there is no automated rewiring path. |
| 2 | **Generate** | Working. `conduit:generate` produces `code-to-canvas.json` + mapping artifact. |
| 3 | **Sync** | Working. Plugin/Conduit applies payload to Figma; `loop:verify-canvas` + `loop:canvas-to-code` syncs back. |
| 4 | **Verify + Prove** | Working for one page. `loop:proof` captures screenshots, runs gates, generates HTML report. |

### What this PRD changes

| Phase | Change |
|-------|--------|
| 1 | Adds Universal Phase 1 pipeline (SCAN → MAP → APPLY) for automated onboarding. |
| 2–3 | Adds namespaced sfids and content layer support to conduit payloads (extends middle-layer PRD). |
| 4 | Makes proof system component-aware and CI-friendly. |
| Cross-cutting | Adds reactive bridge (dev-time feedback) and content extraction layer. |

---

## 4. User Stories

### US-N01: Phase 1a — SCAN (deterministic hardcoded detection)

**Description:** As a **developer onboarding a new project**, I want a script that scans my source files and produces a structured inventory of every hardcoded style value (colors, units, calc expressions) and every component boundary so I know exactly what needs tokenising.

**Acceptance Criteria:**

- [ ] Script exists (e.g. `scripts/scan-project.mjs`) and is runnable via `npm run scan:project`.
- [ ] Input: glob patterns for source files (default: `src/**/*.{ts,tsx,js,jsx,css}`), configurable via CLI flag or `studioflow.workflow.json`.
- [ ] Output: JSON artifact (e.g. `handoff/scan-report.json`) containing:
  - `hardcodedValues[]`: each entry has `file`, `line`, `column`, `rawValue`, `cssProperty` (if detectable), `category` (color / unit / calc / arbitrary).
  - `components[]`: each entry has `file`, `name`, `sfidCandidates[]` (elements with existing `data-sfid` or top-level component roots).
  - `summary`: `{ totalFiles, totalHardcoded, byCategory: { color, unit, calc, arbitrary }, componentCount }`.
- [ ] Reuses existing `hardcoded-detect.mjs` regex library; does not duplicate detection logic.
- [ ] Output is deterministic (sorted by file, then line) and diff-friendly.
- [ ] `npm run check` still passes.

### US-N02: Phase 1b — MAP (LLM-assisted semantic naming)

**Description:** As a **developer or agent**, I want an LLM skill that reads the scan report and proposes semantic token names for each hardcoded value — clustering near-duplicates, suggesting category prefixes, and flagging values that may be intentional constants vs design tokens.

**Acceptance Criteria:**

- [ ] A skill definition exists (e.g. `.agents/skills/tokenize-map/SKILL.md`) that an MCP-capable client can invoke.
- [ ] Input: `handoff/scan-report.json` + `tokens/figma-variables.json` (existing tokens to avoid conflicts).
- [ ] Output: JSON artifact (e.g. `handoff/token-map.json`) containing:
  - `proposedTokens[]`: each entry has `name` (semantic, following existing naming convention), `value`, `category`, `sourceLocations[]` (file:line references from scan), `isNewToken` (boolean), `existingTokenMatch` (name of existing token if value is close/identical, else null).
  - `duplicateClusters[]`: groups of scan entries that resolve to the same proposed token.
  - `skipped[]`: values flagged as intentional constants (e.g. `z-index: 1`, animation keyframe values) with reason.
- [ ] Naming follows existing convention: `{category}-{semantic-name}` (e.g. `color-brand-accent`, `space-card-padding`).
- [ ] Skill is non-destructive: produces a proposal artifact only; does not modify source files.
- [ ] Token map is deterministic given the same scan report (LLM output is structured, not free-form prose).

### US-N03: Phase 1c — APPLY (deterministic file rewrite)

**Description:** As a **developer**, I want a script that reads the approved token map and rewrites source files — replacing hardcoded values with `var(--token-name)` references and adding new tokens to `figma-variables.json` — so the project is fully tokenised in one pass.

**Acceptance Criteria:**

- [ ] Script exists (e.g. `scripts/apply-token-map.mjs`) and is runnable via `npm run apply:token-map`.
- [ ] Input: `handoff/token-map.json` (approved, possibly hand-edited after MAP).
- [ ] Actions:
  - Adds new tokens to `tokens/figma-variables.json` (preserving existing structure, sorted insertion).
  - Rewrites each `sourceLocation` in source files: replaces the raw value with `var(--{token-name})`.
  - Runs `npm run build:tokens` to regenerate CSS/TS.
- [ ] Produces a summary: `{ tokensAdded, tokensReused, filesModified, replacementsMade }`.
- [ ] Does not modify values that were marked `skipped` in the token map.
- [ ] After apply, `npm run verify:no-hardcoded` passes (or reports only the explicitly skipped values).
- [ ] `npm run check` still passes after apply + build.

### US-N04: Content layer extraction

**Description:** As a **developer or designer**, I want static content (headings, body copy, button labels, image URLs, alt text) extracted from JSX into a structured content file so that design layout and content are independently editable and syncable.

**Acceptance Criteria:**

- [ ] Script exists (e.g. `scripts/extract-content.mjs`) and is runnable via `npm run extract:content`.
- [ ] Output: JSON artifact (e.g. `content/content.json`) containing entries keyed by sfid:
  ```json
  {
    "sfid:hero-title": { "text": "Build with confidence", "element": "h1" },
    "sfid:hero-subtitle": { "text": "Design-to-code...", "element": "p" },
    "sfid:hero-primary-cta": { "text": "Get started", "element": "button" }
  }
  ```
- [ ] Components can read from the content file at build time or runtime (e.g. via a `useContent(sfid)` hook or build-time injection).
- [ ] Content file is included in `code-to-canvas.json` so Figma receives canonical copy.
- [ ] Round-trip: content changes in Figma (text overrides) can be captured in `canvas-to-code.json` and applied back to `content.json`.
- [ ] `npm run check` still passes.

### US-N05: Namespaced sfids

**Description:** As a **developer scaling beyond one component**, I want sfids to use a hierarchical namespace (e.g. `sfid:hero/title`, `sfid:pricing/card-1/price`) so components don't collide and the sfid tree maps naturally to component hierarchy.

**Acceptance Criteria:**

- [ ] sfid format supports `/` as namespace separator: `sfid:{component}/{element}` (e.g. `sfid:hero/root`, `sfid:hero/title`, `sfid:pricing/card-1/cta`).
- [ ] `workflow-utils.mjs` `sanitizeId()` permits `/` in sfids.
- [ ] `verify:id-sync` validates namespaced sfids correctly.
- [ ] `loop-code-to-canvas.mjs` groups sfids by namespace in the conduit payload (e.g. `sfidsByComponent`).
- [ ] Figma plugin creates corresponding page/frame hierarchy from sfid namespaces.
- [ ] Backward compatible: existing `sfid:hero-root` style sfids continue to work (treated as flat namespace).
- [ ] Migration path documented: script or instructions to rename existing sfids from flat to namespaced.
- [ ] `npm run check` still passes.

### US-N06: Component-aware proof system

**Description:** As a **developer or CI pipeline**, I want proof generation to capture screenshots and run gates for each component independently, not just the full page, so I can verify individual components at each breakpoint.

**Acceptance Criteria:**

- [ ] `loop:proof` accepts a `--component` flag (or reads from config) to target specific components by sfid namespace.
- [ ] Proof output includes per-component screenshots at each breakpoint (e.g. `proof/latest/hero/mobile.png`, `proof/latest/pricing/desktop.png`).
- [ ] HTML report includes a component index with per-component status and screenshots.
- [ ] Proof can run without the full demo site: component isolation mode renders a single component in a minimal shell.
- [ ] CI-friendly: proof generation exits with non-zero code if any gate fails; artifacts are deterministic paths suitable for CI caching.
- [ ] `npm run check` still passes.

### US-N07: Reactive bridge (dev-time feedback)

**Description:** As a **developer running `npm run dev`**, I want token and sfid violations to appear in the browser overlay and terminal in real-time, not only when I run `npm run check`, so I catch issues as I write code.

**Acceptance Criteria:**

- [ ] A Vite plugin or middleware exists (e.g. `scripts/lib/vite-studioflow-plugin.mjs`) that runs `verify-no-hardcoded` and `verify-id-sync` checks on file save.
- [ ] Violations appear in the Vite dev server terminal output with file:line references.
- [ ] Optionally: a browser overlay (similar to Vite's error overlay) shows current violation count and details.
- [ ] Performance: incremental — only re-checks the changed file, not the full source tree.
- [ ] Does not block HMR; violations are warnings, not errors (unless configured otherwise).
- [ ] `npm run check` still passes.

### US-N08: Unified sync entry points

**Description:** As a **developer or agent**, I want a single pair of commands for the full roundtrip (`npm run sync:push` and `npm run sync:pull`) that handle all the sub-steps, so I don't need to remember the sequence of build, generate, verify, apply commands.

**Acceptance Criteria:**

- [ ] `npm run sync:push` runs: `build:tokens` → `loop:code-to-canvas` → prints conduit path and next steps.
- [ ] `npm run sync:pull` runs: `loop:verify-canvas` → `loop:canvas-to-code` → `build:tokens` → `check`.
- [ ] Both commands emit structured status output (using existing UX ledger conventions).
- [ ] Both commands stop on first failure with classified error code and recovery hint (using `conduit-errors.mjs`).
- [ ] Existing granular commands (`loop:code-to-canvas`, `loop:verify-canvas`, etc.) remain available for advanced use.
- [ ] Documented in `AGENT.md` and `docs/STUDIOFLOW_WORKFLOW.md`.
- [ ] `npm run check` still passes.

---

## 5. Functional Requirements

- **FR-N1:** The system must provide a deterministic scan script that inventories all hardcoded style values and component boundaries in source files, outputting a structured JSON report.
- **FR-N2:** The system must provide an LLM skill that reads the scan report and proposes semantic token names with duplicate clustering, producing a structured token map artifact.
- **FR-N3:** The system must provide a deterministic apply script that reads an approved token map, adds tokens to `figma-variables.json`, rewrites source files to use `var(--token-name)`, and regenerates build artifacts.
- **FR-N4:** The system must support extraction of static content from JSX into a structured content file keyed by sfid, with roundtrip capability through the conduit payload.
- **FR-N5:** sfids must support hierarchical namespaces using `/` as separator, with backward compatibility for flat sfids.
- **FR-N6:** Proof generation must support per-component targeting and component isolation mode, with CI-friendly exit codes and deterministic artifact paths.
- **FR-N7:** A reactive dev-time check must surface token and sfid violations on file save during `npm run dev`, without blocking HMR.
- **FR-N8:** The system must provide unified sync entry points (`sync:push`, `sync:pull`) that compose existing commands with structured error reporting.

---

## 6. Non-Goals (Out of Scope)

- **Framework support beyond React:** This PRD targets React + Vite + plain CSS. Vue, Svelte, or other framework support is a later extension.
- **Multi-file token sources:** `figma-variables.json` remains the single token source. Theme layering or per-component token files are out of scope.
- **Figma plugin rewrite:** The plugin is extended to support namespaced sfids and content, but not rewritten from scratch.
- **CMS or i18n integration:** The content layer is a build-time JSON file, not a CMS connector or full i18n system.
- **Visual regression testing:** Proof captures screenshots for review; pixel-diff comparison is a later extension.

---

## 7. Design Considerations

### Universal Phase 1 pipeline

The onboarding pipeline is three deterministic steps with one LLM-assisted step:

```
SCAN (deterministic) → MAP (LLM skill) → APPLY (deterministic)
     scan-report.json     token-map.json     modified source + tokens
```

**SCAN** reuses `hardcoded-detect.mjs` (the same regex library used by `verify-no-hardcoded` and `report-token-coverage`). No new detection logic — one shared library, three consumers.

**MAP** is the only non-deterministic step. It runs as an LLM skill (not a script) because semantic naming requires judgment: `#7A8DFF` should become `color-brand-primary`, not `color-hex-7a8dff`. The skill produces a structured artifact that a human or agent reviews before APPLY runs.

**APPLY** is fully deterministic. Given the same token map and source files, it produces the same output. It does not make naming decisions.

### Content layer

Content extraction is keyed by sfid, which means namespaced sfids (US-N05) should land before or alongside content extraction (US-N04). The content file is a flat JSON object — not nested by namespace — to keep lookups simple.

### sfid namespacing

The `/` separator was chosen because:
- It maps naturally to Figma's page/frame hierarchy.
- It's valid in HTML `data-*` attribute values.
- It enables glob-style matching (e.g. `sfid:hero/*` for all Hero elements).
- Existing flat sfids (`sfid:hero-root`) remain valid — no `/` means root namespace.

### Reactive bridge

The Vite plugin approach is preferred over a standalone watcher because:
- Vite already has file-watching and HMR infrastructure.
- Plugin can filter to only check changed files (incremental).
- Browser overlay uses Vite's existing error overlay mechanism.
- No additional process to manage.

### Interaction language

All new script output follows existing conventions:
- Deterministic status labels (`OK`, `WARN`, `BLOCKED`).
- ASCII structure, no decorative emoji.
- Error codes from `conduit-errors.mjs` taxonomy (extended as needed).
- Machine-readable JSON artifacts alongside human-readable console output.

---

## 8. Technical Considerations

### Dependencies

- All new scripts use existing libraries: `hardcoded-detect.mjs`, `token-utils.mjs`, `workflow-utils.mjs`, `conduit-errors.mjs`.
- No new npm dependencies for SCAN, MAP skill definition, or APPLY.
- Reactive bridge requires no new dependency (Vite plugin API is built-in).
- Content extraction may use existing AST tooling if JSX parsing is needed, or regex for simple cases.

### File layout for new artifacts

| Artifact | Path | Gitignored |
|----------|------|------------|
| Scan report | `handoff/scan-report.json` | Yes |
| Token map | `handoff/token-map.json` | Yes |
| Content file | `content/content.json` | No |
| Component proof | `proof/latest/{component}/{breakpoint}.png` | Yes |

### Command surface (new npm scripts)

| Script | Purpose |
|--------|---------|
| `npm run scan:project` | Phase 1a — produce scan report |
| `npm run apply:token-map` | Phase 1c — apply approved token map |
| `npm run extract:content` | Extract content from JSX to content.json |
| `npm run sync:push` | Unified code → Figma |
| `npm run sync:pull` | Unified Figma → code |

### Backward compatibility

- Namespaced sfids are additive. Existing flat sfids work without changes.
- New conduit payload fields (`content`, `sfidsByComponent`) are optional. Existing consumers ignore unknown fields.
- `sync:push` and `sync:pull` compose existing commands — they do not replace or modify the underlying scripts.
- Proof system defaults to full-page mode if no `--component` flag is passed.

### Migration path

For existing StudioFlow projects (currently just the demo):
1. Run `scan:project` to get baseline report.
2. Rename sfids from `sfid:hero-root` to `sfid:hero/root` (one-time, script-assisted).
3. Run `extract:content` to pull copy into `content/content.json`.
4. Update `studioflow.workflow.json` with component registry if needed.
5. Run `npm run check` to verify everything still passes.

---

## 9. Success Metrics

- **Onboarding time:** A new React project with ~50 hardcoded style values can go from zero to passing `npm run check` in under 30 minutes using the SCAN → MAP → APPLY pipeline.
- **Token coverage:** After APPLY, `npm run report:token-coverage` shows ≥95% tokenised with zero violations (excluding explicitly skipped values).
- **Component scale:** Proof system generates correct per-component screenshots for a project with ≥3 components.
- **Dev feedback latency:** Reactive bridge surfaces violations within 500ms of file save.
- **Roundtrip integrity:** Namespaced sfids survive a full code → Figma → code roundtrip with zero sfid loss.
- **Content fidelity:** Text content modified in Figma and synced back matches the content.json update.

### Test Cases and Scenarios

1. **SCAN accuracy**
   - Seed a test project with known hardcoded values; confirm scan report finds all of them with correct file:line.
   - Run scan twice on unchanged source; confirm identical output.

2. **MAP → APPLY roundtrip**
   - Generate token map from scan report; apply it; confirm `verify:no-hardcoded` passes.
   - Confirm new tokens appear in `figma-variables.json` with correct structure.
   - Confirm source files contain `var(--token-name)` at every previously-hardcoded location.

3. **Namespaced sfid verification**
   - Add components with `sfid:pricing/card-1/cta` and `sfid:hero/title`; confirm `verify:id-sync` passes.
   - Confirm conduit payload groups sfids by namespace.
   - Confirm Figma plugin creates matching frame hierarchy.

4. **Content roundtrip**
   - Extract content; modify text in Figma; sync back; confirm `content.json` updated.
   - Confirm component renders correct text from content file.

5. **Component proof**
   - Run `npm run loop:proof -- --component hero`; confirm only Hero screenshots generated.
   - Run without flag; confirm all components captured.

6. **Reactive bridge**
   - Add a hardcoded color during `npm run dev`; confirm warning appears in terminal within 1 second.
   - Fix the violation; confirm warning clears.

---

## 10. Open Questions

1. **Should the MAP skill run automatically after SCAN, or require explicit invocation?**
   - A. Automatic: `scan:project` → immediately invokes MAP skill → outputs both artifacts.
   - B. Explicit: `scan:project` outputs scan report; operator runs MAP skill separately; then runs `apply:token-map`.
   - C. Configurable: default to explicit; `--auto-map` flag chains them.

2. **Content layer granularity: per-component files or single file?**
   - A. Single `content/content.json` with all sfid-keyed content.
   - B. Per-component files: `content/hero.json`, `content/pricing.json`.
   - C. Single file with namespace grouping: `{ "hero": { "title": ... }, "pricing": { ... } }`.

3. **Reactive bridge: Vite plugin or standalone watcher?**
   - A. Vite plugin (preferred — reuses Vite's file watching and overlay).
   - B. Standalone `chokidar` watcher running as a separate process.
   - C. Both: Vite plugin for dev, standalone for non-Vite projects (future).

4. **Priority order for implementation?**
   - A. Foundation first: US-N05 (namespaced sfids) → US-N01–N03 (Phase 1 pipeline) → US-N04 (content) → US-N06 (proof) → US-N07 (bridge) → US-N08 (unified sync).
   - B. Onboarding first: US-N01–N03 (Phase 1 pipeline) → US-N05 (sfids) → US-N08 (sync) → US-N04 (content) → US-N06 (proof) → US-N07 (bridge).
   - C. Quick wins first: US-N08 (sync) → US-N05 (sfids) → US-N01 (scan) → US-N06 (proof) → US-N02–N03 (map/apply) → US-N04 (content) → US-N07 (bridge).

5. **sfid migration for existing projects: automated or manual?**
   - A. Provide a migration script (`npm run migrate:sfids`) that renames flat sfids to namespaced.
   - B. Document the rename manually; operator uses find-and-replace.
   - C. Support both flat and namespaced indefinitely; no migration needed.

---

## Checklist (PRD quality)

- [x] User stories are small and specific (one deliverable per story).
- [x] Acceptance criteria are verifiable (scripts run, files exist, gates pass).
- [x] Functional requirements are numbered and unambiguous.
- [x] Non-Goals section defines clear boundaries.
- [x] Technical considerations include backward compatibility and migration.
- [x] Relationship to companion PRD (middle-layer) is documented.
- [x] Open questions include lettered options for prioritisation and scope.
