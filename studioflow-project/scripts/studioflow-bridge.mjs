#!/usr/bin/env node
/**
 * StudioFlow Bridge Server
 *
 * Local WebSocket server that connects the Figma plugin UI
 * directly to your terminal for one-press sync operations.
 *
 * Usage: node scripts/studioflow-bridge.mjs
 *   or:  npm run bridge
 *
 * The Figma plugin UI connects to ws://localhost:9801.
 * When "Sync to Code" is pressed, the plugin sends the canvas payload
 * here, and this server writes it to handoff/canvas-to-code.json
 * then runs the verify + apply pipeline automatically.
 */
import { WebSocketServer } from "ws";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 9801;
const HANDOFF_PATH = path.join(ROOT, "handoff/canvas-to-code.json");

const wss = new WebSocketServer({ port: PORT });
let activeClients = new Set();

console.log(`✓ StudioFlow bridge listening on ws://localhost:${PORT}`);
console.log("  Waiting for Figma plugin connection…\n");

wss.on("connection", (ws) => {
  activeClients.add(ws);
  console.log(`→ Plugin connected (${activeClients.size} client${activeClients.size > 1 ? "s" : ""})`);

  ws.on("message", async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type === "sync-to-code" && msg.payload) {
      await handleSyncToCode(ws, msg.payload);
    }
  });

  ws.on("close", () => {
    activeClients.delete(ws);
    console.log(`← Plugin disconnected (${activeClients.size} remaining)`);
  });
});

function send(ws, type, text, level) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, text, level }));
  }
}

async function handleSyncToCode(ws, jsonPayload) {
  // 1. Write payload to handoff file
  try {
    fs.mkdirSync(path.dirname(HANDOFF_PATH), { recursive: true });
    fs.writeFileSync(HANDOFF_PATH, jsonPayload, "utf8");
    send(ws, "log", "Wrote canvas-to-code.json", "success");
    console.log("  ✓ Wrote handoff/canvas-to-code.json");
  } catch (err) {
    send(ws, "error", "Failed to write handoff file: " + err.message);
    console.error("  ✗ Write failed:", err.message);
    return;
  }

  // 2. Run verify-canvas
  send(ws, "log", "Running verify-canvas…", "info");
  const verifyOk = await runNpm(ws, "loop:verify-canvas");
  if (!verifyOk) {
    send(ws, "error", "Verify failed — check logs");
    return;
  }
  send(ws, "log", "Verify passed ✓", "success");

  // 3. Run canvas-to-code
  send(ws, "log", "Running canvas-to-code…", "info");
  const applyOk = await runNpm(ws, "loop:canvas-to-code");
  if (!applyOk) {
    send(ws, "error", "canvas-to-code failed — check logs");
    return;
  }

  send(ws, "done", "Sync to code complete");
  console.log("  ✓ Sync pipeline complete\n");
}

function runNpm(ws, script) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", script], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    child.stdout.on("data", (chunk) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        send(ws, "log", line.trim(), "info");
        process.stdout.write("    " + line.trim() + "\n");
      }
    });

    child.stderr.on("data", (chunk) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        send(ws, "log", line.trim(), "warn");
        process.stderr.write("    " + line.trim() + "\n");
      }
    });

    child.on("close", (code) => {
      resolve(code === 0);
    });
  });
}
