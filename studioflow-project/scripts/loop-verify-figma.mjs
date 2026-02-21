import path from "node:path";
import { fileURLToPath } from "node:url";
import { runLoopVerifyCanvas } from "./loop-verify-canvas.mjs";
import { exchangePath, readWorkflowConfig } from "./lib/workflow-utils.mjs";

const __filename = fileURLToPath(import.meta.url);

async function main() {
  const workflow = await readWorkflowConfig();
  await runLoopVerifyCanvas({
    inputPath: exchangePath(workflow, "figmaToCode")
  });
  console.log("Compatibility: loop:verify-figma delegated to loop:verify-canvas.");
}

if (path.resolve(process.argv[1] || "") === __filename) {
  main().catch((error) => {
    console.error("Figma handoff verification failed:\n");
    const message = error instanceof Error ? error.message : String(error);
    message
      .split("\n")
      .filter(Boolean)
      .forEach((line) => console.error(`- ${line}`));
    process.exit(1);
  });
}
