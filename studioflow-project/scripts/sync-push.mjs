import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { rootDir } from "./lib/workflow-utils.mjs";
import { classifyConduitError, formatConduitValidationError } from "./lib/conduit-errors.mjs";

const __filename = fileURLToPath(import.meta.url);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "pipe",
    env: { ...process.env }
  });
  return {
    ok: result.status === 0,
    command: `${command} ${args.join(" ")}`,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? ""
  };
}

function printStep(label, status) {
  const tag = status === "OK" ? "OK" : status === "SKIP" ? "SKIP" : "BLOCKED";
  console.log(`  [${tag}] ${label}`);
}

async function main() {
  console.log("[sync:push] Code -> Figma");
  console.log("");

  const buildResult = run("npm", ["run", "build:tokens"]);
  if (!buildResult.ok) {
    printStep("build:tokens", "BLOCKED");
    console.error(buildResult.stderr || buildResult.stdout);
    process.exit(1);
  }
  printStep("build:tokens", "OK");

  const loopResult = run("npm", ["run", "loop:code-to-canvas"]);
  if (!loopResult.ok) {
    printStep("loop:code-to-canvas", "BLOCKED");
    console.error(loopResult.stderr || loopResult.stdout);
    process.exit(1);
  }
  printStep("loop:code-to-canvas", "OK");

  console.log("");
  console.log("  Conduit ready: handoff/code-to-canvas.json");
  console.log("  Next: apply in Figma via Conduit, then run `npm run sync:pull`");
}

if (path.resolve(process.argv[1] || "") === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
