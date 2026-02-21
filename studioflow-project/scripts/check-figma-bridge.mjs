import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  exchangePath,
  loadJson,
  readWorkflowConfig,
  rootDir
} from "./lib/workflow-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const apiBase = process.env.STUDIOFLOW_FIGMA_API_BASE || "https://api.figma.com/v1";
const strictMode = process.env.STUDIOFLOW_STRICT_FIGMA_BRIDGE === "1";
const healthCollection = process.env.STUDIOFLOW_FIGMA_HEALTH_COLLECTION || "StudioFlow Bridge Check";
const healthVariableName = "bridge-check/ping";

function run(command, args, extraEnv = {}) {
  return spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv }
  });
}

function assertStep(ok, label, detail = "") {
  if (ok) {
    console.log(`PASS ${label}`);
    return;
  }
  throw new Error(detail ? `${label}: ${detail}` : label);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function modeNames(workflow) {
  return workflow.breakpoints.map((bp) => String(bp.name));
}

function modeWidthMap(workflow) {
  const output = {};
  for (const bp of workflow.breakpoints) {
    output[String(bp.name)] = Number(bp.width);
  }
  return output;
}

function tempId(prefix, value) {
  const normalized = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${prefix}_${normalized || "value"}`;
}

function findCollectionByName(meta, collectionName) {
  const collections = Object.values(meta?.variableCollections ?? {}).filter(
    (collection) => !collection.remote && !collection.isExtension
  );
  return collections.find((collection) => String(collection.name) === collectionName) ?? null;
}

function findVariableByName(meta, collection, variableName) {
  const variables = meta?.variables ?? {};
  for (const variableId of collection?.variableIds ?? []) {
    const variable = variables[variableId];
    if (!variable || variable.remote) continue;
    if (String(variable.name) === variableName) return variable;
  }
  return null;
}

function modeIdMap(collection) {
  const map = new Map();
  for (const mode of collection?.modes ?? []) {
    map.set(String(mode.name), String(mode.modeId));
  }
  return map;
}

function buildHealthVariableRequest({ workflow, existingCollection, existingMeta }) {
  const variableCollections = [];
  const variableModes = [];
  const variables = [];
  const variableModeValues = [];

  const now = new Date().toISOString();
  const modes = modeNames(workflow);
  const widths = modeWidthMap(workflow);
  if (modes.length === 0) {
    throw new Error("No breakpoints found in studioflow.workflow.json");
  }

  let collectionId = "collection_studioflow_bridge_check";
  const modeIdByName = {};
  let variableId = "variable_bridge_check_ping";

  if (existingCollection) {
    collectionId = String(existingCollection.id);
    const existingModeMap = modeIdMap(existingCollection);
    for (const [modeName, modeId] of existingModeMap.entries()) {
      modeIdByName[modeName] = modeId;
    }
  } else {
    const initialMode = modes[0];
    const initialModeId = tempId("mode", initialMode);
    collectionId = "collection_studioflow_bridge_check";
    variableCollections.push({
      action: "CREATE",
      id: collectionId,
      name: healthCollection,
      initialModeId
    });
    variableModes.push({
      action: "UPDATE",
      id: initialModeId,
      name: initialMode,
      variableCollectionId: collectionId
    });
    modeIdByName[initialMode] = initialModeId;
  }

  for (const modeName of modes) {
    if (modeIdByName[modeName]) continue;
    const modeId = tempId("mode", modeName);
    variableModes.push({
      action: "CREATE",
      id: modeId,
      name: modeName,
      variableCollectionId: collectionId
    });
    modeIdByName[modeName] = modeId;
  }

  const existingVariable = existingCollection
    ? findVariableByName(existingMeta, existingCollection, healthVariableName)
    : null;

  if (existingVariable) {
    variableId = String(existingVariable.id);
    if (String(existingVariable.resolvedType) !== "STRING") {
      throw new Error(
        `Health variable exists with type "${existingVariable.resolvedType}". Delete or rename ${healthVariableName} and retry.`
      );
    }
  } else {
    variables.push({
      action: "CREATE",
      id: variableId,
      name: healthVariableName,
      variableCollectionId: collectionId,
      resolvedType: "STRING",
      description: "Created by StudioFlow check:figma-bridge"
    });
  }

  for (const modeName of modes) {
    const modeId = modeIdByName[modeName];
    variableModeValues.push({
      variableId,
      modeId,
      value: `ok:${modeName}:${widths[modeName]}:${now}`
    });
  }

  const request = {};
  if (variableCollections.length > 0) request.variableCollections = variableCollections;
  if (variableModes.length > 0) request.variableModes = variableModes;
  if (variables.length > 0) request.variables = variables;
  if (variableModeValues.length > 0) request.variableModeValues = variableModeValues;

  return request;
}

async function figmaRequest({ method, pathname, token, body }) {
  const response = await fetch(`${apiBase}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const details = json?.message || json?.err || text || response.statusText;
    throw new Error(`${method} ${pathname} failed (${response.status}): ${details}`);
  }

  return json;
}

async function verifyLocalPayloadGates(workflow) {
  const codeToCanvasPath = exchangePath(workflow, "codeToCanvas");
  const canvasTemplatePath = exchangePath(workflow, "canvasToCodeTemplate");
  const varsPlanPath = path.join(rootDir, "handoff", "figma-variables.upsert.json");

  const codePayload = await loadJson(codeToCanvasPath);
  const templatePayload = await loadJson(canvasTemplatePath);
  const planPayload = await loadJson(varsPlanPath);

  assertStep(Array.isArray(codePayload.tokens) && codePayload.tokens.length > 0, "code-to-canvas includes tokens");
  assertStep(
    Array.isArray(codePayload.requirements?.variableModes) &&
      codePayload.requirements.variableModes.length === workflow.breakpoints.length,
    "code-to-canvas includes all required modes"
  );
  assertStep(
    Array.isArray(templatePayload.variableModes) && templatePayload.variableModes.length === workflow.breakpoints.length,
    "canvas template includes all modes"
  );
  assertStep(
    Array.isArray(templatePayload.screens) && templatePayload.screens.length === workflow.breakpoints.length,
    "canvas template includes all screens"
  );
  assertStep(
    planPayload?.dryRun === true && planPayload?.summary?.operations?.variables > 0,
    "variables plan dry-run generated create/update operations"
  );
}

async function verifyLiveFigmaGates(workflow) {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  const fileKey = process.env.FIGMA_FILE_KEY;

  if (!token || !fileKey) {
    if (strictMode) {
      throw new Error("Strict mode requires FIGMA_ACCESS_TOKEN and FIGMA_FILE_KEY.");
    }
    console.log("WARN live Figma API checks skipped (missing FIGMA_ACCESS_TOKEN or FIGMA_FILE_KEY)");
    return;
  }

  const me = await figmaRequest({
    method: "GET",
    pathname: "/me",
    token
  });
  assertStep(Boolean(me?.email || me?.id), "Figma token is valid (/me)");

  const file = await figmaRequest({
    method: "GET",
    pathname: `/files/${encodeURIComponent(fileKey)}?depth=1`,
    token
  });
  assertStep(Boolean(file?.document?.id), "Figma file is reachable");

  const localVariables = await figmaRequest({
    method: "GET",
    pathname: `/files/${encodeURIComponent(fileKey)}/variables/local`,
    token
  });
  assertStep(Boolean(localVariables?.meta), "variables/local endpoint is reachable");

  const existingMeta = localVariables.meta;
  const existingCollection = findCollectionByName(existingMeta, healthCollection);
  const request = buildHealthVariableRequest({
    workflow,
    existingCollection,
    existingMeta
  });

  const opCount =
    (request.variableCollections?.length ?? 0) +
    (request.variableModes?.length ?? 0) +
    (request.variables?.length ?? 0) +
    (request.variableModeValues?.length ?? 0);
  assertStep(opCount > 0, "healthcheck write request has operations");

  await figmaRequest({
    method: "POST",
    pathname: `/files/${encodeURIComponent(fileKey)}/variables`,
    token,
    body: request
  });
  assertStep(true, "healthcheck variable write succeeded");

  const verifyVariables = await figmaRequest({
    method: "GET",
    pathname: `/files/${encodeURIComponent(fileKey)}/variables/local`,
    token
  });
  const verifyCollection = findCollectionByName(verifyVariables.meta, healthCollection);
  assertStep(Boolean(verifyCollection), `healthcheck collection exists (${healthCollection})`);
  const verifyModeMap = modeIdMap(verifyCollection);
  for (const modeName of modeNames(workflow)) {
    assertStep(
      verifyModeMap.has(modeName),
      `healthcheck collection mode exists (${modeName})`
    );
  }

  const verifyVariable = findVariableByName(verifyVariables.meta, verifyCollection, healthVariableName);
  assertStep(Boolean(verifyVariable), `healthcheck variable exists (${healthVariableName})`);
  const valuesByMode = verifyVariable?.valuesByMode && typeof verifyVariable.valuesByMode === "object"
    ? verifyVariable.valuesByMode
    : {};
  for (const modeName of modeNames(workflow)) {
    const modeId = verifyModeMap.get(modeName);
    assertStep(
      Boolean(modeId && Object.prototype.hasOwnProperty.call(valuesByMode, modeId)),
      `healthcheck variable mode value exists (${modeName})`
    );
  }
}

async function main() {
  const workflow = await readWorkflowConfig();
  const codeToCanvasPath = exchangePath(workflow, "codeToCanvas");
  const canvasTemplatePath = exchangePath(workflow, "canvasToCodeTemplate");

  const checkMcp = run("npm", ["run", "check:mcp"]);
  assertStep(
    checkMcp.status === 0,
    "MCP health gate passed",
    checkMcp.stderr?.trim() || checkMcp.stdout?.trim() || "check:mcp failed"
  );

  const hasPayloads = (await pathExists(codeToCanvasPath)) && (await pathExists(canvasTemplatePath));
  if (!hasPayloads) {
    const codeToCanvas = run("npm", ["run", "loop:code-to-canvas"]);
    assertStep(
      codeToCanvas.status === 0,
      "code-to-canvas generation gate passed",
      codeToCanvas.stderr?.trim() || codeToCanvas.stdout?.trim() || "loop:code-to-canvas failed"
    );
  } else {
    assertStep(true, "code-to-canvas payloads present");
  }

  const plan = run("npm", ["run", "figma:variables:plan"]);
  assertStep(
    plan.status === 0,
    "variables planning gate passed",
    plan.stderr?.trim() || plan.stdout?.trim() || "figma:variables:plan failed"
  );

  await verifyLocalPayloadGates(workflow);
  await verifyLiveFigmaGates(workflow);

  console.log("PASS figma bridge deep healthcheck complete");
}

if (path.resolve(process.argv[1] || "") === __filename) {
  main().catch((error) => {
    console.error("FAIL figma bridge deep healthcheck");
    console.error(error instanceof Error ? error.message : String(error));
    if (String(error).includes("failed (403)")) {
      console.error(
        "Hint: variables write checks require Enterprise + full seat + file_variables scopes. Use non-strict mode to skip live writes."
      );
    }
    process.exit(1);
  });
}
