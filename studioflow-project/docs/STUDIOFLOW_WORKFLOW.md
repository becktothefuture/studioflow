# StudioFlow Workflow (Intent Preservation Model)

## Overview
StudioFlow aligns code and design by preserving one intent model across both environments. The workflow executes deterministic code-to-canvas and canvas-to-code transitions, then validates semantic parity through contract gates.

## Audience and Ownership
Primary operators:
- Design system leads
- Hybrid designers
- Senior frontend engineers

Supporting operators:
- Engineering managers
- Product designers
- Platform and DevEx teams

## Operational Problem
Manual translation between design and code causes semantic drift. Token meaning, component identity, and breakpoint behavior diverge across tools. StudioFlow resolves this with shared vocabulary, deterministic payload generation, and enforceable verification.

## Mechanism of Action
StudioFlow preserves intent through three controls:
1. Semantic alignment across tokens, modes, screens, and IDs.
2. Naming parity via stable `sfid` identifiers and canonical naming rules.
3. Deterministic generation and verification with script-level contract gates.

## System Flow
1. Generate canonical handoff from code.
   - `npm run loop:code-to-canvas`
2. Export tokens for Figma variable import.
   - `npm run export:tokens-studio`
   - Import `tokens/tokens-studio-import.json` via Tokens Studio plugin (one-time, or when tokens change).
3. Apply updates in Figma and export canonical response payload.
   - `handoff/canvas-to-code.json`
4. Verify contract integrity before source mutation.
   - `npm run loop:verify-canvas`
5. Apply verified updates into source artifacts.
   - `npm run loop:canvas-to-code`
6. Enforce project gates and publish evidence.
   - `npm run check && npm run build && npm run loop:proof && npm run manifest:update`

## Entry Paths
Code-first:
- Start in source code.
- Generate payload to Figma.
- Approve updates.
- Verify and apply.

Design-first:
- Start in approved Figma state.
- Export canonical payload.
- Run the same verify/apply chain.

## Enforceable Guarantees
| Guarantee | Verification | Evidence |
| --- | --- | --- |
| Every approved loop preserves stable component identity via `sfid` parity checks. | `npm run verify:id-sync` | `snapshots/*.json`, source `data-sfid` |
| Every approved loop validates all four breakpoint modes and screens. | `npm run loop:verify-canvas` | `handoff/canvas-to-code.json` |
| Style data entering code is token-backed and contract-validated. | `npm run verify:tokens-sync` + `npm run loop:verify-canvas` | `tokens/figma-variables.json`, payload modes |
| Roundtrip application is blocked when contract coverage is incomplete. | `npm run loop:verify-canvas` | manifest gate status |
| Proof artifacts are generated as review evidence, not optional output. | `npm run loop:proof` | `proof/latest/index.html`, `proof/latest/summary-card.png` |
| Manifest state records loop outcomes for operational traceability. | `npm run manifest:update` | `studioflow.manifest.json` |

## Canonical Files
- Workflow config: `studioflow.workflow.json`
- Source tokens: `tokens/figma-variables.json`
- Handoff request: `handoff/code-to-canvas.json`
- Handoff response: `handoff/canvas-to-code.json`
- Manifest evidence: `studioflow.manifest.json`
- Proof artifacts: `proof/latest/*`

## Naming and Semantic Glossary
- Intent: semantic meaning preserved across design and code transitions.
- Semantic alignment: shared token/mode/screen/ID vocabulary.
- Naming parity: stable identifiers and canonical naming map across files.
- Deterministic generation: same source state creates same payload shape.
- Contract gate: script validation step required before apply.

## Promotion Rule
Payloads from exploratory providers require full `loop:verify-canvas` pass before canonical sync-back.

## Daily Operator Path
```bash
npm run setup:project
npm run loop:code-to-canvas
npm run export:tokens-studio
# Import tokens via Tokens Studio plugin if needed, then Figma operations and export
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run loop:proof
npm run manifest:update
```

## Related Docs
- `docs/CANVAS_EXCHANGE_CONTRACT.md`
- `docs/DEMO_WEBSITE_ROUNDTRIP.md`
- `docs/BRAND_POSITIONING.md`
