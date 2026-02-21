#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "StudioFlow one-command setup"
echo "Designer reassurance: the terminal is just Figma's backstage - no dragons, only tokens."

npm install

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude CLI missing. Attempting global install..."
  if npm install -g @anthropic-ai/claude-code; then
    echo "Claude CLI installed."
  else
    echo "Warning: could not auto-install Claude CLI. Install manually with: npm install -g @anthropic-ai/claude-code"
  fi
fi

npm run setup:claude

if npx playwright install chromium; then
  echo "Playwright chromium installed."
else
  echo "Warning: playwright chromium install failed. loop:proof screenshots may fail until this succeeds."
fi

npm run build:tokens
npm run test:contracts
npm run check
npm run loop:code-to-canvas

if npm run check:mcp; then
  echo "MCP health check passed."
else
  echo "Warning: MCP health check did not pass yet. Complete Claude/Figma auth with:"
  echo "  claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp"
  echo "  claude"
  echo "  /mcp"
fi

echo "Setup complete. Next command: npm run demo:website:capture"
