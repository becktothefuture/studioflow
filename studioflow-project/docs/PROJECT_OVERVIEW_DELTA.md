# Project Overview Delta

This document shows what changed from the earlier documentation-heavy state to the current parity-stabilized state.

## Before vs Now

## Before

- Multiple overlapping docs described different workflows.
- Runtime-facing content still referenced legacy checklist commands.
- `scan-project` defaulted to `src/**/*` and React-centric assumptions.
- Conduit style layer had hardcoded hero-specific mappings.
- `loop-canvas-to-code` could overwrite expression tokens with resolved values.

## Now

- Canonical guide + change program + sprint PRD define one coherent direction.
- Runtime-facing command path is aligned on `sync:push` / `sync:pull`.
- Scanner supports configurable include/exclude patterns and project-type defaults.
- Style-layer mappings are generated from discovered `sfid`s + available tokens.
- Pull flow protects expression tokens by default unless explicitly overridden.

## Where To Inspect (Best Overview Path)

1. `docs/DESIGN_SYSTEM_AND_FIGMA_SYNC.md`
- Canonical operating model, current commands, roadmap separation.

2. `docs/PRD_PARITY_STABILIZATION.md`
- Sprint scope, readiness checks, acceptance criteria.

3. `scripts/scan-project.mjs`
- Universal scanning behavior and config-driven include/exclude logic.

4. `scripts/lib/conduit-metadata.mjs`
- Dynamic style-layer generation and sfid-to-style inference.

5. `scripts/loop-canvas-to-code.mjs`
- Expression-fidelity protections in pull path.

6. `studioflow.workflow.json`
- Central scan + breakpoint + exchange file configuration.

7. `figma-plugins/studioflow-screens/code.js`
- Regenerated plugin payload reflecting updated workflow content.

## Quick Diff Summary

- Added: `docs/PRD_PARITY_STABILIZATION.md`
- Added: `docs/PROJECT_OVERVIEW_DELTA.md`
- Updated: `scripts/scan-project.mjs`
- Updated: `scripts/lib/conduit-metadata.mjs`
- Updated: `scripts/loop-canvas-to-code.mjs`
- Updated: `studioflow.workflow.json`
- Updated: runtime content payload and regenerated plugin code
