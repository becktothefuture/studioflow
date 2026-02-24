import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import { rootDir, loadJson } from "./lib/workflow-utils.mjs";

const __filename = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const args = { mapFile: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--map" && argv[i + 1]) {
      args.mapFile = argv[i + 1];
      i++;
    }
    if (argv[i] === "--dry-run") {
      args.dryRun = true;
    }
  }
  return args;
}

async function replaceInFile(filePath, mapping, dryRun) {
  const content = await fs.readFile(filePath, "utf8");
  let result = content;
  let count = 0;

  // Sort by longest key first to avoid partial replacements
  const sortedEntries = Object.entries(mapping).sort((a, b) => b[0].length - a[0].length);

  for (const [oldSfid, newSfid] of sortedEntries) {
    const escaped = oldSfid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "g");
    const matches = result.match(regex);
    if (matches) {
      count += matches.length;
      result = result.replace(regex, newSfid);
    }
  }

  if (count > 0 && !dryRun) {
    await fs.writeFile(filePath, result, "utf8");
  }

  return count;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.mapFile) {
    console.error("Usage: node scripts/migrate-sfids.mjs --map <mapping.json> [--dry-run]");
    console.error("");
    console.error("mapping.json format:");
    console.error('  { "sfid:hero-root": "sfid:hero/root", "sfid:hero-title": "sfid:hero/title" }');
    process.exit(1);
  }

  const mapPath = path.resolve(args.mapFile);
  const mapping = await loadJson(mapPath);

  if (!mapping || typeof mapping !== "object" || Object.keys(mapping).length === 0) {
    console.error("Mapping file is empty or invalid.");
    process.exit(1);
  }

  const mode = args.dryRun ? "[DRY RUN] " : "";
  console.log(`${mode}Migrating sfids using ${path.relative(rootDir, mapPath)}`);
  console.log(`${mode}Mappings: ${Object.keys(mapping).length}`);
  console.log("");

  // Collect all files to process
  const sourceFiles = await glob(["src/**/*.{tsx,jsx,html}"], { cwd: rootDir, nodir: true });
  const snapshotFiles = await glob(["snapshots/*.json"], { cwd: rootDir, nodir: true });
  const configFiles = ["studioflow.manifest.json"];

  const allFiles = [...sourceFiles, ...snapshotFiles, ...configFiles].sort();

  let totalFiles = 0;
  let totalReplacements = 0;

  for (const relFile of allFiles) {
    const fullPath = path.join(rootDir, relFile);
    try {
      await fs.access(fullPath);
    } catch {
      continue; // Skip files that don't exist
    }

    const count = await replaceInFile(fullPath, mapping, args.dryRun);
    if (count > 0) {
      console.log(`  ${mode}${relFile}: ${count} replacement(s)`);
      totalFiles++;
      totalReplacements += count;
    }
  }

  console.log("");
  console.log(`${mode}Summary: ${totalFiles} files modified, ${totalReplacements} replacements`);

  if (args.dryRun) {
    console.log("");
    console.log("No files were written. Remove --dry-run to apply changes.");
  }
}

if (path.resolve(process.argv[1] || "") === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
