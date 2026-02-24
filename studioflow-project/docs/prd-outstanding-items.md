# PRD: Outstanding Items — Completing the Middle Layer and Scale-to-N

**Status:** Draft  
**Last updated:** 2026-02-24  
**Parent PRDs:** `prd-figma-cursor-middle-layer.md` (US-008), `prd-scale-to-n.md` (US-N04, US-N05, US-N06, US-N08)

---

## 1. Introduction / Overview

After implementing the middle-layer and scale-to-N PRDs, a focused set of items remain incomplete. These fall into two categories: one full story not yet started (component-aware proof), one story from the middle-layer PRD not yet implemented (Phase 3 verification log), and partial acceptance criteria from three completed stories (content roundtrip integration, sfid migration tooling, and documentation updates).

---

## 2. User Stories

### US-R01: Phase 3 verification log (bound / unbound / "could be styles")

**Origin:** Middle-layer PRD US-008.

**Description:** As a **design system maintainer**, I want a verification script that reads the conduit payload and token definitions, then reports which element properties would be bound (token or style), which would be unbound, and which "could be styles" — so I can improve coverage before applying in Figma.

**Acceptance Criteria:**

- [ ] Script exists at `scripts/verify-binding-coverage.mjs`, runnable via `npm run verify:binding-coverage`.
- [ ] Input: `handoff/code-to-canvas.json` (conduit payload with `tokens`, `tokenMapping`, `styleLayer`).
- [ ] Output to stdout: per-sfid list of properties with status (`BOUND_TOKEN`, `BOUND_STYLE`, `UNBOUND`, `COULD_BE_STYLE`).
- [ ] Output JSON artifact: `handoff/binding-coverage.json` with structure: `{ generatedAt, bindings[], summary: { bound, unbound, couldBeStyle, total } }`.
- [ ] Uses `conduit-metadata.mjs` `inferFigmaType()` and mapping data to determine binding status.
- [ ] Deterministic output (sorted by sfid, then property).
- [ ] `npm run check` passes.

### US-R02: Content integration into conduit roundtrip

**Origin:** Scale-to-N PRD US-N04 (partial acceptance criteria).

**Description:** As a **developer**, I want the content layer (`content/content.json`) integrated into the code-to-canvas payload and the canvas-to-code apply path so text content roundtrips through Figma.

**Acceptance Criteria:**

- [ ] `loop-code-to-canvas.mjs` reads `content/content.json` (if it exists) and includes a `content` field in the `code-to-canvas.json` payload.
- [ ] `loop-canvas-to-code.mjs` reads `content` from `canvas-to-code.json` (if present) and writes updates back to `content/content.json`.
- [ ] If `content/content.json` does not exist, both scripts skip content handling silently (backward compatible).
- [ ] `npm run check` passes.

### US-R03: sfid migration script

**Origin:** Scale-to-N PRD US-N05 (partial acceptance criteria).

**Description:** As a **developer migrating to namespaced sfids**, I want a script that renames flat sfids (e.g. `sfid:hero-root`) to namespaced sfids (e.g. `sfid:hero/root`) across source files, snapshots, and manifest.

**Acceptance Criteria:**

- [ ] Script exists at `scripts/migrate-sfids.mjs`, runnable via `npm run migrate:sfids`.
- [ ] Accepts a mapping via `--map` flag pointing to a JSON file (e.g. `{"sfid:hero-root": "sfid:hero/root", "sfid:hero-title": "sfid:hero/title"}`).
- [ ] Rewrites all occurrences in `src/**/*.{tsx,jsx,html}`, `snapshots/*.json`, and `studioflow.manifest.json`.
- [ ] Prints summary: files modified, replacements made.
- [ ] Dry-run mode via `--dry-run` flag that prints changes without writing.
- [ ] `npm run check` passes after migration (when mapping is correct).

### US-R04: Documentation updates for new commands

**Origin:** Scale-to-N PRD US-N08 (partial acceptance criteria).

**Description:** As a **developer or agent**, I want `AGENT.md` and `docs/STUDIOFLOW_WORKFLOW.md` updated with the new commands (`sync:push`, `sync:pull`, `scan:project`, `apply:token-map`, `extract:content`, `verify:binding-coverage`, `migrate:sfids`) so the operational docs are current.

**Acceptance Criteria:**

- [ ] `AGENT.md` Commands section includes all new npm scripts with one-line descriptions.
- [ ] `docs/STUDIOFLOW_WORKFLOW.md` Daily Operator Path section includes `sync:push` and `sync:pull` as the primary sync commands.
- [ ] `docs/STUDIOFLOW_WORKFLOW.md` references `scan:project` → `apply:token-map` as the onboarding path.
- [ ] No broken references or stale command names in either file.
- [ ] `npm run check` passes.

### US-R05: Component-aware proof system

**Origin:** Scale-to-N PRD US-N06.

**Description:** As a **developer or CI pipeline**, I want proof generation to support per-component targeting so I can verify individual components at each breakpoint.

**Acceptance Criteria:**

- [ ] `loop:proof` accepts a `--component` flag that filters screenshots to elements matching the sfid namespace (e.g. `--component hero` captures only `sfid:hero/*` elements).
- [ ] When `--component` is passed, screenshots are saved to `proof/latest/{component}/{breakpoint}.png` (e.g. `proof/latest/hero/mobile.png`).
- [ ] When no `--component` flag is passed, existing full-page behavior is preserved (backward compatible).
- [ ] HTML report includes component name in title when component-filtered.
- [ ] Summary JSON includes `component` field when filtered.
- [ ] `npm run check` passes.

---

## 3. Functional Requirements

- **FR-R1:** A binding coverage verification script must report bound/unbound/could-be-style status per sfid per property.
- **FR-R2:** The conduit payload must carry content data when `content/content.json` exists; the canvas-to-code path must write content updates back.
- **FR-R3:** A migration script must rename sfids across all source and config files with dry-run support.
- **FR-R4:** Operational documentation must reflect all current commands.
- **FR-R5:** Proof generation must support per-component filtering by sfid namespace.

---

## 4. Non-Goals

- Redesigning the proof HTML report template.
- Adding visual regression (pixel diff) to proof.
- Changing the Figma plugin to support component-level operations.
- Creating a `useContent()` React hook (deferred to a future iteration).

---

## 5. Open Questions

1. **Should `verify:binding-coverage` run as part of `npm run check`?**
   - A. Yes, add it to the check chain.
   - B. No, keep it separate (it requires conduit payload which may not exist).
   - C. Add it only when conduit payload exists (conditional gate).

---

## Checklist

- [x] Stories are small and single-deliverable.
- [x] Acceptance criteria are verifiable.
- [x] Origin PRD and story referenced for each item.
- [x] Non-Goals defined.
