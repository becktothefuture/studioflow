import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import { colorRegex, calcRegex, arbitraryValueRegex, numberUnitRegex, collectMatches } from "./lib/hardcoded-detect.mjs";
import { rootDir } from "./lib/workflow-utils.mjs";

const scanPatterns = ["src/**/*.{ts,tsx,js,jsx,css}"];

function isIgnoredLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("import ") ||
    trimmed.startsWith("export ") ||
    trimmed.startsWith("//") ||
    trimmed.includes("var(--") ||
    trimmed.includes("url(")
  );
}

function hasTokenReference(segment) {
  return /var\(--[a-z0-9-]+\)/i.test(segment) || /tokens\.[a-z0-9_]+/i.test(segment);
}

async function main() {
  const files = await glob(scanPatterns, {
    cwd: rootDir,
    nodir: true,
    ignore: ["src/**/*.d.ts"]
  });
  const violations = [];

  for (const relativeFile of files) {
    const fullPath = path.join(rootDir, relativeFile);
    const content = await fs.readFile(fullPath, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (isIgnoredLine(line)) {
        return;
      }

      const lineViolations = [];
      const colors = collectMatches(colorRegex, line).filter((c) => !hasTokenReference(c));
      const calcValues = collectMatches(calcRegex, line).filter((c) => !hasTokenReference(c));
      const numberUnits = collectMatches(numberUnitRegex, line).filter((n) => !hasTokenReference(n));

      const arbitraryValues = collectMatches(arbitraryValueRegex, line).filter((raw) => {
        if (/^\[[a-z-]+:[^\]]+\]$/i.test(raw)) {
          return true;
        }
        return /#|\d(?:px|rem|em|vh|vw|%|\b)|calc\(/i.test(raw);
      });

      colors.forEach((v) => lineViolations.push(`hardcoded color \`${v}\``));
      calcValues.forEach((v) => lineViolations.push(`hardcoded calc \`${v}\``));
      numberUnits.forEach((v) => lineViolations.push(`hardcoded unit \`${v}\``));
      arbitraryValues.forEach((v) => lineViolations.push(`tailwind arbitrary value \`${v}\``));

      for (const message of lineViolations) {
        violations.push(`${relativeFile}:${index + 1} ${message}`);
      }
    });
  }

  if (violations.length > 0) {
    console.error("Found hardcoded style values that violate the Token-Only rule:\n");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log(`Token-Only verification passed for ${files.length} files.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
