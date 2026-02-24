import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { rootDir } from "./lib/workflow-utils.mjs";
import { classifyConduitError } from "./lib/conduit-errors.mjs";

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

const STEPS = [
  { label: "loop:verify-canvas", args: ["run", "loop:verify-canvas"] },
  { label: "loop:canvas-to-code", args: ["run", "loop:canvas-to-code"] },
  { label: "build:tokens", args: ["run", "build:tokens"] },
  { label: "check", args: ["run", "check"] }
];

async function main() {
  console.log("[sync:pull] Figma -> Code");
  console.log("");

  for (const step of STEPS) {
    const result = run("npm", step.args);
    if (!result.ok) {
      printStep(step.label, "BLOCKED");
      const errorMessage = result.stderr || result.stdout;
      const classified = classifyConduitError(errorMessage);
      console.error("");
      console.error(`  [${classified.code}] ${classified.title}`);
      console.error(`  cause: ${classified.cause}`);
      console.error(`  fix: ${classified.fastestFix}`);
      process.exit(1);
    }
    printStep(step.label, "OK");
  }

  console.log("");
  console.log("  Sync complete. Code updated from Figma canvas.");
}

if (path.resolve(process.argv[1] || "") === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
