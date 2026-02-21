# Canvas Exchange Contract (Canonical v3)

`handoff/canvas-to-code.json` is the canonical v3 input for syncing Figma Canvas updates back into code.

## Required Top-Level Fields

- `generatedAt`: ISO timestamp
- `source`: `"figma-canvas"`
- `integration`: `"canvas-central"`
- `workflowVersion`: `"3.0.0"` (or current)
- `canvasProvider`: `"figma-sites" | "figma-make"`
- `integrationMode`: `"code-first" | "design-first"`
- `claudeSession`: object metadata (`agent`, `model`, optional `sessionId`)
- `tokenFrames`: array
- `variableModes`: array
- `screens`: array
- `sfids`: array of required stable IDs

## Required Structure

```json
{
  "generatedAt": "2026-02-21T20:00:00.000Z",
  "source": "figma-canvas",
  "integration": "canvas-central",
  "workflowVersion": "3.0.0",
  "canvasProvider": "figma-sites",
  "integrationMode": "code-first",
  "claudeSession": {
    "agent": "claude-code",
    "model": "opus",
    "sessionId": "optional"
  },
  "tokenFrames": [
    { "name": "Tokens / Colors", "tokenNames": ["color-brand-primary"] },
    { "name": "Tokens / Typography", "tokenNames": ["font-size-body"] },
    { "name": "Tokens / Spacing", "tokenNames": ["space-md"] }
  ],
  "variableModes": [
    {
      "name": "mobile",
      "width": 390,
      "values": {
        "color-brand-primary": "#1A5BFF"
      }
    }
  ],
  "screens": [
    {
      "name": "Screen / Mobile",
      "breakpoint": "mobile",
      "width": 390,
      "usesOnlyTokens": true,
      "sfids": ["sfid:hero-root"]
    }
  ],
  "sfids": ["sfid:hero-root"]
}
```

## Validation Rules

1. Token frames must include:
   - `Tokens / Colors`
   - `Tokens / Typography`
   - `Tokens / Spacing`
2. `variableModes` must include exactly:
   - `mobile` (390)
   - `tablet` (768)
   - `laptop` (1280)
   - `desktop` (1440)
3. Each mode must include values for every token from `tokens/figma-variables.json`.
4. Screens must include all four breakpoints with expected names and widths.
5. Every screen must set `usesOnlyTokens: true`.
6. `sfids` and each screen’s `sfids` must include every `data-sfid` from code.

## Commands

Validate only:

```bash
npm run loop:verify-canvas
```

Apply if valid:

```bash
npm run loop:canvas-to-code
```
