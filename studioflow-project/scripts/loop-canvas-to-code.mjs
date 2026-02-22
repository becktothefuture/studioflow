import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildArtifacts, flattenTokens } from "./build-tokens.mjs";
import { validateCanvasPayload } from "./loop-verify-canvas.mjs";
import {
  exchangePath,
  extractCodeSfids,
  loadJson,
  manifestPath,
  normalizeCanvasPayload,
  readWorkflowConfig,
  rootDir,
  setTokenValueByPath,
  snapshotsDir,
  tokenInputPath,
  utcStamp,
  writeJson
} from "./lib/workflow-utils.mjs";

const __filename = fileURLToPath(import.meta.url);

function asModesMap(payload) {
  const output = {};
  for (const mode of payload.variableModes) {
    output[String(mode.name)] = mode.values ?? {};
  }
  return output;
}

export async function runLoopCanvasToCode(options = {}) {
  const workflow = await readWorkflowConfig();
  const inputPath =
    options.inputPath || process.env.STUDIOFLOW_INPUT || exchangePath(workflow, "canvasToCode");

  const [rawPayload, tokenJson, codeSfids] = await Promise.all([
    loadJson(inputPath),
    loadJson(tokenInputPath),
    extractCodeSfids()
  ]);
  const payload = normalizeCanvasPayload(rawPayload, workflow);

  const tokenRows = flattenTokens(tokenJson);
  const tokenNames = tokenRows.map((token) => token.name);
  const validationErrors = validateCanvasPayload(payload, { workflow, tokenNames, codeSfids });
  if (validationErrors.length > 0) {
    throw new Error(`Cannot apply canvas payload because validation failed:\n${validationErrors.join("\n")}`);
  }

  const modeMap = new Map(payload.variableModes.map((mode) => [String(mode.name), mode]));
  const defaultMode = workflow.breakpoints[workflow.breakpoints.length - 1]?.name ?? "desktop";
  const canonicalMode = process.env.STUDIOFLOW_CANONICAL_MODE || defaultMode;
  const canonicalModeValues = modeMap.get(canonicalMode)?.values;
  if (!canonicalModeValues || typeof canonicalModeValues !== "object") {
    throw new Error(`Canonical mode "${canonicalMode}" is missing in canvas payload.`);
  }

  let updatedTokenCount = 0;
  for (const token of tokenRows) {
    if (!(token.name in canonicalModeValues)) {
      throw new Error(`Missing canonical token value: ${token.name}`);
    }

    const nextValue = String(canonicalModeValues[token.name]);
    if (nextValue !== token.value) {
      const updated = setTokenValueByPath(tokenJson, token.path, nextValue);
      if (!updated) {
        throw new Error(`Could not update token path for ${token.name}`);
      }
      updatedTokenCount += 1;
    }
  }

  await writeJson(tokenInputPath, tokenJson);
  await buildArtifacts();

  const snapshotGeneratedAt = new Date().toISOString();
  const snapshotFilename = `figma-${utcStamp()}.json`;
  await writeJson(path.join(snapshotsDir, snapshotFilename), {
    generatedAt: snapshotGeneratedAt,
    source: "figma-canvas",
    integrationMode: payload.integrationMode,
    canvasProvider: payload.canvasProvider,
    tokenFrames: payload.tokenFrames,
    variableModes: payload.variableModes.map((mode) => ({ name: mode.name, width: mode.width })),
    screens: payload.screens,
    sfids: payload.sfids
  });

  const manifest = await loadJson(manifestPath);
  manifest.workflowVersion = workflow.workflowVersion;
  manifest.integration = workflow.integration;
  manifest.loopCount = Number.isFinite(manifest.loopCount) ? manifest.loopCount + 1 : 1;
  manifest.updatedAt = snapshotGeneratedAt;
  manifest.lastSnapshot = snapshotFilename;
  manifest.lastSnapshotAt = snapshotGeneratedAt;
  manifest.expectedSfids = payload.sfids;
  manifest.canvasProvider = payload.canvasProvider;
  manifest.claudeModelUsed = payload.claudeSession?.model ?? "claude-code";
  manifest.lastCanvasSync = {
    ranAt: snapshotGeneratedAt,
    sourceFile: path.relative(rootDir, inputPath),
    canvasProvider: payload.canvasProvider,
    integrationMode: payload.integrationMode,
    canonicalMode,
    updatedTokenCount
  };
  manifest.lastCanvasVerification = {
    status: "passed",
    ranAt: snapshotGeneratedAt,
    sourceFile: path.relative(rootDir, inputPath),
    canvasProvider: payload.canvasProvider,
    errorsCount: 0
  };
  manifest.lastVerification = {
    status: "pending",
    ranAt: null,
    command: "npm run check"
  };
  await writeJson(manifestPath, manifest);

  console.log(`Updated tokens/figma-variables.json with mode "${canonicalMode}" values.`);
  console.log(`Created snapshots/${snapshotFilename}`);
  console.log("Next: run `npm run check && npm run build && npm run manifest:update`.");
}

if (path.resolve(process.argv[1] || "") === __filename) {
  runLoopCanvasToCode().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
