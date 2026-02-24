# PRD: Figma–Cursor Middle Layer

**Status:** Active  
**Last updated:** 2026-02-24  
**Source plan:** `docs/DESIGN_SYSTEM_AND_FIGMA_SYNC.md` (Improvements 1–13)

---

## 1. Introduction / Overview

The “middle layer” between Figma and Cursor is the set of artifacts and workflows that keep design (Figma) and code (Cursor/codebase) aligned: token source, conduit payload (code-to-canvas), Conduit MCP / Figma plugin behaviour, and verification. Today this layer is partially implemented; gaps cause ambiguity (e.g. which tokens are variable-bound vs resolved, no coverage report, no style layer in the conduit). This PRD turns the 13 refinements from the design system doc into an actionable, verifiable plan so the middle layer is deterministic, auditable, and easy to operate from Cursor and from Figma.

**Problem:** Designers and agents cannot reliably know what will sync, what failed, or how to fix sync errors. The conduit file and plugin do not expose a style layer or element–property mapping; verification does not flag “could be styles.”

---

## 2. Goals

- **Single source of truth** for design system standard (spacing, typography, colours, breakpoints) and for code↔Figma token mapping.
- **Observable middle layer:** Coverage report (Phase 1), verification log with bound/unbound and “could be styles” (Phase 3), and a clear error taxonomy with recovery hints.
- **Deterministic, diff-friendly conduit:** Schema/versioning, stable ordering, and one MCP-friendly entry point (“generate conduit from code”).
- **Style layer in conduit:** Semantic styles (Card, Button, Text/Body) and special styles (e.g. gradient) defined in the conduit with element–property→token/style mapping so Figma and Cursor agree on what gets applied.

---

## 3. User Stories

### US-001: Design system standard document

**Description:** As a **design system maintainer**, I want a single canonical document that defines the design system standard (8+2 spacing, typography scale, colour roles, radii, motion, four breakpoints) so that Cursor, the plugin, and humans all reference the same spec.

**Acceptance Criteria:**

- [ ] New file `docs/DESIGN_SYSTEM_STANDARD.md` exists and defines: spacing scale (8 base + 2 micro with names), typography scale (sizes, weights, line-heights), colour roles, radii, motion, four breakpoints (names + widths).
- [ ] `docs/DESIGN_SYSTEM_AND_FIGMA_SYNC.md` references this doc in Section 1 and in Improvements.
- [ ] `npm run check` (or equivalent) still passes.

### US-002: Token coverage report script

**Description:** As a **developer or agent**, I want a script that scans `src/` (and style files) and outputs a token coverage report (token usage per category, hardcoded properties with file:line, summary %) so I can see what is not yet tokenised.

**Acceptance Criteria:**

- [ ] Script exists (e.g. `scripts/report-token-coverage.mjs`) and is runnable via npm script (e.g. `npm run report:token-coverage`).
- [ ] Output includes: list of token names by category (color, space, font, etc.), list of hardcoded style usages with file path and line number, and a summary line (e.g. “X% tokenised, Y violations”).
- [ ] Output is deterministic (e.g. sorted) so it can be diffed or committed as artifact.
- [ ] `npm run check` still passes.

### US-003: Conduit schema / version field

**Description:** As a **plugin or MCP client**, I want the conduit payload to have a defined schema or version so I can validate and evolve the format without breaking consumers.

**Acceptance Criteria:**

- [ ] `handoff/code-to-canvas.json` includes a version field (e.g. `conduitVersion` or `handoffVersion`) and is documented in the design system doc.
- [ ] `scripts/loop-code-to-canvas.mjs` (or equivalent) sets this field from workflow or constant.
- [ ] Document supported version(s) and where to find the schema (or key shape) in `docs/DESIGN_SYSTEM_AND_FIGMA_SYNC.md` or `DESIGN_SYSTEM_STANDARD.md`.
- [ ] `npm run loop:code-to-canvas` produces valid payload; `npm run check` passes.

### US-004: Bidirectional mapping table (code ↔ Figma)

**Description:** As a **developer or agent**, I want a single mapping table that lists code token name, CSS `var(--…)` name, Figma variable grouped name, Figma type, and bindable Figma properties so the middle layer is unambiguous.

**Acceptance Criteria:**

- [ ] A mapping artifact or doc section exists (e.g. generated from token source or maintained in `docs/`) with columns: code token name, CSS var name, Figma grouped name, Figma type (COLOR/FLOAT/STRING), bindable Figma properties (or “resolved” where not bound).
- [ ] Design system doc or DESIGN_SYSTEM_STANDARD references this mapping; plugin and Cursor workflows can consume it.
- [ ] `npm run check` passes.

### US-005: MCP-friendly “generate conduit” entry point

**Description:** As an **MCP client (e.g. Cursor)**, I want a single documented way to generate the conduit file from code (e.g. one npm script or one MCP tool) so I don’t have to remember or guess the sequence of commands.

**Acceptance Criteria:**

- [ ] One npm script (e.g. `npm run conduit:generate`) runs `build:tokens` and `loop:code-to-canvas` and prints the path to the conduit file (e.g. `handoff/code-to-canvas.json`).
- [ ] This flow is documented in `docs/DESIGN_SYSTEM_AND_FIGMA_SYNC.md` and in AGENT.md or CONDUIT_SETUP.md.
- [ ] `npm run conduit:generate` succeeds and produces valid conduit file; `npm run check` passes.

### US-006: Diff-friendly conduit output

**Description:** As a **developer**, I want the conduit file (and any verification report) to be deterministic and diff-friendly so git diffs and reviews catch unintended changes.

**Acceptance Criteria:**

- [ ] Conduit file is written with sorted keys and stable ordering of tokens and modes. Canonical ordering rules: object keys sorted lexicographically; token arrays sorted by `name`; modes in fixed list order (`mobile`, `tablet`, `laptop`, `desktop`); mapping rows sorted by `codeTokenName`.
- [ ] Any verification report (e.g. coverage, binding log) uses stable ordering where it writes lists.
- [ ] Re-running the generator twice yields identical output (or documented exceptions).
- [ ] `npm run check` passes.

### US-007: Error taxonomy and recovery hints

**Description:** As a **developer or agent**, I want the plugin and verification to emit a small set of known error types with recovery hints so I can fix sync failures without guessing.

**Acceptance Criteria:**

- [ ] A short error taxonomy is documented (e.g. in design system doc or CONDUIT_SETUP): e.g. “token missing in Figma”, “mode mismatch”, “sfid not found”, “style creation failed” with recommended recovery (e.g. “re-run plugin”, “add token to figma-variables.json”).
- [ ] Each error emits a machine-readable JSON payload: `{ "code": "TOKEN_MISSING", "title": "...", "cause": "...", "fastestFix": "...", "safeFallback": "..." }`.
- [ ] Plugin or verification log emits these codes where applicable; at least `TOKEN_MISSING` and `SFID_NOT_FOUND` are covered by test fixtures.
- [ ] `npm run check` passes.

### US-008A: Pre-apply binding coverage report

**Description:** As a **design system maintainer**, I want a script that reads the conduit payload and token definitions, then reports which element properties would be bound (token or style), which would be unbound, and which “could be styles” — so I can improve coverage before applying in Figma.

**Acceptance Criteria:**

- [ ] Script exists at `scripts/verify-binding-coverage.mjs`, runnable via `npm run verify:binding-coverage`.
- [ ] Input: `handoff/code-to-canvas.json` (conduit payload with `tokens`, `tokenMapping`, `styleLayer`).
- [ ] Output to stdout: per-sfid list of properties with status (`BOUND_TOKEN`, `BOUND_STYLE`, `UNBOUND`, `COULD_BE_STYLE`).
- [ ] Output JSON artifact: `handoff/binding-coverage.json` with structure: `{ generatedAt, bindings[], summary: { bound, unbound, couldBeStyle, total } }`.
- [ ] `COULD_BE_STYLE` classification rule: property is unbound by token, but matches a style-eligible property set (e.g. `fills`, `strokes`, `textStyle`) and the node type supports Figma styles.
- [ ] Deterministic output (sorted by sfid, then property).
- [ ] `npm run check` passes.

### US-008B: Post-apply verification audit (deferred)

**Description:** As a **design system maintainer**, I want a verification step after applying the conduit in Figma that reads actual node property state and confirms which bindings succeeded, which failed, and why — so I can audit what happened.

**Acceptance Criteria:**

- [ ] Plugin emits raw binding result data (node ID, property, outcome) after apply.
- [ ] A script consumes this raw data and produces the human/agent-friendly log listing: bound properties, failed bindings with cause, and “could be styles” suggestions.
- [ ] Result is written to a file (e.g. `handoff/binding-audit.json` or `proof/`).
- [ ] Documented in design system doc and CONDUIT_SETUP.
- [ ] `npm run check` passes.

**Note:** US-008B depends on plugin instrumentation and is deferred until US-008A is validated. Ship US-008A first.

### US-009: Style layer in conduit (semantic + gradient, element–property mapping)

**Description:** As a **designer or developer**, I want the conduit file to define semantic styles (Card, Button, Text/Body) and special styles (e.g. gradient brand → +20hue) and to map elements (e.g. by sfid) and properties to tokens or styles so Figma and code stay aligned.

**Acceptance Criteria:**

- [ ] Conduit payload (or extended schema) includes: named styles (e.g. Card, Button, Text/Body) as token→property sets; at least one special style (e.g. gradient); mapping from element identifier (e.g. sfid) + property to token or style name.
- [ ] Plugin or Conduit can create/update Figma styles and assign them to nodes using this mapping.
- [ ] Design system doc describes the style layer and mapping format.
- [ ] `npm run check` passes; conduit generator produces the new fields (or placeholder structure).

### US-010: Trust Ledger (shared run state across Cursor and Figma)

**Description:** As an **operator**, I want one consistent run-state panel in Cursor and Figma so I can see exactly what is safe, blocked, or complete without checking multiple logs.

**Acceptance Criteria:**

- [ ] A shared trust ledger artifact exists for each run (e.g. `handoff/trust-ledger.json`) and is updated at each stage.
- [ ] Cursor CLI and Figma plugin display the same canonical states: `READY`, `PREVIEW_READY`, `COMMIT_IN_PROGRESS`, `COMMIT_BLOCKED`, `COMMIT_DONE`.
- [ ] Ledger includes deterministic fields: `runId`, `conduitVersion`, `tokenCount`, `modeCoverage`, `sfidCoverage`, `styleAssignments`, `lastReceiptId`, `blockingIssues`.
- [ ] UI rendering uses strict ASCII structure with no decorative emoji and no confidence/probability language.
- [ ] `npm run check` passes.

### US-011: Preview → Commit with immutable receipts

**Description:** As an **operator**, I want every apply to use preview-first and explicit commit with a receipt so changes are intentional, reviewable, and reversible.

**Acceptance Criteria:**

- [ ] New preview flow exists (CLI and plugin trigger) that performs diff + validation with no source mutation.
- [ ] Commit flow requires explicit confirmation against the latest preview `runId`.
- [ ] Commit writes immutable receipt artifact (e.g. `proof/receipts/<timestamp>-<runId>.json`) containing changed tokens/styles/sfids and gate outcomes.
- [ ] If source changed after preview, commit is blocked with a deterministic error code and fix instruction.
- [ ] `npm run check` passes.

### US-012: Frictionless Fix (single best next action per error)

**Description:** As an **operator**, I want every failure to give one precise fix command/action so recovery is immediate and unambiguous.

**Acceptance Criteria:**

- [ ] Error taxonomy includes machine-readable codes with fields: `code`, `title`, `cause`, `fastestFix`, `safeFallback`.
- [ ] CLI and plugin surface exactly one recommended next action first; alternate fallback is shown second.
- [ ] Recovery message format is concise and copy-pasteable (for CLI) or one-click executable/copyable (plugin).
- [ ] Known errors map to deterministic recovery hints (e.g. missing token, mode mismatch, sfid missing, style apply failure).
- [ ] `npm run check` passes.

### US-013: Band Mode presence bridge (shared “you are here” context)

**Description:** As an **operator**, I want Cursor and Figma to share current target context so I can move between tools without losing orientation.

**Acceptance Criteria:**

- [ ] A shared context artifact exists (e.g. `handoff/band-context.json`) with `screen`, `breakpoint`, `sfid`, `selectionPath`, `updatedAt`.
- [ ] Figma selection updates context; CLI reads and displays it in the next relevant command output.
- [ ] CLI commands can set context intentionally (e.g. `--screen`, `--sfid`) and plugin reflects it.
- [ ] Stale context detection exists (`updatedAt` TTL) and warns with deterministic wording.
- [ ] `npm run check` passes.

---

## 4. Functional Requirements

- **FR-1:** The system must provide a single canonical document (`DESIGN_SYSTEM_STANDARD.md`) that defines spacing, typography, colour roles, radii, motion, and four breakpoints.
- **FR-2:** The system must provide a script that scans source and style files and outputs a token coverage report (token usage by category, hardcoded usages with file:line, summary %).
- **FR-3:** The conduit payload must include a version field and have documented schema or key shape; the generator must set the version.
- **FR-4:** The system must provide a bidirectional mapping (code token ↔ CSS var ↔ Figma variable name/type and bindable properties) in a single artifact or doc section.
- **FR-5:** The system must provide one npm script that generates the conduit file from code and prints its path.
- **FR-6:** The conduit file and any verification reports must be written with deterministic, diff-friendly ordering.
- **FR-7:** The system must document an error taxonomy (sync/plugin/verification errors) with machine-readable codes and recovery hints; plugin or verification must emit these where applicable.
- **FR-8A:** The system must provide a pre-apply binding coverage script that reads the conduit payload and reports per-sfid binding status (`BOUND_TOKEN`, `BOUND_STYLE`, `UNBOUND`, `COULD_BE_STYLE`) with a JSON artifact.
- **FR-8B:** (Deferred) After applying the conduit in Figma, a post-apply verification step must produce a log listing actual binding outcomes and failures.
- **FR-9:** The conduit payload must support a style layer: semantic styles, special styles (e.g. gradient), and element–property→token/style mapping; the plugin or Conduit must be able to apply them in Figma.
- **FR-10:** The system must maintain a run-scoped trust ledger artifact consumable by both CLI and plugin.
- **FR-11:** The system must render canonical run states consistently across Cursor and Figma using ASCII-only structural output.
- **FR-12:** The system must provide a preview-only operation that performs full validation and produces a deterministic diff artifact.
- **FR-13:** The system must require explicit commit tied to a specific preview run ID.
- **FR-14:** The system must emit immutable commit receipts containing change summary and gate evidence.
- **FR-15:** The system must emit one primary recovery action per error code with copy-pasteable command text.
- **FR-16:** The system must persist and synchronize active cross-tool context (`screen`, `breakpoint`, `sfid`, `selectionPath`).
- **FR-17:** The system must detect stale context and stale preview data before commit and block unsafe operations.

---

## 5. Non-Goals (Out of Scope)

- **Figma → code sync:** Applying changes from Figma back to code is a separate flow; this PRD focuses on the middle layer for code→Figma and observability.
- **Changing Conduit MCP or Figma plugin internals beyond what’s needed** for schema, mapping, styles, and verification log.
- **Implementing new UI in the demo app** beyond what is required to keep token-only styling and sfids.
- **Support for projects that do not use the four breakpoints or the design system standard** (out of scope for this PRD; can be a later extension).

---

## 6. Design Considerations

- **Single source of truth:** DESIGN_SYSTEM_STANDARD.md and the mapping table should be the only places to look for “what is the standard” and “how does code map to Figma.”
- **Agent-friendly:** Outputs (coverage report, verification log, error codes) should be machine-readable so Cursor or other agents can suggest fixes.
- **Backward compatibility:** New conduit version or schema fields should not break existing `loop:code-to-canvas` / `loop:verify-canvas` flows without a documented migration.

### Interaction language (ASCII-first, precise, calm)

- Use ASCII box/line structure for state output; avoid heavy ornament.
- Use deterministic status labels (`OK`, `WARN`, `BLOCKED`) and avoid subjective scoring.
- Keep copy concise, operational, and non-childish.
- Delight is delivered through clarity, rhythm, and fast recoverability, not playful ambiguity.

---

## 7. Technical Considerations

- **Dependencies:** Existing stack (Node, `scripts/build-tokens.mjs`, `loop-code-to-canvas.mjs`, Figma plugin, Conduit MCP) remains the base; new scripts and doc updates must not break `npm run check` or `npm run build`.
- **Ordering:** Use a shared sort (e.g. alphabetical by token name, modes in fixed order) in both the code-to-canvas generator and any report writer so diffs are meaningful.
- **Per-breakpoint tokens:** Improvement #3 (per-breakpoint tokens) can stay as “document derivation rules” first; style layer and verification log are higher priority for the middle layer.

### UX contract artifacts

- `handoff/trust-ledger.json` (shared run state)
- `handoff/band-context.json` (shared selection context)
- `handoff/preview-diff.json` (preview result)
- `proof/receipts/<timestamp>-<runId>.json` (immutable commit receipt)

### Command surface

- `npm run conduit:preview`
- `npm run conduit:commit`
- `npm run conduit:doctor --code <ERROR_CODE>`

### Backward compatibility

- New UX artifacts are additive and must not break existing `loop:*` flows.
- Existing flows may run without Band Mode, but must log degraded-mode behavior explicitly.

### Important interface additions (for implementers)

- `trust-ledger.json` schema:
  - `runId`, `state`, `conduitVersion`, `tokenCount`, `modeCoverage`, `sfidCoverage`, `styleAssignments`, `blockingIssues[]`, `lastReceiptId`, `updatedAt`
- `band-context.json` schema:
  - `screen`, `breakpoint`, `sfid`, `selectionPath`, `sourceTool`, `updatedAt`
- `receipt` schema:
  - `runId`, `previewHash`, `commitHash`, `appliedChanges`, `gateResults`, `errorCodes`, `generatedAt`

### Testing strategy

- **Golden-file tests:** Maintain `tests/golden/code-to-canvas.json` and `tests/golden/code-to-figma-mapping.json`. A test regenerates these from a fixed token fixture and asserts byte-identical output. Regenerate via `npm run test:update-golden`.
- **Error code fixtures:** At least `TOKEN_MISSING` and `SFID_NOT_FOUND` have test fixtures in `tests/contracts/` that trigger the error path and assert the machine-readable JSON shape.
- **Binding coverage snapshot:** `tests/golden/binding-coverage.json` from a known conduit fixture, asserting deterministic classification.

### Migration and versioning policy

- **Conduit version:** Semantic string (e.g. `"1.0.0"`). Backward-compatible additions = minor bump; breaking shape changes = major bump.
- **Consumer detection:** Scripts and plugin check `conduitVersion` on read. If major version is unsupported, emit `CONDUIT_VERSION_MISMATCH` error with upgrade instructions.
- **Deprecation:** Old fields kept for one minor version with a console warning before removal.

### Performance constraints

- `npm run report:token-coverage` must complete in < 5s on the current codebase.
- `npm run conduit:generate` must complete in < 10s.
- If these budgets are exceeded, the script must log a timing warning.

---

## 8. Success Metrics

- **Coverage visibility:** Token coverage report runs and shows a single summary % and list of violations.
- **Conduit stability:** Conduit file has a version and stable ordering; two runs produce identical output.
- **Recovery time:** Error taxonomy and recovery hints are documented and emitted; an agent or human can resolve “token missing in Figma” or “mode mismatch” without reading plugin source.
- **Style layer:** At least one semantic style (e.g. Card) and one special style (e.g. gradient) are defined in the conduit and applied in Figma via plugin or Conduit.
- **Verification:** Pre-apply binding coverage report (US-008A) exists and lists bound/unbound/could-be-styles per sfid.
- **Trust ledger adoption:** % of runs where trust ledger is present and complete.
- **Preview discipline:** % of commits preceded by preview from the same `runId`.
- **Recovery speed:** Median time from first error emission to successful recovery.
- **Context-switch friction:** Average manual retarget actions per run (Cursor↔Figma).
- **Unsafe commit prevention:** Count of stale preview/context commits successfully blocked.

### Test Cases and Scenarios

1. **Trust ledger parity**
   - Run flow from CLI and plugin; confirm both show identical `state` and `runId`.
2. **Preview/commit integrity**
   - Commit with matching preview passes.
   - Commit with stale preview hash is blocked with deterministic code and fix.
3. **Error recovery UX**
   - Force mode mismatch and sfid missing cases; confirm first shown action resolves issue.
4. **Band mode sync**
   - Select node in Figma; verify CLI displays matching `screen/sfid`.
   - Set context in CLI; verify plugin context banner updates.
5. **Artifact determinism**
   - Re-run preview with unchanged input; diff artifact and ledger ordering are stable.

---

## 9. Resolved Questions

1. **What is the priority order for the 13 improvements?**
   → **B. MVP first** (US-001–US-007), then US-008A (pre-apply binding coverage) before US-009 (style layer). Style work without visibility tooling creates silent drift.

2. **Where should the bidirectional mapping table live?**
   → **C. Generated from `figma-variables.json` + workflow config**, producing `handoff/code-to-figma-mapping.json` (machine-readable) and a summary table in `DESIGN_SYSTEM_STANDARD.md`.

3. **Should the Phase 3 verification run inside the Figma plugin or as a separate script?**
   → **C. Both, staged.** Ship pre-apply coverage script first (US-008A, no Figma APIs). Then add post-apply plugin extraction (US-008B) that feeds a script for the canonical log.

4. **Scope for first release (MVP)?**
   → **B. US-001–US-007** as public MVP. US-008A (binding coverage) is the immediate next item because it unlocks the style layer safely.

5. **How should we version the conduit payload?**
   → **B. Semantic string** (e.g. `"1.0.0"`). Backward-compatible additions = minor bump; breaking shape changes = major bump. Changelog maintained in `DESIGN_SYSTEM_STANDARD.md`.

### Assumptions and defaults

- No confidence score or probabilistic language is exposed anywhere.
- Existing story numbering remains unchanged; UX stories append as `US-010..US-013`.
- Existing pipeline semantics remain canonical; UX additions are orchestration and visibility layers.

---

## Checklist (PRD quality)

- [x] User stories are small and specific (one deliverable per story).
- [x] Acceptance criteria are verifiable (scripts run, files exist, ordering defined).
- [x] Functional requirements are numbered and unambiguous.
- [x] Non-Goals section defines clear boundaries.
- [x] UI user stories: N/A (middle layer is scripts/docs/plugin).
- [x] Open questions resolved with decisions and rationale.
- [x] File saved as `docs/prd-figma-cursor-middle-layer.md` (no `tasks/` in this project).
