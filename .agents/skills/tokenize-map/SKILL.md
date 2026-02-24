---
name: tokenize-map
description: "Read a scan report and propose semantic token names for hardcoded values. Use when onboarding a new project into StudioFlow tokens. Triggers on: map tokens, tokenize project, propose token names, create token map."
user-invocable: true
---

# Token Map Generator

Read a scan report and propose semantic token names for every hardcoded design value, producing a `token-map.json` artifact.

---

## The Job

1. Read `handoff/scan-report.json` (output of `npm run scan:project`)
2. Read `tokens/figma-variables.json` (existing token definitions)
3. Propose a semantic token name for each hardcoded value
4. Write `handoff/token-map.json`

**Important:** This skill is non-destructive. It only produces the `token-map.json` artifact. It does NOT modify any source files.

---

## Step 1: Read Inputs

Read both files before doing anything:

- **`handoff/scan-report.json`** — contains hardcoded values with their raw values and source locations.
- **`tokens/figma-variables.json`** — contains existing token definitions with names and values.

If either file is missing, stop and tell the user which file is missing and how to generate it.

---

## Step 2: Propose Token Names

For each hardcoded value in the scan report:

### Naming Convention

Token names follow `{category}-{semantic-name}`:

| Category | Examples |
|----------|---------|
| `color` | `color-brand-primary`, `color-text-muted`, `color-border-card` |
| `space` | `space-card-padding`, `space-section-gap`, `space-inline-sm` |
| `size` | `size-icon-md`, `size-avatar-lg` |
| `font` | `font-size-label`, `font-weight-bold`, `font-line-height-body` |
| `radius` | `radius-card`, `radius-button`, `radius-pill` |
| `shadow` | `shadow-card`, `shadow-dropdown`, `shadow-elevated` |
| `opacity` | `opacity-disabled`, `opacity-overlay` |
| `z` | `z-modal`, `z-tooltip`, `z-header` |
| `motion` | `motion-fade-in`, `motion-duration-fast` |
| `mix` | `mix-blur-background` |

### Naming Rules

- First path segment is the category.
- Use **semantic names**, not literal descriptions: `color-brand-primary` not `color-hex-7a8dff`.
- For spacing, prefer purpose-based names: `space-card-padding` over `space-16px`.
- For colors, check if the value matches an existing brand color and reuse that name.
- For typography, follow existing pattern: `font-size-{role}`, `font-weight-{name}`, `font-line-height-{role}`.

### Check for Existing Token Matches

For each value, check `figma-variables.json` for an existing token with the same or very close value (e.g. same hex color, same px value). If a match exists:

- Set `isNewToken: false`
- Set `existingTokenMatch` to the name of the matching token

### Group Duplicates

If the same value (or case-insensitive equivalent like `#7A8DFF` and `#7a8dff`) appears in multiple locations, propose one token with all source locations listed. Track these in `duplicateClusters`.

---

## Step 3: Flag Values to Skip

Mark the following as `skipped` instead of proposing a token:

| Pattern | Reason |
|---------|--------|
| `z-index` values (integer-only, no unit) | `"z-index constant"` |
| Animation keyframe percentages (`0%`, `50%`, `100%`) | `"keyframe percentage"` |
| Values that are `0` or `0` with any unit (`0px`, `0rem`, etc.) | `"zero value"` |
| Any value that is a structural constant rather than a design token | `"structural constant"` |

Use your judgment for structural constants — these are values tied to layout logic (e.g. `100%`, `100vw`, `50%` for centering) rather than design decisions.

---

## Step 4: Write Output

Write `handoff/token-map.json` with this exact structure:

```json
{
  "generatedAt": "ISO string",
  "proposedTokens": [
    {
      "name": "color-brand-accent",
      "value": "#7A8DFF",
      "category": "color",
      "sourceLocations": ["src/styles/globals.css:15", "src/components/Hero/HeroLayout.tsx:42"],
      "isNewToken": true,
      "existingTokenMatch": null
    }
  ],
  "duplicateClusters": [
    {
      "proposedName": "color-brand-accent",
      "rawValues": ["#7A8DFF", "#7a8dff"],
      "locations": ["src/styles/globals.css:15", "src/styles/globals.css:88"]
    }
  ],
  "skipped": [
    { "rawValue": "1", "locations": ["src/styles/globals.css:20"], "reason": "z-index constant" }
  ]
}
```

### Output Rules

- **Deterministic:** Sort `proposedTokens` by `name` alphabetically.
- **Deterministic:** Sort `duplicateClusters` by `proposedName` alphabetically.
- **Deterministic:** Sort `skipped` by `rawValue` alphabetically.

---

## Step 5: Print Summary

After writing the file, print a summary table:

```
Token Map Summary
─────────────────────────────
New tokens proposed:    12
Reuse existing token:    4
Skipped:                 8
Duplicate clusters:      3
─────────────────────────────
Output: handoff/token-map.json
```

---

## Checklist

Before writing `token-map.json`:

- [ ] Read `handoff/scan-report.json` successfully
- [ ] Read `tokens/figma-variables.json` successfully
- [ ] Every hardcoded value is either in `proposedTokens` or `skipped`
- [ ] No literal/hex-based token names — all names are semantic
- [ ] Duplicate values are grouped into one token with multiple `sourceLocations`
- [ ] Existing token matches are flagged with `isNewToken: false`
- [ ] Output is sorted alphabetically by token name
- [ ] No source files were modified
