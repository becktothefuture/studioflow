# StudioFlow Project

## Direct Value Summary
StudioFlow preserves one intent model from code to canvas and back to code. The workflow enforces structural parity through deterministic payload generation, stable naming, and contract-gated verification. Each approved loop produces proof artifacts and manifest updates for operational traceability.

## Problem Definition
UI delivery loses coherence when teams translate intent manually between design and code. Token semantics drift, component identity changes, breakpoint behavior diverges, and review cycles absorb interpretation defects. StudioFlow encodes intent as enforceable system contracts to keep releases aligned.

## Principle: Intent Preservation
Intent preservation is the governing rule for every loop.

Operational scope:
- Shared token, mode, screen, and `sfid` vocabulary.
- Deterministic payload generation and verification.
- Gated application path tied to proof and manifest evidence.

## System Guarantees
The guarantees below are enforceable and mapped to commands.

| Guarantee | Verify With | Evidence Path |
| --- | --- | --- |
| Every approved loop preserves stable component identity via `sfid` parity checks. | `npm run verify:id-sync` | `src/** data-sfid`, `snapshots/*.json` |
| Every approved loop validates all four breakpoint modes and screens. | `npm run loop:verify-canvas` | `handoff/canvas-to-code.json` |
| Style data entering code is token-backed and contract-validated. | `npm run verify:tokens-sync` + `npm run loop:verify-canvas` | `tokens/figma-variables.json`, `handoff/canvas-to-code.json` |
| Roundtrip application is blocked when contract coverage is incomplete. | `npm run loop:verify-canvas` | `studioflow.manifest.json` gate status |
| Proof artifacts are generated as review evidence, not optional output. | `npm run loop:proof` | `proof/latest/index.html`, `proof/latest/summary-card.png` |
| Manifest state records loop outcomes for operational traceability. | `npm run manifest:update` | `studioflow.manifest.json` |

## Architecture Overview
System flow:
1. `npm run loop:code-to-canvas` generates canonical payloads.
2. `npm run export:tokens-studio` generates Tokens Studio import file.
3. Figma receives tokens via Tokens Studio plugin (one-time) and returns approved updates in `handoff/canvas-to-code.json`.
4. `npm run loop:verify-canvas` validates token/mode/screen/sfid coverage.
5. `npm run loop:canvas-to-code` applies verified updates into source.
6. `npm run check && npm run build` validates source integrity.
7. `npm run loop:proof && npm run manifest:update` records evidence.

## Workflow Overview
Code-first path:
```bash
npm run setup:project
npm run loop:code-to-canvas
npm run export:tokens-studio
# Import tokens/tokens-studio-import.json via Tokens Studio plugin in Figma (one-time)
# Figma update + export handoff/canvas-to-code.json
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run loop:proof
npm run manifest:update
```

Design-first path:
```bash
# Start from approved Figma design state
# Export handoff/canvas-to-code.json
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run loop:proof
npm run manifest:update
```

## Installation
Prerequisites:
- Node.js 18+ and npm
- Claude Code with project MCP access for live Figma loops

Setup and first proof:
```bash
npm install
npm run setup:project
npm run demo:website:capture
```

First successful run criteria:
- `proof/latest/index.html` exists.
- `proof/latest/summary-card.png` exists.
- `npm run check` passes.
- `npm run build` passes.

Always-on bridge monitor:
```bash
npm run monitor:figma-bridge:start
npm run monitor:figma-bridge:status
npm run monitor:figma-bridge:stop
```

Foreground mode (single terminal):
```bash
npm run monitor:figma-bridge
```

## Naming & Semantic Conventions
Canonical naming policy:
- `sfid:*` values preserve stable component identity.
- Breakpoint modes remain `mobile`, `tablet`, `laptop`, `desktop`.
- Token authority starts in `tokens/figma-variables.json`.
- Canonical payload paths are `handoff/code-to-canvas.json` and `handoff/canvas-to-code.json`.

Glossary:
- Intent: semantic meaning shared across code and design state.
- Parity: equivalence of semantic identity across environments.
- Deterministic generation: repeatable payload output from the same source state.
- Contract gate: validation command that must pass before apply.
- Proof artifact: generated evidence that supports review and audit.

## Roadmap
Near-term:
1. Add measured production baselines for modeled outcomes.
2. Expand CI templates for contract gates and proof generation.
3. Publish versioned glossary policy for naming governance.

Mid-term:
1. Add multi-repo manifest aggregation and lineage tracking.
2. Provide rollout playbooks for platform-level adoption.
3. Extend payload diagnostics for faster contract triage.

Related docs:
- `docs/STUDIOFLOW_WORKFLOW.md`
- `docs/CANVAS_EXCHANGE_CONTRACT.md`
- `docs/DEMO_WEBSITE_ROUNDTRIP.md`
- `docs/BRAND_POSITIONING.md`
