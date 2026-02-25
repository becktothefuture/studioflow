# StudioFlow For Designers

StudioFlow keeps approved design intent aligned between Figma and code.

## What You Get
- A deterministic `code -> Figma -> code` loop.
- Token-first styling and stable `sfid` anchors.
- Contract gates that block unsafe apply steps.
- Proof artifacts for auditability after each apply.

## Quick Start

```bash
npm install
npm run dev
```

## Daily Roundtrip

1. Generate outbound payload:
```bash
npm run sync:push
```

2. In Figma, apply `handoff/code-to-canvas.json` through Conduit/plugin and export `handoff/canvas-to-code.json`.

3. Pull approved changes back into code:
```bash
npm run sync:pull
```

## Primary Docs
- `docs/DESIGN_SYSTEM_AND_FIGMA_SYNC.md` — canonical parity guide and universal workflow.
- `docs/PARITY_CHANGE_PROGRAM.md` — prioritized implementation program to reach full parity.
- `docs/PRD_PARITY_STABILIZATION.md` — current sprint PRD for concrete parity fixes.
- `docs/PROJECT_OVERVIEW_DELTA.md` — before-vs-now overview and inspection path.
- `docs/DESIGN_SYSTEM_STANDARD.md` — invariant token and breakpoint standards.
- `docs/MCP_SETUP.md` — MCP client/server setup.
- `docs/CONDUIT_SETUP.md` — Conduit + plugin setup.
