import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const snapshotsDir = path.join(rootDir, "snapshots");
const manifestPath = path.join(rootDir, "studioflow.manifest.json");

const codeIdRegex = /data-sfid\s*=\s*['"]([^'"]+)['"]/g;

function utcStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function getCodeIds() {
  const files = await glob(["src/**/*.{tsx,jsx,html}"], { cwd: rootDir, nodir: true });
  const ids = new Set();
  for (const file of files) {
    const content = await fs.readFile(path.join(rootDir, file), "utf8");
    for (const match of content.matchAll(codeIdRegex)) {
      ids.add(match[1]);
    }
  }
  return [...ids].sort();
}

async function main() {
  const ids = await getCodeIds();
  if (ids.length === 0) {
    throw new Error("Cannot create snapshot: no data-sfid IDs found in src files.");
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: "code",
    sfids: ids
  };

  const filename = `figma-${utcStamp()}.json`;
  const outputPath = path.join(snapshotsDir, filename);
  await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  const manifestRaw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);
  manifest.lastSnapshot = filename;
  manifest.lastSnapshotAt = snapshot.generatedAt;
  manifest.expectedSfids = ids;
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log(`Snapshot created: snapshots/${filename}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
