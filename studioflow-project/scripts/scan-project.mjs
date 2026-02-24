import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import {
  colorRegex,
  calcRegex,
  arbitraryValueRegex,
  numberUnitRegex,
  collectMatches,
} from "./lib/hardcoded-detect.mjs";
import { rootDir, writeJson } from "./lib/workflow-utils.mjs";

const defaultPattern = "src/**/*.{ts,tsx,js,jsx,css}";
const reportPath = path.join(rootDir, "handoff", "scan-report.json");

const cssPropertyRegex = /^\s*([a-z-]+)\s*:/i;
const componentExportRegex =
  /export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(|export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=/g;
const sfidRegex = /data-sfid\s*=\s*["']([^"']+)["']/g;

function parseArgs() {
  const args = process.argv.slice(2);
  let pattern = defaultPattern;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pattern" && args[i + 1]) {
      pattern = args[i + 1];
      i++;
    }
  }
  return { pattern };
}

function isIgnoredLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("import ") ||
    trimmed.startsWith("export ") ||
    trimmed.startsWith("//")
  );
}

function stripVarReferences(line) {
  return line.replace(/var\(--[^)]+\)/g, (match) => " ".repeat(match.length));
}

function extractCssProperty(line, filePath) {
  if (!filePath.endsWith(".css")) return null;
  const m = line.match(cssPropertyRegex);
  return m ? m[1] : null;
}

function scanHardcodedValues(lines, relativeFile) {
  const results = [];
  const isCss = relativeFile.endsWith(".css");

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (isIgnoredLine(rawLine)) continue;

    const line = stripVarReferences(rawLine);
    const cssProperty = extractCssProperty(rawLine, relativeFile);

    const checks = [
      { regex: colorRegex, category: "color" },
      { regex: calcRegex, category: "calc" },
      { regex: numberUnitRegex, category: "unit" },
      { regex: arbitraryValueRegex, category: "arbitrary" },
    ];

    for (const { regex, category } of checks) {
      const cloned = new RegExp(regex.source, regex.flags);
      let match;
      while ((match = cloned.exec(line)) !== null) {
        if (category === "arbitrary") {
          const raw = match[0];
          const isTailwind = /^\[[a-z-]+:[^\]]+\]$/i.test(raw);
          const hasCssValue = /#|\d(?:px|rem|em|vh|vw|%|\b)|calc\(/i.test(raw);
          if (!isTailwind && !hasCssValue) continue;
        }
        results.push({
          file: relativeFile,
          line: i + 1,
          column: match.index,
          rawValue: match[0],
          cssProperty: isCss ? cssProperty : null,
          category,
        });
      }
    }
  }

  return results;
}

function scanComponents(content, relativeFile) {
  const components = [];
  const cloned = new RegExp(componentExportRegex.source, componentExportRegex.flags);
  let match;
  while ((match = cloned.exec(content)) !== null) {
    const name = match[1] || match[2];
    components.push({ file: relativeFile, name });
  }

  if (components.length > 0) {
    const sfids = [];
    const sfidCloned = new RegExp(sfidRegex.source, sfidRegex.flags);
    let sfidMatch;
    while ((sfidMatch = sfidCloned.exec(content)) !== null) {
      sfids.push(sfidMatch[1]);
    }
    for (const comp of components) {
      comp.sfidCandidates = [...sfids];
    }
  }

  return components;
}

async function main() {
  const { pattern } = parseArgs();

  const files = await glob([pattern], {
    cwd: rootDir,
    nodir: true,
    ignore: ["src/**/*.d.ts"],
  });

  const allHardcoded = [];
  const allComponents = [];

  for (const relativeFile of files) {
    const fullPath = path.join(rootDir, relativeFile);
    const content = await fs.readFile(fullPath, "utf8");
    const lines = content.split(/\r?\n/);

    const hardcoded = scanHardcodedValues(lines, relativeFile);
    allHardcoded.push(...hardcoded);

    if (relativeFile.endsWith(".tsx") || relativeFile.endsWith(".jsx")) {
      const components = scanComponents(content, relativeFile);
      allComponents.push(...components);
    }
  }

  allHardcoded.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  allComponents.sort((a, b) => a.file.localeCompare(b.file));

  const byCategory = { color: 0, unit: 0, calc: 0, arbitrary: 0 };
  for (const h of allHardcoded) {
    byCategory[h.category]++;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scannedFiles: files.length,
    hardcodedValues: allHardcoded,
    components: allComponents,
    summary: {
      totalFiles: files.length,
      totalHardcoded: allHardcoded.length,
      byCategory,
      componentCount: allComponents.length,
    },
  };

  await writeJson(reportPath, report);

  console.log(`Scan complete.`);
  console.log(`  Files scanned:  ${report.summary.totalFiles}`);
  console.log(`  Hardcoded values: ${report.summary.totalHardcoded}`);
  console.log(
    `    color: ${byCategory.color}, unit: ${byCategory.unit}, calc: ${byCategory.calc}, arbitrary: ${byCategory.arbitrary}`
  );
  console.log(`  Components:     ${report.summary.componentCount}`);
  console.log(`  Report written: ${path.relative(rootDir, reportPath)}`);
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
