# StudioFlow Commands

Repeatable workflows for Claude Code sessions.

## Available Commands

- **studioflow-sync-to-figma** — Push code state to Figma via Conduit MCP
- **studioflow-apply-from-figma** — Apply verified Figma edits back to code
- **studioflow-verify** — Run all quality gates

## Token Rules

1. **No CSS functions in token values.** No `color-mix()`, `clamp()`, `calc()`, or `var()` references.
2. **Colors are hex.** All 14 color tokens are literal hex values. Derived colors are pre-computed.
3. **Dimensions keep `px` units.** Spacing, sizing, radius, font-size values include `px` (valid CSS, Figma strips the unit via `parseFloat()`).
4. **Unitless numbers are plain.** Weights, line-heights, opacities have no unit.
5. **Responsive behavior lives in CSS, not tokens.** Use `clamp()` in the stylesheet with the token as a bound (e.g., `clamp(56px, 6vw, var(--font-size-title))`).
6. **Strings stay as strings.** Font families, letter-spacing (em), motion (ms, cubic-bezier) are STRING type in Figma.
