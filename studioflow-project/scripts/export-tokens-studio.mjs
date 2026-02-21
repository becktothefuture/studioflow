import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadJson,
  readWorkflowConfig,
  rootDir,
  writeJson
} from "./lib/workflow-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const breakpointVarsPath = path.join(rootDir, "tokens", "figma-breakpoint-variables.json");
const outputPath = path.join(rootDir, "tokens", "tokens-studio-import.json");
const collectionName = "StudioFlow";

function inferType(tokenName, value) {
  const v = String(value).trim();

  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return "color";

  if (/^-?\d+(\.\d+)?px$/.test(v)) {
    if (tokenName.startsWith("radius-")) return "borderRadius";
    if (tokenName.startsWith("size-border-")) return "borderWidth";
    if (tokenName.startsWith("font-size-")) return "fontSizes";
    if (tokenName.startsWith("space-")) return "spacing";
    if (tokenName.startsWith("size-")) return "sizing";
    return "dimension";
  }

  if (/^-?\d+(\.\d+)?em$/.test(v)) {
    if (tokenName.startsWith("font-letter-spacing-")) return "letterSpacing";
    return "dimension";
  }

  if (/^-?\d+(\.\d+)?$/.test(v)) {
    if (tokenName.startsWith("opacity-")) return "opacity";
    if (tokenName.startsWith("font-weight-")) return "fontWeights";
    if (tokenName.startsWith("font-line-height-")) return "lineHeights";
    if (tokenName.startsWith("mix-")) return "number";
    return "number";
  }

  if (tokenName.startsWith("font-family-")) return "fontFamilies";

  return "text";
}

function buildTokenSet(modeValues) {
  const set = {};
  for (const [name, value] of Object.entries(modeValues)) {
    set[name] = {
      value: String(value),
      type: inferType(name, value)
    };
  }
  return set;
}

function buildThemes(modeNames) {
  return modeNames.map((name) => ({
    id: `studioflow-${name}`,
    name,
    selectedTokenSets: { [`${collectionName}/${name}`]: "enabled" },
    group: collectionName
  }));
}

async function main() {
  const workflow = await readWorkflowConfig();
  const breakpointVars = await loadJson(breakpointVarsPath);
  const modes = breakpointVars?.modes;

  if (!modes || typeof modes !== "object" || Object.keys(modes).length === 0) {
    throw new Error(
      "No modes found in tokens/figma-breakpoint-variables.json. Run `npm run loop:code-to-canvas` first."
    );
  }

  const modeNames = workflow.breakpoints.map((bp) => String(bp.name));
  const missingModes = modeNames.filter((name) => !modes[name]);
  if (missingModes.length > 0) {
    throw new Error(`Missing modes in figma-breakpoint-variables.json: ${missingModes.join(", ")}`);
  }

  const output = {};

  for (const modeName of modeNames) {
    const setName = `${collectionName}/${modeName}`;
    output[setName] = buildTokenSet(modes[modeName]);
  }

  output.$themes = buildThemes(modeNames);
  output.$metadata = {
    tokenSetOrder: modeNames.map((name) => `${collectionName}/${name}`)
  };

  await writeJson(outputPath, output);

  const tokenCount = Object.keys(modes[modeNames[0]]).length;
  const relPath = path.relative(rootDir, outputPath);
  console.log(`Created ${relPath}`);
  console.log(`  ${modeNames.length} modes: ${modeNames.join(", ")}`);
  console.log(`  ${tokenCount} tokens per mode`);
  console.log(`  Collection: ${collectionName}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Open your Figma file");
  console.log("  2. Plugins → Tokens Studio for Figma");
  console.log('  3. Load JSON: paste or sync the file above');
  console.log("  4. Export to Figma → Variables");
  console.log("     Free: export each set (creates collection per mode)");
  console.log("     Pro:  export from Themes (creates 1 collection with 4 modes)");
  console.log("");
  console.log("Once variables exist in Figma, Claude/MCP can reference them.");
  console.log("This import only needs to repeat when tokens change.");
}

if (path.resolve(process.argv[1] || "") === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
