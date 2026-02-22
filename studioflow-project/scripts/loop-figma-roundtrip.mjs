import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const canvasPayloadPath = path.join(rootDir, "handoff", "canvas-to-code.json");
const shouldApply = process.argv.includes("--apply");

const checklist = [
  "Run `npm run loop:code-to-canvas`",
  "Ensure tokens are exported if needed",
  "Use Conduit to apply the payload to Figma and export `handoff/canvas-to-code.json`",
  "Run `npm run loop:verify-canvas`",
  "Run `npm run loop:canvas-to-code`",
  "Run `npm run check`",
  "Run `npm run build`",
  "Run `npm run loop:proof`",
  "Run `npm run manifest:update`"
];

console.log("StudioFlow operator checklist:");
checklist.forEach((item, index) => {
  console.log(`${index + 1}. ${item}`);
});

if (!shouldApply) {
  process.exit(0);
}

if (!existsSync(canvasPayloadPath)) {
  console.error("Missing handoff/canvas-to-code.json");
  process.exit(1);
}

const applyCommands = [
  ["run", "loop:verify-canvas"],
  ["run", "loop:canvas-to-code"],
  ["run", "check"],
  ["run", "build"],
  ["run", "loop:proof"],
  ["run", "manifest:update"]
];

for (const npmArgs of applyCommands) {
  const result = spawnSync("npm", npmArgs, {
    cwd: rootDir,
    stdio: "inherit"
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
}
