import path from "node:path";
import { readWorkflowConfig, rootDir, writeJson, loadJson, exchangePath } from "./lib/workflow-utils.mjs";

const DEMO_OUTPUT_RELATIVE = "handoff/demo-website-canvas-to-code.json";

function applyModeOverrides(modeName, values) {
  const overrides = {
    mobile: {
      "color-brand-primary": "#5B6BFF",
      "color-brand-secondary": "#64F2EA",
      "space-xl": "32px",
      "size-panel-width": "100%",
      "font-size-title": "clamp(34px, 12vw, 58px)"
    },
    tablet: {
      "color-brand-primary": "#5F73FF",
      "color-brand-secondary": "#6AF4EC",
      "space-xl": "36px",
      "size-panel-width": "420px",
      "font-size-title": "clamp(42px, 9vw, 68px)"
    },
    laptop: {
      "color-brand-primary": "#6C80FF",
      "color-brand-secondary": "#72F5EE",
      "space-xl": "40px",
      "size-panel-width": "380px",
      "font-size-title": "clamp(52px, 7vw, 80px)"
    },
    desktop: {
      "color-brand-primary": "#7A8DFF",
      "color-brand-secondary": "#7EF7F0",
      "space-xl": "44px",
      "size-panel-width": "400px",
      "font-size-title": "clamp(56px, 6vw, 92px)"
    }
  };

  return {
    ...values,
    ...(overrides[modeName] ?? {})
  };
}

async function main() {
  const workflow = await readWorkflowConfig();
  const templatePath = exchangePath(workflow, "canvasToCodeTemplate");
  const template = await loadJson(templatePath);

  const output = structuredClone(template);
  output.generatedAt = new Date().toISOString();
  output.canvasProvider = process.env.STUDIOFLOW_CANVAS_PROVIDER || "figma";
  output.integrationMode = "code-first";
  output.clientSession = {
    ...(output.clientSession ?? output.claudeSession ?? {}),
    sessionId: output.clientSession?.sessionId ?? output.claudeSession?.sessionId ?? "demo-website-session"
  };

  output.variableModes = (output.variableModes ?? []).map((mode) => ({
    ...mode,
    values: applyModeOverrides(String(mode.name), mode.values ?? {})
  }));

  const outputPath = path.join(rootDir, DEMO_OUTPUT_RELATIVE);
  await writeJson(outputPath, output);
  console.log(`Created ${DEMO_OUTPUT_RELATIVE}`);
  console.log("Use with:");
  console.log(`STUDIOFLOW_INPUT=${DEMO_OUTPUT_RELATIVE} npm run loop:verify-canvas`);
  console.log(`STUDIOFLOW_INPUT=${DEMO_OUTPUT_RELATIVE} npm run loop:canvas-to-code`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
