import path from "node:path";
import { fileURLToPath } from "node:url";
import { flattenTokens } from "./build-tokens.mjs";
import {
  duplicateValues,
  exchangePath,
  extractCodeSfids,
  loadJson,
  manifestPath,
  normalizeCanvasPayload,
  readWorkflowConfig,
  rootDir,
  screenNameForBreakpoint,
  tokenInputPath,
  writeJson
} from "./lib/workflow-utils.mjs";

const __filename = fileURLToPath(import.meta.url);

function formatMissing(prefix, values) {
  return values.length > 0 ? `${prefix}: ${values.join(", ")}` : null;
}

export function validateCanvasPayload(payload, { workflow, tokenNames, codeSfids }) {
  const errors = [];
  const allowedSources = ["figma-canvas", "figma"];
  if (!allowedSources.includes(payload.source)) {
    errors.push(`Expected source to be one of ${allowedSources.join(", ")}, got ${JSON.stringify(payload.source)}`);
  }

  if (payload.integration && payload.integration !== workflow.integration) {
    errors.push(`Expected integration "${workflow.integration}" but got "${payload.integration}"`);
  }

  const sourceIsCanvas = payload.source === "figma-canvas";
  if (sourceIsCanvas) {
    if (!payload.canvasProvider) {
      errors.push("Missing canvasProvider on canvas payload.");
    }

    if (!["code-first", "design-first"].includes(payload.integrationMode)) {
      errors.push(`integrationMode must be "code-first" or "design-first", got ${JSON.stringify(payload.integrationMode)}`);
    }
  }

  if (sourceIsCanvas && (!payload.claudeSession || typeof payload.claudeSession !== "object")) {
    errors.push("Missing claudeSession metadata.");
  }

  const sfids = Array.isArray(payload.sfids) ? payload.sfids.map(String) : [];
  const sfidDupes = duplicateValues(sfids);
  if (sfidDupes.length > 0) {
    errors.push(`Duplicate payload sfids: ${sfidDupes.join(", ")}`);
  }

  const missingPayloadSfids = codeSfids.filter((sfid) => !sfids.includes(sfid));
  const maybeMissingPayloadSfids = formatMissing("Payload sfids missing code IDs", missingPayloadSfids);
  if (maybeMissingPayloadSfids) {
    errors.push(maybeMissingPayloadSfids);
  }

  const requiredFrames = workflow.tokenFrames.map((frame) => frame.name);
  const tokenFrames = Array.isArray(payload.tokenFrames) ? payload.tokenFrames : [];
  const frameNames = tokenFrames.map((frame) => String(frame.name));
  const frameDupes = duplicateValues(frameNames);
  const missingFrames = requiredFrames.filter((name) => !frameNames.includes(name));
  if (frameDupes.length > 0) {
    errors.push(`Duplicate token frames: ${frameDupes.join(", ")}`);
  }
  if (missingFrames.length > 0) {
    errors.push(`Missing token frames: ${missingFrames.join(", ")}`);
  }

  const frameTokenSet = new Set();
  for (const frame of tokenFrames) {
    const names = Array.isArray(frame.tokenNames) ? frame.tokenNames.map(String) : [];
    names.forEach((name) => frameTokenSet.add(name));
  }
  const missingFrameTokens = tokenNames.filter((name) => !frameTokenSet.has(name));
  if (missingFrameTokens.length > 0) {
    errors.push(`Token frames are missing token names: ${missingFrameTokens.join(", ")}`);
  }

  const variableModes = Array.isArray(payload.variableModes) ? payload.variableModes : [];
  const modeMap = new Map(variableModes.map((mode) => [String(mode.name), mode]));
  const modeDupes = duplicateValues(variableModes.map((mode) => String(mode.name)));
  const missingModes = workflow.breakpoints.map((bp) => bp.name).filter((name) => !modeMap.has(name));
  if (modeDupes.length > 0) {
    errors.push(`Duplicate variable modes: ${modeDupes.join(", ")}`);
  }
  if (missingModes.length > 0) {
    errors.push(`Missing variable modes: ${missingModes.join(", ")}`);
  }

  for (const breakpoint of workflow.breakpoints) {
    const mode = modeMap.get(breakpoint.name);
    if (!mode) continue;

    if (Number(mode.width) !== Number(breakpoint.width)) {
      errors.push(`Mode width mismatch for ${breakpoint.name}: expected ${breakpoint.width}, got ${mode.width}`);
    }

    const values = mode.values && typeof mode.values === "object" ? mode.values : {};
    const missingModeTokens = tokenNames.filter((name) => !(name in values));
    const maybeMissingModeValues = formatMissing(`Mode ${breakpoint.name} is missing token values`, missingModeTokens);
    if (maybeMissingModeValues) {
      errors.push(maybeMissingModeValues);
    }
  }

  const requiredScreens = workflow.breakpoints.map((bp) => ({
    breakpoint: bp.name,
    width: bp.width,
    name: screenNameForBreakpoint(bp)
  }));

  const screens = Array.isArray(payload.screens) ? payload.screens : [];
  const screenMap = new Map(screens.map((screen) => [String(screen.breakpoint), screen]));
  const screenDupes = duplicateValues(screens.map((screen) => String(screen.breakpoint)));
  if (screenDupes.length > 0) {
    errors.push(`Duplicate screens by breakpoint: ${screenDupes.join(", ")}`);
  }

  for (const required of requiredScreens) {
    const screen = screenMap.get(required.breakpoint);
    if (!screen) {
      errors.push(`Missing screen for breakpoint ${required.breakpoint}`);
      continue;
    }

    if (String(screen.name) !== required.name) {
      errors.push(`Screen name mismatch for ${required.breakpoint}: expected "${required.name}", got "${screen.name}"`);
    }
    if (Number(screen.width) !== Number(required.width)) {
      errors.push(`Screen width mismatch for ${required.breakpoint}: expected ${required.width}, got ${screen.width}`);
    }
    if (screen.usesOnlyTokens !== true) {
      errors.push(`Screen ${required.name} must set usesOnlyTokens=true`);
    }

    const screenSfids = Array.isArray(screen.sfids) ? screen.sfids.map(String) : [];
    const missingScreenSfids = codeSfids.filter((id) => !screenSfids.includes(id));
    const maybeMissingScreenSfids = formatMissing(`Screen ${required.name} is missing sfids`, missingScreenSfids);
    if (maybeMissingScreenSfids) {
      errors.push(maybeMissingScreenSfids);
    }
  }

  return errors;
}

export async function runLoopVerifyCanvas(options = {}) {
  const workflow = await readWorkflowConfig();
  const inputPath =
    options.inputPath || process.env.STUDIOFLOW_INPUT || exchangePath(workflow, "canvasToCode");
  const [rawPayload, tokenJson, codeSfids] = await Promise.all([
    loadJson(inputPath),
    loadJson(tokenInputPath),
    extractCodeSfids()
  ]);

  const payload = normalizeCanvasPayload(rawPayload, workflow);
  const tokenNames = flattenTokens(tokenJson).map((token) => token.name).sort();
  const errors = validateCanvasPayload(payload, { workflow, tokenNames, codeSfids });

  const shouldUpdateManifest = options.updateManifest ?? process.env.STUDIOFLOW_NO_MANIFEST !== "1";
  const ranAt = new Date().toISOString();

  if (shouldUpdateManifest) {
    const manifest = await loadJson(manifestPath);
    manifest.workflowVersion = workflow.workflowVersion;
    manifest.integration = workflow.integration;
    manifest.lastCanvasVerification = {
      status: errors.length === 0 ? "passed" : "failed",
      ranAt,
      sourceFile: path.relative(rootDir, inputPath),
      canvasProvider: payload.canvasProvider ?? "figma",
      errorsCount: errors.length
    };
    manifest.updatedAt = ranAt;
    await writeJson(manifestPath, manifest);
  }

  if (errors.length > 0) {
    const error = new Error(errors.join("\n"));
    error.name = "CanvasContractValidationError";
    throw error;
  }

  console.log(
    `Canvas handoff verification passed for ${workflow.tokenFrames.length} frames, ${workflow.breakpoints.length} modes, and ${workflow.breakpoints.length} screens.`
  );
}

if (path.resolve(process.argv[1] || "") === __filename) {
  runLoopVerifyCanvas().catch((error) => {
    console.error("Canvas handoff verification failed:\n");
    const message = error instanceof Error ? error.message : String(error);
    message
      .split("\n")
      .filter(Boolean)
      .forEach((line) => console.error(`- ${line}`));
    process.exit(1);
  });
}
