import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import { flattenTokens } from "./build-tokens.mjs";
import { tokenInputPath } from "./lib/workflow-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const scanPatterns = ["src/**/*.{ts,tsx,js,jsx,css}"];
const colorRegex = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\brgba?\([^\)]+\)|\bhsla?\([^\)]+\)/g;
const calcRegex = /\bcalc\([^\)]+\)/g;
const arbitraryValueRegex = /\[[^\]\n]+\]/g;
const numberUnitRegex = /\b(?!0(?:\.0+)?(?:px|rem|em|%)?\b)\d*\.?\d+(?:px|rem|em|vh|vw|vmin|vmax|%)\b/g;

function collectMatches(regex, line) {
  return [...line.matchAll(regex)].map((m) => m[0]);
}

function extractTokenRefs(line) {
  const refs = [];

  for (const match of line.matchAll(/var\(--([a-z0-9-]+)\)/gi)) {
    refs.push(match[1]);
  }
  for (const match of line.matchAll(/tokens\["([a-z0-9-]+)"\]/gi)) {
    refs.push(match[1]);
  }

  return refs;
}

function isIgnoredLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("import ") || trimmed.startsWith("export ") || trimmed.startsWith("//");
}

function collectLineViolations(line) {
  if (isIgnoredLine(line) || line.includes("var(--") || line.includes("url(")) {
    return [];
  }

  const violations = [];
  const colors = collectMatches(colorRegex, line);
  const calcValues = collectMatches(calcRegex, line);
  const numberUnits = collectMatches(numberUnitRegex, line);
  const arbitraryValues = collectMatches(arbitraryValueRegex, line).filter((raw) => {
    if (/^\[[a-z-]+:[^\]]+\]$/i.test(raw)) {
      return true;
    }
    return /#|\d(?:px|rem|em|vh|vw|%|\b)|calc\(/i.test(raw);
  });

  colors.forEach((value) => violations.push(`hardcoded color \`${value}\``));
  calcValues.forEach((value) => violations.push(`hardcoded calc \`${value}\``));
  numberUnits.forEach((value) => violations.push(`hardcoded unit \`${value}\``));
  arbitraryValues.forEach((value) => violations.push(`tailwind arbitrary value \`${value}\``));

  return violations;
}

function categoryForToken(tokenName) {
  return tokenName.split("-")[0];
}

async function main() {
  const [files, tokenJson] = await Promise.all([
    glob(scanPatterns, {
      cwd: rootDir,
      nodir: true,
      ignore: ["src/**/*.d.ts", "src/styles/tokens.css"]
    }),
    fs.readFile(tokenInputPath, "utf8").then((raw) => JSON.parse(raw))
  ]);

  const sortedFiles = [...files].sort((a, b) => a.localeCompare(b));
  const tokenRows = flattenTokens(tokenJson).sort((a, b) => a.name.localeCompare(b.name));
  const tokenUsage = new Map(tokenRows.map((token) => [token.name, 0]));
  const hardcodedViolations = [];

  for (const relativeFile of sortedFiles) {
    const fullPath = path.join(rootDir, relativeFile);
    const content = await fs.readFile(fullPath, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const tokenName of extractTokenRefs(line)) {
        if (tokenUsage.has(tokenName)) {
          tokenUsage.set(tokenName, tokenUsage.get(tokenName) + 1);
        }
      }

      for (const message of collectLineViolations(line)) {
        hardcodedViolations.push(`${relativeFile}:${index + 1} ${message}`);
      }
    });
  }

  hardcodedViolations.sort((a, b) => a.localeCompare(b));

  const categories = new Map();
  for (const token of tokenRows) {
    const category = categoryForToken(token.name);
    if (!categories.has(category)) {
      categories.set(category, { tokens: [], refs: 0, used: 0 });
    }
    categories.get(category).tokens.push(token.name);
  }

  for (const [tokenName, count] of tokenUsage.entries()) {
    const category = categoryForToken(tokenName);
    const data = categories.get(category);
    if (!data) continue;
    data.refs += count;
    if (count > 0) {
      data.used += 1;
    }
  }

  const totalTokenRefs = [...tokenUsage.values()].reduce((acc, value) => acc + value, 0);
  const totalSignals = totalTokenRefs + hardcodedViolations.length;
  const tokenizedPct = totalSignals === 0 ? 100 : (totalTokenRefs / totalSignals) * 100;

  console.log("Token Coverage Report");
  console.log(`Scanned files: ${sortedFiles.length}`);
  console.log("");
  console.log("Token Names by Category");

  for (const category of [...categories.keys()].sort((a, b) => a.localeCompare(b))) {
    const data = categories.get(category);
    const names = data.tokens.map((tokenName) => `${tokenName} (${tokenUsage.get(tokenName) ?? 0})`);
    console.log(`- ${category}: ${data.used}/${data.tokens.length} used, ${data.refs} refs`);
    console.log(`  ${names.join(", ")}`);
  }

  console.log("");
  console.log("Hardcoded Style Usages");
  if (hardcodedViolations.length === 0) {
    console.log("- none");
  } else {
    hardcodedViolations.forEach((violation) => console.log(`- ${violation}`));
  }

  console.log("");
  console.log(
    `Summary: ${tokenizedPct.toFixed(1)}% tokenised (${totalTokenRefs} token refs, ${hardcodedViolations.length} hardcoded violations)`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
