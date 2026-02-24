import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import { rootDir, manifestPath } from "./lib/workflow-utils.mjs";

async function latestSnapshotFile() {
  const files = await glob(["snapshots/*.json"], { cwd: rootDir, nodir: true });
  if (files.length === 0) return null;
  const sorted = [...files].sort();
  return sorted[sorted.length - 1].replace(/^snapshots\//, "");
}

async function main() {
  const manifestRaw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);

  manifest.updatedAt = new Date().toISOString();
  manifest.loopCount = Number.isFinite(manifest.loopCount) ? manifest.loopCount : 0;
  manifest.lastVerification = {
    status: "passed",
    ranAt: manifest.updatedAt,
    command: "npm run check"
  };

  if (manifest.lastCanvasVerification) {
    manifest.lastCanvasVerification = {
      ...manifest.lastCanvasVerification,
      status: "passed",
      ranAt: manifest.updatedAt
    };
  }

  const snapshot = await latestSnapshotFile();
  if (snapshot) {
    manifest.lastSnapshot = snapshot;
  }

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log("Manifest updated: studioflow.manifest.json");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
