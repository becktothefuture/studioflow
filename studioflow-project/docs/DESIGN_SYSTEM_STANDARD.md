# Design System Standard

Canonical standard for StudioFlow code↔Figma sync. This file defines invariant scales and mapping rules used by Cursor workflows, verification scripts, and Figma payload generation.

## Canonical Sources

- Token source: `tokens/figma-variables.json`
- Generated token artifacts: `tokens/tokens.css`, `tokens/tokens.ts`, `src/styles/tokens.css`
- Conduit payload: `handoff/code-to-canvas.json`
- Code↔Figma mapping artifact: `handoff/code-to-figma-mapping.json`

## Spacing Standard (8 + 2)

- Micro spacing: `space-xxs (2px)`, `space-xs (4px)`
- Core 8-step spacing scale:
  - `space-sm (8px)`
  - `space-ms (12px)`
  - `space-md (16px)`
  - `space-ml (20px)`
  - `space-lg (24px)`
  - `space-2xl (32px)`
  - `space-3xl (40px)`
  - `space-xl (44px)`
- Extended spacing for large layout rhythm: `space-xxl (64px)`

## Typography Standard

- Font families:
  - Base: `font-family-base`
  - Display: `font-family-display`
- Size scale:
  - `font-size-kicker`, `font-size-meta`, `font-size-body`, `font-size-h3`, `font-size-h2`, `font-size-title`
- Weights:
  - `font-weight-regular`, `font-weight-medium`, `font-weight-semibold`, `font-weight-bold`
- Line heights:
  - `font-line-height-title`, `font-line-height-snug`, `font-line-height-body`
- Letter spacing:
  - `font-letter-spacing-tight`, `font-letter-spacing-kicker`

## Color Roles

- Brand/background: `color-brand-bg`, `color-brand-surface`, `color-brand-panel`
- Text/content: `color-brand-text`, `color-brand-muted`, `color-brand-white`
- Borders/strokes: `color-brand-stroke`, `color-brand-stroke-strong`
- Brand accents: `color-brand-primary`, `color-brand-secondary`, `color-brand-accent`, `color-brand-signal`
- Status: `color-brand-good`, `color-brand-danger`

## Radii and Motion

- Radii: `radius-sm`, `radius-md`, `radius-lg`, `radius-xl`, `radius-pill`
- Motion durations: `motion-duration-fast`, `motion-duration-medium`, `motion-duration-intro`
- Motion easing: `motion-easing-standard`, `motion-easing-entrance`

## Breakpoints (Invariant)

- `mobile`: `390`
- `tablet`: `768`
- `laptop`: `1280`
- `desktop`: `1440`

These names and widths must match `studioflow.workflow.json` and Figma mode names.

## Conduit Schema + Version

- `handoff/code-to-canvas.json` includes `conduitVersion`.
- Current supported conduit version: `1.0.0`.
- Current workflow version: `4.0.0` (from `studioflow.workflow.json`).
- Key shape for conduit payload is documented in:
  - `docs/DESIGN_SYSTEM_AND_FIGMA_SYNC.md`
  - `docs/prd-figma-cursor-middle-layer.md`

## Bidirectional Mapping Contract (Code ↔ Figma)

The generated artifact `handoff/code-to-figma-mapping.json` contains one row per token with these columns:

- `codeTokenName`
- `cssVarName`
- `cssVarReference`
- `figmaGroupedName`
- `figmaType` (`COLOR`, `FLOAT`, `STRING`, `RESOLVED`)
- `bindingMode` (`variable-bound`, `resolved`)
- `bindableFigmaProperties`

Example rows:

| codeTokenName | cssVarName | figmaGroupedName | figmaType | bindableFigmaProperties |
| --- | --- | --- | --- | --- |
| `color-brand-primary` | `--color-brand-primary` | `color/brand-primary` | `COLOR` | `fills/*/color`, `strokes/*/color` |
| `space-md` | `--space-md` | `space/md` | `FLOAT` | `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `itemSpacing` |
| `font-family-base` | `--font-family-base` | `font/family-base` | `STRING` | `textStyle/fontFamily` |
| `motion-easing-standard` | `--motion-easing-standard` | `motion/easing-standard` | `RESOLVED` | `resolved` |
