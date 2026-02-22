# MCP Setup

Model Context Protocol (MCP) is a standard interface that lets an agent client call tools through structured servers, so StudioFlow can read Figma context and run controlled write operations with the same workflow contract.

## Works With
- Cursor
- Claude Code
- VS Code
- Windsurf
- Any MCP-capable client

## Server Config Example

Use this baseline config in your MCP client:

```json
{
  "mcpServers": {
    "figma-desktop": {
      "transport": "http",
      "url": "http://127.0.0.1:3845/mcp"
    },
    "figma": {
      "transport": "http",
      "url": "https://mcp.figma.com/mcp"
    },
    "conduit": {
      "command": "bunx",
      "args": ["conduit-design@latest"]
    }
  }
}
```

## Figma Dev Mode MCP (Read Context)
- Use `figma-desktop` at `http://127.0.0.1:3845/mcp` when Figma desktop is available.
- Use `figma` at `https://mcp.figma.com/mcp` as an optional remote endpoint.
- Keep Dev Mode MCP for read context and inspection.

## Conduit MCP (Write Operations)
- Run Conduit as a command server from the MCP client:
  - `command`: `bunx`
  - `args`: `["conduit-design@latest"]`
- Use Conduit for write operations that apply `handoff/code-to-canvas.json` updates in Figma.

## Client Example: Cursor
- Open Cursor MCP settings.
- Paste the server config above into Cursor MCP JSON.
- Restart Cursor MCP servers.
- Confirm both `figma-desktop` or `figma`, plus `conduit`, show as available.

## Next Step
- Continue with `docs/CONDUIT_SETUP.md` to pair Conduit MCP with the Conduit Figma plugin.
