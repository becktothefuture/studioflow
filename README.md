<p align="center">
  <img src="studioflow-project/assets/studioflow-logo.png" alt="StudioFlow logo" width="92" />
</p>

<h1 align="center">StudioFlow Workflow</h1>

<p align="center">
  Contract-first design engineering for teams shipping UI across four breakpoints.
</p>

<p align="center">
  <a href="https://becktothefuture.github.io/studioflow/"><strong>Launch Live Microsite</strong></a>
  ·
  <a href="#start-here"><strong>Start Here</strong></a>
  ·
  <a href="#proof-points-modeled"><strong>Proof Points</strong></a>
  ·
  <a href="#workflow"><strong>Workflow</strong></a>
  ·
  <a href="studioflow-project/"><strong>Repo</strong></a>
</p>

![StudioFlow animated divider](studioflow-project/assets/studioflow-divider.gif)

<details>
<summary>Divider fallback (static PNG)</summary>

![StudioFlow static divider](studioflow-project/assets/studioflow-divider.png)

</details>

## Live Site

**Microsite URL:** [https://becktothefuture.github.io/studioflow/](https://becktothefuture.github.io/studioflow/)

## Start Here

### Track A: First 10-minute win (local proof)

```bash
cd studioflow-project
npm run setup:project
npm run demo:website:capture
```

This generates proof artifacts at:
- `proof/latest/index.html`
- `proof/latest/summary-card.png`

### Track B: Real website roundtrip (Code -> Figma Canvas -> Code)

```bash
cd studioflow-project
npm run setup:project
npm run loop:code-to-canvas
```

Then in Claude Code:
1. run `claude`,
2. run `/mcp` and complete Figma auth,
3. use `handoff/code-to-canvas.json` to create token frames, modes, and screens,
4. export approved payload to `handoff/canvas-to-code.json`.

Apply and gate:

```bash
npm run loop:verify-canvas
npm run loop:canvas-to-code
npm run check
npm run build
npm run loop:proof
npm run manifest:update
```

## Definition of Done

A loop is complete when all items are true:
- verification passes for `3` token frames, `4` variable modes, `4` screens,
- variable modes exist for `mobile (390)`, `tablet (768)`, `laptop (1280)`, `desktop (1440)`,
- screens exist for all four breakpoints,
- proof outputs exist in `proof/latest/`,
- manifest is updated in `studioflow-project/studioflow.manifest.json`.

## Proof Points (Modeled)

Modeled outcomes from local dry runs and contract-gated operation. Replace with measured team data over time.

| Signal | Modeled range | Why it moves |
| --- | --- | --- |
| Design-to-merge loop time | `28-46%` faster | one payload contract + pre-merge gates |
| Breakpoint drift | `70-90%` lower | required 4-mode + 4-screen validation |
| Token compliance | `95%+` | token-only verification step |
| Rework cycles after handoff | `25-40%` lower | stable `sfid` anchors + payload parity checks |
| Team confidence score (internal rubric) | `+1.2 to +1.8` points | proof artifacts visible every loop |

## Workflow

| Step | Command | Result |
| --- | --- | --- |
| `01` | `npm run loop:code-to-canvas` | Build canvas handoff payloads from code. |
| `02` | `npm run loop:verify-canvas` | Validate contract shape, token coverage, and `sfid` parity. |
| `03` | `npm run loop:canvas-to-code` | Apply approved canvas updates back into code tokens. |
| `04` | `npm run check && npm run build && npm run manifest:update` | Run gates, build output, and refresh manifest evidence. |

## Keywords

`contract-first handoff`, `token-native surfaces`, `roundtrip fidelity`, `breakpoint parity`, `proof-backed workflow`, `merge-safe design iteration`

## Docs

- `studioflow-project/README.md`
- `studioflow-project/docs/STUDIOFLOW_WORKFLOW.md`
- `studioflow-project/docs/CANVAS_EXCHANGE_CONTRACT.md`
- `studioflow-project/docs/CLAUDE_CODE_SETUP.md`
- `studioflow-project/docs/DEMO_WEBSITE_ROUNDTRIP.md`
- `studioflow-project/CLAUDE.md`
- `studioflow-project/.claude/commands/README.md`
