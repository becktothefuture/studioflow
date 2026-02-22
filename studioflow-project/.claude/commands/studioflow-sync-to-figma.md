# StudioFlow: Sync to Figma

Push the current code state into Figma using the deterministic plugin.

## Prerequisites

- Talk-to-Figma MCP connected (websocket bridge running, plugin open in Figma)
- Token variables exist in Figma (imported via Tokens Studio, or created by previous plugin run)

## Runbook

1. Build tokens and generate sync spec:
```bash
npm run build:tokens
npm run loop:code-to-canvas
```

2. Verify code quality gates pass:
```bash
npm run check
```

3. Use Talk-to-Figma MCP to run the StudioFlow Sync plugin in Figma:
- The plugin reads `handoff/code-to-canvas.json`
- It creates/updates screen frames for all 4 breakpoints
- It binds all available token variables by name (not by value)
- It computes `color-mix()` and `clamp()` values deterministically from the token source

4. After Figma edits are complete, export `handoff/canvas-to-code.json` from Figma.

5. Verify and apply:
```bash
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
```

## Token Fidelity Rules

- `color-mix()` and `clamp()` are canonical CSS expressions in code.
- For Figma, these are resolved deterministically per breakpoint at sync time.
- Never write resolved values back into `tokens/figma-variables.json`.
- Only 4 colors are bindable as COLOR variables: `ink`, `signal`, `primary`, `secondary`.
- Derived colors (`bg`, `surface`, `panel`, etc.) use computed hex fills, not variable bindings.
- Spacing/sizing tokens strip `px` units for Figma FLOAT properties.

## Guardrails

- Preserve all `sfid` anchors.
- Keep token-only styling in code (enforced by `verify:no-hardcoded`).
- Keep all 4 breakpoints complete.
- Stop on any verification failure.
