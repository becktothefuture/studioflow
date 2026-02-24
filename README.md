<p align="center">
  <img src="studioflow-project/assets/studioflow-logo.png" alt="StudioFlow logo" width="92" />
</p>

<h1 align="center">StudioFlow</h1>

<p align="center"><strong>The formal system for deterministic design–code parity.</strong></p>

<p align="center">
  StudioFlow operationalizes one non-negotiable standard: semantic intent must survive every transition between code and Figma without drift.
</p>

<p align="center">
  <a href="https://becktothefuture.github.io/studioflow/"><strong>Live Website</strong></a>
  ·
  <a href="#quick-start"><strong>Quick Start</strong></a>
  ·
  <a href="#north-star"><strong>North Star</strong></a>
  ·
  <a href="#required-architecture"><strong>Required Architecture</strong></a>
  ·
  <a href="studioflow-project/README.md"><strong>Project Docs</strong></a>
</p>

![StudioFlow divider](studioflow-project/assets/studioflow-divider.gif)

## North Star

StudioFlow is built for complete bidirectional parity:

- **Figma ⇄ code parity with no semantic drift**
- **Deterministic sync in either direction**
- **Framework-agnostic operation across modern web stacks**

Intent is treated as a first-class artifact, including:
- UI structure and hierarchy
- stable component identity via `sfid`
- token semantics and references
- responsive behavior per mode/breakpoint
- style semantics, layout constraints, and content values

## Why This Matters

Most teams do not fail from lack of tooling—they fail from translation loss between environments. StudioFlow eliminates manual reinterpretation by enforcing contracts, identity continuity, and auditable evidence at each handoff stage.

Primary audience:
- Design system leads
- Senior frontend engineers
- Hybrid design/engineering operators

Secondary audience:
- Engineering managers
- Product designers
- Platform and DevEx teams

## Current Strengths

StudioFlow already provides strong foundations:

- deterministic token build pipeline
- pre-apply contract validation (`loop:verify-canvas`)
- identity continuity checks (`verify:id-sync`)
- operator-friendly sync wrappers (`sync:push`, `sync:pull`)
- manifest/proof artifacts for auditability

## Critical Gaps Being Addressed

The parity program now explicitly addresses five architectural flaws:

1. Missing canonical intermediate representation (IR)
2. Structure sync weaker than token sync
3. Runtime/tooling bias toward React conventions
4. Partial normalization of style semantics
5. Fragmented operational documentation and command drift

## Required Architecture

StudioFlow is advancing toward a canonical parity model:

1. **Versioned StudioFlow IR** as the deterministic contract between code and Figma
2. **Deterministic engine + agentic assist split** for reliability and controlled intelligence
3. **Adapter architecture** for `html-css-js`, `react`, `vue`, and `svelte`
4. **Explicit style policy** (`tokenRef`, `namedStyleRef`, `resolvedLiteral`)
5. **Expression fidelity rules** preventing token-expression overwrite from resolved exports

## Universal Workflow

1. **Onboard** project via adapter, token mapping, `sfid` map, and IR baseline.
2. **Push** deterministic payload from IR + token authority into Figma.
3. **Edit** with controlled parity-safe operations.
4. **Pull** normalized IR diff back into source through safe apply.
5. **Lock drift** with strict gate execution and generated receipts.

## Non-Negotiable Operating Rules

- No apply without contract verification.
- No raw style values where token references are expected.
- No `sfid` mutation without migration mapping.
- No expression-token overwrite from resolved pull exports.
- No undocumented workflow variants.

## System Guarantees

| Guarantee | Verify With | Evidence |
| --- | --- | --- |
| Stable component identity parity | `npm run verify:id-sync` | source `data-sfid` + `snapshots/*.json` |
| Canvas payload contract coverage before apply | `npm run loop:verify-canvas` | `handoff/canvas-to-code.json` |
| Token determinism and sync discipline | `npm run verify:tokens-sync` | `tokens/figma-variables.json` and generated artifacts |
| Proof artifact generation for review | `npm run loop:proof` | `proof/latest/index.html`, `proof/latest/summary-card.png` |
| Manifested loop traceability | `npm run manifest:update` | `studioflow-project/studioflow.manifest.json` |

## Quick Start

```bash
cd studioflow-project
npm run setup:project
npm run sync:push
# Export approved handoff/canvas-to-code.json from Figma
npm run loop:verify-canvas
npm run sync:pull
npm run check
npm run build
npm run loop:proof
npm run manifest:update
```

## Command Surface

Current stable commands:
- `npm run sync:push`
- `npm run sync:pull`
- `npm run conduit:generate`
- `npm run loop:verify-canvas`
- `npm run check`

Target parity commands:
- `npm run ir:build`
- `npm run ir:verify-structure`
- `npm run tokens:verify-expressions`
- `npm run sync:orchestrate -- --direction push|pull --project-type auto`

## Success Criteria

StudioFlow is complete-parity ready only when all are true:

1. identical structure in code and Figma after roundtrip
2. identical token semantics preserved after roundtrip
3. identical content semantics preserved after roundtrip
4. deterministic receipts for every apply
5. onboarding works across HTML/CSS/JS and React without project-specific rewrites

## Operator References

- Canonical parity guide: `studioflow-project/docs/DESIGN_SYSTEM_AND_FIGMA_SYNC.md`
- Implementation program: `studioflow-project/docs/PARITY_CHANGE_PROGRAM.md`
- Standards baseline: `studioflow-project/docs/DESIGN_SYSTEM_STANDARD.md`
- Conduit setup: `studioflow-project/docs/CONDUIT_SETUP.md`
- MCP setup: `studioflow-project/docs/MCP_SETUP.md`
