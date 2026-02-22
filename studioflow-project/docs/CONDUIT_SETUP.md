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

## 3) Connect from Any MCP Client
1. Add MCP server config for `figma-desktop` (or `figma`) and `conduit`.
2. Start MCP servers in your client.
3. Open the target file in Figma desktop.
4. Run the Conduit plugin in Figma to establish the active channel/session.
5. Run your StudioFlow loop command from the client with `handoff/code-to-canvas.json`.

## 4) StudioFlow Roundtrip Sequence
1. Run `npm run loop:code-to-canvas`.
2. Use Conduit to apply and produce `handoff/canvas-to-code.json`.
3. Run `npm run loop:figma-roundtrip:apply`.

StudioFlow contract gates remain mandatory for every apply path.

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
