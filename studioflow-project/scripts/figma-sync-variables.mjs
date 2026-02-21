import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  exchangePath,
  loadJson,
  readWorkflowConfig,
  rootDir,
  writeJson
} from "./lib/workflow-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const defaultCollectionName = process.env.STUDIOFLOW_FIGMA_COLLECTION || "StudioFlow Tokens";
const defaultApiBase = process.env.STUDIOFLOW_FIGMA_API_BASE || "https://api.figma.com/v1";

function printUsage() {
  console.log("Usage:");
  console.log("  node scripts/figma-sync-variables.mjs --dry-run [--collection <name>] [--request-out <path>]");
  console.log("  node scripts/figma-sync-variables.mjs [--collection <name>] [--request-out <path>]");
  console.log("");
  console.log("Required for live sync:");
  console.log("  FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=...");
  console.log("");
  console.log("Notes:");
  console.log("  - --dry-run does not call the Figma API.");
  console.log("  - Live mode upserts a local collection by exact name match.");
  console.log("  - This uses the Variables REST API (Enterprise-only in Figma).");
}

function parseArgs(argv) {
  const args = [...argv];
  const dryRun = args.includes("--dry-run");
  const help = args.includes("--help") || args.includes("-h");
  const collection = readFlagValue(args, "--collection") || defaultCollectionName;
  const requestOut =
    readFlagValue(args, "--request-out") || path.join("handoff", "figma-variables.upsert.json");
  const fileKeyArg = readFlagValue(args, "--file-key");
  return { dryRun, help, collection, requestOut, fileKeyArg };
}

function readFlagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const next = args[index + 1];
  if (!next || next.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return next;
}

function normalizeTokenSpecs({ codePayload, templatePayload, workflow }) {
  const tokens = Array.isArray(codePayload?.tokens) ? codePayload.tokens : [];
  if (tokens.length === 0) {
    throw new Error("handoff/code-to-canvas.json has no tokens. Run `npm run loop:code-to-canvas` first.");
  }

  const templateModes = Array.isArray(templatePayload?.variableModes) ? templatePayload.variableModes : [];
  const modeValuesByName = new Map(
    templateModes.map((mode) => [String(mode.name), (mode && typeof mode.values === "object" ? mode.values : {})])
  );
  const requiredModeNames = workflow.breakpoints.map((breakpoint) => String(breakpoint.name));
  const missingModes = requiredModeNames.filter((modeName) => !modeValuesByName.has(modeName));
  if (missingModes.length > 0) {
    throw new Error(
      `handoff/canvas-to-code.template.json is missing variable modes: ${missingModes.join(", ")}`
    );
  }

  return tokens.map((token) => {
    const tokenName = String(token.name);
    const valuesByMode = {};
    for (const breakpoint of workflow.breakpoints) {
      const modeName = String(breakpoint.name);
      const modeValues = modeValuesByName.get(modeName) ?? {};
      if (!Object.prototype.hasOwnProperty.call(modeValues, tokenName)) {
        throw new Error(
          `handoff/canvas-to-code.template.json is missing token "${tokenName}" in mode "${modeName}".`
        );
      }
      valuesByMode[modeName] = String(modeValues[tokenName]);
    }
    return {
      name: tokenName,
      frame: String(token.frame || "Tokens / Spacing"),
      valuesByMode
    };
  });
}

function tempId(prefix, index, seed) {
  const normalized = String(seed)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${prefix}_${index}_${normalized || "value"}`;
}

function parseHexColor(value) {
  const input = String(value).trim();
  const match = input.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!match) return null;

  let hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    hex = [...hex].map((char) => char + char).join("");
  }

  const hasAlpha = hex.length === 8;
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  const a = hasAlpha ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function parseFloatValue(value) {
  const input = String(value).trim();
  if (/^-?\d+(\.\d+)?$/.test(input)) {
    return Number.parseFloat(input);
  }
  return null;
}

function inferResolvedType(rawValues) {
  const values = rawValues.map((value) => String(value));
  if (values.every((value) => parseHexColor(value))) return "COLOR";
  if (values.every((value) => parseFloatValue(value) !== null)) return "FLOAT";
  return "STRING";
}

function convertValueForType(rawValue, type) {
  const raw = String(rawValue);
  if (type === "COLOR") {
    const color = parseHexColor(raw);
    if (!color) throw new Error(`Expected hex color, got "${raw}"`);
    return color;
  }
  if (type === "FLOAT") {
    const value = parseFloatValue(raw);
    if (value === null) throw new Error(`Expected numeric value, got "${raw}"`);
    return value;
  }
  return raw;
}

function findCollectionByName(meta, collectionName) {
  const collections = Object.values(meta?.variableCollections ?? {}).filter(
    (collection) => !collection.remote && !collection.isExtension
  );
  const matches = collections.filter((collection) => String(collection.name) === collectionName);
  if (matches.length > 1) {
    throw new Error(
      `More than one local variable collection named "${collectionName}" exists in this file. Rename duplicates and retry.`
    );
  }
  return matches[0] ?? null;
}

function indexCollectionVariables(meta, collection) {
  const map = new Map();
  const variableLookup = meta?.variables ?? {};
  for (const variableId of collection?.variableIds ?? []) {
    const variable = variableLookup[variableId];
    if (!variable || variable.remote) continue;
    map.set(String(variable.name), variable);
  }
  return map;
}

function compactRequest(request) {
  const output = {};
  for (const key of ["variableCollections", "variableModes", "variables", "variableModeValues"]) {
    if (Array.isArray(request[key]) && request[key].length > 0) {
      output[key] = request[key];
    }
  }
  return output;
}

function buildUpsertRequest({
  workflow,
  tokenSpecs,
  collectionName,
  existingCollection = null,
  existingMeta = null
}) {
  const variableCollections = [];
  const variableModes = [];
  const variables = [];
  const variableModeValues = [];
  const warnings = [];

  const breakpoints = workflow.breakpoints.map((bp) => ({
    name: String(bp.name),
    width: Number(bp.width)
  }));

  let collectionId = "collection_tmp_studioflow";
  const modeIdByName = {};
  const existingByName = existingCollection ? indexCollectionVariables(existingMeta, existingCollection) : new Map();

  if (existingCollection) {
    collectionId = String(existingCollection.id);
    for (const mode of existingCollection.modes ?? []) {
      modeIdByName[String(mode.name)] = String(mode.modeId);
    }

    breakpoints.forEach((bp, index) => {
      if (!modeIdByName[bp.name]) {
        const nextModeId = tempId("mode", index, bp.name);
        variableModes.push({
          action: "CREATE",
          id: nextModeId,
          name: bp.name,
          variableCollectionId: collectionId
        });
        modeIdByName[bp.name] = nextModeId;
      }
    });
  } else {
    const initialBreakpoint = breakpoints[0];
    if (!initialBreakpoint) {
      throw new Error("No breakpoints configured in studioflow.workflow.json");
    }

    const initialModeId = tempId("mode", 0, initialBreakpoint.name);
    variableCollections.push({
      action: "CREATE",
      id: collectionId,
      name: collectionName,
      initialModeId
    });
    variableModes.push({
      action: "UPDATE",
      id: initialModeId,
      name: initialBreakpoint.name,
      variableCollectionId: collectionId
    });
    modeIdByName[initialBreakpoint.name] = initialModeId;

    breakpoints.slice(1).forEach((bp, index) => {
      const nextModeId = tempId("mode", index + 1, bp.name);
      variableModes.push({
        action: "CREATE",
        id: nextModeId,
        name: bp.name,
        variableCollectionId: collectionId
      });
      modeIdByName[bp.name] = nextModeId;
    });
  }

  tokenSpecs.forEach((token, index) => {
    const rawValues = breakpoints.map((bp) => token.valuesByMode[bp.name]);
    const resolvedType = inferResolvedType(rawValues);

    const existingVariable = existingByName.get(token.name);
    let variableId = existingVariable?.id;

    if (existingVariable) {
      const existingType = String(existingVariable.resolvedType);
      if (existingType !== resolvedType) {
        warnings.push(
          `Skipped "${token.name}" because existing type is ${existingType} and inferred type is ${resolvedType}.`
        );
        return;
      }
    } else {
      variableId = tempId("variable", index, token.name);
      variables.push({
        action: "CREATE",
        id: variableId,
        name: token.name,
        variableCollectionId: collectionId,
        resolvedType,
        description: `StudioFlow token (${token.frame})`
      });
    }

    for (const bp of breakpoints) {
      const modeId = modeIdByName[bp.name];
      if (!modeId) {
        warnings.push(`Skipped value for "${token.name}" in "${bp.name}" because mode is missing.`);
        continue;
      }
      try {
        const value = convertValueForType(token.valuesByMode[bp.name], resolvedType);
        variableModeValues.push({
          variableId,
          modeId,
          value
        });
      } catch (error) {
        warnings.push(
          `Skipped value for "${token.name}" in "${bp.name}" (${error instanceof Error ? error.message : String(error)}).`
        );
      }
    }
  });

  const request = compactRequest({
    variableCollections,
    variableModes,
    variables,
    variableModeValues
  });

  return {
    request,
    warnings,
    summary: {
      collectionAction: existingCollection ? "update-existing" : "create-new",
      collectionName,
      modeCount: breakpoints.length,
      tokenCount: tokenSpecs.length,
      operations: {
        variableCollections: variableCollections.length,
        variableModes: variableModes.length,
        variables: variables.length,
        variableModeValues: variableModeValues.length
      }
    }
  };
}

async function figmaApiRequest({ method, apiBase, accessToken, pathname, body }) {
  const url = `${apiBase}${pathname}`;
  const response = await fetch(url, {
    method,
    headers: {
      "X-Figma-Token": accessToken,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const responseText = await response.text();
  let json = null;
  try {
    json = responseText ? JSON.parse(responseText) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const details = json?.message || json?.err || responseText || response.statusText;
    const error = new Error(`Figma API ${method} ${pathname} failed (${response.status}): ${details}`);
    error.status = response.status;
    throw error;
  }

  return json;
}

async function loadPayloads(workflow) {
  const codeToCanvasPath = exchangePath(workflow, "codeToCanvas");
  const canvasTemplatePath = exchangePath(workflow, "canvasToCodeTemplate");

  let codePayload;
  let templatePayload;
  try {
    [codePayload, templatePayload] = await Promise.all([loadJson(codeToCanvasPath), loadJson(canvasTemplatePath)]);
  } catch {
    throw new Error(
      "Missing handoff payloads. Run `npm run loop:code-to-canvas` before syncing Figma variables."
    );
  }

  return { codePayload, templatePayload };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  if (cli.help) {
    printUsage();
    return;
  }

  const workflow = await readWorkflowConfig();
  const { codePayload, templatePayload } = await loadPayloads(workflow);
  const tokenSpecs = normalizeTokenSpecs({ codePayload, templatePayload, workflow });
  const requestOutPath = path.join(rootDir, cli.requestOut);

  if (cli.dryRun) {
    const plan = buildUpsertRequest({
      workflow,
      tokenSpecs,
      collectionName: cli.collection
    });

    await writeJson(requestOutPath, {
      generatedAt: new Date().toISOString(),
      dryRun: true,
      apiBase: defaultApiBase,
      summary: plan.summary,
      warnings: plan.warnings,
      request: plan.request
    });

    console.log(`Created ${path.relative(rootDir, requestOutPath)}`);
    console.log(`Planned ${plan.summary.operations.variables} variable creates.`);
    if (plan.warnings.length > 0) {
      console.log(`Warnings: ${plan.warnings.length}`);
      plan.warnings.slice(0, 5).forEach((warning) => console.log(`- ${warning}`));
    }
    console.log("Dry run complete. No Figma API calls were made.");
    return;
  }

  const accessToken = process.env.FIGMA_ACCESS_TOKEN;
  const fileKey = cli.fileKeyArg || process.env.FIGMA_FILE_KEY;
  if (!accessToken || !fileKey) {
    throw new Error("Live sync requires FIGMA_ACCESS_TOKEN and FIGMA_FILE_KEY.");
  }

  const localVariables = await figmaApiRequest({
    method: "GET",
    apiBase: defaultApiBase,
    accessToken,
    pathname: `/files/${encodeURIComponent(fileKey)}/variables/local`
  });

  const localMeta = localVariables?.meta ?? {};
  const existingCollection = findCollectionByName(localMeta, cli.collection);
  const plan = buildUpsertRequest({
    workflow,
    tokenSpecs,
    collectionName: cli.collection,
    existingCollection,
    existingMeta: localMeta
  });

  await writeJson(requestOutPath, {
    generatedAt: new Date().toISOString(),
    dryRun: false,
    apiBase: defaultApiBase,
    fileKey,
    summary: plan.summary,
    warnings: plan.warnings,
    request: plan.request
  });

  const opCount =
    plan.summary.operations.variableCollections +
    plan.summary.operations.variableModes +
    plan.summary.operations.variables +
    plan.summary.operations.variableModeValues;

  if (opCount === 0) {
    console.log(`No variable changes required for collection "${cli.collection}".`);
    console.log(`Request file: ${path.relative(rootDir, requestOutPath)}`);
    return;
  }

  const result = await figmaApiRequest({
    method: "POST",
    apiBase: defaultApiBase,
    accessToken,
    pathname: `/files/${encodeURIComponent(fileKey)}/variables`,
    body: plan.request
  });

  const mapped = result?.meta?.tempIdToRealId ? Object.keys(result.meta.tempIdToRealId).length : 0;
  console.log(`Synced variables to Figma file ${fileKey}.`);
  console.log(`Collection mode: ${plan.summary.collectionAction}`);
  console.log(`Operations: ${opCount} (${plan.summary.operations.variables} variable creates/updates planned)`);
  console.log(`Temporary IDs resolved: ${mapped}`);
  console.log(`Request file: ${path.relative(rootDir, requestOutPath)}`);
  if (plan.warnings.length > 0) {
    console.log(`Warnings: ${plan.warnings.length}`);
    plan.warnings.slice(0, 5).forEach((warning) => console.log(`- ${warning}`));
  }
}

if (path.resolve(process.argv[1] || "") === __filename) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (message.includes("failed (403):")) {
      console.error(
        "Hint: Variables REST API requires Enterprise + full seat + file_variables scopes. Use `--dry-run` if unavailable."
      );
    }
    process.exit(1);
  });
}
