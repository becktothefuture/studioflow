import path from "node:path";
import { flattenTokens } from "./build-tokens.mjs";
import { validateCanvasPayload } from "./loop-verify-canvas.mjs";
import {
  extractCodeSfids,
  loadJson,
  normalizeCanvasPayload,
  readWorkflowConfig,
  rootDir,
  tokenInputPath
} from "./lib/workflow-utils.mjs";

async function main() {
  const [workflow, tokenJson, codeSfids] = await Promise.all([
    readWorkflowConfig(),
    loadJson(tokenInputPath),
    extractCodeSfids()
  ]);
  const tokenNames = flattenTokens(tokenJson).map((token) => token.name).sort();

  const cases = [
    {
      file: "tests/fixtures/canvas/valid-canvas-to-code.json",
      shouldPass: true
    },
    {
      file: "tests/fixtures/canvas/invalid-missing-mode.json",
      shouldPass: false,
      expectedErrorIncludes: "Missing variable modes"
    },
    {
      file: "tests/fixtures/canvas/invalid-missing-sfid.json",
      shouldPass: false,
      expectedErrorIncludes: "Payload sfids missing code IDs"
    }
  ];

  const failures = [];

  for (const testCase of cases) {
    const absolutePath = path.join(rootDir, testCase.file);
    const rawPayload = await loadJson(absolutePath);
    const payload = normalizeCanvasPayload(rawPayload, workflow);
    const errors = validateCanvasPayload(payload, { workflow, tokenNames, codeSfids });

    if (testCase.shouldPass && errors.length > 0) {
      failures.push(`${testCase.file} should pass but failed: ${errors.join(" | ")}`);
      continue;
    }

    if (!testCase.shouldPass) {
      if (errors.length === 0) {
        failures.push(`${testCase.file} should fail but passed.`);
        continue;
      }

      if (testCase.expectedErrorIncludes && !errors.some((error) => error.includes(testCase.expectedErrorIncludes))) {
        failures.push(
          `${testCase.file} failed, but did not include expected error fragment "${testCase.expectedErrorIncludes}".`
        );
      }
    }
  }

  if (failures.length > 0) {
    console.error("Canvas fixture tests failed:\n");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log(`Canvas fixture tests passed (${cases.length} cases).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
