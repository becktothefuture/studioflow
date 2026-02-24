import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import { rootDir, ensureDir } from "./lib/workflow-utils.mjs";

const sfidTagRegex = /<(\w+)\b[^>]*data-sfid\s*=\s*"([^"]+)"[^>]*>/g;
const sfidTagAltRegex = /data-sfid\s*=\s*"([^"]+)"[^>]*>/;

function extractChildContent(source, tagEndIndex) {
  const remaining = source.slice(tagEndIndex);

  const staticMatch = remaining.match(/^\s*\n?\s*([A-Za-z][^<{}\n]*?)\s*</);
  if (staticMatch) {
    return { textContent: staticMatch[1].trim(), propReference: null };
  }

  const exprMatch = remaining.match(/^\s*\n?\s*\{([^}]+)\}\s*</);
  if (exprMatch) {
    return { textContent: null, propReference: exprMatch[1].trim() };
  }

  return { textContent: null, propReference: null };
}

function extractElementForSfid(source, sfidIndex) {
  const before = source.slice(0, sfidIndex);
  const lastOpenBracket = before.lastIndexOf("<");
  if (lastOpenBracket === -1) {
    return null;
  }
  const fragment = before.slice(lastOpenBracket);
  const tagMatch = fragment.match(/^<(\w+)/);
  return tagMatch ? tagMatch[1] : null;
}

async function extractContentEntries() {
  const files = await glob(["src/components/**/*.{tsx,jsx}"], { cwd: rootDir, nodir: true });
  const entries = {};

  for (const file of files) {
    const source = await fs.readFile(path.join(rootDir, file), "utf8");

    for (const match of source.matchAll(sfidTagRegex)) {
      const element = match[1];
      const sfid = match[2];
      const tagEndIndex = match.index + match[0].length;
      const child = extractChildContent(source, tagEndIndex);
      entries[sfid] = { element, ...child };
    }

    const selfClosingRegex = /<(\w+)\b[^>]*data-sfid\s*=\s*"([^"]+)"[^>]*\/>/g;
    for (const match of source.matchAll(selfClosingRegex)) {
      const sfid = match[2];
      if (!entries[sfid]) {
        entries[sfid] = { element: match[1], textContent: null, propReference: null };
      }
    }

    const lineByLine = source.split("\n");
    for (let i = 0; i < lineByLine.length; i++) {
      const line = lineByLine[i];
      const sfidMatch = line.match(sfidTagAltRegex);
      if (!sfidMatch) continue;
      const sfid = sfidMatch[1];

      if (entries[sfid] && entries[sfid].element) continue;

      for (let j = i; j >= Math.max(0, i - 5); j--) {
        const tagMatch = lineByLine[j].match(/<(\w+)\b/);
        if (tagMatch) {
          if (!entries[sfid]) {
            entries[sfid] = { element: tagMatch[1], textContent: null, propReference: null };
          } else {
            entries[sfid].element = tagMatch[1];
          }
          break;
        }
      }
    }
  }

  return entries;
}

async function main() {
  const entries = await extractContentEntries();

  const sortedEntries = {};
  for (const key of Object.keys(entries).sort()) {
    sortedEntries[key] = entries[key];
  }

  let withStaticText = 0;
  let withPropReference = 0;
  let withoutContent = 0;

  for (const entry of Object.values(sortedEntries)) {
    if (entry.textContent) {
      withStaticText++;
    } else if (entry.propReference) {
      withPropReference++;
    } else {
      withoutContent++;
    }
  }

  const totalSfids = Object.keys(sortedEntries).length;
  const summary = { totalSfids, withStaticText, withPropReference, withoutContent };

  const output = {
    generatedAt: new Date().toISOString(),
    entries: sortedEntries,
    summary,
  };

  const outputPath = path.join(rootDir, "content", "content.json");
  await ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log("Content extraction complete:");
  console.log(`  Total sfids: ${summary.totalSfids}`);
  console.log(`  With static text: ${summary.withStaticText}`);
  console.log(`  With prop reference: ${summary.withPropReference}`);
  console.log(`  Without content: ${summary.withoutContent}`);
  console.log(`  Output: content/content.json`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
