import { spawnSync } from "node:child_process";

const commands = [
  ["npm", ["run", "loop:code-to-canvas"]],
  ["npm", ["run", "demo:website:generate"]],
  ["npm", ["run", "loop:verify-canvas"], { STUDIOFLOW_INPUT: "handoff/demo-website-canvas-to-code.json" }],
  ["npm", ["run", "loop:canvas-to-code"], { STUDIOFLOW_INPUT: "handoff/demo-website-canvas-to-code.json" }],
  ["npm", ["run", "check"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "manifest:update"]]
];

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env }
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function main() {
  commands.forEach(([command, args, env]) => run(command, args, env));
  console.log("Demo completed successfully.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
