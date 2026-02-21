# StudioFlow Workflow

## Direct Value Summary
StudioFlow aligns code and design by preserving one intent model across both environments. It enforces semantic parity through deterministic payload generation, stable naming, and contract-gated verification. Teams ship interface changes with proof artifacts that show what changed and why the loop is valid.

Primary audience:
- Design system leads responsible for token governance and component integrity.
- Hybrid designers operating across Figma and code.
- Senior frontend engineers owning release quality.

Secondary audience:
- Engineering managers driving delivery predictability.
- Product designers collaborating with system teams.
- Platform and DevEx teams scaling workflow policy.

## Problem Definition
Interface delivery drifts when intent is translated manually across tools. Token meaning shifts, component identity drifts, breakpoint behavior fragments, and teams spend review time on interpretation defects. StudioFlow addresses this operational failure by encoding intent into enforceable contracts.

## Principle: Intent Preservation
Intent preservation means tokens, modes, screens, and stable identifiers carry the same meaning across code and canvas transitions. StudioFlow keeps this scope explicit through canonical payload schema, naming rules, and deterministic verification gates.

## System Guarantees
The guarantees below are enforceable claims with direct verification mapping.

| Guarantee | Verify With | Evidence Path |
| --- | --- | --- |
| Every approved loop preserves stable component identity via `sfid` parity checks. | `npm run verify:id-sync` | `src/** data-sfid`, `snapshots/*.json` |
| Every approved loop validates all four breakpoint modes and screens. | `npm run loop:verify-canvas` | `handoff/canvas-to-code.json` |
| Style data entering code is token-backed and contract-validated. | `npm run verify:tokens-sync` + `npm run loop:verify-canvas` | `tokens/figma-variables.json`, `handoff/canvas-to-code.json` |
| Roundtrip application is blocked when contract coverage is incomplete. | `npm run loop:verify-canvas` | `studioflow.manifest.json` gate status |
| Proof artifacts are generated as review evidence, not optional output. | `npm run loop:proof` | `proof/latest/index.html`, `proof/latest/summary-card.png` |
| Manifest state records loop outcomes for operational traceability. | `npm run manifest:update` | `studioflow-project/studioflow.manifest.json` |

## Architecture Overview
High-level flow:
1. Code emits canonical payload: `npm run loop:code-to-canvas`.
2. Canvas updates return via `handoff/canvas-to-code.json`.
3. Contract validation enforces token/mode/screen/sfid integrity: `npm run loop:verify-canvas`.
4. Verified payload applies to source tokens and generated artifacts: `npm run loop:canvas-to-code`.
5. Proof and manifest capture operational evidence: `npm run loop:proof && npm run manifest:update`.

## Workflow Overview
Code-first path:
1. Generate payload from source.
2. Apply updates in Figma using canonical schema.
3. Verify contract coverage.
4. Apply back to code.
5. Run quality gates and produce proof.

Design-first path:
1. Start from approved design state in Figma.
2. Export canonical payload to `handoff/canvas-to-code.json`.
3. Run the same verification and apply chain.
4. Produce manifest and proof evidence.

## Installation
```bash
cd studioflow-project
npm run setup:project
npm run demo:website:capture
```

You can also run the same commands from this parent folder:

```bash
npm run setup:project
npm run demo:website:capture
```

First successful run criteria:
- `proof/latest/index.html` exists.
- `proof/latest/summary-card.png` exists.
- `npm run check` passes.
- `npm run build` passes.

## Naming & Semantic Conventions
Core conventions:
- `sfid` values define stable component identity.
- `mobile`, `tablet`, `laptop`, `desktop` are fixed mode names.
- Token authority starts in `tokens/figma-variables.json`.
- Screen names map to breakpoint intent in contract payloads.

Glossary:
- Intent: the semantic meaning of structure, naming, and token usage across environments.
- Parity: matching semantic identity between source code and payload state.
- Deterministic generation: repeatable payload output for the same code state.
- Contract gate: validation rule that blocks apply when integrity checks fail.
- Proof artifact: generated evidence file for review and audit.

## Roadmap
Near-term:
1. Add measured team baselines for loop time and drift outcomes.
2. Expand automated checks for contract completeness in CI presets.
3. Publish versioned glossary and naming governance policy.

Mid-term:
1. Add richer manifest lineage for multi-repo orchestration.
2. Standardize adoption templates for platform rollout.
3. Formalize release policy bundles for governance teams.

Strategic references:
- Project operator manual: `studioflow-project/README.md`
- Workflow specification: `studioflow-project/docs/STUDIOFLOW_WORKFLOW.md`
- Brand and messaging framework: `studioflow-project/docs/BRAND_POSITIONING.md`
