import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const snapshotsDir = path.join(rootDir, "snapshots");
const manifestPath = path.join(rootDir, "studioflow.manifest.json");
const workflowConfigPath = path.join(rootDir, "studioflow.workflow.json");

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

async function maybeReadCanvasHandoff() {
  try {
    const raw = await fs.readFile(workflowConfigPath, "utf8");
    const config = JSON.parse(raw);

    const candidates = [config.exchangeFiles?.canvasToCode, config.exchangeFiles?.figmaToCode].filter(Boolean);
    for (const relativePath of candidates) {
      const fullPath = path.join(rootDir, relativePath);
      const payloadRaw = await fs.readFile(fullPath, "utf8");
      const payload = JSON.parse(payloadRaw);
      if (Array.isArray(payload?.screens) && payload.screens.length > 0) {
        return payload;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function collectSfidSet(screens) {
  const ids = new Set();
  for (const screen of screens) {
    const sfids = Array.isArray(screen?.sfids) ? screen.sfids : [];
    for (const sfid of sfids) {
      if (typeof sfid === "string" && sfid.startsWith("sfid:")) {
        ids.add(sfid);
      }
    }
  }
  return [...ids].sort();
}

async function main() {
  const canvasPayload = await maybeReadCanvasHandoff();
  const ids = canvasPayload ? collectSfidSet(canvasPayload.screens) : await getCodeIds();
  if (ids.length === 0) {
    throw new Error("Cannot create snapshot: no data-sfid IDs found in src files.");
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: canvasPayload ? "figma-canvas" : "code",
    canvasProvider: canvasPayload?.canvasProvider ?? null,
    integrationMode: canvasPayload?.integrationMode ?? null,
    screens: canvasPayload?.screens ?? [],
    tokenFrames: canvasPayload?.tokenFrames ?? [],
    variableModes: canvasPayload?.variableModes?.map((mode) => ({ name: mode.name, width: mode.width })) ?? [],
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
