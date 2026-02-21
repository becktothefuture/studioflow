# StudioFlow Claude Code Operating Instructions

This file is the in-repo contract for Claude Code sessions.

## Mission

Keep the StudioFlow loop reliable:
- `code -> canvas -> code`
- token-first styling
- stable `sfid` anchors
- proof artifacts generated on every serious loop run

## Non-Negotiables

1. Never introduce hardcoded style values where token values are expected.
2. Never remove or rename stable `data-sfid="sfid:*"` anchors without coordinated updates.
3. Never apply canvas payloads without successful contract verification.
4. Keep diffs minimal and task-scoped.

## Standard Operating Flow

1. Generate handoff:
```bash
npm run loop:code-to-canvas
```
2. Verify returned payload:
```bash
npm run loop:verify-canvas
```
3. Apply approved payload:
```bash
npm run loop:canvas-to-code
```
4. Run quality gate:
```bash
npm run check
npm run build
npm run manifest:update
```
5. Capture proof when needed:
```bash
npm run loop:proof
```

## Design-First Flow

If Figma is the source:
1. Save approved payload to `handoff/canvas-to-code.json`.
2. Set `integrationMode` to `design-first`.
3. Run verify/apply/check/build as above.

## Figma MCP Rules

1. Use project-scoped MCP config (`.mcp.json`).
2. Treat `figma-sites` as canonical provider.
3. Treat `figma-make` as exploratory; promote only after `loop:verify-canvas` passes.

## Quality Gates to Respect

- `npm run test:contracts`
- `npm run verify:tokens-sync`
- `npm run verify:no-hardcoded`
- `npm run verify:id-sync`
- `npm run check`
- `npm run build`

If any gate fails, stop and report:
- failing command,
- exact cause,
- smallest safe fix.

## Command Macros

Use command templates in `.claude/commands/` for repeatable workflows.
They are the repo-level equivalent of “skills” for Claude Code operations.

## Tone and Output

Write concise, factual updates.
Prioritize signal over flourish.
Use direct language and concrete commands.
