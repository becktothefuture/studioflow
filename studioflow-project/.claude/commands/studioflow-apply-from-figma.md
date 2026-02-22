# StudioFlow: Apply from Figma

Sync approved Figma edits back into code.

## Runbook

1. Export the approved canvas state to `handoff/canvas-to-code.json`.
   - Must include: `tokenFrames`, `variableModes` (all 4 breakpoints with token values), `screens`, `sfids`.
   - Set `source: "figma-canvas"` and `integrationMode: "design-first"` or `"code-first"`.

2. Verify the payload:
```bash
npm run loop:verify-canvas
```

3. Apply verified payload:
```bash
npm run loop:canvas-to-code
```

4. Run quality gates:
```bash
npm run check
npm run build
```

## What Changes

- `tokens/figma-variables.json` gets updated with new token values from the desktop (canonical) breakpoint mode.
- `tokens/tokens.css`, `tokens/tokens.ts`, `src/styles/tokens.css` are regenerated.
- A snapshot is saved to `snapshots/`.

## Rules

- Never apply without `loop:verify-canvas` passing first.
- If verification fails, report the exact errors and fix the payload.
- Preserve `color-mix()` and `clamp()` expressions — do not replace them with resolved values unless the designer explicitly changed the expression itself.
