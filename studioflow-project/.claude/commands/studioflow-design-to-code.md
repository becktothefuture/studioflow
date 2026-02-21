# StudioFlow: Design -> Code

Use when Figma is the source of truth.

## Runbook

1. Export approved canvas payload to:
- `handoff/canvas-to-code.json`

2. Set payload fields:
- `source: "figma-canvas"`
- `integrationMode: "design-first"`

3. Validate and apply:
```bash
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run manifest:update
```

## Promotion Rule

If provider is `figma-make`, treat as exploratory until `loop:verify-canvas` passes.
