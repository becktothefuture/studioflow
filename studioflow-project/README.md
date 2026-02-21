# StudioFlow Project

StudioFlow is a design-engineering loop with measurable proof built into day-to-day shipping.

## Fast Start

```bash
npm install
npm run assets:brand
npm run build:tokens
npm run check
npm run dev
```

## Claude Quick Start

```bash
npm run setup:claude
npm run check:mcp
```

Then:
1. start Claude with `claude`,
2. run `/mcp` and complete Figma auth,
3. use playbooks in `.claude/commands/`.

## Baseline Workflow

```bash
npm run loop:code-to-canvas
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run manifest:update
```

## Copy Tone Gate

```bash
npm run verify:copy-tone
```

Scope:
- `../README.md`
- `README.md`
- `src/components/Hero/HeroLogic.tsx`
- `src/components/Hero/HeroLayout.tsx`

## Two-Color Brand Control

Canonical inputs in `tokens/figma-variables.json`:
- `color.brand.ink`
- `color.brand.signal`

Regenerate token artifacts:

```bash
npm run build:tokens
```

Regenerate shader-aligned brand assets:

```bash
npm run assets:brand
```

Generated assets:
- `assets/studioflow-shader-loop.mp4`
- `assets/studioflow-shader-loop.webm`
- `assets/studioflow-shader-still.png`
- `assets/divider-loop.mp4`
- `assets/divider-loop.webm`
- `assets/studioflow-divider.gif`
- `assets/studioflow-divider.png`
- `assets/studioflow-logo.png`

## Canonical Files

- Token source: `tokens/figma-variables.json`
- Token artifacts: `tokens/tokens.css`, `tokens/tokens.ts`, `src/styles/tokens.css`
- Canvas contract: `handoff/canvas-to-code.json`
- Workflow manifest: `studioflow.manifest.json`
- Workflow config: `studioflow.workflow.json`

## Docs

- `docs/STUDIOFLOW_WORKFLOW.md`
- `docs/CANVAS_EXCHANGE_CONTRACT.md`
- `docs/FIGMA_EXCHANGE_CONTRACT.md`
- `docs/CLAUDE_CODE_SETUP.md`
- `docs/DEMO_WEBSITE_ROUNDTRIP.md`
- `CLAUDE.md`
- `.claude/commands/README.md`

## Demo Capture

```bash
npm run demo:website:capture
```

Output:
- `proof/latest/index.html`
- `proof/latest/summary-card.png`
