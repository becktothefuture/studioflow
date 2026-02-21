# StudioFlow: Code -> Canvas

Use when code is the source of truth.

## Runbook

1. Prepare local state:
```bash
npm run build:tokens
npm run check
```

2. Generate handoff payload:
```bash
npm run loop:code-to-canvas
```

3. Export tokens for Figma import:
```bash
npm run export:tokens-studio
```

Import into Figma (one-time, or when tokens change):
- Plugins → Tokens Studio for Figma → load `tokens/tokens-studio-import.json`
- Export to Figma → Variables

4. Run deep bridge gate:
```bash
npm run check:figma-bridge
```

5. In Figma (via MCP), update token frames, modes, and screens from `handoff/code-to-canvas.json`.

6. Save approved payload to:
- `handoff/canvas-to-code.json`

7. Validate and apply:
```bash
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run manifest:update
```

## Guardrails

- Preserve all `sfid` anchors.
- Keep token-only styling.
- Keep all 4 breakpoints complete.
- Stop immediately on verification failure.
