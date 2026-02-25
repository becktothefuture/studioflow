# PRD: Parity Stabilization Sprint

Status: Active
Owner: StudioFlow
Scope: Immediate remediation of parity blockers discovered in post-cleanup review.

## Objective

Fix the concrete parity gaps encountered in the review while keeping implementation lean:

1. remove command/documentation ambiguity,
2. reduce React/path coupling in onboarding,
3. replace hardcoded hero-only style mappings,
4. protect expression token fidelity in pull flow,
5. update guidance so operators see current-state workflow vs roadmap clearly.

## Information Readiness (Verified Before Build)

All stories below are marked ready and mapped to source files already inspected.

| Story | Ready | Evidence Read |
| --- | --- | --- |
| US-PS1 Command Reality Alignment | Yes | `docs/DESIGN_SYSTEM_AND_FIGMA_SYNC.md`, `handoff/figma-page-content.json`, `figma-plugins/studioflow-screens/code.js` |
| US-PS2 Universal Scanner Defaults | Yes | `scripts/scan-project.mjs`, `studioflow.workflow.json` |
| US-PS3 Dynamic Style Layer Mapping | Yes | `scripts/lib/conduit-metadata.mjs`, `scripts/loop-code-to-canvas.mjs` |
| US-PS4 Expression Fidelity Guard | Yes | `scripts/loop-canvas-to-code.mjs`, `tokens/figma-variables.json`, `AGENT.md` rules |
| US-PS5 Documentation + Before/After Guide | Yes | `README.md`, `docs/*`, `src/components/Hero/HeroLogic.tsx` |

## User Stories

### US-PS1: Command Reality Alignment

As an operator, I need docs and payload content to only show current runnable workflow commands, so I do not execute stale paths.

Acceptance Criteria:
- `docs/DESIGN_SYSTEM_AND_FIGMA_SYNC.md` separates "Current Commands" from "Roadmap Commands".
- No stale `loop:figma-roundtrip` references remain in runtime-facing content files.
- Figma plugin payload content reflects the current push/pull command path after regeneration.

### US-PS2: Universal Scanner Defaults

As a user onboarding non-React projects, I need project scan defaults that work beyond `src/**/*.tsx` conventions.

Acceptance Criteria:
- `scan-project` supports multiple include patterns and exclude patterns.
- defaults include HTML/CSS/JS/TS/framework files and are configurable in `studioflow.workflow.json`.
- script output includes effective scan config for reproducibility.

### US-PS3: Dynamic Style Layer Mapping

As a team syncing arbitrary projects, I need conduit style mappings generated from discovered sfids and token availability, not hardcoded hero IDs.

Acceptance Criteria:
- `createConduitStyleLayer()` is generated from `sfids` + available token names.
- no hardcoded hero-only `elementPropertyMappings` remain.
- `loop:code-to-canvas` passes required inputs and generates deterministic mapping order.

### US-PS4: Expression Fidelity Guard in Pull

As a token system maintainer, I need `loop:canvas-to-code` to preserve canonical expression tokens by default.

Acceptance Criteria:
- expression tokens in source (e.g. `clamp(...)`, `color-mix(...)`) are not overwritten by resolved payload values by default.
- explicit opt-in env var allows overwrite when intentionally required.
- pull output and manifest include counts for updated vs expression-protected tokens.

### US-PS5: Documentation + Overview Refresh

As a project owner, I need an immediate "before vs now" overview and updated guides.

Acceptance Criteria:
- docs updated to reflect this sprint's changes.
- new overview doc explains architecture/workflow deltas and where to inspect.
- README links point to canonical guide, sprint PRD, and overview.

## Non-Goals

- Full IR/adapter architecture rollout.
- Full structure roundtrip engine.
- New agentic orchestration runtime.

## Validation

- `npm run build:figma-plugin`
- `npm run check`
- `npm run build`
