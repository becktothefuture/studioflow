import path from "node:path";
import { fileURLToPath } from "node:url";
import { flattenTokens } from "./build-tokens.mjs";
import {
  exchangePath,
  extractCodeSfids,
  groupTokenFrame,
  loadJson,
  manifestPath,
  normalizeCanvasPayload,
  readWorkflowConfig,
  rootDir,
  screenNameForBreakpoint,
  tokenInputPath,
  toFigmaAliasPayload,
  writeJson
} from "./lib/workflow-utils.mjs";

const __filename = fileURLToPath(import.meta.url);

function collectFrameTokenNames(tokens, tokenFrames) {
  return tokenFrames.map((frame) => ({
    name: frame.name,
    tokenNames: tokens.filter((token) => token.frame === frame.name).map((token) => token.name)
  }));
}

function createModeValues(tokens) {
  const values = {};
  for (const token of tokens) {
    values[token.name] = token.value;
  }
  return values;
}

function createScreens(workflow, codeSfids) {
  return workflow.breakpoints.map((breakpoint) => ({
    name: screenNameForBreakpoint(breakpoint),
    breakpoint: breakpoint.name,
    width: breakpoint.width,
    usesOnlyTokens: true,
    sfids: codeSfids
  }));
}

function createClaudeSession(workflow) {
  return {
    agent: "claude-code",
    model: workflow.modelPolicy.defaultModel,
    profile: workflow.modelPolicy.profile,
    notes: "Set sessionId to your current Claude Code session identifier when available."
  };
}

export async function runLoopCodeToCanvas() {
  const [workflow, tokenJson, codeSfids] = await Promise.all([
    readWorkflowConfig(),
    loadJson(tokenInputPath),
    extractCodeSfids()
  ]);

  if (codeSfids.length === 0) {
    throw new Error("No code sfids found. Add data-sfid=\"sfid:*\" attributes before syncing.");
  }

  const flattened = flattenTokens(tokenJson).map((token) => ({
    ...token,
    frame: groupTokenFrame(token.name, workflow.tokenFrames)
  }));

  if (flattened.length === 0) {
    throw new Error("No tokens found in tokens/figma-variables.json");
  }

  const generatedAt = new Date().toISOString();
  const frameTokens = collectFrameTokenNames(flattened, workflow.tokenFrames);
  const modeValues = createModeValues(flattened);
  const screens = createScreens(workflow, codeSfids);

  const codeToCanvasPayload = {
    generatedAt,
    source: "code",
    integration: workflow.integration,
    workflowVersion: workflow.workflowVersion,
    canvasProvider: workflow.canvas.canonicalProvider,
    integrationMode: "code-first",
    claudeSession: createClaudeSession(workflow),
    requirements: {
      tokenFrames: workflow.tokenFrames.map((frame) => frame.name),
      variableModes: workflow.breakpoints.map((breakpoint) => ({
        name: breakpoint.name,
        width: breakpoint.width
      })),
      screens: screens.map((screen) => ({
        name: screen.name,
        breakpoint: screen.breakpoint,
        width: screen.width
      }))
    },
    tokens: flattened.map((token) => ({
      name: token.name,
      value: token.value,
      frame: token.frame
    })),
    sfids: codeSfids
  };

  const canvasTemplatePayload = normalizeCanvasPayload(
    {
      generatedAt,
      source: "figma-canvas",
      integration: workflow.integration,
      workflowVersion: workflow.workflowVersion,
      canvasProvider: workflow.canvas.canonicalProvider,
      integrationMode: "code-first",
      claudeSession: {
        ...createClaudeSession(workflow),
        sessionId: "replace-with-session-id"
      },
      tokenFrames: frameTokens,
      variableModes: workflow.breakpoints.map((breakpoint) => ({
        name: breakpoint.name,
        width: breakpoint.width,
        values: modeValues
      })),
      screens,
      sfids: codeSfids
    },
    workflow
  );

  const writes = [
    writeJson(exchangePath(workflow, "codeToCanvas"), codeToCanvasPayload),
    writeJson(exchangePath(workflow, "canvasToCodeTemplate"), canvasTemplatePayload)
  ];

  if (workflow.compatibility?.enableFigmaAliases) {
    writes.push(
      writeJson(exchangePath(workflow, "codeToFigma"), codeToCanvasPayload),
      writeJson(exchangePath(workflow, "figmaToCodeTemplate"), toFigmaAliasPayload(canvasTemplatePayload, workflow))
    );
  }

  await Promise.all(writes);

  const manifest = await loadJson(manifestPath);
  manifest.workflowVersion = workflow.workflowVersion;
  manifest.integration = workflow.integration;
  manifest.canvasProvider = workflow.canvas.canonicalProvider;
  manifest.claudeModelUsed = workflow.modelPolicy.defaultModel;
  manifest.updatedAt = generatedAt;
  manifest.lastCodeToCanvas = {
    ranAt: generatedAt,
    tokenCount: flattened.length,
    sfidCount: codeSfids.length,
    handoffFile: workflow.exchangeFiles.codeToCanvas
  };
  if (workflow.compatibility?.enableFigmaAliases) {
    manifest.lastCodeToFigma = {
      ranAt: generatedAt,
      tokenCount: flattened.length,
      sfidCount: codeSfids.length,
      handoffFile: workflow.exchangeFiles.codeToFigma
    };
  }
  manifest.expectedSfids = codeSfids;
  await writeJson(manifestPath, manifest);

  console.log(`Created ${path.relative(rootDir, exchangePath(workflow, "codeToCanvas"))}`);
  console.log(`Created ${path.relative(rootDir, exchangePath(workflow, "canvasToCodeTemplate"))}`);
  if (workflow.compatibility?.enableFigmaAliases) {
    console.log(`Created ${path.relative(rootDir, exchangePath(workflow, "codeToFigma"))}`);
    console.log(`Created ${path.relative(rootDir, exchangePath(workflow, "figmaToCodeTemplate"))}`);
  }
  console.log("Next: produce handoff/canvas-to-code.json and run `npm run loop:verify-canvas`.");
}

if (path.resolve(process.argv[1] || "") === __filename) {
  runLoopCodeToCanvas().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
