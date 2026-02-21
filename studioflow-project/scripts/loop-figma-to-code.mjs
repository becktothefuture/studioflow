import path from "node:path";
import { fileURLToPath } from "node:url";
import { runLoopCanvasToCode } from "./loop-canvas-to-code.mjs";
import { exchangePath, readWorkflowConfig } from "./lib/workflow-utils.mjs";

const __filename = fileURLToPath(import.meta.url);

async function main() {
  const workflow = await readWorkflowConfig();
  await runLoopCanvasToCode({
    inputPath: exchangePath(workflow, "figmaToCode")
  });
  console.log("Compatibility: loop:figma-to-code delegated to loop:canvas-to-code.");
}

if (path.resolve(process.argv[1] || "") === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
