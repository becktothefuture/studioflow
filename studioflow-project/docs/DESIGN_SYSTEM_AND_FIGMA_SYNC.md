# StudioFlow Roundtrip Parity Guide

This guide defines how StudioFlow reaches the only acceptable target state:

- **complete Figma ⇄ code parity**
- **sync in either direction without drift**
- **works for any web project, not just React**

Use this as the canonical operating document for product, design, engineering, and agent workflows.

Companion docs:
- `docs/PRD_PARITY_STABILIZATION.md` — active sprint PRD for immediate parity fixes.
- `docs/PROJECT_OVERVIEW_DELTA.md` — before-vs-now overview and inspection map.

## 1. North Star

StudioFlow should behave like a tennis rally:

1. Code sends structure + styling intent to Figma.
2. Figma sends back edited structure + styling intent.
3. No meaning is lost in either direction.
4. No hidden rewrite changes the source of truth.

"Intent" includes:
- DOM tree and hierarchy
- component identity (`sfid`)
- tokens and token references
- responsive behavior by breakpoint/mode
- style semantics (fills, strokes, typography, spacing, radius, effects)
- static content values

## 2. Current Reality Check

### What currently works toward parity

1. **Deterministic token pipeline exists**
- `tokens/figma-variables.json` feeds generated token artifacts.
- `npm run build:tokens` is stable and repeatable.

2. **Contract gate exists before apply**
- `npm run loop:verify-canvas` blocks malformed payloads.
- Missing modes/screens/sfids are rejected.

3. **Stable identity primitive exists**
- `data-sfid="sfid:*"` is enforced and checked.
- `npm run verify:id-sync` protects anchor continuity.

4. **Push/pull wrappers exist**
- `npm run sync:push` and `npm run sync:pull` provide a simple operational path.

5. **Evidence trail exists**
- Manifest/proof artifacts provide auditability for each loop.

### What currently works against parity

1. **No structural roundtrip model**
- Current pull path updates token values; it does not apply DOM/layout structure changes from Figma back to source.
- Result: design structure can drift from code structure.

2. **Project-specific style mapping in conduit metadata**
- `styleLayer` is hardcoded to hero-specific sfids and style assumptions.
- This blocks universal project usage.

3. **Framework/path coupling**
- Scanners/extractors assume `src/` and React-like files (`tsx/jsx`) as primary path.
- HTML-first or other frameworks require manual adaptation.

4. **Expression fidelity risk on pull**
- Figma-exported float/color values are serialized as resolved values.
- Applying those directly can overwrite expression-based token intent (e.g. clamp semantics).

5. **Documentation drift and command drift**
- Multiple docs disagree on active commands and flows.
- This causes operational confusion and inconsistent team behavior.

## 3. Five Fundamental Flaws

These are the core reasons the system feels complicated and fragile.

### Flaw 1: Missing Canonical Intermediate Representation (IR)

The system has token payloads, but no single canonical **UI graph** that both code and Figma serialize to and from.

Impact:
- cannot guarantee full structure parity
- cannot diff intent at the right abstraction
- roundtrip becomes value sync, not system sync

### Flaw 2: Token sync is stronger than structure sync

Tokens are first-class. Structure is not.

Impact:
- Figma can change hierarchy while code remains unchanged
- parity claim is overstated by current implementation
- manual rewrite work creeps back in

### Flaw 3: Runtime and tooling are React-biased

Core onboarding/extraction scripts assume React conventions and `src/` layout.

Impact:
- non-React projects need one-off handling
- onboarding is not reproducible across project types
- scale-to-any-project objective is blocked

### Flaw 4: Style semantics are not fully normalized

The system partially maps token values, but style intent is still mixed between:
- token-bound
- resolved literal
- custom plugin renderer behavior

Impact:
- inconsistent behavior across modes
- hard-to-debug Figma binding outcomes
- elevated drift risk when pulling back

### Flaw 5: Operational surface is fragmented

Too many partially overlapping docs and flows dilute confidence.

Impact:
- teams execute different workflows
- quality gates are bypassed accidentally
- trust in the system declines

## 4. Required Architecture For True Parity

### 4.1 Introduce a canonical `StudioFlow IR`

Create a versioned, deterministic IR JSON that contains:
- node tree (`type`, `children`, `order`)
- stable ids (`sfid`)
- semantic style refs (token/style names, not raw literals)
- content entries (text, attributes)
- layout primitives (stack/grid/constraints)
- breakpoint mode overrides

All directions must use this flow:
- code -> IR -> Figma
- Figma -> IR -> code

### 4.2 Separate deterministic engine from agentic assist

Deterministic responsibilities:
- parsing adapters
- serialization
- contract validation
- safe apply
- diff and patch generation

Agentic responsibilities:
- semantic token naming proposals
- fuzzy structure matching when ids are absent
- conflict resolution suggestions for ambiguous merges

### 4.3 Add adapter architecture for "any project"

Use adapters per project type:
- `html-css-js` adapter
- `react` adapter
- `vue` adapter
- `svelte` adapter

Each adapter must implement the same interface:
- `extract(project) -> IR`
- `apply(irDiff, project) -> patch`
- `verify(project, ir) -> report`

### 4.4 Make style policy explicit

Every style assignment in IR must be one of:
- `tokenRef`
- `namedStyleRef`
- `resolvedLiteral` (only when unavoidable, explicitly flagged)

No silent fallback.

### 4.5 Preserve token expression fidelity

Rules:
1. canonical token source may contain expressions.
2. Figma export values are treated as mode projections, not canonical replacement values.
3. pull flow must not overwrite expression tokens unless explicitly approved.

## 5. Universal Workflow (Any Project)

## Step A: Onboard codebase

1. Detect project type and load adapter.
2. Scan for hardcoded values.
3. Generate token map proposal.
4. Apply approved token map.
5. Generate initial sfid map.
6. Build IR baseline.

## Step B: Push to Figma

1. Generate conduit payload from IR + token source.
2. Apply via Figma plugin/Conduit.
3. Verify binding coverage and unresolved literals.
4. Save push receipt.

## Step C: Edit in Figma

Allowed edits:
- token values by mode
- semantic style assignments
- content text
- structure edits only when sfids are preserved or remapped

## Step D: Pull back to code

1. Export canvas payload.
2. Normalize to IR diff.
3. Validate contract.
4. Run safe apply through adapter.
5. Re-run token build + checks.
6. Generate proof + receipt.

## Step E: Drift lock

Must pass:
- token sync gate
- no hardcoded style gate
- id parity gate
- canvas contract gate
- structure parity gate (new)
- expression fidelity gate (new)

## 6. Where Agentic Calls Are Required

Use AI where deterministic parsing is insufficient.

### Required agentic call 1: Semantic token naming

Input:
- scan report
- existing tokens
- style contexts

Output:
- deterministic token-map proposal
- conflict/confidence scores

### Required agentic call 2: sfid recovery/matching

When structure changed and ids are missing, use AI to propose node matches.

Input:
- old IR tree
- new IR tree
- content/style similarity features

Output:
- match proposals + confidence
- mandatory human review on low confidence

### Required agentic call 3: merge conflict resolver

When Figma and code changed same region, AI proposes merge plan.

Input:
- code-side IR diff
- figma-side IR diff

Output:
- merge patch candidates + risk score

## 7. Scripted Agentic Orchestration

Yes, this should be scripted.

Implement a single orchestrator:
- `scripts/roundtrip-orchestrator.mjs`
- command: `npm run sync:orchestrate -- --direction push|pull --project-type auto`

Responsibilities:
1. run deterministic pipeline stages
2. invoke agentic calls via configured provider when required
3. checkpoint each stage in trust ledger
4. stop on gate failure with deterministic recovery hints
5. emit one final receipt artifact with full lineage

Add machine-readable config:
- `studioflow.agentic.json`

Example shape:
- providers
- retry policy
- confidence thresholds
- human-approval thresholds
- deterministic fallback behavior

## 8. Alternative Approaches Considered

### Option 1: Continue token-only parity (current tendency)

Pros:
- fastest incremental progress

Cons:
- never reaches full structure parity
- still drifts at layout/DOM level

### Option 2: Figma as source of truth

Pros:
- designer-first

Cons:
- weak for engineering-led refactors
- brittle for production semantics

### Option 3: Dual-source with canonical IR (recommended)

Pros:
- true bidirectional parity
- reproducible and auditable
- framework-agnostic via adapters

Cons:
- higher upfront architecture work

## 9. Non-Negotiable Operating Rules

1. No apply without contract verification.
2. No raw style values where tokens are expected.
3. No sfid mutation without migration map.
4. No expression token overwrite from resolved pull values.
5. No undocumented workflow variants.

## 10. Practical Commands

Current (implemented and runnable now):
- `npm run sync:push`
- `npm run sync:pull`
- `npm run conduit:generate`
- `npm run loop:verify-canvas`
- `npm run check`
- `npm run scan:project -- --project-type html`
- `npm run scan:project -- --project-type react`

Expression-safety default on pull:
- `npm run sync:pull` protects expression tokens (for example `clamp(...)`, `color-mix(...)`) from resolved overwrite.
- Override only intentionally: `STUDIOFLOW_ALLOW_EXPRESSION_OVERWRITE=1 npm run loop:canvas-to-code`

Roadmap (not implemented yet):
- `npm run ir:build`
- `npm run ir:verify-structure`
- `npm run tokens:verify-expressions`
- `npm run sync:orchestrate`

## 11. Success Criteria

StudioFlow is "complete parity" ready when all are true:

1. same UI structure in code and Figma after any roundtrip
2. same token semantics preserved after any roundtrip
3. same content semantics preserved after any roundtrip
4. deterministic receipts for every apply
5. onboarding works for HTML/CSS/JS and React with no custom rewrite
