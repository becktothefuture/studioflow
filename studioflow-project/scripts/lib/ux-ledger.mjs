import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { rootDir, utcStamp, writeJson } from "./workflow-utils.mjs";

export const TRUST_LEDGER_STATES = {
  READY: "READY",
  PREVIEW_READY: "PREVIEW_READY",
  COMMIT_IN_PROGRESS: "COMMIT_IN_PROGRESS",
  COMMIT_BLOCKED: "COMMIT_BLOCKED",
  COMMIT_DONE: "COMMIT_DONE"
};

export const uxArtifacts = {
  trustLedger: path.join(rootDir, "handoff", "trust-ledger.json"),
  previewDiff: path.join(rootDir, "handoff", "preview-diff.json"),
  bandContext: path.join(rootDir, "handoff", "band-context.json"),
  receiptsDir: path.join(rootDir, "proof", "receipts")
};

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function readTrustLedger() {
  return readJsonIfExists(uxArtifacts.trustLedger);
}

export async function readBandContext() {
  return readJsonIfExists(uxArtifacts.bandContext);
}

export async function readPreviewDiff() {
  return readJsonIfExists(uxArtifacts.previewDiff);
}

export async function writeTrustLedger(ledger) {
  const current = await readTrustLedger();
  const next = {
    runId: ledger.runId ?? current?.runId ?? `run-${utcStamp()}`,
    state: ledger.state ?? TRUST_LEDGER_STATES.READY,
    conduitVersion: ledger.conduitVersion ?? null,
    tokenCount: Number.isFinite(ledger.tokenCount) ? ledger.tokenCount : 0,
    modeCoverage: ledger.modeCoverage ?? { expected: 0, actual: 0, status: "WARN" },
    sfidCoverage: ledger.sfidCoverage ?? { expected: 0, actual: 0, status: "WARN" },
    styleAssignments: Number.isFinite(ledger.styleAssignments) ? ledger.styleAssignments : 0,
    lastReceiptId: ledger.lastReceiptId ?? current?.lastReceiptId ?? null,
    blockingIssues: Array.isArray(ledger.blockingIssues) ? ledger.blockingIssues : [],
    preview: ledger.preview ?? current?.preview ?? null,
    updatedAt: new Date().toISOString()
  };

  await writeJson(uxArtifacts.trustLedger, next);
  return next;
}

export async function writeBandContext(context) {
  const current = await readBandContext();
  const next = {
    screen: context.screen ?? current?.screen ?? null,
    breakpoint: context.breakpoint ?? current?.breakpoint ?? null,
    sfid: context.sfid ?? current?.sfid ?? null,
    selectionPath: context.selectionPath ?? current?.selectionPath ?? [],
    sourceTool: context.sourceTool ?? current?.sourceTool ?? "cursor-cli",
    updatedAt: new Date().toISOString()
  };
  await writeJson(uxArtifacts.bandContext, next);
  return next;
}

export async function writePreviewDiff(diff) {
  const output = {
    runId: diff.runId,
    generatedAt: new Date().toISOString(),
    conduitPath: diff.conduitPath,
    currentHash: diff.currentHash,
    previousHash: diff.previousHash ?? null,
    hasChanges: Boolean(diff.hasChanges),
    summary: diff.summary ?? {
      tokenCount: 0,
      sfidCount: 0,
      styleAssignments: 0
    }
  };
  await writeJson(uxArtifacts.previewDiff, output);
  return output;
}

export async function writeReceipt(receipt) {
  await fs.mkdir(uxArtifacts.receiptsDir, { recursive: true });
  const fileName = `${utcStamp()}-${receipt.runId}.json`;
  const filePath = path.join(uxArtifacts.receiptsDir, fileName);
  const payload = {
    runId: receipt.runId,
    previewHash: receipt.previewHash,
    commitHash: receipt.commitHash,
    appliedChanges: receipt.appliedChanges ?? {},
    gateResults: receipt.gateResults ?? {},
    errorCodes: Array.isArray(receipt.errorCodes) ? receipt.errorCodes : [],
    generatedAt: new Date().toISOString()
  };
  await writeJson(filePath, payload);
  return { fileName, filePath, payload };
}

export function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function hashString(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function printAsciiLedger(ledger, context = null) {
  const width = 76;
  const border = "+".padEnd(width - 1, "-") + "+";
  const row = (text) => {
    const value = String(text);
    const maxLen = width - 3;
    const clipped = value.length > maxLen ? `${value.slice(0, maxLen - 3)}...` : value;
    return `| ${clipped}`.padEnd(width - 1, " ") + "|";
  };
  const lines = [
    border,
    row("STUDIOFLOW TRUST LEDGER"),
    border,
    row(`runId: ${ledger.runId}`),
    row(`state: ${ledger.state}`),
    row(`conduitVersion: ${ledger.conduitVersion ?? "n/a"}`),
    row(`tokenCount: ${ledger.tokenCount}`),
    row(`modeCoverage: ${ledger.modeCoverage.actual}/${ledger.modeCoverage.expected} (${ledger.modeCoverage.status})`),
    row(`sfidCoverage: ${ledger.sfidCoverage.actual}/${ledger.sfidCoverage.expected} (${ledger.sfidCoverage.status})`),
    row(`styleAssignments: ${ledger.styleAssignments}`),
    row(`blockingIssues: ${ledger.blockingIssues.length}`),
    row(`lastReceiptId: ${ledger.lastReceiptId ?? "n/a"}`)
  ];

  if (context) {
    lines.push(border);
    lines.push(row("BAND CONTEXT"));
    lines.push(row(`screen: ${context.screen ?? "n/a"}`));
    lines.push(row(`breakpoint: ${context.breakpoint ?? "n/a"}`));
    lines.push(row(`sfid: ${context.sfid ?? "n/a"}`));
    lines.push(row(`sourceTool: ${context.sourceTool ?? "n/a"}`));
  }

  lines.push(border);
  console.log(lines.join("\n"));
}
