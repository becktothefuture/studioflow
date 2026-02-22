# Canvas Exchange Contract (Canonical v3)

## Contract Purpose
`handoff/canvas-to-code.json` is the canonical payload for preserving intent from canvas back into source code. This contract keeps token semantics, breakpoint coverage, and stable identifiers aligned during roundtrip operations.

## Required Top-Level Fields
- `generatedAt`: ISO timestamp
- `source`: `"figma-canvas"`
- `integration`: `"canvas-central"`
- `workflowVersion`: `"3.0.0"` (or current)
- `canvasProvider`: `"figma-sites" | "figma-make"`
- `integrationMode`: `"code-first" | "design-first"`
- `clientSession`: object metadata (`agent`, `model`, optional `sessionId`)
- `tokenFrames`: array
- `variableModes`: array
- `screens`: array
- `sfids`: array of required stable identifiers

## Canonical Structure
```json
{
  "generatedAt": "2026-02-21T20:00:00.000Z",
  "source": "figma-canvas",
  "integration": "canvas-central",
  "workflowVersion": "3.0.0",
  "canvasProvider": "figma-sites",
  "integrationMode": "code-first",
  "clientSession": {
    "agent": "cursor",
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
1. Token frames must include `Tokens / Colors`, `Tokens / Typography`, and `Tokens / Spacing`.
2. Variable modes must include `mobile (390)`, `tablet (768)`, `laptop (1280)`, and `desktop (1440)`.
3. Each mode must include all token names defined in `tokens/figma-variables.json`.
4. Screens must include all four breakpoints with expected names and widths.
5. Each screen must set `usesOnlyTokens: true`.
6. `sfids` and screen-level `sfids` must include every required source `data-sfid` value.

## Intent-Preservation Guarantees Mapped to Commands
| Guarantee | Command | Required Evidence |
| --- | --- | --- |
| Stable component identity parity | `npm run verify:id-sync` | source `data-sfid` + snapshots |
| Full mode and screen coverage | `npm run loop:verify-canvas` | validated payload |
| Token-backed style integrity | `npm run verify:tokens-sync` + `npm run loop:verify-canvas` | token source and mode values |
| Apply blocked on incomplete coverage | `npm run loop:verify-canvas` | manifest gate outcome |

## Command Path
Validate payload only:
```bash
npm run loop:verify-canvas
```

Apply verified payload:
```bash
npm run loop:canvas-to-code
```

Generate proof and manifest evidence:
```bash
npm run loop:proof
npm run manifest:update
```
