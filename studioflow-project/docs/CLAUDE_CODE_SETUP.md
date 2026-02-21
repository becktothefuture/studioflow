# Claude Code Setup (Fresh 2026)

This guide sets up Claude Code for StudioFlow with a reliable Code -> Canvas -> Code loop.
It mirrors the official Figma guide for Claude Code to Figma:
- https://www.figma.com/blog/introducing-claude-code-to-figma/

Quick-launch menu and full run plan:
- `docs/ON_YOUR_MARKS_SET_GO.md`

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

After checks pass, use the installer menu directly:
- `1` Send website to Figma (recommended),
- `2` Create a local proof report,
- `3` Advanced tools,
- `q` Quit installer.

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
claude mcp add --transport http figma https://mcp.figma.com/mcp --scope user
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
npm run check:figma-bridge
```

Bridge smoke test (official flow):

1. Keep Claude open.
2. In a Figma file, run a simple prompt like:

```text
Capture this UI in Figma.
```

If Claude can create/update content in your open Figma file, the bridge is live.

## 2.1) Deep bridge gate (automated)

`check:figma-bridge` performs all of these:
- runs MCP health validation,
- regenerates code-to-canvas payload,
- validates token/mode/screen payload completeness,
- generates variable upsert plan,
- if `FIGMA_ACCESS_TOKEN` and `FIGMA_FILE_KEY` are present:
  - validates `/me`,
  - validates file access,
  - validates variables endpoint access (Enterprise plan only),
  - writes/updates a real test variable collection (`StudioFlow Bridge Check`) and test variable (`bridge-check/ping`) for all four modes (Enterprise plan only).

Non-Enterprise users: skip strict mode. Variables are imported via Tokens Studio plugin instead (see section 2.3).

Strict mode (require live write checks):

```bash
STUDIOFLOW_STRICT_FIGMA_BRIDGE=1 FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=... npm run check:figma-bridge
```

## 2.2) Always-on bridge monitor (terminal)

Foreground mode:

```bash
npm run monitor:figma-bridge
```

Detached mode:

```bash
npm run monitor:figma-bridge:start
npm run monitor:figma-bridge:status
npm run monitor:figma-bridge:stop
```

Spawn directly from installer:

```bash
STUDIOFLOW_SPAWN_BRIDGE_MONITOR=1 npm run setup:project
```

Optional cadence controls:

```bash
STUDIOFLOW_MONITOR_INTERVAL=45 STUDIOFLOW_MONITOR_DEEP_EVERY=3 npm run monitor:figma-bridge:start
```

## 2.3) Tokens Studio variable import (any Figma plan)

StudioFlow tokens are imported into Figma as variables using the free Tokens Studio plugin. This replaces the Enterprise-only Variables REST API for most users.

Generate the import file:

```bash
npm run export:tokens-studio
```

This creates `tokens/tokens-studio-import.json` with all tokens across 4 breakpoint modes (mobile, tablet, laptop, desktop).

Import steps (one-time, or when source tokens change):
1. Open your Figma file.
2. Plugins → **Tokens Studio for Figma** (install from Figma Community if needed).
3. Load the JSON file from `tokens/tokens-studio-import.json`.
4. Export to Figma → Variables.
   - **Free tier**: export each token set individually.
   - **Pro tier** ($5/mo): export from Themes → creates 1 collection with 4 modes (recommended).

Once variables exist in Figma, they persist. Claude/MCP references them when pushing the design.

Enterprise users with `file_variables` scopes can still use the fully automated path:

```bash
FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=... npm run figma:variables:sync
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
claude mcp add --transport http figma https://mcp.figma.com/mcp --scope user
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
