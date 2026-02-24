import path from "node:path";
import { colorRegex, calcRegex, numberUnitRegex, collectMatches } from "./hardcoded-detect.mjs";

// Only check files matching these extensions
const CHECKED_EXTENSIONS = new Set([".css", ".ts", ".tsx", ".js", ".jsx"]);

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

function checkFileContent(content, filePath) {
  const lines = content.split(/\r?\n/);
  const violations = [];

  lines.forEach((line, index) => {
    if (isIgnoredLine(line)) return;

    const colors = collectMatches(colorRegex, line);
    const calcValues = collectMatches(calcRegex, line);
    const numberUnits = collectMatches(numberUnitRegex, line);

    for (const v of colors) violations.push({ file: filePath, line: index + 1, value: v, category: "color" });
    for (const v of calcValues) violations.push({ file: filePath, line: index + 1, value: v, category: "calc" });
    for (const v of numberUnits) violations.push({ file: filePath, line: index + 1, value: v, category: "unit" });
  });

  return violations;
}

export default function studioflowPlugin() {
  let projectRoot = "";

  return {
    name: "vite-plugin-studioflow",
    configResolved(config) {
      projectRoot = config.root;
    },
    handleHotUpdate({ file, read }) {
      const ext = path.extname(file);
      if (!CHECKED_EXTENSIONS.has(ext)) return;

      // Skip generated token files
      const relative = path.relative(projectRoot, file);
      if (relative.startsWith("tokens/") || relative.includes("tokens.css") || relative.includes("tokens.ts")) return;
      // Skip .d.ts files
      if (relative.endsWith(".d.ts")) return;

      read().then((content) => {
        const violations = checkFileContent(content, relative);
        if (violations.length > 0) {
          console.log("");
          console.log(`[studioflow] ${violations.length} token violation(s) in ${relative}:`);
          for (const v of violations) {
            console.log(`  ${v.file}:${v.line} — hardcoded ${v.category} \`${v.value}\``);
          }
          console.log("[studioflow] Use var(--token-name) from tokens/figma-variables.json instead.");
          console.log("");
        }
      }).catch(() => {
        // Silently ignore read failures during HMR
      });
    }
  };
}
