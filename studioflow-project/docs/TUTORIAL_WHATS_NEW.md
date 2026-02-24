# StudioFlow: The Complete Guide

Everything you need to understand the project, how it feels to use it, and why every piece exists. Written to be read front-to-back like a short book — no prior knowledge needed.

---

## Contents

1. [One Sentence](#1-one-sentence)
2. [The Problem (It's Drift)](#2-the-problem-its-drift)
3. [Three Ideas That Fix It](#3-three-ideas-that-fix-it)
4. [Tokens — The Core Concept](#4-tokens--the-core-concept)
5. [Project Map](#5-project-map)
6. [The Four Phases](#6-the-four-phases)
7. [What It Feels Like to Use](#7-what-it-feels-like-to-use)
8. [The Safety Net (Verification + Errors)](#8-the-safety-net-verification--errors)
9. [The Figma Plugin](#9-the-figma-plugin)
10. [Binding Coverage — What Figma Actually Sees](#10-binding-coverage--what-figma-actually-sees)
11. [Preview, Commit, Receipt — The Audit Trail](#11-preview-commit-receipt--the-audit-trail)
12. [Key Principles](#12-key-principles)
13. [Command Reference](#13-command-reference)
14. [How the Pieces Connect](#14-how-the-pieces-connect)
15. [Glossary](#15-glossary)

---

## 1. One Sentence

StudioFlow keeps a React website and a Figma design file in sync — change a color in code and it updates in Figma, change it in Figma and it updates in code.

---

## 2. The Problem (It's Drift)

Here's what happens on every project, eventually:

1. Designer picks `#7A8DFF` blue in Figma. Card padding is `24px`. Body text is `16px Inter`.
2. Developer types `color: #7A8DFF` and `padding: 24px` into CSS. Pixel-perfect match. Ship it.
3. Designer changes the blue to `#6B7EFF`. Tells the developer. Developer finds 14 occurrences. Fixes 13. Misses one.
4. A month later, nobody knows which file is "right." Figma says one thing. Code says another. Drift wins.

Drift is the slow, silent divergence between design intent and shipped code. It happens because the same values live in two places with no connection between them.

StudioFlow eliminates drift by making sure there is only **one place** where each value lives.

---

## 3. Three Ideas That Fix It

The entire system rests on three ideas. Everything else is implementation detail.

### Idea 1: Tokens (one source of truth)

Every color, spacing value, font size, and radius is defined **once** in `tokens/figma-variables.json`. CSS files, TypeScript files, and Figma all read from this one source. Change it once, everything updates.

### Idea 2: sfids (stable anchors)

Every important element in the code has a unique ID: `data-sfid="sfid:hero/title"`. This is how the system knows that *this* `<h1>` in React is *that* text layer in Figma. Without stable identity, sync is guesswork.

### Idea 3: Contracts (automated verification)

Scripts check that code and Figma agree. If they don't, the scripts tell you exactly what's wrong and exactly how to fix it. No ambiguity, no guesswork, no "it looks right."

---

## 4. Tokens — The Core Concept

A **token** is a named value. Instead of writing `#7A8DFF` in your CSS, you write `var(--color-brand-primary)`. The actual hex lives in one place:

```json
{
  "color": {
    "brand": {
      "primary": { "value": "#7A8DFF" }
    }
  }
}
```

Run `npm run build:tokens` and this JSON becomes:

```css
/* tokens/tokens.css */
:root { --color-brand-primary: #7A8DFF; }
```

```ts
// tokens/tokens.ts
export const tokens = { "color-brand-primary": "var(--color-brand-primary)" };
```

Want to change the blue? Edit `figma-variables.json`, run `build:tokens`, done. Every CSS file, every component, and Figma all update from the same change.

### Token categories

| Category | Examples | Controls |
|----------|---------|----------|
| `color-*` | `color-brand-primary`, `color-brand-surface` | Backgrounds, text, borders |
| `space-*` | `space-sm (8px)`, `space-md (16px)`, `space-xl (44px)` | Padding, margins, gaps |
| `font-*` | `font-size-body`, `font-weight-bold` | All text styling |
| `radius-*` | `radius-sm`, `radius-lg`, `radius-pill` | Corner rounding |
| `size-*` | `size-border-default`, `size-logo` | Widths, heights, borders |
| `shadow-*` | `shadow-card`, `shadow-glow` | Box shadows |
| `motion-*` | `motion-duration-fast`, `motion-easing-standard` | Animation timing |
| `opacity-*` | `opacity-full`, `opacity-bg-fallback` | Transparency |

The project currently has **63 tokens**.

### The Figma compatibility wrinkle

CSS is more expressive than Figma's variable system. CSS can do:

```css
--color-brand-surface: color-mix(in srgb, #070A13 95%, #7A8DFF);
```

Browsers understand this. Figma does not. So StudioFlow classifies tokens by how Figma can handle them:

| Figma type | Count | What happens |
|------------|-------|-------------|
| **COLOR** variable | 4 | Bound directly (hex values Figma stores natively) |
| **FLOAT** variable | 29 | Bound directly (numbers — spacing, weights, opacity) |
| **STRING** variable | 20 | Stored but not bindable to visual properties |
| **Resolved** | 10 | Script computes the result and sends plain hex to Figma |

Only 4 colors are directly bindable: `ink`, `signal`, `primary`, `secondary`. Everything else uses `color-mix()`, so the script resolves them to hex before sending to Figma.

This is an inherent two-tier system — some tokens are live-linked in Figma, others are applied as static values. The binding coverage report (section 10) makes this visible.

---

## 5. Project Map

```
studioflow-project/
│
├── tokens/                         THE SOURCE OF TRUTH
│   ├── figma-variables.json        Every token defined here (you edit this)
│   ├── tokens.css                  Generated — DO NOT EDIT
│   └── tokens.ts                   Generated — DO NOT EDIT
│
├── src/                            THE WEBSITE
│   ├── styles/
│   │   ├── tokens.css              Generated copy of tokens
│   │   └── globals.css             Component styles (uses var(--token-name))
│   ├── components/
│   │   ├── Hero/                   Main landing page component
│   │   └── Background/             Animated shader background
│   └── main.tsx                    App entry point
│
├── scripts/                        ALL THE AUTOMATION
│   ├── build-tokens.mjs            JSON → CSS + TS
│   ├── scan-project.mjs            Finds hardcoded values
│   ├── apply-token-map.mjs         Rewrites hardcoded → tokens
│   ├── extract-content.mjs         Pulls text from JSX
│   ├── sync-push.mjs               One-command code→Figma
│   ├── sync-pull.mjs               One-command Figma→code
│   ├── migrate-sfids.mjs           Renames flat sfids to namespaced
│   ├── verify-binding-coverage.mjs Reports what's bound in Figma
│   ├── loop-code-to-canvas.mjs     Generates the Figma payload
│   ├── loop-verify-canvas.mjs      Checks payload before applying
│   ├── loop-canvas-to-code.mjs     Applies Figma changes back to code
│   ├── loop-proof.mjs              Screenshots + quality report
│   ├── conduit-preview.mjs         Preview before commit
│   ├── conduit-commit.mjs          Commit with receipt
│   ├── conduit-doctor.mjs          Error diagnosis
│   ├── studioflow-bridge.mjs       WebSocket server for plugin
│   └── lib/                        Shared code
│       ├── workflow-utils.mjs      File loading, sfid extraction, paths
│       ├── token-utils.mjs         Token parsing and flattening
│       ├── hardcoded-detect.mjs    Regex patterns for finding raw values
│       ├── conduit-errors.mjs      Error codes + recovery hints
│       ├── conduit-metadata.mjs    Figma type inference
│       ├── ux-ledger.mjs           Trust ledger + band context
│       └── proof-templates.mjs     HTML/Markdown report generators
│
├── handoff/                        EXCHANGE FILES (gitignored)
│   ├── code-to-canvas.json         What code sends TO Figma
│   ├── canvas-to-code.json         What Figma sends BACK to code
│   ├── code-to-figma-mapping.json  Token ↔ Figma variable lookup table
│   ├── binding-coverage.json       Binding analysis output
│   ├── scan-report.json            Output of scan:project
│   ├── trust-ledger.json           Shared run state
│   ├── preview-diff.json           Preview snapshot
│   └── band-context.json           Shared selection context
│
├── content/
│   └── content.json                Extracted text content from JSX
│
├── proof/                          GENERATED EVIDENCE (gitignored)
│   ├── latest/                     Most recent proof run
│   ├── history/                    All past runs with timestamps
│   └── receipts/                   Immutable commit receipts
│
├── figma-plugins/
│   └── studioflow-screens/         Figma plugin source
│       ├── code.js                 Plugin logic (runs inside Figma)
│       └── ui.html                 Plugin interface (the panel you see)
│
├── studioflow.workflow.json        Config: breakpoints, file paths
├── studioflow.manifest.json        Runtime state: loop counts, timestamps
├── AGENT.md                        Instructions for AI agents
└── docs/
    ├── DESIGN_SYSTEM_STANDARD.md   Canonical spacing/typography/color spec
    ├── DESIGN_SYSTEM_AND_FIGMA_SYNC.md   Full sync reference
    ├── STUDIOFLOW_WORKFLOW.md      Operator workflow guide
    ├── prd-figma-cursor-middle-layer.md   PRD for the middle layer
    ├── prd-scale-to-n.md           PRD for scaling
    └── prd-outstanding-items.md    PRD for gap closure
```

---

## 6. The Four Phases

Every StudioFlow workflow follows four phases. Think of them as a pipeline — each phase feeds the next.

### Phase 1: Tokenize

**Question it answers:** "Is this project ready for sync?"

Before StudioFlow can manage anything, every `#7A8DFF` and `24px` in the CSS needs to become `var(--color-brand-primary)` and `var(--space-lg)`. Phase 1 gets you there.

```bash
npm run scan:project              # Find hardcoded values
# Review the token map (human + LLM step)
npm run apply:token-map           # Rewrite source files
npm run verify:no-hardcoded       # Confirm zero violations
npm run report:token-coverage     # See the summary %
```

### Phase 2: Generate

**Question it answers:** "What should Figma look like right now?"

A script reads every token, every sfid, and the breakpoint configuration, then writes `handoff/code-to-canvas.json` — the complete description of what code says the design should be. It also produces the mapping artifact (`code-to-figma-mapping.json`) so you can look up any token's Figma equivalent.

```bash
npm run conduit:generate          # build tokens + generate payload + mapping
```

The conduit payload includes a `conduitVersion` field (semantic string, e.g. `"1.0.0"`) so consumers can detect format changes. The payload is written with deterministic ordering — object keys sorted lexicographically, token arrays sorted by name, modes in fixed order (`mobile`, `tablet`, `laptop`, `desktop`). Run the generator twice with the same input and you get byte-identical output.

### Phase 3: Sync

**Question it answers:** "Are code and Figma aligned?"

This is where changes flow in both directions:

- **Code → Figma:** The Figma plugin (or Conduit MCP) reads `code-to-canvas.json` and creates/updates variables, modes, and screen frames.
- **Figma → Code:** Export `canvas-to-code.json` from Figma. Verify it. Apply it. Token source updates.

```bash
npm run sync:push                 # Code → Figma (one command)
npm run sync:pull                 # Figma → Code (one command)
```

### Phase 4: Verify + Prove

**Question it answers:** "Can I trust what just happened?"

Quality gates check that tokens are in sync, no hardcoded values snuck in, all sfids match, and TypeScript compiles. The proof system takes screenshots at every breakpoint and generates an HTML report with evidence.

```bash
npm run check                     # All quality gates
npm run loop:proof                # Screenshots + report
```

---

## 7. What It Feels Like to Use

The daily experience is designed around two one-liners and a safety net.

### "I changed code, push to Figma"

```bash
npm run sync:push
```

Output:

```
[sync:push] Code -> Figma

  [OK] build:tokens
  [OK] loop:code-to-canvas

  Conduit ready: handoff/code-to-canvas.json
  Next: apply in Figma via Conduit, then run `npm run sync:pull`
```

Done. One command replaced `build:tokens` + `loop:code-to-canvas`.

### "Designer made changes, pull to code"

```bash
npm run sync:pull
```

This runs verify → apply → rebuild → check in sequence. Stops on first failure and tells you exactly what broke (see section 8).

### "I want to review before committing"

```bash
npm run conduit:preview
```

```
+-----------------------------------------+
| State: PREVIEW_READY                    |
| Run:   preview-2026-02-24T10-30-00Z     |
| Tokens: 63  Modes: 4/4  sfids: 8/8     |
| Styles: 12                              |
| Issues: none                            |
+-----------------------------------------+
Next: npm run conduit:commit -- --run-id preview-2026-02-24T10-30-00Z
```

Happy with it? Commit:

```bash
npm run conduit:commit -- --run-id preview-2026-02-24T10-30-00Z
```

An immutable receipt is written to `proof/receipts/`. You can always look back and see exactly what changed, what gates passed, and when.

### "Something broke"

```bash
npm run conduit:doctor -- --code SF_MODE_MISMATCH
```

```
[SF_MODE_MISMATCH] Mode set is incomplete or mismatched
  cause:      One or more required breakpoint modes are missing.
  fastestFix: Re-export all four modes from Figma.
  safeFallback: npm run conduit:generate
```

Every error has a code, a cause, and two recovery paths. Always.

### "How bound is my Figma file?"

```bash
npm run verify:binding-coverage
```

```
Binding Coverage Report

  sfid:hero/root
    [BOUND_STYLE]  fills/0/color  -- Hero -> color-brand-bg
    [BOUND_TOKEN]  paddingTop     -- space-lg
    [BOUND_TOKEN]  paddingBottom  -- space-lg

  sfid:hero/title
    [BOUND_TOKEN]    fontSize   -- font-size-title
    [COULD_BE_STYLE] fontFamily -- style-capable but not mapped

  sfid:hero/actions
    [UNBOUND] * -- No element-property mapping

Summary: 8 bound, 3 unbound, 1 could-be-style (12 total)
```

This is the view that tells you where your Figma integration has gaps and where to improve it next.

---

## 8. The Safety Net (Verification + Errors)

### Quality gates

These run together via `npm run check`:

| Gate | What it checks |
|------|---------------|
| `verify:tokens-sync` | Generated CSS/TS matches source JSON |
| `verify:no-hardcoded` | No raw colors/units in `src/` |
| `verify:id-sync` | sfid parity between code and snapshots |
| `tsc --noEmit` | TypeScript compiles |

If any gate fails, the whole check fails. Fix the first failure and re-run.

### Error codes

Every error in StudioFlow has a structured entry:

| Field | What it is |
|-------|-----------|
| `code` | Machine-readable identifier, e.g. `SF_MODE_MISMATCH` |
| `title` | One-line human summary |
| `cause` | Why this happened |
| `fastestFix` | The quickest way to resolve it |
| `safeFallback` | A safer but slower alternative |

The full error taxonomy:

| Code | When it happens |
|------|----------------|
| `SF_SOURCE_INVALID` | Payload `source` field is wrong |
| `SF_MODE_MISMATCH` | Not all 4 breakpoint modes present |
| `SF_SFID_NOT_FOUND` | An sfid exists in code but not in payload, or vice versa |
| `SF_TOKEN_FRAME_MISSING` | Token frame grouping (Colors/Typography/Spacing) incomplete |
| `SF_TOKEN_MODE_VALUE_MISSING` | A token lacks a value in one or more modes |
| `SF_SCREEN_MISMATCH` | Screen names/widths don't match workflow config |
| `SF_STYLE_APPLY_FAILED` | Style definition references something that doesn't exist |
| `SF_PREVIEW_STALE` | Payload changed since you previewed |
| `SF_CONTEXT_STALE` | Band context expired (> 15 min since last update) |
| `SF_PREVIEW_GATE_FAILED` | Quality gates failed during preview |
| `SF_COMMIT_GATE_FAILED` | Quality gates failed during commit |
| `SF_CONTRACT_INVALID` | General payload validation failure |

Errors use **pattern matching** — each code has a list of text patterns. When a script fails, `classifyConduitError()` scans the message and returns the matching entry with recovery hints. This is how `sync:pull` can surface the right fix even though it's calling sub-scripts under the hood.

### Testing strategy

The PRD now specifies three kinds of tests to keep the system honest:

- **Golden-file tests** — `tests/golden/code-to-canvas.json` and `tests/golden/code-to-figma-mapping.json` are regenerated from a fixed token fixture and must match byte-for-byte. This catches ordering regressions and accidental schema changes.
- **Error code fixtures** — At least `SF_TOKEN_MISSING` and `SF_SFID_NOT_FOUND` have test fixtures in `tests/contracts/` that trigger the error path and assert the machine-readable JSON shape.
- **Binding coverage snapshot** — `tests/golden/binding-coverage.json` from a known conduit fixture, asserting deterministic classification.

### Performance constraints

Two budgets keep scripts fast:
- `npm run report:token-coverage` must complete in < 5 seconds.
- `npm run conduit:generate` must complete in < 10 seconds.

If exceeded, the script logs a timing warning.

---

## 9. The Figma Plugin

The plugin has two parts:

**`code.js`** runs inside Figma's sandbox. It creates frames, variables, and collections. When you press "Sync to Figma", it reads the token payload, creates a "StudioFlow Tokens" variable collection with 4 modes, and assigns variables to screen frame nodes.

**`ui.html`** is the panel you see. It has:
- A status dot (green = ready, blue = syncing, red = error)
- A context line showing what's selected
- Two buttons: "Sync to Figma" and "Sync to Code"
- A log area showing what happened

### Live connection via the bridge

The plugin connects to `ws://localhost:9801` (the bridge server, started with `npm run bridge`). When you press "Sync to Code":

1. Plugin collects current canvas state as JSON
2. Sends it to the bridge via WebSocket
3. Bridge writes it to `handoff/canvas-to-code.json`
4. Bridge runs `verify-canvas` + `canvas-to-code`
5. Results stream back to the plugin log in real time

If the bridge isn't running, the plugin copies the JSON to your clipboard as a fallback.

### Band context

When you select a frame in Figma, the plugin tells the bridge which screen/sfid you're looking at. This gets written to `handoff/band-context.json` so CLI commands know your current focus. If the context is older than 15 minutes, it's considered stale and the system warns you.

---

## 10. Binding Coverage — What Figma Actually Sees

This is one of the most important views in StudioFlow. It answers: "For every property on every element, is Figma actually connected to a token?"

Run `npm run verify:binding-coverage` to get a per-sfid, per-property report.

### The four statuses

| Status | Meaning |
|--------|---------|
| **BOUND_TOKEN** | Property uses a Figma variable. Token changes automatically update in Figma. |
| **BOUND_STYLE** | Property uses a Figma style (a named group of token assignments). Connected, but not individually variable-bound. |
| **UNBOUND** | No connection. This is a gap — the property exists in code but Figma doesn't track it. |
| **COULD_BE_STYLE** | Not currently mapped, but the property type supports Figma styles. Worth investigating. |

### How COULD_BE_STYLE is classified

A property gets flagged as `COULD_BE_STYLE` when:
- It has no token binding (unbound), **and**
- It matches a style-eligible property set (`fills`, `strokes`, `textStyle`), **and**
- The node type supports Figma styles

This is a deterministic, rule-based classification — not a guess. It highlights opportunities to improve coverage by creating Figma styles for properties that can't be directly variable-bound.

### Pre-apply vs post-apply (the US-008 split)

There are two different questions about binding:

- **US-008A (pre-apply):** "Based on the conduit payload, what *would* be bound?" This runs as a script (`verify-binding-coverage`), reads the conduit JSON, and reports without touching Figma. Ship first — it's the planning tool.

- **US-008B (post-apply, deferred):** "After applying in Figma, what *actually* got bound?" This requires the plugin to report back what succeeded and what failed. Depends on plugin instrumentation. Ship after US-008A is validated.

The pre-apply report is what you use daily. The post-apply audit is for debugging when something doesn't look right after sync.

---

## 11. Preview, Commit, Receipt — The Audit Trail

The preview/commit system exists so that changes are intentional, reviewable, and traceable.

### The flow

```
conduit:preview  →  review  →  conduit:commit  →  receipt
```

**Preview** generates the payload, runs all quality gates, and produces:
- `handoff/trust-ledger.json` — run state (`READY` / `PREVIEW_READY` / `COMMIT_DONE` / `BLOCKED`)
- `handoff/preview-diff.json` — deterministic hash of the payload

**Commit** verifies:
1. Run ID matches the latest preview (no stale commits)
2. Payload hasn't changed since preview (if you edited code, re-preview first)
3. Band context isn't expired
4. All quality gates still pass

**Receipt** is an immutable JSON file in `proof/receipts/`:

```json
{
  "runId": "preview-2026-02-24T10-30-00Z",
  "previewHash": "a1b2c3...",
  "commitHash": "a1b2c3...",
  "appliedChanges": { "tokenCount": 63, "sfidCount": 8, "styleAssignments": 12 },
  "gateResults": { "check": "passed" },
  "generatedAt": "2026-02-24T10:30:05Z"
}
```

If anything is wrong, the commit is blocked with a deterministic error code and a fix instruction. For example:

```
[SF_PREVIEW_STALE] Preview artifact is stale
  fastestFix: Run `npm run conduit:preview` again, then commit with the new run ID.
```

### The trust ledger

The trust ledger (`handoff/trust-ledger.json`) tracks the canonical state of the current run. Both the CLI and the Figma plugin read it. Fields:

- `runId`, `state`, `conduitVersion`
- `tokenCount`, `modeCoverage`, `sfidCoverage`, `styleAssignments`
- `blockingIssues[]`, `lastReceiptId`, `updatedAt`

The ledger is additive — it never blocks existing `loop:*` flows. If you skip the preview/commit workflow and use `sync:push` directly, everything still works. The ledger is there when you want the audit trail.

### Versioning policy

The conduit payload uses semantic versioning (e.g. `"1.0.0"`):
- Backward-compatible additions = minor bump
- Breaking shape changes = major bump
- Scripts and plugin check `conduitVersion` on read; if the major version is unsupported, they emit `CONDUIT_VERSION_MISMATCH` with upgrade instructions
- Old fields are kept for one minor version with a console warning before removal

---

## 12. Key Principles

These are the design decisions that shape every part of StudioFlow.

### Token-first, always

Every visual property in `src/` must use `var(--token-name)`. No hex codes, no pixel values, no font names written directly. The `verify:no-hardcoded` gate enforces this. If it fails, the pipeline stops.

### Deterministic output

Same input → same output. Always. The conduit payload, the mapping artifact, the binding coverage report — all are written with deterministic ordering (keys sorted lexicographically, arrays sorted by name, modes in fixed order). Run the generator twice and diff the output: identical.

This matters because it makes git diffs meaningful. If a diff shows up, something actually changed.

### One fix per error

When something breaks, the system gives you one thing to do. Not a stack trace. Not a paragraph. One command to copy-paste (or one action to click in the plugin). A safe fallback is shown second, in case the fast fix doesn't apply.

### Additive, not blocking

New features (trust ledger, band context, preview/commit) are layers on top of the existing pipeline. If you don't use them, the `loop:*` commands still work exactly as before. The system degrades gracefully — if band context is missing, it warns but continues. If the trust ledger isn't present, the sync still runs.

### ASCII-first output

Status output uses ASCII box drawing and deterministic labels (`OK`, `WARN`, `BLOCKED`). No decorative emoji. No confidence scores or probabilistic language. No subjective adjectives. The goal is clarity and copy-pasteability.

### Contracts over conventions

"Convention" means "we agreed to do it this way." "Contract" means "the machine checks and blocks you if you don't." StudioFlow prefers contracts: `verify:tokens-sync`, `verify:no-hardcoded`, `verify:id-sync`, `loop:verify-canvas`. If a rule matters, it has a script that enforces it.

### Minimal diffs

Every edit should touch only what changed. The AGENT.md instructions say "keep diffs minimal and task-scoped." This applies to human and agent work. Don't rewrite a file to change one token.

---

## 13. Command Reference

### Daily workflow

| Command | What it does |
|---------|-------------|
| `npm run sync:push` | Build tokens + generate conduit (code → Figma) |
| `npm run sync:pull` | Verify + apply + rebuild + check (Figma → code) |
| `npm run check` | Run all quality gates |
| `npm run build` | TypeScript compile + Vite build |

### Onboarding a new project

| Command | What it does |
|---------|-------------|
| `npm run scan:project` | Find all hardcoded values |
| `npm run apply:token-map` | Apply reviewed token map to source files |
| `npm run extract:content` | Pull text content from JSX into `content.json` |
| `npm run migrate:sfids -- --map file.json` | Rename sfids from flat to namespaced |

### Quality + coverage

| Command | What it does |
|---------|-------------|
| `npm run verify:tokens-sync` | Generated CSS/TS matches source JSON? |
| `npm run verify:no-hardcoded` | No raw colors/units in `src/`? |
| `npm run verify:id-sync` | sfid parity between code and snapshots? |
| `npm run verify:binding-coverage` | What's bound vs unbound in Figma? |
| `npm run report:token-coverage` | Token usage stats + violation list |

### Preview / commit

| Command | What it does |
|---------|-------------|
| `npm run conduit:generate` | Build tokens + generate payload + mapping |
| `npm run conduit:preview` | Generate preview with trust ledger |
| `npm run conduit:commit -- --run-id <id>` | Finalize with immutable receipt |
| `npm run conduit:doctor -- --code <code>` | Look up error recovery guidance |

### Proof

| Command | What it does |
|---------|-------------|
| `npm run loop:proof` | Full-page screenshots + HTML report |
| `npm run loop:proof -- --component hero` | Component-only screenshots |

### Low-level (rarely run directly)

| Command | What it does |
|---------|-------------|
| `npm run build:tokens` | JSON → CSS + TS |
| `npm run loop:code-to-canvas` | Generate conduit payload |
| `npm run loop:verify-canvas` | Validate incoming Figma payload |
| `npm run loop:canvas-to-code` | Apply verified Figma changes |
| `npm run manifest:update` | Record loop outcome |
| `npm run bridge` | Start WebSocket server for plugin |

---

## 14. How the Pieces Connect

### Code → Figma

```
figma-variables.json
        |
        v
   build:tokens
        |
        +---> tokens/tokens.css
        +---> tokens/tokens.ts
        +---> src/styles/tokens.css
                |
                v
      loop:code-to-canvas
        reads: tokens, sfids from src/, workflow config
                |
                +---> handoff/code-to-canvas.json     (the payload)
                +---> handoff/code-to-figma-mapping.json (the lookup table)
                        |
                        v
                Figma Plugin / Conduit MCP
                  creates: variables, modes, screen frames in Figma
```

### Figma → Code

```
   Figma (designer makes changes)
        |
        v
   Plugin exports / manual export
        |
        v
   handoff/canvas-to-code.json
        |
        v
   loop:verify-canvas
     checks: modes, screens, sfids, token values
        |
        v
   loop:canvas-to-code
     writes: updated figma-variables.json
        |
        v
   build:tokens  -->  check
```

### Onboarding

```
   Existing project with hardcoded values
        |
        v
   scan:project  -->  handoff/scan-report.json
        |
        v
   LLM proposes token names  -->  handoff/token-map.json
        |
        v  (human reviews)
   apply:token-map  -->  rewritten source + updated tokens
        |
        v
   build:tokens  -->  check  -->  done
```

### Preview / Commit

```
   conduit:preview
        |
        +---> handoff/trust-ledger.json   (run state)
        +---> handoff/preview-diff.json   (payload hash)
        |
        v  (human reviews)
   conduit:commit -- --run-id <id>
        |
        +---> proof/receipts/<timestamp>-<runId>.json  (immutable receipt)
        +---> updated trust-ledger.json (state -> COMMIT_DONE)
```

---

## 15. Glossary

| Term | Definition |
|------|-----------|
| **Token** | A named design value (color, spacing, font size). Defined in `figma-variables.json`, used as `var(--token-name)` in CSS. |
| **sfid** | Stable Fragment ID. A `data-sfid="sfid:hero/title"` attribute that ties a code element to a Figma layer. |
| **Conduit** | The JSON payload (`code-to-canvas.json`) describing everything Figma needs to know about the code. |
| **Conduit MCP** | A tool that sends the conduit payload to Figma programmatically (alternative to the plugin). |
| **Breakpoint** | A screen width where layout changes. StudioFlow uses 4: mobile (390), tablet (768), laptop (1280), desktop (1440). |
| **Mode** | A breakpoint in Figma terms. A variable can have different values per mode. |
| **Quality gate** | An automated check that must pass. If it doesn't, the pipeline stops. |
| **Trust ledger** | JSON file tracking the state of the current sync run (READY → PREVIEW_READY → COMMIT_DONE). |
| **Band context** | Shared "you are here" context between Figma and CLI. Tracks which screen/sfid is selected. |
| **Receipt** | Immutable record of a commit — what changed, what gates passed, when. |
| **Proof** | Screenshots at every breakpoint + a quality report. Evidence you can review and archive. |
| **Binding coverage** | A per-sfid, per-property report showing what's connected to tokens/styles in Figma and what isn't. |
| **COULD_BE_STYLE** | A binding status meaning: not mapped, but the property type supports Figma styles. An improvement opportunity. |
| **Hardcoded value** | A raw value like `#7A8DFF` or `24px` written directly in CSS instead of using a token. These are violations. |
| **Semantic style** | A named group of token assignments (e.g. "Card" = panel background + large radius + card shadow). |
| **FLOAT** | A Figma variable type for numbers. Values like `16px` have the `px` stripped to become `16`. |
| **COLOR** | A Figma variable type for hex colors. Only 4 tokens qualify. |
| **STRING** | A Figma variable type for text values. Stored but not bindable to visual properties. |
| **Resolved** | A token whose CSS expression (like `color-mix()`) is computed before sending to Figma. |
| **Golden file** | A known-good output snapshot used in tests. If the actual output differs, the test fails. |
| **Deterministic** | Same input always produces same output. No randomness, no timestamp-dependent ordering. |

---

## Quick Start

```bash
# See the current state
npm run check                     # Are all gates passing?
npm run report:token-coverage     # How tokenized is the project?

# Make a code change and push to Figma
npm run sync:push                 # One command

# Pull Figma changes back
npm run sync:pull                 # One command

# See what Figma can actually bind
npm run verify:binding-coverage

# Take proof screenshots
npm run loop:proof

# If something breaks
npm run conduit:doctor -- --code SF_MODE_MISMATCH
```
