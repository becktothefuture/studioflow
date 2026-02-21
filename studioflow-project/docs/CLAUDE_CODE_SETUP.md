# Claude Code Setup (Fresh 2026)

This guide sets up Claude Code for StudioFlow with Figma MCP, contract gates, and a reliable Code -> Canvas -> Code loop.

## 1) Quick Start (Recommended)

From `studioflow-project`:

```bash
npm run setup:project
```

What this does:
- installs dependencies,
- prepares Claude templates and local command playbooks,
- installs Playwright Chromium for proof screenshots,
- runs contract/tests/checks,
- generates initial handoff payloads.

Then open Claude and complete Figma auth:

```bash
claude
```

Inside Claude, run:
```text
/mcp
```

Then run one of the repo playbooks in `.claude/commands/`.

## 2) Manual Setup (If you want full control)

1. Install Claude Code globally:
```bash
npm install -g @anthropic-ai/claude-code
```

2. Prepare repo-local config:
```bash
npm run setup:claude
```

3. Add Figma MCP server (project scope):
```bash
claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp
claude mcp list
```

4. Validate local setup:
```bash
npm run check:mcp
npm run test:contracts
npm run check
```

5. Optional, if you want asset regeneration from brand tokens:
```bash
npm run assets:brand
```

## 3) Custom Instructions That Strengthen the Link

StudioFlow already includes custom instructions for Claude Code here:
- `CLAUDE.md`

This file defines:
- the loop mission,
- non-negotiable invariants,
- standard operating sequence,
- how to handle failures,
- expected communication style.

Keep `CLAUDE.md` short, strict, and operational.

### Recommended custom instruction block

Use this pattern when extending `CLAUDE.md`:

```md
## Session Policy
1. Verify before apply: run `npm run loop:verify-canvas` before `npm run loop:canvas-to-code`.
2. Keep tokens canonical: only update token values through approved payloads.
3. Preserve sfids: do not remove `data-sfid="sfid:*"` anchors unless migration is intentional and verified.
4. Fail loud: if any gate fails, stop and report command + cause + minimal fix.
```

## 4) Repo "Skills" for Claude Code

Claude Code does not use Codex-style skill packages directly.
In this repo, the practical equivalent is:
- `.claude/commands/studioflow-code-to-canvas.md`
- `.claude/commands/studioflow-design-to-code.md`
- `.claude/commands/studioflow-loop-verify.md`
- `.claude/commands/README.md`

Think of these as reusable command playbooks for common loops.

This means: yes, the repo already includes the Claude-side skill equivalents needed to operate this workflow.

## 5) Best Practices (High Impact)

1. Always run `loop:verify-canvas` before `loop:canvas-to-code`.
2. Keep `tokens/figma-variables.json` as canonical token source.
3. Preserve all `data-sfid="sfid:*"` anchors unless intentionally migrated.
4. Use small PRs that isolate one loop change at a time.
5. Run `test:contracts`, `check`, and `build` before merge.
6. Use `demo:website:capture` for stakeholder-ready proof output.
7. Keep exploratory canvas work in `figma-make`, promote via verification.
8. Prefer `loop:run` for disciplined end-to-end updates.
9. Keep generated artifacts out of commits unless intentionally sharing evidence.

## 6) Suggested Model Policy

- Primary reasoning / architecture: `opus`
- High-volume mechanical patching fallback: `sonnet`
- Lightweight triage/checks: `haiku`

Set in:
- `.claude/settings.local.json`

Template is provided at:
- `.claude/settings.local.json.example`

## 7) First-Day Commands

```bash
npm run loop:code-to-canvas
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run loop:proof
```

Proof outputs:
- `proof/latest/index.html`
- `proof/latest/summary-card.png`

## 8) Core vs Optional Commands

Core loop commands:
- `loop:code-to-canvas`
- `loop:verify-canvas`
- `loop:canvas-to-code`
- `check`
- `build`
- `manifest:update`

Optional support commands:
- `assets:brand` (refresh generated media assets from brand token values)
- `verify:copy-tone` (checks public copy phrasing rules)
