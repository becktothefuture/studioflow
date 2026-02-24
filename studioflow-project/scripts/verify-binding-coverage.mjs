import path from "node:path";
import { fileURLToPath } from "node:url";
import { exchangePath, loadJson, readWorkflowConfig, rootDir, writeJson } from "./lib/workflow-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const outputPath = path.join(rootDir, "handoff", "binding-coverage.json");

// Properties that could be Figma styles if not token-bound
const STYLE_CAPABLE_PROPERTIES = new Set([
  "fills/0/color", "fills/*/color",
  "strokes/0/color", "strokes/*/color",
  "fontFamily", "fontSize", "lineHeight", "letterSpacing", "fontWeight",
  "effects/dropShadow",
  "cornerRadius",
  "text/fills/0/color"
]);

function analyzeBindings(payload) {
  const sfids = payload.sfids ?? [];
  const tokenMapping = payload.tokenMapping ?? [];
  const styleLayer = payload.styleLayer ?? { semanticStyles: [], specialStyles: [], elementPropertyMappings: [] };
  const elementMappings = styleLayer.elementPropertyMappings ?? [];

  // Build lookup: sfid → style assignments
  const styleBySfid = new Map();
  for (const mapping of elementMappings) {
    if (!styleBySfid.has(mapping.sfid)) {
      styleBySfid.set(mapping.sfid, []);
    }
    styleBySfid.get(mapping.sfid).push(mapping);
  }

  // Build lookup: style name → property assignments
  const styleAssignments = new Map();
  for (const style of styleLayer.semanticStyles ?? []) {
    styleAssignments.set(style.name, Object.keys(style.assignments ?? {}));
  }

  // Build set of token names that are variable-bound
  const boundTokenNames = new Set(
    tokenMapping.filter(t => t.bindingMode === "variable-bound").map(t => t.codeTokenName)
  );

  const bindings = [];

  for (const sfid of [...sfids].sort()) {
    const sfidStyles = styleBySfid.get(sfid) ?? [];

    if (sfidStyles.length === 0) {
      // sfid exists but has no style or property mapping
      bindings.push({
        sfid,
        property: "*",
        status: "UNBOUND",
        detail: "No element-property mapping in styleLayer"
      });
      continue;
    }

    for (const mapping of sfidStyles) {
      const styleName = mapping.style;
      const properties = styleAssignments.get(styleName) ?? [];

      if (properties.length === 0) {
        bindings.push({
          sfid,
          property: mapping.property ?? "*",
          status: "BOUND_STYLE",
          detail: `Style "${styleName}" (no property breakdown available)`
        });
        continue;
      }

      for (const prop of properties.sort()) {
        const style = (styleLayer.semanticStyles ?? []).find(s => s.name === styleName);
        const tokenName = style?.assignments?.[prop];

        if (tokenName && boundTokenNames.has(tokenName)) {
          bindings.push({ sfid, property: prop, status: "BOUND_TOKEN", detail: tokenName });
        } else if (tokenName) {
          bindings.push({ sfid, property: prop, status: "BOUND_STYLE", detail: `${styleName} → ${tokenName}` });
        } else if (STYLE_CAPABLE_PROPERTIES.has(prop)) {
          bindings.push({ sfid, property: prop, status: "COULD_BE_STYLE", detail: `Property "${prop}" is style-capable but not mapped` });
        } else {
          bindings.push({ sfid, property: prop, status: "UNBOUND", detail: `No token or style for "${prop}"` });
        }
      }
    }
  }

  // Check for sfids with no mapping at all
  const mappedSfids = new Set(elementMappings.map(m => m.sfid));
  for (const sfid of [...sfids].sort()) {
    if (!mappedSfids.has(sfid)) {
      const existing = bindings.find(b => b.sfid === sfid);
      if (!existing) {
        bindings.push({
          sfid,
          property: "*",
          status: "UNBOUND",
          detail: "No element-property mapping in styleLayer"
        });
      }
    }
  }

  // Sort for determinism
  bindings.sort((a, b) => a.sfid.localeCompare(b.sfid) || a.property.localeCompare(b.property));

  return bindings;
}

async function main() {
  const workflow = await readWorkflowConfig();
  const conduitPath = exchangePath(workflow, "codeToCanvas");

  let payload;
  try {
    payload = await loadJson(conduitPath);
  } catch {
    console.error(`Could not read conduit payload at ${path.relative(rootDir, conduitPath)}.`);
    console.error("Run `npm run conduit:generate` first.");
    process.exit(1);
  }

  const bindings = analyzeBindings(payload);

  const summary = {
    bound: bindings.filter(b => b.status === "BOUND_TOKEN" || b.status === "BOUND_STYLE").length,
    unbound: bindings.filter(b => b.status === "UNBOUND").length,
    couldBeStyle: bindings.filter(b => b.status === "COULD_BE_STYLE").length,
    total: bindings.length
  };

  const report = {
    generatedAt: new Date().toISOString(),
    bindings,
    summary
  };

  await writeJson(outputPath, report);

  // Print human-readable output
  console.log("Binding Coverage Report");
  console.log("");

  let currentSfid = null;
  for (const b of bindings) {
    if (b.sfid !== currentSfid) {
      currentSfid = b.sfid;
      console.log(`  ${b.sfid}`);
    }
    console.log(`    [${b.status}] ${b.property} — ${b.detail}`);
  }

  console.log("");
  console.log(`Summary: ${summary.bound} bound, ${summary.unbound} unbound, ${summary.couldBeStyle} could-be-style (${summary.total} total)`);
  console.log(`Report: ${path.relative(rootDir, outputPath)}`);
}

if (path.resolve(process.argv[1] || "") === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
