import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, "..", "..");
export const workflowConfigPath = path.join(rootDir, "studioflow.workflow.json");
export const manifestPath = path.join(rootDir, "studioflow.manifest.json");
export const tokenInputPath = path.join(rootDir, "tokens", "figma-variables.json");
export const snapshotsDir = path.join(rootDir, "snapshots");

const codeIdRegex = /data-sfid\s*=\s*['"]([^'"]+)['"]/g;

export function sanitizeId(input) {
  return input.trim().toLowerCase().replace(/[^a-z0-9:_-]/g, "");
}

export function utcStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readWorkflowConfig() {
  return loadJson(workflowConfigPath);
}

export function exchangePath(workflow, key) {
  const relative = workflow?.exchangeFiles?.[key];
  if (!relative) {
    throw new Error(`Missing exchange file path for "${key}" in studioflow.workflow.json`);
  }
  return path.join(rootDir, relative);
}

export async function extractCodeSfids() {
  const files = await glob(["src/**/*.{tsx,jsx,html}"], { cwd: rootDir, nodir: true });
  const ids = new Set();

  for (const file of files) {
    const content = await fs.readFile(path.join(rootDir, file), "utf8");
    for (const match of content.matchAll(codeIdRegex)) {
      ids.add(sanitizeId(match[1]));
    }
  }

  return [...ids].sort();
}

export function setTokenValueByPath(root, tokenPath, nextValue) {
  let cursor = root;
  for (let i = 0; i < tokenPath.length - 1; i += 1) {
    const key = tokenPath[i];
    if (!cursor || typeof cursor !== "object" || !(key in cursor)) {
      return false;
    }
    cursor = cursor[key];
  }

  const leafKey = tokenPath[tokenPath.length - 1];
  const leaf = cursor?.[leafKey];
  if (!leaf || typeof leaf !== "object" || !Object.prototype.hasOwnProperty.call(leaf, "value")) {
    return false;
  }

  leaf.value = String(nextValue);
  return true;
}

export function groupTokenFrame(tokenName, tokenFrames) {
  const [prefix] = tokenName.split("-");
  const match = tokenFrames.find((frame) => frame.prefixes.includes(prefix));
  return match ? match.name : tokenFrames[tokenFrames.length - 1]?.name ?? "Tokens / Spacing";
}

export function screenNameForBreakpoint(breakpoint) {
  return `Screen / ${breakpoint.label}`;
}

export function duplicateValues(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      dupes.add(value);
    }
    seen.add(value);
  }
  return [...dupes];
}

export function uniqueValues(values) {
  return [...new Set(values)];
}

export function normalizeCanvasPayload(input, workflow) {
  const payload = structuredClone(input);
  payload.integration ||= workflow.integration;
  payload.workflowVersion ||= workflow.workflowVersion;

  if (payload.source === "figma") {
    payload.source = "figma-canvas";
  }

  payload.canvasProvider ||= "figma";
  payload.integrationMode ||= "code-first";
  payload.sfids ||= [];

  if (!Array.isArray(payload.sfids) || payload.sfids.length === 0) {
    const ids = new Set();
    for (const screen of payload.screens ?? []) {
      const sfids = Array.isArray(screen?.sfids) ? screen.sfids : [];
      for (const sfid of sfids) {
        const sanitized = sanitizeId(String(sfid));
        if (sanitized.startsWith("sfid:")) {
          ids.add(sanitized);
        }
      }
    }
    payload.sfids = [...ids].sort();
  } else {
    payload.sfids = payload.sfids.map((sfid) => sanitizeId(String(sfid))).filter((sfid) => sfid.startsWith("sfid:"));
  }

  return payload;
}
