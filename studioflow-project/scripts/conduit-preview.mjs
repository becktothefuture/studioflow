import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildArtifacts } from "./build-tokens.mjs";
import { runLoopCodeToCanvas } from "./loop-code-to-canvas.mjs";
import { exchangePath, extractCodeSfids, loadJson, readWorkflowConfig, utcStamp } from "./lib/workflow-utils.mjs";
import {
  TRUST_LEDGER_STATES,
  hashJson,
  printAsciiLedger,
  readPreviewDiff,
  readTrustLedger,
  writeBandContext,
  writePreviewDiff,
  writeTrustLedger
} from "./lib/ux-ledger.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = {
    screen: null,
    sfid: null,
    breakpoint: null,
    skipCheck: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--screen") {
      args.screen = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (token === "--sfid") {
      args.sfid = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (token === "--breakpoint") {
      args.breakpoint = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (token === "--skip-check") {
      args.skipCheck = true;
    }
  }

  return args;
}

function runCheckGate() {
  const result = spawnSync("npm", ["run", "check"], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8"
  });

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim()
  };
}

function coverageStatus(actual, expected) {
  if (actual === expected && expected > 0) return "OK";
  if (actual > 0) return "WARN";
  return "BLOCKED";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = `preview-${utcStamp()}`;
  const workflow = await readWorkflowConfig();
  const conduitPath = exchangePath(workflow, "codeToCanvas");

  await writeTrustLedger({
    runId,
    state: TRUST_LEDGER_STATES.READY,
    blockingIssues: []
  });

  await buildArtifacts();
  await runLoopCodeToCanvas();

  const [payload, previousPreview, previousLedger, codeSfids] = await Promise.all([
    loadJson(conduitPath),
    readPreviewDiff(),
    readTrustLedger(),
    extractCodeSfids()
  ]);

  const payloadHash = hashJson(payload);
  const summary = {
    tokenCount: Array.isArray(payload.tokens) ? payload.tokens.length : 0,
    sfidCount: Array.isArray(payload.sfids) ? payload.sfids.length : 0,
    styleAssignments: Array.isArray(payload.styleLayer?.elementPropertyMappings)
      ? payload.styleLayer.elementPropertyMappings.length
      : 0
  };

  const preview = await writePreviewDiff({
    runId,
    conduitPath: path.relative(path.resolve(__dirname, ".."), conduitPath),
    currentHash: payloadHash,
    previousHash: previousPreview?.currentHash ?? null,
    hasChanges: payloadHash !== previousPreview?.currentHash,
    summary
  });

  const checkResult = args.skipCheck ? { ok: true, output: "check skipped" } : runCheckGate();
  const blockingIssues = [];
  if (!checkResult.ok) {
    blockingIssues.push({
      code: "SF_PREVIEW_GATE_FAILED",
      title: "Preview quality gates failed",
      fastestFix: "Run `npm run check` and resolve the first reported error.",
      safeFallback: "Use `npm run conduit:doctor -- --code SF_PREVIEW_GATE_FAILED` for guidance."
    });
  }

  const ledger = await writeTrustLedger({
    runId,
    state: checkResult.ok ? TRUST_LEDGER_STATES.PREVIEW_READY : TRUST_LEDGER_STATES.COMMIT_BLOCKED,
    conduitVersion: payload.conduitVersion ?? null,
    tokenCount: summary.tokenCount,
    modeCoverage: {
      expected: workflow.breakpoints.length,
      actual: Array.isArray(payload.requirements?.variableModes) ? payload.requirements.variableModes.length : 0,
      status: coverageStatus(
        Array.isArray(payload.requirements?.variableModes) ? payload.requirements.variableModes.length : 0,
        workflow.breakpoints.length
      )
    },
    sfidCoverage: {
      expected: codeSfids.length,
      actual: summary.sfidCount,
      status: coverageStatus(summary.sfidCount, codeSfids.length)
    },
    styleAssignments: summary.styleAssignments,
    blockingIssues,
    lastReceiptId: previousLedger?.lastReceiptId ?? null,
    preview: {
      runId: preview.runId,
      hash: preview.currentHash,
      diffFile: "handoff/preview-diff.json",
      generatedAt: preview.generatedAt
    }
  });

  let context = null;
  if (args.screen || args.sfid || args.breakpoint) {
    context = await writeBandContext({
      screen: args.screen,
      sfid: args.sfid,
      breakpoint: args.breakpoint,
      selectionPath: args.sfid ? [args.sfid] : [],
      sourceTool: "cursor-cli"
    });
  }

  printAsciiLedger(ledger, context);
  console.log("");
  console.log("Preview artifact: handoff/preview-diff.json");
  console.log(`Preview hash: ${preview.currentHash}`);
  console.log(`Next: npm run conduit:commit -- --run-id ${runId}`);

  if (!checkResult.ok) {
    console.error("");
    console.error("Preview gates failed:");
    console.error(checkResult.output);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
