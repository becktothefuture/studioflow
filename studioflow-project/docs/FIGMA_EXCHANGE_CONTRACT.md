# Figma Exchange Contract (Compatibility Layer)

This document describes the legacy alias contract used by:
- `handoff/figma-to-code.json`
- `handoff/figma-to-code.template.json`

Canonical v3 contract now lives in:
- `docs/CANVAS_EXCHANGE_CONTRACT.md`

## Why This Still Exists

StudioFlow v3 is canvas-central, but older scripts and external integrations may still consume Figma-named handoff files. To avoid breaking existing workflows, v3 keeps these aliases.

## Compatibility Behavior

- `loop:code-to-figma` delegates to `loop:code-to-canvas` and writes alias files.
- `loop:verify-figma` delegates to `loop:verify-canvas`.
- `loop:figma-to-code` delegates to `loop:canvas-to-code`.

Alias mapping:
- `source: "figma"` is normalized to canonical `source: "figma-canvas"` during validation/apply.

## Legacy Shape (Supported)

```json
{
  "source": "figma",
  "tokenFrames": [],
  "variableModes": [],
  "screens": []
}
```

New fields added by v3 (and supported in aliases):
- `canvasProvider`
- `integrationMode`
- `sfids`
- `claudeSession`

For full required fields and strict rules, use `docs/CANVAS_EXCHANGE_CONTRACT.md`.
