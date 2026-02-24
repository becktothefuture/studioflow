# StudioFlow Parity Change Program

This is the implementation program derived from the parity guide and your ambition.

Goal:
- full Figma ⇄ code parity
- universal project support (HTML-first and framework projects)
- zero drift across repeated sync loops

## 1. Priority Matrix

- `P0`: Must complete to claim true parity.
- `P1`: Strongly needed for reliability and scale.
- `P2`: Valuable optimization once parity core is stable.

## 2. Change List With Rationale

## P0: Core Parity Architecture

### 1) Add canonical StudioFlow IR

Change:
- Create `schema/studioflow-ir.schema.json` and IR builders/parsers.

Why:
- parity is impossible without one model both sides agree on.

Done when:
- both push and pull operate through IR, not ad-hoc payload shapes.

### 2) Add structure diff + apply engine

Change:
- Build `scripts/ir-diff.mjs` and `scripts/ir-apply.mjs`.

Why:
- current pull updates token values but cannot apply structure/DOM changes.

Done when:
- Figma structural edits can be applied back to code deterministically.

### 3) Introduce adapter interface for project types

Change:
- Create adapter contract and implement `react` + `html-css-js` adapters first.

Why:
- current scripts are React/`src` biased; this blocks universal adoption.

Done when:
- same CLI workflow runs successfully on plain HTML site and React app.

### 4) Protect expression token fidelity

Change:
- Add expression-preserving token policy and verify gate.
- Do not overwrite expression tokens during pull by default.

Why:
- resolved Figma values can destroy canonical token intent.

Done when:
- pull path emits warning/approval flow for expression-token replacement.

### 5) Promote structure parity to quality gate

Change:
- Add `npm run ir:verify-structure` to `check` chain.

Why:
- without a structure gate, drift remains undetected.

Done when:
- apply is blocked on structural mismatch.

## P1: Workflow Reliability

### 6) Replace hardcoded style layer with generated mappings

Change:
- Generate `styleLayer` from IR and token mapping, remove project-specific defaults.

Why:
- hardcoded hero mappings prevent reuse and produce false confidence.

Done when:
- style mappings are project-derived and deterministic.

### 7) Build agentic orchestration runner

Change:
- Add `scripts/roundtrip-orchestrator.mjs` and `npm run sync:orchestrate`.

Why:
- manual sequencing increases operator error.

Done when:
- one command executes deterministic stages and required agentic calls.

### 8) Add confidence-based approval policy for AI calls

Change:
- create `studioflow.agentic.json` with thresholds and fallback behavior.

Why:
- agentic assistance must be safe, auditable, and reproducible.

Done when:
- low-confidence proposals require explicit human confirmation.

### 9) Extend binding coverage to include structure and mode semantics

Change:
- upgrade coverage report to include per-node, per-mode binding status.

Why:
- token-only binding stats are not enough for real parity.

Done when:
- report answers: what is bound, what is resolved, what is structurally unmatched.

### 10) Add deterministic receipts for every stage

Change:
- include stage hashes in trust ledger and immutable receipt output.

Why:
- reproducibility requires full lineage, not only final status.

Done when:
- any roundtrip can be replayed and audited with the receipt set.

## P1: Universal Project Onboarding

### 11) Expand scanner coverage beyond `src/`

Change:
- make scan roots configurable and auto-detected.

Why:
- HTML and mixed repos often do not use `src/`.

Done when:
- scanner works with arbitrary root paths and file globs.

### 12) Support non-React content extraction

Change:
- adapter-based content extraction for HTML templates and static pages.

Why:
- current extraction logic is JSX-centric.

Done when:
- content roundtrip works on HTML-only projects.

### 13) Add sfid bootstrap mode for legacy projects

Change:
- generate initial sfid map from DOM/selector heuristics.

Why:
- most existing projects have no sfid anchors yet.

Done when:
- onboarding produces stable sfid anchors automatically with review step.

## P2: Efficiency and UX

### 14) Incremental sync with changed-region detection

Change:
- sync only changed subtrees/tokens by default.

Why:
- full sync loops are slower and noisier for large sites.

Done when:
- median sync time drops without loss of parity checks.

### 15) Add visual + semantic regression bundle

Change:
- pair screenshot diffs with IR/token diffs.

Why:
- visual pass can hide semantic drift and vice versa.

Done when:
- proof bundle includes both visual and semantic deltas.

### 16) Add plugin-side guided recovery UX

Change:
- show deterministic error code + fastest fix directly in plugin panel.

Why:
- errors should be recoverable where operators are working.

Done when:
- operators can recover without leaving plugin context.

## 3. Explicit Agentic Call Plan

Use AI only for these classes of work:

1. token naming proposal
- deterministic fallback: keep current value + mark unresolved

2. sfid matching/recovery when structure diverges
- deterministic fallback: block apply and request manual map

3. merge conflict suggestion for simultaneous code/Figma edits
- deterministic fallback: prefer no-op + explicit conflict artifact

Everything else remains deterministic scripts.

## 4. Recommended Execution Order

1. P0 items 1-5 (mandatory parity foundation)
2. P1 items 6-10 (reliability)
3. P1 items 11-13 (universal onboarding)
4. P2 items 14-16 (efficiency and UX)

## 5. Definition of Done (Program Level)

The program is complete when:

1. roundtrip preserves structure, style semantics, and content
2. HTML-only and React projects pass the same sync pipeline
3. all applies require passing deterministic + structure + expression gates
4. agentic calls are auditable, confidence-gated, and optional
5. zero-drift is demonstrated across repeated push/pull cycles
