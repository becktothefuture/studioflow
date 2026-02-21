<p align="center">
  <img src="studioflow-project/assets/studioflow-logo.png" alt="StudioFlow logo" width="92" />
</p>

<h1 align="center">StudioFlow</h1>

<p align="center"><strong>Preserve one intent from code to design.</strong></p>

<p align="center">
  StudioFlow aligns code and design through deterministic contracts, naming parity, and verification gates that keep semantic intent stable across every transition.
</p>

<p align="center">
  <a href="https://becktothefuture.github.io/studioflow/"><strong>Live Website</strong></a>
  ·
  <a href="#quick-start"><strong>Quick Start</strong></a>
  ·
  <a href="#system-guarantees"><strong>System Guarantees</strong></a>
  ·
  <a href="#workflow"><strong>Workflow</strong></a>
  ·
  <a href="studioflow-project/README.md"><strong>Project Docs</strong></a>
</p>

![StudioFlow divider](studioflow-project/assets/studioflow-divider.gif)

## Why StudioFlow

Interface delivery drifts when intent is translated manually between tools. Token semantics shift, component identity changes, and breakpoint behavior fragments across teams. StudioFlow addresses this operational problem by preserving one shared intent model across code and canvas.

Primary audience:
- Design system leads
- Hybrid designers
- Senior frontend engineers

Secondary audience:
- Engineering managers
- Product designers
- Platform and DevEx teams

## System Guarantees

Each guarantee maps to an executable command and an evidence path.

| Guarantee | Verify With | Evidence |
| --- | --- | --- |
| Stable component identity is preserved through `sfid` parity checks. | `npm run verify:id-sync` | Source `data-sfid` + `snapshots/*.json` |
| All four breakpoint modes and screens are validated on every approved loop. | `npm run loop:verify-canvas` | `handoff/canvas-to-code.json` |
| Style data entering code remains token-backed and contract-validated. | `npm run verify:tokens-sync` + `npm run loop:verify-canvas` | `tokens/figma-variables.json`, payload mode values |
| Roundtrip apply is blocked when contract coverage is incomplete. | `npm run loop:verify-canvas` | `studioflow-project/studioflow.manifest.json` |
| Proof artifacts are generated as required review evidence. | `npm run loop:proof` | `proof/latest/index.html`, `proof/latest/summary-card.png` |
| Manifest state records loop outcomes for operational traceability. | `npm run manifest:update` | `studioflow-project/studioflow.manifest.json` |

## Architecture

1. Generate canonical handoff from code: `npm run loop:code-to-canvas`.
2. Export approved canvas payload to `handoff/canvas-to-code.json`.
3. Enforce contract coverage: `npm run loop:verify-canvas`.
4. Apply verified updates to source: `npm run loop:canvas-to-code`.
5. Publish evidence: `npm run loop:proof && npm run manifest:update`.

## Workflow

### Code-first

```bash
cd studioflow-project
npm run setup:project
npm run loop:code-to-canvas
npm run export:tokens-studio
# Import tokens/tokens-studio-import.json via Tokens Studio plugin in Figma
# Figma operations and export to handoff/canvas-to-code.json
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run loop:proof
npm run manifest:update
```

### Design-first

```bash
cd studioflow-project
# Export approved handoff/canvas-to-code.json from Figma
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run loop:proof
npm run manifest:update
```

## Website Content Map

The website and repo use one narrative structure:
1. Structural Alignment
2. Preserving Intent Across Environments
3. Deterministic Code-to-Canvas Generation
4. Naming and Component Identity Parity
5. Team-Level Outcomes
6. Technical Foundations

Live website:
- https://becktothefuture.github.io/studioflow/

## Quick Start

```bash
cd studioflow-project
npm run setup:project
npm run demo:website:capture
```

Successful first run criteria:
- `proof/latest/index.html` exists
- `proof/latest/summary-card.png` exists
- `npm run check` passes
- `npm run build` passes

## Naming and Semantic Conventions

- `sfid:*` values define stable component identity.
- Breakpoint modes are fixed: `mobile`, `tablet`, `laptop`, `desktop`.
- Token authority starts in `tokens/figma-variables.json`.
- Token Studio import file is `tokens/tokens-studio-import.json`.
- Canonical handoff files are `handoff/code-to-canvas.json` and `handoff/canvas-to-code.json`.

Glossary:
- Intent: semantic meaning preserved across environments.
- Parity: matching semantic identity between source and payload state.
- Deterministic generation: repeatable payload output from the same source state.
- Contract gate: required validation step before apply.
- Proof artifact: generated file used for review and audit.

## Operator Docs

- Project README: `studioflow-project/README.md`
- Workflow spec: `studioflow-project/docs/STUDIOFLOW_WORKFLOW.md`
- Canvas contract: `studioflow-project/docs/CANVAS_EXCHANGE_CONTRACT.md`
- Demo roundtrip: `studioflow-project/docs/DEMO_WEBSITE_ROUNDTRIP.md`
- Brand positioning: `studioflow-project/docs/BRAND_POSITIONING.md`

## Roadmap

Near-term:
1. Replace modeled performance ranges with measured baseline metrics.
2. Expand CI templates for contract and proof gates.
3. Publish versioned naming governance guidance.

Mid-term:
1. Add multi-repo manifest lineage aggregation.
2. Ship platform rollout templates for large teams.
3. Extend contract diagnostics for faster gate triage.
