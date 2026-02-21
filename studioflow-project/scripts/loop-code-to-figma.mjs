import path from "node:path";
import { fileURLToPath } from "node:url";
import { runLoopCodeToCanvas } from "./loop-code-to-canvas.mjs";

const __filename = fileURLToPath(import.meta.url);

async function main() {
  await runLoopCodeToCanvas();
  console.log("Compatibility: loop:code-to-figma delegated to loop:code-to-canvas.");
}

if (path.resolve(process.argv[1] || "") === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
