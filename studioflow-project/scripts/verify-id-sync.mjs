import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const manifestPath = path.join(rootDir, "studioflow.manifest.json");
const snapshotsDir = path.join(rootDir, "snapshots");

const codeIdRegex = /data-sfid\s*=\s*['"]([^'"]+)['"]/g;
const sfidRegex = /sfid:[a-zA-Z0-9:_-]+/g;

function sanitizeId(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "");
}

function duplicateValues(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      dupes.add(value);
    }
    seen.add(value);
  }
  return [...dupes];
}

async function extractCodeIds() {
  const files = await glob(["src/**/*.{tsx,jsx,html}"], { cwd: rootDir, nodir: true });
  const ids = [];

  for (const file of files) {
    const content = await fs.readFile(path.join(rootDir, file), "utf8");
    for (const match of content.matchAll(codeIdRegex)) {
      ids.push(sanitizeId(match[1]));
    }
  }

  return ids;
}

async function extractSnapshotIds() {
  const snapshotFiles = await glob(["*.json"], { cwd: snapshotsDir, nodir: true });
  const ids = [];

  for (const file of snapshotFiles) {
    const content = await fs.readFile(path.join(snapshotsDir, file), "utf8");
    for (const match of content.matchAll(sfidRegex)) {
      ids.push(sanitizeId(match[0]));
    }
  }

  return ids;
}

async function readManifestIds() {
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  const expected = Array.isArray(manifest.expectedSfids) ? manifest.expectedSfids : [];
  return expected.map((value) => sanitizeId(String(value)));
}

async function main() {
  const [codeIds, snapshotIds, manifestIds] = await Promise.all([
    extractCodeIds(),
    extractSnapshotIds(),
    readManifestIds()
  ]);

  if (codeIds.length === 0) {
    throw new Error("No data-sfid IDs found in src files.");
  }

  const codeDupes = duplicateValues(codeIds);
  if (codeDupes.length > 0) {
    throw new Error(`Duplicate code IDs found: ${codeDupes.join(", ")}`);
  }

  const referenceIds = snapshotIds.length > 0 ? snapshotIds : manifestIds;
  if (referenceIds.length === 0) {
    throw new Error("No reference IDs found. Add snapshots/*.json or expectedSfids in studioflow.manifest.json");
  }

  const referenceDupes = duplicateValues(referenceIds);
  if (referenceDupes.length > 0) {
    throw new Error(`Duplicate reference IDs found: ${referenceDupes.join(", ")}`);
  }

  const codeSet = new Set(codeIds);
  const referenceSet = new Set(referenceIds);

  const missingInReference = codeIds.filter((id) => !referenceSet.has(id));
  const missingInCode = referenceIds.filter((id) => !codeSet.has(id));

  if (missingInReference.length > 0 || missingInCode.length > 0) {
    console.error("Stable ID verification failed:");
    if (missingInReference.length > 0) {
      console.error(`- In code but not in reference: ${missingInReference.join(", ")}`);
    }
    if (missingInCode.length > 0) {
      console.error(`- In reference but not in code: ${missingInCode.join(", ")}`);
    }
    process.exit(1);
  }

  const source = snapshotIds.length > 0 ? "snapshots" : "manifest expectedSfids";
  console.log(`Stable ID verification passed (${codeSet.size} IDs matched against ${source}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
