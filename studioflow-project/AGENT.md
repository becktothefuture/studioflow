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

## Workflow: Code → Figma

```bash
npm run build:tokens
npm run loop:code-to-canvas
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

Use `.claude/commands/` for repeatable workflows:
- `studioflow-sync-to-figma` — push code state to Figma
- `studioflow-apply-from-figma` — apply Figma edits back to code
- `studioflow-verify` — run all quality gates
