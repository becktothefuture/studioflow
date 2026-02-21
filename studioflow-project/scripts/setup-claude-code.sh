#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "StudioFlow Claude Code setup"

if command -v claude >/dev/null 2>&1; then
  echo "Detected claude: $(claude --version)"
else
  echo "Warning: claude CLI not found yet."
  echo "Install with: npm install -g @anthropic-ai/claude-code"
fi

mkdir -p .claude .claude/commands handoff

cp -f .mcp.json.example .mcp.json
echo "Refreshed .mcp.json from template."

cp -f .claude/settings.local.json.example .claude/settings.local.json
echo "Refreshed .claude/settings.local.json from template."

if [[ -f CLAUDE.md ]]; then
  echo "Found CLAUDE.md repo instruction contract."
else
  echo "Warning: CLAUDE.md is missing. Claude sessions will have weaker project context."
fi

echo ""
echo "Next steps:"
echo "1) claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp"
echo "2) claude mcp list"
echo "3) Start claude, run /mcp, and complete Figma auth"
echo "4) npm install --save-dev @figma/code-connect"
echo "5) npx figma connect create"
echo "6) npm run check:mcp"
echo "7) Use .claude/commands/* playbooks for repeatable loop operations"
