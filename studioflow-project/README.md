# StudioFlow Project

StudioFlow is a contract-first Code -> Canvas -> Code workflow for design engineers.

## Start Here

### Track A: Local proof in one shot

```bash
npm run setup:project
npm run demo:website:capture
```

Expected outputs:
- `proof/latest/index.html`
- `proof/latest/summary-card.png`

### Track B: Real Figma roundtrip

```bash
npm run setup:project
npm run loop:code-to-canvas
```

Then in Claude Code:
1. run `claude`,
2. run `/mcp` and complete auth,
3. push `handoff/code-to-canvas.json` into Figma,
4. export approved payload to `handoff/canvas-to-code.json`.

Apply and gate:

```bash
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run loop:proof
npm run manifest:update
```

## MCP Truth State

Treat MCP readiness as three explicit states:

1. Configured
- `.mcp.json` contains a `figma` server entry.

2. Registered
- `claude mcp list` shows `figma`.

3. Authenticated
- inside `claude`, `/mcp` succeeds and Figma tools respond.

Run checks:

```bash
npm run check:mcp
claude mcp list
```

If `claude mcp list` returns `No MCP servers configured`, run:

```bash
claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp
```

## Definition of Done

A complete roundtrip meets all conditions:
- `loop:verify-canvas` passes,
- token frames include `Tokens / Colors`, `Tokens / Typography`, `Tokens / Spacing`,
- variable modes include `mobile`, `tablet`, `laptop`, `desktop` with widths `390/768/1280/1440`,
- screens include all four breakpoints,
- `proof/latest/index.html` exists,
- `studioflow.manifest.json` is updated.

## Baseline Workflow

```bash
npm run loop:code-to-canvas
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run manifest:update
```

One-command happy path:

```bash
npm run loop:run
```

## Proof Points (Modeled)

Modeled outcomes to start internal benchmarking:

| Signal | Modeled range |
| --- | --- |
| Loop cycle time | `28-46%` faster |
| Breakpoint drift | `70-90%` lower |
| Token consistency | `95%+` pass rate |
| Post-handoff rework | `25-40%` lower |
| Team confidence | `+1.2 to +1.8` rubric points |

## Canonical Files

- Token source: `tokens/figma-variables.json`
- Breakpoint values: `tokens/figma-breakpoint-variables.json`
- Token artifacts: `tokens/tokens.css`, `tokens/tokens.ts`, `src/styles/tokens.css`
- Canvas handoff source: `handoff/code-to-canvas.json`
- Canvas handoff return: `handoff/canvas-to-code.json`
- Workflow config: `studioflow.workflow.json`
- Workflow manifest: `studioflow.manifest.json`

## Copy Tone Gate

```bash
npm run verify:copy-tone
```

Scope:
- `../README.md`
- `README.md`
- `src/components/Hero/HeroLogic.tsx`
- `src/components/Hero/HeroLayout.tsx`

## Docs

- `docs/STUDIOFLOW_WORKFLOW.md`
- `docs/CANVAS_EXCHANGE_CONTRACT.md`
- `docs/FIGMA_EXCHANGE_CONTRACT.md`
- `docs/CLAUDE_CODE_SETUP.md`
- `docs/DEMO_WEBSITE_ROUNDTRIP.md`
- `CLAUDE.md`
- `.claude/commands/README.md`
