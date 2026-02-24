import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rootDir, loadJson, writeJson } from "./lib/workflow-utils.mjs";
import { buildArtifacts } from "./build-tokens.mjs";

const tokenMapPath = path.join(rootDir, "handoff", "token-map.json");
const figmaVarsPath = path.join(rootDir, "tokens", "figma-variables.json");

const CSS_EXTENSIONS = new Set([".css"]);
const JS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

function sortObjectKeys(obj) {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return obj;
  }
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}

function insertToken(root, tokenName, value) {
  const segments = tokenName.split("-");
  let cursor = root;

  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    if (!(key in cursor) || typeof cursor[key] !== "object" || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }

  const leafKey = segments[segments.length - 1];

  if (
    leafKey in cursor &&
    typeof cursor[leafKey] === "object" &&
    cursor[leafKey] !== null &&
    "value" in cursor[leafKey]
  ) {
    console.warn(`⚠  Token path "${tokenName}" already exists — skipping insertion.`);
    return false;
  }

  cursor[leafKey] = { value };
  return true;
}

function isStyleObjectContext(line) {
  return /style\s*=\s*\{\{/.test(line) || /style\s*:\s*\{/.test(line) || /:\s*['"]/.test(line);
}

function replaceValueOnLine(line, rawValue, tokenName, ext) {
  const idx = line.indexOf(rawValue);
  if (idx === -1) return null;

  const varRef = `var(--${tokenName})`;

  if (CSS_EXTENSIONS.has(ext)) {
    return line.slice(0, idx) + varRef + line.slice(idx + rawValue.length);
  }

  if (JS_EXTENSIONS.has(ext)) {
    const before = line.slice(0, idx);
    const after = line.slice(idx + rawValue.length);

    const quotesBefore = before.match(/['"`]$/);
    const quotesAfter = after.match(/^['"`]/);

    if (quotesBefore && quotesAfter) {
      return (
        before.slice(0, -1) +
        `"${varRef}"` +
        after.slice(1)
      );
    }

    return before + varRef + after;
  }

  return line.slice(0, idx) + varRef + line.slice(idx + rawValue.length);
}

function parseSourceLocation(loc) {
  const lastColon = loc.lastIndexOf(":");
  if (lastColon === -1) return null;
  const file = loc.slice(0, lastColon);
  const lineNum = parseInt(loc.slice(lastColon + 1), 10);
  if (Number.isNaN(lineNum)) return null;
  return { file, line: lineNum };
}

export async function applyTokenMap() {
  const tokenMap = await loadJson(tokenMapPath);
  const figmaVars = await loadJson(figmaVarsPath);

  const proposed = tokenMap.proposedTokens ?? [];
  const skippedSet = new Set((tokenMap.skipped ?? []).map((s) => s.value));

  let tokensAdded = 0;
  let tokensReused = 0;

  const fileReplacements = new Map();

  for (const entry of proposed) {
    if (skippedSet.has(entry.value)) continue;

    if (entry.isNewToken) {
      const inserted = insertToken(figmaVars, entry.name, entry.value);
      if (inserted) {
        tokensAdded++;
      }
    } else {
      tokensReused++;
    }

    for (const loc of entry.sourceLocations ?? []) {
      const parsed = parseSourceLocation(loc);
      if (!parsed) {
        console.warn(`⚠  Could not parse source location "${loc}" — skipping.`);
        continue;
      }

      if (!fileReplacements.has(parsed.file)) {
        fileReplacements.set(parsed.file, []);
      }
      fileReplacements.get(parsed.file).push({
        line: parsed.line,
        rawValue: entry.value,
        tokenName: entry.name,
      });
    }
  }

  await writeJson(figmaVarsPath, sortObjectKeys(figmaVars));

  let filesModified = 0;
  let replacementsMade = 0;

  for (const [relFile, replacements] of fileReplacements) {
    const fullPath = path.join(rootDir, relFile);
    let content;
    try {
      content = await fs.readFile(fullPath, "utf8");
    } catch {
      console.warn(`⚠  File not found: ${relFile} — skipping.`);
      continue;
    }

    const lines = content.split("\n");
    const ext = path.extname(relFile);

    replacements.sort((a, b) => b.line - a.line);

    let fileModified = false;

    for (const rep of replacements) {
      const lineIdx = rep.line - 1;
      if (lineIdx < 0 || lineIdx >= lines.length) {
        console.warn(
          `⚠  Line ${rep.line} out of range in ${relFile} (${lines.length} lines) — skipping.`
        );
        continue;
      }

      const result = replaceValueOnLine(lines[lineIdx], rep.rawValue, rep.tokenName, ext);
      if (result === null) {
        console.warn(
          `⚠  Raw value "${rep.rawValue}" not found on line ${rep.line} of ${relFile} — skipping.`
        );
        continue;
      }

      lines[lineIdx] = result;
      replacementsMade++;
      fileModified = true;
    }

    if (fileModified) {
      await fs.writeFile(fullPath, lines.join("\n"), "utf8");
      filesModified++;
    }
  }

  console.log("Running build:tokens…");
  const buildResult = await buildArtifacts();
  console.log(`Built ${buildResult.count} tokens.`);

  const summary = { tokensAdded, tokensReused, filesModified, replacementsMade };
  console.log("\nSummary:", JSON.stringify(summary, null, 2));
  return summary;
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  applyTokenMap().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
