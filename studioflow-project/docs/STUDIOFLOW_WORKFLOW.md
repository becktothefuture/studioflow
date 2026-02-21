# StudioFlow Workflow (v3)

## Overview

StudioFlow v3 is a **Code ↔ Canvas ↔ Code** workflow.

Central integration point:
- Figma Code-to-Canvas (Sites canonical, Make exploratory)

Preserved guarantees:
- existing token system remains unchanged,
- tokens roundtrip code -> Figma -> code,
- stable IDs remain enforced.

## Dual Track

1. Canonical track: `figma-sites`
   - production-grade source for approved roundtrips.
2. Exploratory track: `figma-make`
   - rapid experimentation; must pass validation before promotion.

## Entry Path A: Code-first

1. Build/update rough structure in code with token-only styles and `sfid` IDs.
2. Run:
   ```bash
   npm run loop:code-to-canvas
   ```
3. Claude Code + Figma MCP applies the payload in Figma.
4. Save approved response to `handoff/canvas-to-code.json`.
5. Run:
   ```bash
   npm run loop:verify-canvas
   npm run loop:canvas-to-code
   npm run check
   npm run build
   npm run manifest:update
   ```

## Entry Path B: Design-first

1. Begin in Figma Sites or Figma Make.
2. Claude Code emits `handoff/canvas-to-code.json` from approved design state.
3. Run:
   ```bash
   npm run loop:verify-canvas
   npm run loop:canvas-to-code
   npm run check
   npm run build
   npm run manifest:update
   ```

## Required Files

- Workflow config: `studioflow.workflow.json`
- Token source: `tokens/figma-variables.json`
- Canonical handoff files:
  - `handoff/code-to-canvas.json`
  - `handoff/canvas-to-code.json`
  - `handoff/canvas-to-code.template.json`
- Compatibility handoff files:
  - `handoff/code-to-figma.json`
  - `handoff/figma-to-code.json`
  - `handoff/figma-to-code.template.json`
- Breakpoint token export: `tokens/figma-breakpoint-variables.json`
- Audit snapshots: `snapshots/figma-*.json`
- Loop metadata: `studioflow.manifest.json`

## Invariants Enforced

1. Token-only style values.
2. Stable `sfid` parity between code and canvas payload.
3. Complete token frame coverage.
4. Complete mode coverage for `mobile/tablet/laptop/desktop`.
5. Complete screen coverage for all 4 breakpoints.

## Scripts

- `loop:code-to-canvas`: generate canonical code->canvas payload and template.
- `loop:verify-canvas`: validate canonical canvas contract and update manifest status.
- `loop:canvas-to-code`: apply approved values back into token source and artifacts.
- `loop:proof`: generate visual/token/sfid proof report (`proof/latest/index.html`) plus share card (`proof/latest/summary-card.png`).
- `loop:run`: full happy-path chain.
- `loop:*figma*`: compatibility wrappers.

## Promotion Rule

If provider is `figma-make`, payload must pass `loop:verify-canvas` before it is treated as canonical for sync-back.

## Suggested Daily Flow

```bash
npm run setup:project
npm run loop:code-to-canvas
# Claude Code + MCP + Figma work
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run loop:proof
npm run manifest:update
```

## Demo Walkthrough

Use the live website in this repo as the example design roundtrip:

- `docs/DEMO_WEBSITE_ROUNDTRIP.md`
