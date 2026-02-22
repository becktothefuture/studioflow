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

function createClientSession() {
  return {
    agent: process.env.STUDIOFLOW_AGENT_NAME || "mcp-client",
    notes: "Set sessionId to your current MCP client session identifier when available."
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
    canvasProvider: "figma",
    integrationMode: "code-first",
    clientSession: createClientSession(),
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
      canvasProvider: "figma",
      integrationMode: "code-first",
      clientSession: {
        ...createClientSession(),
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

  await Promise.all(writes);

  const manifest = await loadJson(manifestPath);
  manifest.workflowVersion = workflow.workflowVersion;
  manifest.integration = workflow.integration;
  manifest.canvasProvider = "figma";
  manifest.automationClient = process.env.STUDIOFLOW_AGENT_NAME || "mcp-client";
  manifest.updatedAt = generatedAt;
  manifest.lastCodeToCanvas = {
    ranAt: generatedAt,
    tokenCount: flattened.length,
    sfidCount: codeSfids.length,
    handoffFile: workflow.exchangeFiles.codeToCanvas
  };
  manifest.expectedSfids = codeSfids;
  await writeJson(manifestPath, manifest);

  console.log(`Created ${path.relative(rootDir, exchangePath(workflow, "codeToCanvas"))}`);
  console.log(`Created ${path.relative(rootDir, exchangePath(workflow, "canvasToCodeTemplate"))}`);
  console.log("Next: produce handoff/canvas-to-code.json and run `npm run loop:verify-canvas`.");
}

if (path.resolve(process.argv[1] || "") === __filename) {
  runLoopCodeToCanvas().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
