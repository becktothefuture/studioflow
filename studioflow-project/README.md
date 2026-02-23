# StudioFlow For Designers

StudioFlow keeps your approved design intent aligned from Figma to code.

## What You Get
- A clear loop from code to Figma and back to code.
- Token-first styling that keeps named styles consistent.
- Stable `sfid` anchors so matching UI parts stay connected.
- Built-in checks that stop unsafe apply steps.
- Proof output after each apply so reviews are simple.

## Quick Start

Install and run:
```bash
npm install
npm run dev
```

Set up your MCP tools:
- `docs/MCP_SETUP.md`
- `docs/CONDUIT_SETUP.md`

## Daily Designer Loop

1. Prepare preview artifacts.
```bash
npm run conduit:preview
```

2. Commit the reviewed preview.
```bash
npm run conduit:commit -- --run-id <preview-run-id>
```

3. Build outbound handoff payload.
```bash
npm run conduit:generate
```

4. Print the checklist.
```bash
npm run loop:figma-roundtrip
```

5. In Figma, use Conduit to apply the payload and export:
- `handoff/canvas-to-code.json`

6. Apply safely back to code.
```bash
npm run loop:figma-roundtrip:apply
```

The apply wrapper runs verification, apply, check, build, proof, and manifest update in order.

## Fallback Path

If Conduit is not available:
- Use `figma-plugins/studioflow-screens/` for frame creation and variable binding.
- Use Figma Dev Mode MCP for read-only context.
- Export `handoff/canvas-to-code.json` manually.
- Run `npm run loop:verify-canvas` and `npm run loop:canvas-to-code`.

## Helpful Docs
- `docs/DEMO_WEBSITE_ROUNDTRIP.md`
- `docs/STUDIOFLOW_WORKFLOW.md`
- `docs/CANVAS_EXCHANGE_CONTRACT.md`
- `docs/MCP_SETUP.md`
- `docs/CONDUIT_SETUP.md`
