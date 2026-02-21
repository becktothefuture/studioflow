# Claude Code Setup (Fresh 2026)

This guide sets up Claude Code for StudioFlow with a reliable Code -> Canvas -> Code loop.

## 1) One-command setup

From `studioflow-project`:

```bash
npm run setup:project
```

This command runs:
- dependency install,
- Claude local config prep,
- Playwright Chromium install,
- token/contracts/check gates,
- initial code-to-canvas payload generation.

## 2) MCP readiness (hard checks)

Treat setup as complete only when all three checks pass.

### Check A: config exists

```bash
cat .mcp.json
```

Expected: a `figma` server entry with `https://mcp.figma.com/mcp`.

### Check B: Claude registers the server

```bash
claude mcp list
```

Expected: output includes `figma`.

If output is `No MCP servers configured`, run:

```bash
claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp
claude mcp list
```

### Check C: auth is active in session

```bash
claude
```

Inside Claude:

```text
/mcp
```

Complete Figma auth flow. Then run:

```bash
npm run check:mcp
```

## 3) Manual setup path (full control)

1. Install Claude CLI:

```bash
npm install -g @anthropic-ai/claude-code
```

2. Create local Claude config files:

```bash
npm run setup:claude
```

3. Add and verify Figma MCP:

```bash
claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp
claude mcp list
npm run check:mcp
```

4. Optional Code Connect setup:

```bash
npm install --save-dev @figma/code-connect
npx figma connect create
```

## 4) First-day loop commands

```bash
npm run loop:code-to-canvas
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run loop:proof
npm run manifest:update
```

Proof outputs:
- `proof/latest/index.html`
- `proof/latest/summary-card.png`

## 5) Fast failure policy

Stop the loop immediately on any failing gate and report:
- failing command,
- exact error,
- smallest safe fix.

Core gates:
- `npm run test:contracts`
- `npm run loop:verify-canvas`
- `npm run check`
- `npm run build`

## 6) Claude playbooks in this repo

Use these command playbooks for repeatable operation:
- `.claude/commands/studioflow-code-to-canvas.md`
- `.claude/commands/studioflow-design-to-code.md`
- `.claude/commands/studioflow-loop-verify.md`

## 7) Suggested model policy

- primary: `opus`
- execution fallback: `sonnet`
- lightweight triage: `haiku`

Configured via:
- `.claude/settings.local.json`
- `.claude/settings.local.json.example`
