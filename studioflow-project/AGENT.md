# StudioFlow Agent Operating Instructions

## Mission

Keep the StudioFlow roundtrip reliable:
- `code → Figma → code`
- token-first styling (zero hardcoded values in `src/`)
- stable `sfid` anchors across both environments
- 1:1 token fidelity: `tokens/figma-variables.json` is the single source of truth

## Non-Negotiables

1. Never introduce hardcoded style values where token values are expected.
2. Never remove or rename stable `data-sfid="sfid:*"` anchors without coordinated updates.
3. Never apply canvas payloads without successful contract verification.
4. Never write resolved `color-mix()` or `clamp()` values back into `figma-variables.json`.
5. Keep diffs minimal and task-scoped.

## Token Fidelity Rules

- `tokens/figma-variables.json` contains canonical token values including CSS expressions.
- `color-mix()` and `clamp()` are valid CSS. The browser evaluates them. Figma requires resolved values.
- For Figma sync, resolve expressions deterministically:
  - `color-mix(in srgb, A NN%, B)` → compute the hex color
  - `clamp(minPx, Nvw, maxPx)` → compute px for each breakpoint width
- Only 4 colors are literal hex (bindable as COLOR variables): `ink`, `signal`, `primary`, `secondary`.
- All other colors use computed hex fills in Figma (not variable bindings).
- Spacing/sizing tokens: strip `px` unit and bind as FLOAT variable.

Any MCP-capable client can run this workflow. Cursor is a common client.

For **Figma MCP design-to-code** and **code→Figma sync**: use `docs/DESIGN_SYSTEM_AND_FIGMA_SYNC.md` for the design system, token rules, three-phase pipeline, and Figma interpretation.

## Workflow: Code → Figma

```bash
npm run conduit:generate
npm run check
```

Use Conduit for write operations and Figma Dev Mode MCP for read context.

## Workflow: Figma → Code

```bash
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
```

## Quality Gates

- `npm run verify:tokens-sync` — generated CSS/TS matches source JSON
- `npm run verify:no-hardcoded` — no raw colors/units in `src/`
- `npm run verify:id-sync` — sfid parity between code and snapshots
- `npm run loop:verify-canvas` — canvas payload has all modes/screens/tokens/sfids
- `tsc --noEmit` — TypeScript compiles
- `npm run build` — Vite builds

If any gate fails, stop on failure and report the failing command, exact cause, and smallest safe fix.

## Commands

Use npm scripts for repeatable workflows from any MCP-capable client (Cursor, Claude Code, etc.):
- `npm run conduit:preview` — generate deterministic preview artifacts (`trust-ledger`, `preview-diff`)
- `npm run conduit:commit -- --run-id <preview-run-id>` — finalize preview with immutable receipt
- `npm run conduit:generate` — build tokens + generate `handoff/code-to-canvas.json` and mapping artifact
- `npm run report:token-coverage` — report token usage by category + hardcoded style violations
- `npm run conduit:doctor -- --code <ERROR_CODE>` — print deterministic recovery guidance
- `npm run sync:push` — unified code → Figma push (build:tokens + loop:code-to-canvas)
- `npm run sync:pull` — unified Figma → code pull (verify-canvas + canvas-to-code + build:tokens + check)
- `npm run scan:project` — scan source files for hardcoded values and component boundaries
- `npm run apply:token-map` — apply approved token map: add tokens to source and rewrite hardcoded values
- `npm run extract:content` — extract static content from JSX into content/content.json
- `npm run verify:binding-coverage` — report token/style binding status per sfid property
- `npm run migrate:sfids` — rename sfids across source files, snapshots, and manifest
- `npm run loop:code-to-canvas` — push code state to Figma handoff payload
- `npm run loop:verify-canvas` + `npm run loop:canvas-to-code` — apply Figma edits back to code
- `npm run check` — run all quality gates
