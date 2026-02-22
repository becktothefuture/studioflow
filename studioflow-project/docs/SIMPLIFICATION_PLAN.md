# StudioFlow Simplification Plan

## Scope Reduction

### KEEP (core loop)

| File/Dir | Why |
| --- | --- |
| `tokens/figma-variables.json` | Single source of truth |
| `scripts/build-tokens.mjs` | Generates CSS/TS from source |
| `scripts/lib/workflow-utils.mjs` | Shared utilities |
| `scripts/loop-code-to-canvas.mjs` | Generates sync spec for Figma |
| `scripts/loop-verify-canvas.mjs` | Contract verification gate |
| `scripts/loop-canvas-to-code.mjs` | Applies verified Figma edits back |
| `scripts/verify-tokens-sync.mjs` | Catches stale generated files |
| `scripts/verify-no-hardcoded.mjs` | Enforces token-only styling |
| `scripts/verify-id-sync.mjs` | Enforces sfid parity |
| `scripts/test-canvas-contracts.mjs` | Fixture tests for verification |
| `scripts/manifest-update.mjs` | Records loop outcomes |
| `scripts/loop-proof.mjs` | Proof artifact generation |
| `src/` | Website application |
| `tokens/tokens.css`, `tokens.ts` | Generated build artifacts |
| `handoff/code-to-canvas.json` | Outbound sync spec |
| `handoff/canvas-to-code.json` | Inbound verified payload |
| `handoff/canvas-to-code.template.json` | Template for payload creation |
| `studioflow.workflow.json` | Workflow configuration |
| `studioflow.manifest.json` | Loop evidence |
| `figma-plugins/studioflow-screens/` | Figma plugin (REFACTOR) |
| `.claude/commands/` | Claude Code skills |

### DELETE (no longer needed)

| File/Dir | Why |
| --- | --- |
| `scripts/export-tokens-studio.mjs` | Replaced by plugin-driven variable creation. Keep Tokens Studio as optional manual fallback documented in README, but remove the automated script. |
| `scripts/figma-sync-variables.mjs` | Enterprise-only REST API. Not needed when plugin creates variables. |
| `scripts/loop-code-to-figma.mjs` | Alias wrapper, adds nothing |
| `scripts/loop-verify-figma.mjs` | Alias wrapper, adds nothing |
| `scripts/loop-figma-to-code.mjs` | Alias wrapper, adds nothing |
| `scripts/check-figma-bridge.mjs` | Bridge monitor for official MCP, not needed for Conduit |
| `scripts/check-mcp-health.mjs` | MCP health check, replaced by direct plugin connection |
| `scripts/monitor-figma-bridge.mjs` | Bridge monitor daemon |
| `scripts/snapshot-figma.mjs` | Redundant with loop-canvas-to-code snapshots |
| `figma-plugins/create-screen-frames.js` | Dev console paste script, replaced by plugin |
| `figma-plugins/bind-variables.js` | Dev console paste script, replaced by plugin |
| `handoff/code-to-figma.json` | Alias file |
| `handoff/figma-to-code.json` | Alias file |
| `handoff/figma-to-code.template.json` | Alias file |
| `handoff/figma-variables.upsert.json` | Enterprise REST payload |
| `tokens/tokens-studio-import.json` | Auto-generated, can regenerate if needed |
| `tokens/figma-breakpoint-variables.json` | Intermediate file, folded into sync spec |
| `docs/FIGMA_EXCHANGE_CONTRACT.md` | Legacy alias contract |
| `docs/CLAUDE_CODE_SETUP.md` | Replaced by simplified CLAUDE.md |

### REFACTOR

#### `studioflow.workflow.json`
Remove:
- `compatibility.enableFigmaAliases` (no more aliases)
- `canvas.providers` / `canonicalProvider` / `exploratoryProvider` / `promotionRule` (one path now)
- `modelPolicy` (not workflow config)
- `exchangeFiles.codeToFigma`, `figmaToCode`, `figmaToCodeTemplate`, `breakpointVariables`

#### `scripts/loop-code-to-canvas.mjs`
Remove:
- Figma alias writes (`toFigmaAliasPayload`, `codeToFigma` writes)
- `compatibility` checks
- Keep: token extraction, sync spec generation, template generation

#### `scripts/loop-verify-canvas.mjs`
Remove:
- `toFigmaAliasPayload` writes
- `compatibility` conditional
- `claudeSession` requirement (metadata, not critical for verification)

#### `scripts/loop-canvas-to-code.mjs`
Remove:
- `toFigmaAliasPayload` writes
- `compatibility` conditional

#### `scripts/lib/workflow-utils.mjs`
Remove:
- `toFigmaAliasPayload()` function

#### `figma-plugins/studioflow-screens/code.js`
Major refactor needed:
- Remove hardcoded `C` color object → compute from token source
- Remove hardcoded `SCALE` object → compute `clamp()` per breakpoint
- Remove `bindAllVariables()` bind-by-value approach
- Add: bind-by-name at creation time
- Add: `color-mix()` resolver function
- Add: `clamp()` resolver function
- Add: unit stripper (`"16px"` → `16`) for Figma FLOAT properties

#### `package.json` scripts
Remove:
- `loop:code-to-figma`, `loop:verify-figma`, `loop:figma-to-code`
- `figma:variables:plan`, `figma:variables:sync`
- `export:tokens-studio`
- `check:mcp`, `check:figma-bridge`
- `monitor:figma-bridge`, `monitor:figma-bridge:start/stop/status`
- `demo:figma:prep`

## Token Fidelity: The 63 Token Classification

### 4 tokens → Figma COLOR variable (bindable to fills/strokes)
- `color-brand-ink` (#070A13)
- `color-brand-signal` (#88AEBF)
- `color-brand-primary` (#7A8DFF)
- `color-brand-secondary` (#7EF7F0)

### 10 tokens → Computed hex (resolved at sync time, NOT variables)
- `color-brand-bg`, `surface`, `panel`, `text`, `muted`, `stroke`, `stroke-strong`, `accent`, `good`, `danger`
- Plugin resolves `color-mix()` → hex → applies as fill/stroke value

### 8 tokens → Figma FLOAT variable (bindable to numeric props)
- `opacity-full`, `opacity-bg-fallback`
- `font-weight-regular`, `medium`, `semibold`, `bold`
- `font-line-height-body`, `font-line-height-title`

### 19 tokens → Figma FLOAT variable (strip `px` unit)
- `space-xxs` through `space-xxl` (7)
- `size-border-default`, `size-border-strong` (2)
- `radius-sm` through `radius-pill` (5)
- `font-size-body`, `h3`, `kicker`, `meta` (4)
- `size-logo` (1)

### 2 tokens → Computed FLOAT per breakpoint (resolved `clamp()`)
- `font-size-title`: `clamp(56px, 6vw, 92px)` → 56/56/77/86 per breakpoint
- `font-size-h2`: `clamp(26px, 4vw, 42px)` → 26/31/42/42 per breakpoint

### 20 tokens → STRING only (not bindable to Figma node properties)
- Sizes with `%`, `dvh`, compound values: `size-full`, `size-viewport`, `size-intro-height`, `size-shell-max`, `size-content-max`, `size-card-min`, `size-button-min-width`, `size-blur-soft`, `size-blur-strong`
- Font families: `font-family-base`, `font-family-display`
- Letter spacing with `em`: `font-letter-spacing-kicker`, `font-letter-spacing-tight`
- Shadows: `shadow-card`, `shadow-glow`
- Motion: `motion-duration-intro`, `fast`, `medium`
- Easing: `motion-easing-standard`, `entrance`
- Mix: `mix-bg-strong`

## Risk Mitigation

### Conduit MCP reliability
- It's community-maintained (Grab, 6.3k stars)
- Requires: local websocket server + Figma plugin running
- Mitigation: treat as local dev tool, not CI dependency
- Fallback: Tokens Studio manual import still works for variables

### Variable binding coverage
- Some Figma properties can't be bound to variables (e.g., `letterSpacing` in some units)
- Mitigation: plugin should log every unbound property so you can track coverage

### `color-mix()` resolver accuracy
- Must match CSS spec: `color-mix(in srgb, colorA NN%, colorB)`
- Risk: rounding differences between plugin math and browser rendering
- Mitigation: resolve using the same math (linear interpolation in sRGB), round to 8-bit per channel
