import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import {
  colorRegex,
  calcRegex,
  arbitraryValueRegex,
  numberUnitRegex
} from "./lib/hardcoded-detect.mjs";
import { readWorkflowConfig, rootDir, writeJson } from "./lib/workflow-utils.mjs";

const fallbackIncludePatterns = [
  "src/**/*.{ts,tsx,js,jsx,css,scss,sass,html,htm,vue,svelte}",
  "**/*.{html,htm,css,scss,sass,js,ts,jsx,tsx,vue,svelte}"
];
const fallbackExcludePatterns = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.git/**",
  "**/*.d.ts"
];

const projectTypeDefaults = {
  react: ["src/**/*.{tsx,jsx,ts,js,css,scss,sass}", "**/*.{tsx,jsx}"],
  html: ["**/*.{html,htm,css,scss,sass,js,ts}"],
  auto: fallbackIncludePatterns
};

const reportPath = path.join(rootDir, "handoff", "scan-report.json");

const cssPropertyRegex = /^\s*([a-z-]+)\s*:/i;
const componentExportRegex =
  /export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(|export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=/g;
const sfidRegex = /data-sfid\s*=\s*["']([^"']+)["']/g;

function parseArgs() {
  const args = process.argv.slice(2);
  let projectType = "auto";
  const includePatterns = [];
  const excludePatterns = [];

  function parseCsvOrValue(value) {
    return String(value)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pattern" && args[i + 1]) {
      includePatterns.push(...parseCsvOrValue(args[i + 1]));
      i++;
      continue;
    }
    if (args[i] === "--include" && args[i + 1]) {
      includePatterns.push(...parseCsvOrValue(args[i + 1]));
      i++;
      continue;
    }
    if (args[i] === "--exclude" && args[i + 1]) {
      excludePatterns.push(...parseCsvOrValue(args[i + 1]));
      i++;
      continue;
    }
    if (args[i] === "--project-type" && args[i + 1]) {
      projectType = String(args[i + 1]).toLowerCase();
      i++;
      continue;
    }
  }
  return { projectType, includePatterns, excludePatterns };
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

function scanDocumentComponents(content, relativeFile) {
  const sfids = [];
  const sfidCloned = new RegExp(sfidRegex.source, sfidRegex.flags);
  let sfidMatch;
  while ((sfidMatch = sfidCloned.exec(content)) !== null) {
    sfids.push(sfidMatch[1]);
  }

  if (sfids.length === 0) {
    return [];
  }

  return [
    {
      file: relativeFile,
      name: path.basename(relativeFile),
      sfidCandidates: [...new Set(sfids)].sort()
    }
  ];
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function resolveScanConfig(workflow, cli) {
  const workflowScan = workflow?.projectScan ?? {};
  const workflowInclude = Array.isArray(workflowScan.includePatterns) ? workflowScan.includePatterns : [];
  const workflowExclude = Array.isArray(workflowScan.excludePatterns) ? workflowScan.excludePatterns : [];

  const baseInclude =
    cli.projectType in projectTypeDefaults
      ? projectTypeDefaults[cli.projectType]
      : projectTypeDefaults.auto;

  const includeFromProjectType = cli.projectType !== "auto";

  const includePatterns = uniqueSorted(
    cli.includePatterns.length > 0
      ? cli.includePatterns
      : includeFromProjectType
        ? baseInclude
        : workflowInclude.length > 0
        ? workflowInclude
        : baseInclude
  );

  const excludePatterns = uniqueSorted(
    cli.excludePatterns.length > 0
      ? cli.excludePatterns
      : workflowExclude.length > 0
        ? workflowExclude
        : fallbackExcludePatterns
  );

  return {
    projectType: cli.projectType,
    includePatterns,
    excludePatterns
  };
}

async function main() {
  const [workflow, cli] = await Promise.all([readWorkflowConfig(), Promise.resolve(parseArgs())]);
  const scanConfig = resolveScanConfig(workflow, cli);

  const files = await glob(scanConfig.includePatterns, {
    cwd: rootDir,
    nodir: true,
    ignore: scanConfig.excludePatterns
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
      continue;
    }

    if (
      relativeFile.endsWith(".html") ||
      relativeFile.endsWith(".htm") ||
      relativeFile.endsWith(".vue") ||
      relativeFile.endsWith(".svelte")
    ) {
      const components = scanDocumentComponents(content, relativeFile);
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
    scanConfig,
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
  console.log(`  Project type: ${scanConfig.projectType}`);
  console.log(`  Includes: ${scanConfig.includePatterns.join(", ")}`);
  console.log(`  Excludes: ${scanConfig.excludePatterns.join(", ")}`);
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
