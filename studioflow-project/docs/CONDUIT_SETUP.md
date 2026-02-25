# Conduit Setup

## Prerequisites
- Node.js 18+
- Bun
- Figma desktop app

## 1) Run Conduit MCP Server
Run Conduit from your MCP client config:

```json
{
  "command": "bunx",
  "args": ["conduit-design@latest"]
}
```

Run directly for local checks:

```bash
bunx conduit-design@latest
```

## 2) Install the Conduit Figma Plugin from a Manifest
1. Open Figma desktop.
2. Go to `Plugins` → `Development` → `Import plugin from manifest…`.
3. Select the Conduit plugin `manifest.json` you installed from the Conduit package.
4. Confirm the plugin appears under your development plugins.

**StudioFlow Screens plugin:** To use the project’s own plugin (`figma-plugins/studioflow-screens/manifest.json`), import it the same way. It then appears under **Plugins → Development** and, in **Dev Mode**, in the right-hand **Inspect** panel (Plugins). In Design mode you get full create/bind/export; in Dev Mode the plugin is read-only (inspect and export only)—switch to Design mode to create frames or bind variables.

## 3) Connect from Any MCP Client
1. Add MCP server config for `figma-desktop` (or `figma`) and `conduit`.
2. Start MCP servers in your client.
3. Open the target file in Figma desktop.
4. Run the Conduit plugin in Figma to establish the active channel/session.
5. Run your StudioFlow loop command from the client with `handoff/code-to-canvas.json`.

## 4) StudioFlow Roundtrip Sequence
1. Run `npm run conduit:preview`.
2. Review `handoff/trust-ledger.json` and `handoff/preview-diff.json`.
3. Run `npm run conduit:commit -- --run-id <preview-run-id>`.
4. Run `npm run conduit:generate`.
5. Use Conduit to apply and produce `handoff/canvas-to-code.json`.
6. Run `npm run sync:pull`.

StudioFlow contract gates remain mandatory for every apply path.

Preview/commit artifacts:
- `handoff/trust-ledger.json` — canonical run state for CLI/plugin.
- `handoff/band-context.json` — shared active target context.
- `handoff/preview-diff.json` — deterministic preview hash + summary.
- `proof/receipts/<timestamp>-<runId>.json` — immutable commit receipt.

## 5) Conduit Error Taxonomy

When verification fails, errors include deterministic codes and recovery hints.

| Code | Title | Fastest fix | Safe fallback |
| --- | --- | --- | --- |
| `SF_SOURCE_INVALID` | Payload source is invalid | Set `source` to `figma-canvas` and re-export from Figma. | `npm run loop:code-to-canvas` |
| `SF_MODE_MISMATCH` | Mode set is incomplete or mismatched | Re-export all four breakpoint modes from Figma. | `npm run conduit:generate` |
| `SF_SFID_NOT_FOUND` | Required sfid is missing | Restore missing `data-sfid` and export again. | `npm run verify:id-sync` |
| `SF_TOKEN_FRAME_MISSING` | Token frame coverage is incomplete | Regenerate handoff payload. | `npm run conduit:generate` |
| `SF_TOKEN_MODE_VALUE_MISSING` | Token value missing for one or more modes | Ensure every token exists in each mode, then re-export. | `npm run verify:tokens-sync` |
| `SF_SCREEN_MISMATCH` | Screen metadata does not match workflow | Recreate screens from plugin defaults and re-export. | `npm run conduit:generate` |
| `SF_STYLE_APPLY_FAILED` | Style layer apply failed | Verify style names in conduit `styleLayer`, then re-apply. | Continue with token-only bindings |
| `SF_PREVIEW_STALE` | Preview artifact is stale | Re-run `npm run conduit:preview`, then commit with the new runId. | Do not commit stale preview data |
| `SF_CONTEXT_STALE` | Band context is stale | Refresh target context from Figma or CLI and retry commit. | Continue only after manual target verification |
| `SF_PREVIEW_GATE_FAILED` | Preview quality gates failed | Run `npm run check` and fix first failure. | Use `conduit:doctor` for exact recovery |
| `SF_COMMIT_GATE_FAILED` | Commit quality gates failed | Run `npm run check` and retry commit. | Re-run preview to rebuild deterministic baseline |
| `SF_CONTRACT_INVALID` | Payload failed contract validation | Fix the first emitted validation line and retry. | `npm run conduit:generate` |

Look up a specific code:

```bash
npm run conduit:doctor -- --code SF_MODE_MISMATCH
```

## Fallback Path
- Use `figma-plugins/studioflow-screens/` for frame creation and variable binding.
- Use Figma Dev Mode MCP for read-only context.
- Export `handoff/canvas-to-code.json` manually.
- Run `npm run loop:verify-canvas` and `npm run loop:canvas-to-code`.

## Troubleshooting

### Port Issues
- Symptom: Figma desktop MCP tools do not appear.
- Check: `figma-desktop` URL is `http://127.0.0.1:3845/mcp`.
- Action: restart Figma desktop, then restart MCP servers.

### Channel/Session Pairing
- Symptom: Conduit tools connect but no write operations reach the active file.
- Check: Conduit plugin is running in the same open Figma file.
- Action: relaunch Conduit plugin and re-run the MCP command.

### Tool Not Available
- Symptom: client reports Conduit tool not available.
- Check: Bun is installed and `bunx conduit-design@latest` starts cleanly.
- Action: restart MCP servers and confirm `conduit` is listed in client tool status.
