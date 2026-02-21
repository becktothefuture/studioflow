import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readWorkflowConfig, rootDir } from "./lib/workflow-utils.mjs";

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath) {
  if (!(await fileExists(filePath))) return null;
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function hasFigmaServer(config) {
  if (!config || typeof config !== "object") return false;
  if (config.mcpServers && typeof config.mcpServers === "object") {
    return Object.keys(config.mcpServers).includes("figma");
  }
  if (Array.isArray(config.servers)) {
    return config.servers.some((server) => server?.name === "figma");
  }
  return false;
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    timeout: 10_000
  });
}

async function main() {
  const workflow = await readWorkflowConfig();
  const errors = [];
  const warnings = [];

  if (workflow.integration !== "canvas-central") {
    errors.push(`Expected integration to be "canvas-central", got "${workflow.integration ?? "undefined"}".`);
  }

  if (!Array.isArray(workflow.canvas?.providers) || workflow.canvas.providers.length === 0) {
    errors.push("workflow.canvas.providers must be a non-empty array.");
  }

  const mcpTemplatePath = path.join(rootDir, ".mcp.json.example");
  const mcpConfigPath = path.join(rootDir, ".mcp.json");
  const [mcpTemplate, mcpConfig] = await Promise.all([readJsonIfExists(mcpTemplatePath), readJsonIfExists(mcpConfigPath)]);

  if (!mcpTemplate) {
    errors.push("Missing .mcp.json.example.");
  } else if (!hasFigmaServer(mcpTemplate)) {
    errors.push(".mcp.json.example does not declare a figma MCP server.");
  }

  if (!mcpConfig) {
    warnings.push("No .mcp.json found yet. Run `npm run setup:claude` or copy the example file.");
  } else if (!hasFigmaServer(mcpConfig)) {
    errors.push(".mcp.json exists but does not declare a figma MCP server.");
  }

  const claudeVersion = run("claude", ["--version"]);
  if (claudeVersion.error || claudeVersion.status !== 0) {
    errors.push("Claude Code CLI is not available. Install with `npm install -g @anthropic-ai/claude-code`.");
  } else {
    const mcpList = run("claude", ["mcp", "list"]);
    if (mcpList.error || mcpList.status !== 0) {
      warnings.push("Could not run `claude mcp list`. Authenticate via `claude` and `/mcp` if needed.");
    } else if (!mcpList.stdout.toLowerCase().includes("figma")) {
      warnings.push("`claude mcp list` does not currently show a figma server.");
    }
  }

  if (errors.length > 0) {
    console.error("MCP health check failed:\n");
    errors.forEach((error) => console.error(`- ${error}`));
    if (warnings.length > 0) {
      console.error("\nWarnings:");
      warnings.forEach((warning) => console.error(`- ${warning}`));
    }
    process.exit(1);
  }

  console.log("MCP health check passed.");
  if (warnings.length > 0) {
    console.log("\nWarnings:");
    warnings.forEach((warning) => console.log(`- ${warning}`));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
