# StudioFlow Architecture

## Overview

StudioFlow is a deterministic design-to-code roundtrip system. It keeps tokens, component anchors (sfids), and breakpoint layouts synchronized between a React web app and Figma.

## Stack

- **Runtime**: React 18 + TypeScript + Vite (SPA)
- **Node**: 20.11.1 (ESM modules)
- **Figma Plugin**: Vanilla JS (generated from renderer.js + payload)
- **CI**: GitHub Actions (deploy + loop verification)

## Directory Map

| Directory | Purpose |
|-----------|---------|
| `src/` | React web app (Hero component, ShaderBackground, global styles) |
| `tokens/` | Canonical token source (`figma-variables.json`) + generated CSS/TS |
| `scripts/` | CLI workflow tools (build, verify, loop, conduit) |
| `scripts/lib/` | Shared utilities (workflow-utils, token-utils, conduit-errors, conduit-metadata, ux-ledger, hardcoded-detect, proof-templates) |
| `handoff/` | Generated exchange payloads between code and Figma (gitignored) |
| `figma-plugins/` | Figma plugin source (renderer.js) + generated code.js |
| `proof/` | Generated proof artifacts — screenshots, HTML reports (gitignored) |
| `tests/` | Contract test fixtures |
| `docs/` | Workflow, setup, and design system documentation |

## Data Flow

### Code → Figma
1. `build:tokens` reads `tokens/figma-variables.json` → generates `tokens.css`, `tokens.ts`
2. `loop:code-to-canvas` reads tokens + source sfids → writes `handoff/code-to-canvas.json`
3. Figma plugin or Conduit MCP applies the payload to Figma

### Figma → Code
1. Export `handoff/canvas-to-code.json` from Figma (plugin or manual)
2. `loop:verify-canvas` validates payload against contract (modes, screens, sfids, tokens)
3. `loop:canvas-to-code` applies canonical mode values back to `tokens/figma-variables.json`
4. `build:tokens` regenerates CSS/TS from updated source

### Proof Generation
1. `loop:proof` builds the site, starts preview server, captures screenshots per breakpoint
2. Runs all quality gates, generates HTML report + summary card
3. Archives to `proof/history/{timestamp}/`, symlinks to `proof/latest/`

## Config Files

| File | Purpose |
|------|---------|
| `studioflow.workflow.json` | Breakpoints, token frames, exchange file paths |
| `studioflow.manifest.json` | Runtime state (loop count, last sync timestamps) |
| `tokens/figma-variables.json` | Canonical token values (single source of truth) |
| `.env.local` | Figma API credentials (gitignored) |

## Quality Gates

All gates run via `npm run check`:
- `verify:tokens-sync` — generated CSS/TS matches source JSON
- `verify:no-hardcoded` — no raw colors/units in src/
- `verify:id-sync` — sfid parity between code and snapshots/manifest
- `tsc --noEmit` — TypeScript compiles

## Key Invariants

1. `tokens/figma-variables.json` is the single source of truth for all design tokens
2. `data-sfid` anchors are stable identifiers shared between code and Figma
3. Canvas payloads must pass contract verification before code apply
4. All style values in `src/` must use CSS custom properties (no hardcoded values)
