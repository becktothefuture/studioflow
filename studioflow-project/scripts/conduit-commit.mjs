import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CONDUIT_ERROR_TAXONOMY } from "./lib/conduit-errors.mjs";
import { exchangePath, loadJson, readWorkflowConfig, rootDir } from "./lib/workflow-utils.mjs";
import {
  TRUST_LEDGER_STATES,
  hashJson,
  printAsciiLedger,
  readBandContext,
  readPreviewDiff,
  readTrustLedger,
  writeReceipt,
  writeTrustLedger
} from "./lib/ux-ledger.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = {
    runId: null,
    contextTtlSeconds: Number(process.env.STUDIOFLOW_CONTEXT_TTL_SECONDS || 900)
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--run-id") {
      args.runId = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (token === "--context-ttl") {
      const value = Number(argv[i + 1]);
      if (Number.isFinite(value) && value > 0) {
        args.contextTtlSeconds = value;
      }
      i += 1;
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
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim()
  };
}

function staleContextIssue() {
  const entry = CONDUIT_ERROR_TAXONOMY.SF_CONTEXT_STALE;
  return {
    code: entry.code,
    title: entry.title,
    fastestFix: entry.fastestFix,
    safeFallback: entry.safeFallback
  };
}

function stalePreviewIssue() {
  const entry = CONDUIT_ERROR_TAXONOMY.SF_PREVIEW_STALE;
  return {
    code: entry.code,
    title: entry.title,
    fastestFix: entry.fastestFix,
    safeFallback: entry.safeFallback
  };
}

function checkGateIssue() {
  const entry = CONDUIT_ERROR_TAXONOMY.SF_COMMIT_GATE_FAILED;
  return {
    code: entry.code,
    title: entry.title,
    fastestFix: entry.fastestFix,
    safeFallback: entry.safeFallback
  };
}

function isContextStale(context, ttlSeconds) {
  if (!context?.updatedAt) return false;
  const ageMs = Date.now() - new Date(context.updatedAt).getTime();
  return Number.isFinite(ageMs) && ageMs > ttlSeconds * 1000;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.runId) {
    console.error("Missing required argument: --run-id <preview-run-id>");
    process.exit(1);
  }

  const [workflow, ledger, preview, context] = await Promise.all([
    readWorkflowConfig(),
    readTrustLedger(),
    readPreviewDiff(),
    readBandContext()
  ]);

  if (!ledger || !preview) {
    console.error("No preview artifacts found. Run `npm run conduit:preview` first.");
    process.exit(1);
  }

  if (ledger.runId !== args.runId || preview.runId !== args.runId) {
    await writeTrustLedger({
      ...ledger,
      state: TRUST_LEDGER_STATES.COMMIT_BLOCKED,
      blockingIssues: [stalePreviewIssue()]
    });
    console.error(`[${CONDUIT_ERROR_TAXONOMY.SF_PREVIEW_STALE.code}] Preview runId mismatch.`);
    console.error(`fastestFix: ${CONDUIT_ERROR_TAXONOMY.SF_PREVIEW_STALE.fastestFix}`);
    process.exit(1);
  }

  const codeToCanvasPath = exchangePath(workflow, "codeToCanvas");
  const payload = await loadJson(codeToCanvasPath);
  const currentHash = hashJson(payload);

  const blockingIssues = [];
  if (currentHash !== preview.currentHash) {
    blockingIssues.push(stalePreviewIssue());
  }
  if (isContextStale(context, args.contextTtlSeconds)) {
    blockingIssues.push(staleContextIssue());
  }

  if (blockingIssues.length > 0) {
    const blocked = await writeTrustLedger({
      ...ledger,
      state: TRUST_LEDGER_STATES.COMMIT_BLOCKED,
      blockingIssues
    });
    printAsciiLedger(blocked, context);
    process.exit(1);
  }

  const inProgress = await writeTrustLedger({
    ...ledger,
    state: TRUST_LEDGER_STATES.COMMIT_IN_PROGRESS,
    blockingIssues: []
  });
  printAsciiLedger(inProgress, context);

  const checkResult = runCheckGate();
  if (!checkResult.ok) {
    const blocked = await writeTrustLedger({
      ...ledger,
      state: TRUST_LEDGER_STATES.COMMIT_BLOCKED,
      blockingIssues: [checkGateIssue()]
    });
    printAsciiLedger(blocked, context);
    console.error("");
    console.error("Commit blocked due to failed quality gates:");
    console.error(checkResult.output);
    process.exit(1);
  }

  const receipt = await writeReceipt({
    runId: args.runId,
    previewHash: preview.currentHash,
    commitHash: currentHash,
    appliedChanges: {
      tokenCount: preview.summary?.tokenCount ?? 0,
      sfidCount: preview.summary?.sfidCount ?? 0,
      styleAssignments: preview.summary?.styleAssignments ?? 0
    },
    gateResults: {
      check: "passed"
    },
    errorCodes: []
  });

  const done = await writeTrustLedger({
    ...ledger,
    state: TRUST_LEDGER_STATES.COMMIT_DONE,
    blockingIssues: [],
    lastReceiptId: path.relative(rootDir, receipt.filePath)
  });

  printAsciiLedger(done, context);
  console.log("");
  console.log(`Receipt: ${path.relative(rootDir, receipt.filePath)}`);
  console.log("Commit complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
