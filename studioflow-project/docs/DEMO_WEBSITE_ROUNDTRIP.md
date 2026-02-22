# Demo: Website Roundtrip (Intent Preservation Walkthrough)

## Purpose
This demo uses the StudioFlow landing page as a working example of intent preservation across code and canvas. The walkthrough maps each strategic claim to executable commands and concrete evidence files.

## What the Demo Validates
1. One semantic model survives code-to-canvas and canvas-to-code transitions.
2. Token and breakpoint intent remains aligned across all four required modes.
3. Contract gates block incomplete payloads before source updates.
4. Proof and manifest outputs provide operational traceability.

## Prerequisites
```bash
npm run setup:project
```

Complete MCP setup before live Figma loops:
- `docs/MCP_SETUP.md`
- `docs/CONDUIT_SETUP.md`

## Path A: Live Figma Roundtrip

### 1) Generate canonical payload from code
```bash
npm run loop:code-to-canvas
```

Generated files:
- `handoff/code-to-canvas.json`
- `handoff/canvas-to-code.template.json`

### 2) Import variables into Figma
Generate Tokens Studio import file:
```bash
npm run export:tokens-studio
```

Import via Tokens Studio plugin in Figma (one-time):
1. Plugins → Tokens Studio for Figma → load `tokens/tokens-studio-import.json`
2. Export to Figma → Variables

Enterprise alternative (REST API, requires `file_variables` scopes):
```bash
FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=... npm run figma:variables:sync
```

### 3) Apply payload in Figma with Conduit
Agent instruction:
```text
Use handoff/code-to-canvas.json.
Create or update token frames, variable modes, and screens.
Keep all sfid identifiers from the payload.
Return the approved payload as handoff/canvas-to-code.json.
```

### 4) Apply design edits in Figma
Recommended edits:
- Token value updates per breakpoint mode
- Typography scale updates per mode
- Layout spacing updates that remain token-driven

### 5) Export approved payload
Save as:
- `handoff/canvas-to-code.json`

### 6) Verify, apply, and publish evidence
Checklist and apply wrapper:
```bash
npm run loop:figma-roundtrip
npm run loop:figma-roundtrip:apply
```

Manual command path:
```bash
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run loop:proof
npm run manifest:update
```

## Path B: Local Simulated Roundtrip
```bash
npm run loop:code-to-canvas
npm run demo:website:generate
npm run demo:website:verify
npm run demo:website:apply
npm run check
npm run build
npm run manifest:update
```

One-shot path:
```bash
npm run demo:website:run
```

Capture plus proof output:
```bash
npm run demo:website:capture
```

## Expected Evidence After Apply
- `tokens/figma-variables.json`
- `tokens/figma-breakpoint-variables.json`
- `tokens/tokens-studio-import.json`
- `tokens/tokens.css`
- `tokens/tokens.ts`
- `src/styles/tokens.css`
- `snapshots/figma-*.json`
- `proof/latest/index.html`
- `proof/latest/summary-card.png`
- `studioflow.manifest.json`

## Guarantee Mapping for This Demo
| Strategic claim | Command | Evidence |
| --- | --- | --- |
| Stable identity parity | `npm run verify:id-sync` | source and snapshot sfid parity |
| Full breakpoint validation | `npm run loop:verify-canvas` | payload mode and screen coverage |
| Deterministic source updates | `npm run loop:canvas-to-code` | token artifacts and styles sync |
| Review-ready traceability | `npm run loop:proof && npm run manifest:update` | proof output and manifest lineage |
