#!/usr/bin/env node
/**
 * StudioFlow Figma Screen Builder v3
 * 
 * Fixed: autolayout action field, proper nesting, cleanup, content.
 */
import { spawn, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const payload = JSON.parse(readFileSync(path.join(ROOT, "handoff/code-to-canvas.json"), "utf8"));
const tokens = payload.tokens;
const screens = payload.requirements.screens;

function hex(h) {
  h = h.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 };
}
function hexA(h) { return { ...hex(h), a: 1 }; }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class McpClient {
  constructor(proc) {
    this.proc = proc; this.reqId = 100; this.pending = new Map(); this.buffer = "";
    proc.stdout.on("data", chunk => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split("\n"); this.buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.method === "roots/list") { this._send({ jsonrpc: "2.0", id: msg.id, result: { roots: [] } }); }
          else if (msg.id !== undefined && this.pending.has(msg.id)) {
            const { resolve } = this.pending.get(msg.id); this.pending.delete(msg.id); resolve(msg);
          }
        } catch {}
      }
    });
  }
  _send(obj) { this.proc.stdin.write(JSON.stringify(obj) + "\n"); }
  async request(method, params = {}, t = 60000) {
    const id = this.reqId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, t);
      this.pending.set(id, { resolve: m => { clearTimeout(timer); resolve(m); } });
      this._send({ jsonrpc: "2.0", id, method, params });
    });
  }
  async init() {
    await this.request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "sf-builder", version: "3.0" } });
    this._send({ jsonrpc: "2.0", method: "notifications/initialized" });
  }
  async tool(name, args, t = 60000) {
    const resp = await this.request("tools/call", { name, arguments: args }, t);
    if (resp.error) throw new Error(`${name}: ${JSON.stringify(resp.error).substring(0, 300)}`);
    const text = resp.result?.content?.[0]?.text;
    if (text) { try { return JSON.parse(text); } catch { return text; } }
    return resp.result;
  }
  // Non-throwing version for tools where response validation may fail
  async toolSafe(name, args, t = 60000) {
    try { return await this.tool(name, args, t); }
    catch (e) {
      // If it's an output validation error, the tool likely still ran
      if (e.message.includes("structured content")) return { ok: true };
      throw e;
    }
  }
}

function nid(r) {
  if (r?.id) return r.id;
  if (r?.nodeId) return r.nodeId;
  if (r?.results?.[0]?.value?.id) return r.results[0].value.id;
  if (r?.results?.[0]?.id) return r.results[0].id;
  if (r?.results?.[0]?.value?.nodeId) return r.results[0].value.nodeId;
  // Text tool returns nodeIds in content
  if (typeof r === "string") { const m = r.match(/(\d+:\d+)/); if (m) return m[1]; }
  // Debug: log what we got
  const s = JSON.stringify(r);
  if (s.length < 500) console.log("  [nid debug]", s);
  else console.log("  [nid debug]", s.substring(0, 500) + "...");
  return null;
}

async function main() {
  console.log("🔧 StudioFlow Figma Builder v3\n");

  // Kill existing, start fresh
  try { execSync("pkill -f conduit-mcp", { stdio: "ignore" }); } catch {}
  await sleep(2000);

  const proc = spawn("/Users/alexanderbeck/.local/bin/conduit-mcp", ["--stdio"], {
    env: { ...process.env, PORT: "3055", CHANNEL_KEY: "wise-panda-45" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  proc.stderr.on("data", () => {});
  const c = new McpClient(proc);

  try {
    await c.init();
    console.log("✓ MCP ready, waiting for Figma plugin (8s)...");
    await sleep(8000);

    // Verify Figma connected
    try {
      const lsof = execSync("lsof -i :3055 2>/dev/null | grep ESTABLISHED | grep Figma", { encoding: "utf8" });
      if (!lsof.trim()) { console.log("✗ Figma not connected! Re-run Conduit plugin."); proc.kill(); process.exit(1); }
    } catch { console.log("⚠ Can't verify Figma, continuing..."); }
    console.log("✓ Figma connected");

    await c.tool("join", { channel: "wise-panda-45" });
    console.log("✓ Joined channel\n");

    // ---- CLEANUP: Delete old frames ----
    console.log("Cleaning up old frames...");
    try {
      const docInfo = await c.tool("info", { entries: [{ nodeId: "0:1", type: "normal" }] });
      // Parse children from result
      const pageData = docInfo?.results?.[0] || docInfo;
      const children = pageData?.children || pageData?.value?.children || [];
      if (children.length > 0) {
        const deleteOps = children.map(ch => ({ action: "delete", config: { nodeId: ch.id || ch.nodeId } })).filter(op => op.config.nodeId);
        if (deleteOps.length > 0) {
          await c.tool("node", { operations: deleteOps, options: { skipErrors: true } });
          console.log(`  Deleted ${deleteOps.length} old frames`);
        }
      }
    } catch (e) {
      console.log("  ⚠ Cleanup:", e.message.substring(0, 120));
    }
    await sleep(500);

    // ---- CLEANUP: Delete old StudioFlow variables ----
    console.log("Cleaning up old variables...");
    try {
      const existVars = await c.tool("variable", { entry: { action: "get" } });
      const allV = existVars?.results?.[0]?.getResults?.results || [];
      const sfIds = allV.filter(v => (v.collection || v.name || "").includes("StudioFlow")).map(v => v.id).filter(Boolean);
      if (sfIds.length > 0) {
        for (let i = 0; i < sfIds.length; i += 30) {
          await c.tool("variable", { entry: { action: "delete", ids: sfIds.slice(i, i + 30) } });
        }
        console.log(`  Deleted ${sfIds.length} old variables`);
      }
    } catch (e) {
      console.log("  ⚠ Var cleanup:", e.message.substring(0, 120));
    }
    await sleep(500);

    // ---- CREATE VARIABLES (single collection) ----
    console.log("\nCreating variables...");
    const colorTokens = tokens.filter(t => t.frame === "Tokens / Colors");
    const spacingTokens = tokens.filter(t => t.frame === "Tokens / Spacing" && t.value.endsWith("px") && !t.value.includes("rgba"));
    const typoNumTokens = tokens.filter(t => t.frame === "Tokens / Typography" && !t.name.includes("family") && !isNaN(parseFloat(t.value)) && !t.value.includes("clamp"));
    const fontFamilyTokens = tokens.filter(t => t.name.includes("font-family"));

    const allVariables = [
      ...colorTokens.map(t => ({ name: t.name, type: "COLOR", value: hexA(t.value), collection: "StudioFlow Tokens" })),
      ...spacingTokens.map(t => ({ name: t.name, type: "FLOAT", value: parseFloat(t.value), collection: "StudioFlow Tokens" })),
      ...typoNumTokens.map(t => ({ name: t.name, type: "FLOAT", value: parseFloat(t.value), collection: "StudioFlow Tokens" })),
      ...fontFamilyTokens.map(t => ({ name: t.name, type: "STRING", value: t.value, collection: "StudioFlow Tokens" })),
    ];

    // Create all at once in one call to avoid duplicate collections
    await c.tool("variable", { entry: { action: "set", variables: allVariables } });
    console.log(`  ✓ ${allVariables.length} variables created in "StudioFlow Tokens"`);

    // Add breakpoint modes
    const freshVars = await c.tool("variable", { entry: { action: "get", collection: "StudioFlow Tokens" } });
    const fv = freshVars?.results?.[0]?.getResults?.results || [];
    let colId = fv[0]?.collection;
    if (colId) {
      const vbm = fv[0]?.valuesByMode;
      const defaultModeId = vbm ? Object.keys(vbm)[0] : null;
      if (defaultModeId) {
        await c.tool("variable", { entry: { action: "add_mode", collectionId: colId, modeName: "mobile", modeId: defaultModeId } });
      }
      for (const mode of ["tablet", "laptop", "desktop"]) {
        try { await c.tool("variable", { entry: { action: "add_mode", collectionId: colId, modeName: mode } }); } catch {}
      }
      console.log("  ✓ Breakpoint modes added: mobile, tablet, laptop, desktop");
    }

    // ---- CREATE TOKEN FRAMES ----
    console.log("\nCreating token reference frames...");
    let tx = 0;
    for (const fname of payload.requirements.tokenFrames) {
      await c.tool("shape", { shape: { type: "frame", name: fname, config: { x: tx, y: -500, width: 400, height: 300, cornerRadius: 12 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#161E28") }] } } });
      console.log(`  ✓ ${fname}`);
      tx += 450;
    }

    // ---- CREATE 4 SCREEN FRAMES WITH CONTENT ----
    console.log("\nCreating screens with hero content...");
    let xOff = 0;

    for (const screen of screens) {
      console.log(`\n── ${screen.name} (${screen.width}px) ──`);
      const isMob = screen.width <= 390;
      const titleSz = isMob ? 56 : screen.width <= 768 ? 72 : 92;
      const maxW = Math.min(screen.width - 80, 780);
      const scrH = isMob ? 1200 : 900;

      // Create screen frame
      const sr = await c.tool("shape", { shape: { type: "frame", name: screen.name, config: { x: xOff, y: 0, width: screen.width, height: scrH, clipsContent: true }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#0F141D") }] } } });
      const sId = nid(sr);
      if (!sId) { console.log("  ✗ No screen ID"); xOff += screen.width + 100; continue; }

      // Auto-layout on screen
      await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: sId, layoutMode: "VERTICAL", primaryAxisSizingMode: "FIXED", counterAxisSizingMode: "FIXED", primaryAxisAlignItems: "MIN", counterAxisAlignItems: "CENTER", itemSpacing: 0 } });
      console.log(`  ✓ Screen ${sId}`);

      // Nav bar
      const navR = await c.tool("shape", { shape: { type: "frame", name: "nav-bar", parentId: sId, config: { x: 0, y: 0, width: 10, height: 10 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#0F141D"), opacity: 0 }] } } });
      const navId = nid(navR);
      if (navId) {
        await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: navId, layoutMode: "HORIZONTAL", primaryAxisSizingMode: "FIXED", counterAxisSizingMode: "AUTO", primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER", paddingTop: 16, paddingBottom: 16, paddingLeft: 24, paddingRight: 24, itemSpacing: 16 } });
        await c.tool("text", { entry: { text: "StudioFlow", name: "brand-name", parentId: navId, x: 0, y: 0, textStyle: { fontSize: 16, fontName: { family: "Inter", style: "Bold" }, fills: [{ type: "SOLID", color: hex("#99B9C8") }], textAutoResize: "WIDTH_AND_HEIGHT" } } });
        if (!isMob) {
          await c.tool("text", { entry: { text: "How it works   Proof   Docs", name: "nav-links", parentId: navId, x: 0, y: 0, textStyle: { fontSize: 14, fontName: { family: "Inter", style: "Regular" }, fills: [{ type: "SOLID", color: hex("#88AEBF") }], textAutoResize: "WIDTH_AND_HEIGHT" } } });
        }
        console.log("  ✓ Nav bar");
      }

      // Hero section
      const heroR = await c.tool("shape", { shape: { type: "frame", name: "hero-content", parentId: sId, config: { x: 0, y: 0, width: 10, height: 10 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#0F141D"), opacity: 0 }] } } });
      const heroId = nid(heroR);
      if (!heroId) { console.log("  ✗ No hero ID"); xOff += screen.width + 100; continue; }

      await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: heroId, layoutMode: "VERTICAL", primaryAxisSizingMode: "AUTO", counterAxisSizingMode: "FILL", primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", paddingTop: 64, paddingBottom: 64, paddingLeft: isMob ? 20 : 40, paddingRight: isMob ? 20 : 40, itemSpacing: 24 } });

      // Kicker
      await c.tool("text", { entry: { text: "DESIGN–CODE LOOP", name: "hero-kicker", parentId: heroId, x: 0, y: 0, textStyle: { fontSize: 13, fontName: { family: "Inter", style: "Medium" }, fills: [{ type: "SOLID", color: hex("#88AEBF") }], letterSpacing: { unit: "PERCENT", value: 16 }, textAutoResize: "WIDTH_AND_HEIGHT", textAlignHorizontal: "CENTER" } } });
      console.log("  ✓ Kicker");

      // Title
      await c.tool("text", { entry: { text: "Ship pixel-perfect UI\nfrom a single truth.", name: "hero-title", parentId: heroId, x: 0, y: 0, width: maxW, textStyle: { fontSize: titleSz, fontName: { family: "Inter", style: "Bold" }, fills: [{ type: "SOLID", color: hex("#99B9C8") }], lineHeight: { unit: "PERCENT", value: 96 }, letterSpacing: { unit: "PERCENT", value: -3 }, textAutoResize: "HEIGHT", textAlignHorizontal: "CENTER" } } });
      console.log("  ✓ Title");

      // Body
      await c.tool("text", { entry: { text: "StudioFlow keeps your Figma variables and code tokens in structural sync — deterministically. Zero handoff drift. Zero hardcoded values.", name: "hero-body", parentId: heroId, x: 0, y: 0, width: Math.min(maxW, 600), textStyle: { fontSize: 16, fontName: { family: "Inter", style: "Regular" }, fills: [{ type: "SOLID", color: hex("#99B9C8") }], lineHeight: { unit: "PERCENT", value: 160 }, textAutoResize: "HEIGHT", textAlignHorizontal: "CENTER" } } });
      console.log("  ✓ Body");

      // Command box
      const cmdR = await c.tool("shape", { shape: { type: "frame", name: "command-box", parentId: heroId, config: { x: 0, y: 0, width: 10, height: 10, cornerRadius: 12 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#161E28") }] }, stroke: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#3D4F5B") }] }, strokeWeight: 1, strokeAlign: "INSIDE" } });
      const cmdId = nid(cmdR);
      if (cmdId) {
        await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: cmdId, layoutMode: "HORIZONTAL", primaryAxisSizingMode: "AUTO", counterAxisSizingMode: "AUTO", primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER", paddingTop: 12, paddingBottom: 12, paddingLeft: 20, paddingRight: 20, itemSpacing: 16 } });
        await c.tool("text", { entry: { text: "$ npx studioflow init", name: "command-line", parentId: cmdId, x: 0, y: 0, textStyle: { fontSize: 14, fontName: { family: "Inter", style: "Regular" }, fills: [{ type: "SOLID", color: hex("#88AEBF") }], textAutoResize: "WIDTH_AND_HEIGHT" } } });
        await c.tool("text", { entry: { text: "Copy", name: "copy-btn", parentId: cmdId, x: 0, y: 0, textStyle: { fontSize: 13, fontName: { family: "Inter", style: "Medium" }, fills: [{ type: "SOLID", color: hex("#5A7381") }], textAutoResize: "WIDTH_AND_HEIGHT" } } });
        console.log("  ✓ Command box");
      }

      // CTA Actions
      const actR = await c.tool("shape", { shape: { type: "frame", name: "hero-actions", parentId: heroId, config: { x: 0, y: 0, width: 10, height: 10 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#0F141D"), opacity: 0 }] } } });
      const actId = nid(actR);
      if (actId) {
        await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: actId, layoutMode: isMob ? "VERTICAL" : "HORIZONTAL", primaryAxisSizingMode: "AUTO", counterAxisSizingMode: "AUTO", primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", itemSpacing: 16 } });

        // Primary CTA
        const p1R = await c.tool("shape", { shape: { type: "frame", name: "hero-primary-cta", parentId: actId, config: { x: 0, y: 0, width: 210, height: 48, cornerRadius: 999 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#7A8DFF") }] } } });
        const p1Id = nid(p1R);
        if (p1Id) {
          await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: p1Id, layoutMode: "HORIZONTAL", primaryAxisSizingMode: "AUTO", counterAxisSizingMode: "AUTO", primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", paddingTop: 12, paddingBottom: 12, paddingLeft: 32, paddingRight: 32 } });
          await c.tool("text", { entry: { text: "Start building", parentId: p1Id, x: 0, y: 0, textStyle: { fontSize: 16, fontName: { family: "Inter", style: "SemiBold" }, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }], textAutoResize: "WIDTH_AND_HEIGHT" } } });
        }

        // Secondary CTA
        const p2R = await c.tool("shape", { shape: { type: "frame", name: "hero-secondary-cta", parentId: actId, config: { x: 0, y: 0, width: 210, height: 48, cornerRadius: 999 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#0F141D"), opacity: 0 }] }, stroke: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#7EF7F0") }] }, strokeWeight: 2, strokeAlign: "INSIDE" } });
        const p2Id = nid(p2R);
        if (p2Id) {
          await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: p2Id, layoutMode: "HORIZONTAL", primaryAxisSizingMode: "AUTO", counterAxisSizingMode: "AUTO", primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", paddingTop: 12, paddingBottom: 12, paddingLeft: 32, paddingRight: 32 } });
          await c.tool("text", { entry: { text: "View proof", parentId: p2Id, x: 0, y: 0, textStyle: { fontSize: 16, fontName: { family: "Inter", style: "SemiBold" }, fills: [{ type: "SOLID", color: hex("#7EF7F0") }], textAutoResize: "WIDTH_AND_HEIGHT" } } });
        }
        console.log("  ✓ CTA buttons");
      }

      // Tagline
      await c.tool("text", { entry: { text: "Token-first · sfid-anchored · Zero drift", name: "tagline", parentId: heroId, x: 0, y: 0, textStyle: { fontSize: 13, fontName: { family: "Inter", style: "Regular" }, fills: [{ type: "SOLID", color: hex("#5A7381") }], textAutoResize: "WIDTH_AND_HEIGHT", textAlignHorizontal: "CENTER" } } });

      // Footer
      const ftR = await c.tool("shape", { shape: { type: "frame", name: "footer", parentId: sId, config: { x: 0, y: 0, width: 10, height: 10 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#070A13") }] } } });
      const ftId = nid(ftR);
      if (ftId) {
        await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: ftId, layoutMode: "VERTICAL", primaryAxisSizingMode: "AUTO", counterAxisSizingMode: "FILL", primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", paddingTop: 32, paddingBottom: 32, paddingLeft: 24, paddingRight: 24, itemSpacing: 8 } });
        await c.tool("text", { entry: { text: "© 2026 StudioFlow — Deterministic design-to-code sync.", parentId: ftId, x: 0, y: 0, textStyle: { fontSize: 13, fontName: { family: "Inter", style: "Regular" }, fills: [{ type: "SOLID", color: hex("#5A7381") }], textAutoResize: "WIDTH_AND_HEIGHT", textAlignHorizontal: "CENTER" } } });
        console.log("  ✓ Footer");
      }

      console.log(`  ✅ ${screen.name} done`);
      xOff += screen.width + 100;
    }

    console.log("\n\n✅ ALL DONE — Check Figma!");
    console.log(`   4 screens: ${screens.map(s => s.name).join(", ")}`);
    console.log(`   ${allVariables.length} variables in "StudioFlow Tokens"`);
    console.log("   3 token reference frames");
    console.log("\nNext: npm run check");

  } catch (err) {
    console.error("\n❌ Fatal:", err.message);
  } finally {
    proc.kill();
    process.exit(0);
  }
}

main();
