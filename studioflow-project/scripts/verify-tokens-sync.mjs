import fs from "node:fs/promises";
import path from "node:path";
import { buildArtifacts } from "./build-tokens.mjs";
import { rootDir } from "./lib/workflow-utils.mjs";

async function main() {
  const cssPath = path.join(rootDir, "tokens", "tokens.css");
  const tsPath = path.join(rootDir, "tokens", "tokens.ts");

  const before = await Promise.all([
    fs.readFile(cssPath, "utf8").catch(() => ""),
    fs.readFile(tsPath, "utf8").catch(() => "")
  ]);

  await buildArtifacts();

  const after = await Promise.all([
    fs.readFile(cssPath, "utf8"),
    fs.readFile(tsPath, "utf8")
  ]);

  const changed = [];
  if (before[0] !== after[0]) changed.push("tokens/tokens.css");
  if (before[1] !== after[1]) changed.push("tokens/tokens.ts");

  if (changed.length > 0) {
    console.error("Token files are out of sync. Run `npm run build:tokens` and commit generated files.");
    changed.forEach((entry) => console.error(`- ${entry}`));
    process.exit(1);
  }

  console.log("Token synchronization verification passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
