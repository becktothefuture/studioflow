# Demo: Website Roundtrip (Code -> Figma -> Code)

This demo uses the current StudioFlow landing page as the source design.

Goal:
1. push this website to Figma Canvas,
2. customize tokens and layout behavior across 4 breakpoints,
3. sync approved updates back to code.

## What this demo proves

- The website can be used as a live example design.
- Token edits in Figma are preserved across `mobile/tablet/laptop/desktop`.
- Contract validation blocks invalid payloads before code changes.
- Resync updates token source + generated artifacts + snapshots + manifest.

## Prerequisites

```bash
npm run setup:project
```

If `check:mcp` fails, complete `docs/CLAUDE_CODE_SETUP.md` first.

## Path A: Real Figma roundtrip

### 1) Generate handoff from website code

```bash
npm run loop:code-to-canvas
```

Generated files:
- `handoff/code-to-canvas.json`
- `handoff/canvas-to-code.template.json`

### 2) Push to Figma with Claude Code

Prompt in Claude Code:

```text
Use handoff/code-to-canvas.json.
Push the current website structure into Figma Canvas.
Create or update token frames:
- Tokens / Colors
- Tokens / Typography
- Tokens / Spacing
Create/update variable modes:
- mobile (390)
- tablet (768)
- laptop (1280)
- desktop (1440)
Create/update screens:
- Screen / Mobile
- Screen / Tablet
- Screen / Laptop
- Screen / Desktop
Preserve all sfid IDs from the payload.
```

### 3) Customize in Figma

Example customizations to perform in Figma:
- adjust brand primary and secondary token values per breakpoint,
- adjust title scale per breakpoint,
- adjust panel width and spacing tokens per breakpoint,
- keep all screens token-driven.

### 4) Export approved contract back to repo

Save as:
- `handoff/canvas-to-code.json`

### 5) Verify and apply

```bash
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run manifest:update
```

## Path B: Local simulated demo (no live Figma needed)

This path generates a deterministic example payload with per-breakpoint token edits.

```bash
npm run loop:code-to-canvas
npm run demo:website:generate
npm run demo:website:verify
npm run demo:website:apply
npm run check
npm run build
npm run manifest:update
```

One-shot command:

```bash
npm run demo:website:run
```

(`demo:website:run` already includes `manifest:update`.)

One-shot capture + proof report:

```bash
npm run demo:website:capture
```

Output proof file:
- `proof/latest/index.html`
- `proof/latest/summary-card.png`

## Expected output files after apply

- `tokens/figma-variables.json`
- `tokens/figma-breakpoint-variables.json`
- `tokens/tokens.css`
- `tokens/tokens.ts`
- `src/styles/tokens.css`
- `snapshots/figma-*.json`
- `studioflow.manifest.json`

## Compatibility alias path

If your team still uses Figma-named commands:

```bash
npm run loop:code-to-figma
npm run loop:verify-figma
npm run loop:figma-to-code
```

These commands delegate to the same v3 canvas internals.
