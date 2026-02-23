# Design System & Code-to-Figma Sync

Single reference for the StudioFlow design system, token rules, code→Figma sync pipeline, and Figma MCP integration. Use for CLAUDE.md, Cursor rules, or agent prompts when implementing from Figma or working on the roundtrip.

**Scope:** This doc covers the **design system structure**, the **three-phase code→Figma sync**, **current state and gaps**, and **how to improve Figma interpretation**. Sync from Figma back to code is a separate flow (see AGENT.md and CONDUIT_SETUP.md) once code→Figma is stable.
**Canonical standard:** `docs/DESIGN_SYSTEM_STANDARD.md` is the invariant reference for spacing/typography/colour/radii/motion/breakpoints and the code↔Figma mapping contract.


---

## 1. Design system standard (invariant)

The token system follows a **fixed design-system standard** so any project can be rolled out the same way. Use `docs/DESIGN_SYSTEM_STANDARD.md` for canonical definitions.

- **Spacing:** 8 base spacing values + 2 micro spacing values (e.g. `xxs`, `xs` for micro; then `sm` … `xxl` or equivalent 8-step scale). All paddings, gaps, and rhythm map to these tokens.
- **Sizes / layout:** Systematised tokens for borders, radii, min/max widths, key heights (e.g. button height). No ad-hoc px in styles.
- **Colour:** Semantic colour tokens (brand primaries, surfaces, text, muted, stroke). No raw hex in component styles.
- **Typography:** Font family, size scale, weight scale, line-height (prefer percentage or unitless ratio), letter-spacing. All text styles use tokens.
- **Motion / effects:** Duration and easing tokens; shadow tokens where needed.
- **Breakpoints:** Exactly four modes — **mobile** (390), **tablet** (768), **laptop** (1280), **desktop** (1440). Mode names and widths live in `studioflow.workflow.json`; Figma mode name must equal workflow breakpoint name.
- **Non-token values:** Anything that cannot be a variable (e.g. complex shadows, gradients) is captured as **named styles** (e.g. “Card”, “Button”, “Gradient / Brand +20hue”) that reference tokens where possible.

---

## 2. Design system structure in this repo

### 2.1 Token definitions

**Where defined**

- **Single source of truth:** `tokens/figma-variables.json` — nested JSON (e.g. `color.brand.ink.value`, `space.sm.value`, `font.size.body.value`).
- **Generated (do not edit):** `tokens/tokens.css`, `tokens/tokens.ts`, `src/styles/tokens.css`.

**Format**

- Nested JSON with `value` at leaves. Flattened names in code: first path segment + rest joined with `-` (e.g. `color-brand-ink`, `space-sm`, `font-size-body`).
- CSS: `var(--color-brand-ink)`. TypeScript: `tokens["color-brand-ink"]` → `"var(--color-brand-ink)"`.

**Transformation**

- **Build:** `scripts/build-tokens.mjs` → `npm run build:tokens`.
- **Figma sync:** `scripts/loop-code-to-canvas.mjs` assigns tokens to **token frames** via `studioflow.workflow.json`:
  - **Tokens / Colors** — prefix `color`
  - **Tokens / Typography** — prefix `font`
  - **Tokens / Spacing** — prefixes `space`, `size`, `radius`, `shadow`, `opacity`, `z`
- **Figma variable names:** Plugin replaces the **first** `-` with `/` (e.g. `color-brand-ink` → `color/brand-ink`). Any script or MCP that writes variables should use this same rule.

**Rules**

1. Add or change tokens only in `tokens/figma-variables.json`; then run `npm run build:tokens`.
2. In `src/`, use only token names (enforced by `verify:no-hardcoded`). When implementing from Figma, map to existing tokens or add new ones to the JSON and regenerate.
3. Do not write resolved `color-mix()` or `clamp()` back into `figma-variables.json`; keep expressions there and resolve at sync time for Figma.
4. Generate conduit + mapping artifacts from a single entrypoint: `npm run conduit:generate`.

**Colors in Figma**

- Only a subset are bindable as Figma COLOR variables (e.g. ink, signal, primary, secondary); others are resolved (e.g. from `color-mix()`) and applied as hex fills. Document or log which tokens are “variable-bound” vs “resolved fill” so designers know what updates with mode.

### 2.2 Component library

- **Location:** `src/components/` (Hero/, Background/). React only; no separate design-system package.
- **Styling:** Global CSS in `src/styles/globals.css` with BEM-like class names (e.g. `.hero-panel`, `.button-primary`). No CSS Modules or styled-components; all token-based.
- **Stable IDs:** Elements that roundtrip use `data-sfid="sfid:hero-root"` (and similar). Do not remove or rename without updating handoff/snapshots.
- **No Storybook.** For Figma-to-code, use tokens + class names + `data-sfid` mapping.

**Implementing a Figma component:** (1) Map to an existing or new class; (2) use only `var(--token-name)` in CSS; (3) add the same `data-sfid` in code if the node has a stable ID in Figma.

### 2.3 Frameworks & libraries

- React 18, Vite 5, TypeScript. Plain CSS only; no Tailwind or CSS-in-JS.
- When generating code from Figma: emit React + CSS with `var(--token-name)`; map Figma typography/fills to our token names.

### 2.4 Asset management

- Images referenced from `src/` (e.g. `import logoMark from "../../../assets/studioflow-logo.png"`). No central `public/` asset list. Base path via `STUDIOFLOW_BASE_PATH` in Vite if needed.
- **Figma:** Use localhost or provided image/SVG URLs from the Figma payload; do not add new icon packages.

### 2.5 Icon system

- No dedicated icon system. Icons are inline assets or SVGs. Use assets from the Figma payload; do not introduce new icon packages.

### 2.6 Styling approach

- Single stylesheet: `src/styles/globals.css` imports `tokens.css`. BEM-like naming.
- **Responsive:** Four breakpoints in workflow only; no `@media` for layout in the current demo. Responsive typography uses `clamp()` (e.g. hero title). Spacing/sizing in Figma can be scaled per mode by the plugin; in CSS we use one value per token (and `clamp()` where needed).
- Never use raw hex, px/rem/em, or `calc()` in `src/` except inside `var(--...)` (enforced by `verify:no-hardcoded`).

### 2.7 Project structure

```
studioflow-project/
├── tokens/
│   ├── figma-variables.json   # Source of truth
│   ├── tokens.css             # Generated
│   └── tokens.ts              # Generated
├── src/
│   ├── styles/
│   │   ├── tokens.css         # Generated copy
│   │   └── globals.css       # All component styles
│   ├── components/ (Hero/, Background/)
│   └── main.tsx
├── handoff/
│   ├── code-to-canvas.json    # Code → Figma payload
│   └── canvas-to-code.json    # Figma → code payload
├── studioflow.workflow.json   # Token frames, breakpoints, exchange paths
└── figma-plugins/studioflow-screens/
```

---

## 3. Code-to-Figma sync pipeline (three phases)

**Goal:** Make the workflow applicable to any coded design project: code → tokenised design system → conduit file → Figma → verification.

### Phase 1 — Full tokenisation and coverage report

- **Input:** Current codebase (CSS/TS/JSX and existing tokens).
- **Steps:** (1) Transform design into a fully tokenised system per the design system standard (Section 1). (2) Apply tokenisation across all four breakpoints. (3) Replace raw values with token references. (4) Produce a **coverage report:** token names/categories, properties covered, hardcoded remnants with file:line, and a summary %.
- **Output:** Updated token set and source; coverage report (machine- and human-readable).

### Phase 2 — Conduit file for Figma

- **Input:** Fully tokenised codebase and token definitions.
- **Steps:** (1) Produce a conduit file (handoff payload for Conduit MCP / plugin) that: carries all token definitions with values **per mode** where they differ; maps tokens to Figma variable types (COLOR, FLOAT, STRING) and modes; defines assignments of tokens to element properties (fills, strokes, typography, padding, gap, sizes). (2) Introduce a **style layer:** semantic styles (e.g. “Card”, “Button”, “Text / Body”) as sets of token→property; special styles (e.g. gradient brand → brand+20° hue); mapping from element (e.g. sfid) + property to token or style name.
- **Output:** Conduit handoff (e.g. `code-to-canvas.json` or extended schema) sufficient for Figma to create/update variables, modes, and styles and assign them to elements.
- **Current implementation additions:** `conduitVersion`, `tokenMapping`, `styleLayer` in `handoff/code-to-canvas.json`, plus generated `handoff/code-to-figma-mapping.json`.

### Phase 3 — Build in Figma and verification

- **Input:** Conduit file; Figma file (plugin/Conduit available).
- **Steps:** (1) Apply conduit in Figma: create/update variable collections and modes, create/update semantic and special styles, assign tokens/styles to elements. (2) Run **verification:** log which properties were bound (token or style); flag properties that could not be tokens but **could** be Figma styles; optionally persist result for auditing.
- **Output:** Updated Figma file; verification log with coverage and “could be styles” suggestions.

**Out of scope here:** Sync from Figma back to code (separate flow). Exact conduit file format may be current `code-to-canvas.json` plus extensions; the important part is tokens per mode, style definitions, and element–property assignments.

---

## 4. Current state and gap analysis

### What already exists

| Area | Current state |
|------|----------------|
| Token source | `tokens/figma-variables.json`; build generates `tokens.css` and `tokens.ts`. |
| Spacing scale | 11 spacing-like tokens (`space-xxs` … `space-3xl`). Not yet normalised to “8 + 2 micro”. |
| Breakpoints | Four modes in `studioflow.workflow.json`: mobile 390, tablet 768, laptop 1280, desktop 1440. |
| Code→Figma payload | `handoff/code-to-canvas.json` with flat token list (name, value, frame); tokenFrames, variableModes, screens. |
| Conduit / plugin | Conduit MCP applies payload; plugin creates “StudioFlow Tokens” collection, four modes, COLOR/FLOAT/STRING variables, scales FLOAT per mode, resolves `clamp()` per breakpoint. |
| Canvas→code | `handoff/canvas-to-code.json` with `variableModes[].values` per mode; used for verify and apply. |
| Enforcement | `verify-no-hardcoded`, `loop:verify-canvas`, `loop:proof`, manifest update. No dedicated token coverage or “could be styles” report. |

### Gaps vs the pipeline

| Gap | Description |
|-----|-------------|
| Design system standard not codified | “8 + 2 micro” and full standard (radii, typography scale, etc.) are not in a single canonical doc. |
| No per-breakpoint token values in source | Token source is single-value; per-mode values are computed in plugin (scale, clamp) or from canvas-to-code. |
| No coverage report | No script that outputs tokenised vs non-tokenised properties with file:line and summary %. |
| Conduit file lacks styles and mapping | code-to-canvas has tokens and requirements but not semantic styles (Card, Button, gradient) or element–property→token/style mapping. |
| No gradient/special style | No defined gradient style (e.g. brand → +20hue) in standard or conduit. |
| Verification does not flag “could be styles” | Plugin logs created/skipped variable count only; no list of unbound but style-able properties. |

### How close (rough)

- **Phase 1:** ~50–60%. Tokenisation enforced; missing canonical standard doc, optional per-mode source or derivation rules, and coverage report.
- **Phase 2:** ~40–50%. Conduit and variables/modes exist; missing semantic styles, element–property mapping, and gradient style in spec.
- **Phase 3:** ~40%. Variables and binding exist; verification is contract-focused; missing bound/unbound log and “could be styles” suggestions.

### Improvements (unified list)

1. **Codify design system standard** in one place (e.g. `docs/DESIGN_SYSTEM_STANDARD.md`): 8+2 spacing, typography scale, colour roles, radii, motion, four breakpoints. Align current spacing (e.g. map 11 → 8+2 or declare current scale as project standard).
2. **Phase 1 coverage report:** Script (e.g. `scripts/report-token-coverage.mjs`) that scans `src/` and outputs token usage per category, hardcoded properties with location, summary %. Optionally integrate with `verify-no-hardcoded`.
3. **Per-breakpoint tokens:** Either (a) per-mode overrides in token source, or (b) single value + documented derivation (scale factors, clamp) so conduit is generated with full per-mode values. Prefer (b) for single source of truth.
4. **Style layer in conduit:** Extend code-to-canvas with: named styles (Card, Button, Text/Body, etc.) as token→property sets; gradient style (e.g. brand → +20hue); sfid (+ property) → token or style name. Plugin/Conduit create Figma styles and apply them.
5. **Phase 3 verification log:** After applying in Figma: list bound vs unbound properties; list failed bindings and reason; flag “could not bind but could be a style”; write to log and optionally to `proof/` or `handoff/`.
6. **Token naming / grouping:** Document and use consistently the rule “first `-` → `/`” for Figma variable names (`color/brand-ink`, `space/sm`).
7. **Line-height roundtrip:** Document and enforce one convention (e.g. Figma line-height as % of font size, token value × 100 when writing; convert back to unitless when reading) so roundtrip matches `font-line-height-*` tokens.
8. **Colors: variable vs resolved:** List which tokens are variable-bound vs resolved fill in this doc or plugin log so designers know what updates with mode.
9. **Conduit schema and versioning:** Define a stable JSON schema (or version field) for the conduit payload so Cursor/MCP and the Figma plugin can validate and evolve the handoff format without breaking. Include a `conduitVersion` (or equivalent) in `code-to-canvas.json` and document supported versions in the design system doc.
10. **Bidirectional mapping table (code ↔ Figma):** Maintain a single mapping table (e.g. in docs or as generated artifact) that lists: code token name, CSS `var(--…)` name, Figma variable grouped name, Figma type (COLOR/FLOAT/STRING), and which Figma node properties can be bound. Cursor and the plugin both consume this so the middle layer is unambiguous.
11. **MCP-first conduit flow:** Document and, where possible, automate a path where Cursor (or any MCP client) can trigger “generate conduit from code” and “apply conduit to Figma” without manual script runs. For example: a single npm script or MCP tool that runs `build:tokens` → `loop:code-to-canvas` and outputs the path to the conduit file, so the middle layer is a clear “call this, get this file, then use Conduit to apply.”
12. **Diff-friendly conduit output:** Ensure the conduit file (and any verification report) is deterministic and diff-friendly (e.g. sorted keys, stable ordering of tokens and modes) so that git diffs and code reviews can catch unintended changes to what gets sent to Figma.
13. **Error taxonomy and recovery hints:** Define a small set of error types for the middle layer (e.g. “token missing in Figma”, “mode mismatch”, “sfid not found”, “style creation failed”) and document recommended recovery (e.g. “re-run plugin”, “add token to figma-variables.json”). Plugin and verification log should emit these codes so Cursor/agents can suggest fixes.

---

## 5. Figma MCP workflow (design-to-code)

When using Figma MCP (e.g. get_design_context, get_screenshot):

1. **Resolve design to tokens:** Map every Figma fill, text style, and spacing to a token from `tokens/figma-variables.json` (or add a new token there). Do not emit hardcoded colors or pixel values.
2. **Use existing class names where possible:** Prefer `.hero-panel`, `.section-title`, `.button-primary`. If the design doesn’t match, add a new class in `globals.css` with tokens only.
3. **Preserve sfids:** For nodes that correspond to known screens (e.g. hero), use the same `data-sfid` as in the codebase so roundtrip and verification keep working.
4. **Output:** React components + CSS that only use `var(--token-name)` and the existing global stylesheet; no new styling framework.

---

## 6. Code snippets and file reference

**Token in CSS**

```css
.card {
  background: var(--color-brand-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  gap: var(--space-sm);
}
```

**Token in TS (if needed)**

```ts
import { tokens } from "../tokens/tokens";
// tokens["color-brand-primary"] === "var(--color-brand-primary)"
```

**Stable ID for roundtrip**

```tsx
<div data-sfid="sfid:hero-content" className="hero-panel">
```

**Workflow token frames** (from `studioflow.workflow.json`): Colors `["color"]`, Typography `["font"]`, Spacing `["space","size","radius","shadow","opacity","z"]`.

| Purpose              | Path |
|----------------------|------|
| Token source         | `tokens/figma-variables.json` |
| Generated CSS tokens | `tokens/tokens.css`, `src/styles/tokens.css` |
| Generated TS tokens  | `tokens/tokens.ts` |
| Global styles        | `src/styles/globals.css` |
| Workflow config      | `studioflow.workflow.json` |
| Code → Figma payload | `handoff/code-to-canvas.json` |
| Figma → code payload | `handoff/canvas-to-code.json` |
| Conduit setup        | `docs/CONDUIT_SETUP.md` |
| Agent rules          | `AGENT.md` |
