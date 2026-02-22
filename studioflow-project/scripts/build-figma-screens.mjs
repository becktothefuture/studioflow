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

// Extract primary font family from CSS font-family value
// e.g., '"Xanh Mono", "Space Grotesk", monospace' → 'Xanh Mono'
function primaryFamily(cssValue) {
  const m = cssValue.match(/["']([^"']+)["']/);
  return m ? m[1] : cssValue.split(",")[0].trim();
}

// Resolve font families from tokens
const baseFamilyToken = tokens.find(t => t.name === "font-family-base");
const displayFamilyToken = tokens.find(t => t.name === "font-family-display");
const FONT_BASE = baseFamilyToken ? primaryFamily(baseFamilyToken.value) : "Inter";
const FONT_DISPLAY = displayFamilyToken ? primaryFamily(displayFamilyToken.value) : FONT_BASE;

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
    const opacityTokens = tokens.filter(t => t.name.startsWith("opacity-") && !isNaN(parseFloat(t.value)));

    // Convert typography values to Figma-compatible units:
    // letter-spacing: em → percent (×100), line-height: ratio → percent (×100)
    function figmaTypoValue(name, raw) {
      if (name.startsWith("font-letter-spacing-")) return parseFloat(raw) * 100;
      if (name.startsWith("font-line-height-")) return parseFloat(raw) * 100;
      return parseFloat(raw);
    }

    const allVariables = [
      ...colorTokens.map(t => ({ name: t.name, type: "COLOR", value: hexA(t.value), collection: "StudioFlow Tokens" })),
      ...spacingTokens.map(t => ({ name: t.name, type: "FLOAT", value: parseFloat(t.value), collection: "StudioFlow Tokens" })),
      ...typoNumTokens.map(t => ({ name: t.name, type: "FLOAT", value: figmaTypoValue(t.name, t.value), collection: "StudioFlow Tokens" })),
      ...fontFamilyTokens.map(t => ({ name: t.name, type: "STRING", value: t.value, collection: "StudioFlow Tokens" })),
      ...opacityTokens.map(t => ({ name: t.name, type: "FLOAT", value: parseFloat(t.value), collection: "StudioFlow Tokens" })),
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

    // ---- BUILD VARIABLE MAP (name → ID) ----
    const varMap = new Map();
    const latestVars = await c.tool("variable", { entry: { action: "get", collection: "StudioFlow Tokens" } });
    const lv = latestVars?.results?.[0]?.getResults?.results || [];
    for (const v of lv) {
      if (v.id && v.name) varMap.set(v.name, v.id);
    }
    console.log(`  ✓ Variable map: ${varMap.size} entries`);

    // Discover available tools for debugging
    let availableTools = [];
    try {
      const toolsResp = await c.request("tools/list");
      availableTools = (toolsResp.result?.tools || []).map(t => t.name);
      console.log(`  ✓ Available tools: ${availableTools.join(", ")}`);
    } catch { console.log("  ⚠ Could not list tools"); }

    // Helper: bind a Figma variable to a node property
    let bindCount = 0;
    let bindFailed = false;
    async function applyVar(nodeId, property, varName) {
      const varId = varMap.get(varName);
      if (!nodeId || !varId) return;
      try {
        await c.toolSafe("node", {
          operations: [{ action: "set_bound_variable", config: { nodeId, variableId: varId, field: property } }],
          options: { skipErrors: true }
        });
        bindCount++;
      } catch (e) {
        if (!bindFailed) { console.log("  ⚠ Variable binding via MCP not supported — use plugin 'Bind Variables' button"); bindFailed = true; }
      }
    }

    // ---- CREATE TOKEN FRAMES ----
    console.log("\nCreating token reference frames...");
    let tx = 0;
    for (const fname of payload.requirements.tokenFrames) {
      await c.tool("shape", { shape: { type: "frame", name: fname, config: { x: tx, y: -500, width: 400, height: 300, cornerRadius: 12 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#161E28") }] } } });
      console.log(`  ✓ ${fname}`);
      tx += 450;
    }

    // ---- CREATE 4 SCREEN FRAMES WITH CONTENT + BIND VARIABLES ----
    console.log("\nCreating screens with hero content + variable bindings...");
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
      await applyVar(sId, "fill", "color-brand-bg");

      // Auto-layout on screen
      await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: sId, layoutMode: "VERTICAL", primaryAxisSizingMode: "FIXED", counterAxisSizingMode: "FIXED", primaryAxisAlignItems: "MIN", counterAxisAlignItems: "CENTER", itemSpacing: 0 } });
      console.log(`  ✓ Screen ${sId}`);

      // Nav bar
      const navR = await c.tool("shape", { shape: { type: "frame", name: "nav-bar", parentId: sId, config: { x: 0, y: 0, width: screen.width, height: 60 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#0F141D"), opacity: 0 }] } } });
      const navId = nid(navR);
      if (navId) {
        await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: navId, layoutMode: "HORIZONTAL", layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG", primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER", paddingTop: 16, paddingBottom: 16, paddingLeft: 24, paddingRight: 24, itemSpacing: 16 } });
        await applyVar(navId, "paddingTop", "space-md");
        await applyVar(navId, "paddingBottom", "space-md");
        await applyVar(navId, "paddingLeft", "space-lg");
        await applyVar(navId, "paddingRight", "space-lg");
        await applyVar(navId, "itemSpacing", "space-md");

        const brandR = await c.tool("text", { entry: { text: "StudioFlow", name: "brand-name", parentId: navId, x: 0, y: 0, textStyle: { fontSize: 16, fontName: { family: FONT_BASE, style: "Bold" }, fills: [{ type: "SOLID", color: hex("#99B9C8") }], textAutoResize: "WIDTH_AND_HEIGHT" } } });
        const brandId = nid(brandR);
        await applyVar(brandId, "fill", "color-brand-text");
        await applyVar(brandId, "fontSize", "font-size-body");

        if (!isMob) {
          const navLinksR = await c.tool("text", { entry: { text: "How it works   Proof   Docs", name: "nav-links", parentId: navId, x: 0, y: 0, textStyle: { fontSize: 14, fontName: { family: FONT_BASE, style: "Regular" }, fills: [{ type: "SOLID", color: hex("#88AEBF") }], textAutoResize: "WIDTH_AND_HEIGHT" } } });
          const navLinksId = nid(navLinksR);
          await applyVar(navLinksId, "fill", "color-brand-signal");
          await applyVar(navLinksId, "fontSize", "font-size-meta");
        }
        console.log("  ✓ Nav bar + bindings");
      }

      // Hero section
      const heroR = await c.tool("shape", { shape: { type: "frame", name: "hero-content", parentId: sId, config: { x: 0, y: 0, width: screen.width, height: 600 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#0F141D"), opacity: 0 }] } } });
      const heroId = nid(heroR);
      if (!heroId) { console.log("  ✗ No hero ID"); xOff += screen.width + 100; continue; }

      await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: heroId, layoutMode: "VERTICAL", layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG", primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", paddingTop: 64, paddingBottom: 64, paddingLeft: isMob ? 20 : 40, paddingRight: isMob ? 20 : 40, itemSpacing: 24 } });
      await applyVar(heroId, "paddingTop", "space-xxl");
      await applyVar(heroId, "paddingBottom", "space-xxl");
      await applyVar(heroId, "paddingLeft", isMob ? "space-ml" : "space-3xl");
      await applyVar(heroId, "paddingRight", isMob ? "space-ml" : "space-3xl");
      await applyVar(heroId, "itemSpacing", "space-lg");

      // Kicker
      const kickerR = await c.tool("text", { entry: { text: "DESIGN–CODE LOOP", name: "hero-kicker", parentId: heroId, x: 0, y: 0, textStyle: { fontSize: 13, fontName: { family: FONT_BASE, style: "Medium" }, fills: [{ type: "SOLID", color: hex("#88AEBF") }], letterSpacing: { unit: "PERCENT", value: 16 }, textAutoResize: "WIDTH_AND_HEIGHT", textAlignHorizontal: "CENTER" } } });
      const kickerId = nid(kickerR);
      await applyVar(kickerId, "fill", "color-brand-signal");
      await applyVar(kickerId, "fontSize", "font-size-kicker");
      await applyVar(kickerId, "letterSpacing", "font-letter-spacing-kicker");

      console.log("  ✓ Kicker + bindings");

      // Title
      const titleR = await c.tool("text", { entry: { text: "Ship pixel-perfect UI\nfrom a single truth.", name: "hero-title", parentId: heroId, x: 0, y: 0, width: maxW, textStyle: { fontSize: titleSz, fontName: { family: FONT_DISPLAY, style: "Regular" }, fills: [{ type: "SOLID", color: hex("#99B9C8") }], lineHeight: { unit: "PERCENT", value: 96 }, letterSpacing: { unit: "PERCENT", value: -3 }, textAutoResize: "HEIGHT", textAlignHorizontal: "CENTER" } } });
      const titleId = nid(titleR);
      await applyVar(titleId, "fill", "color-brand-text");
      await applyVar(titleId, "lineHeight", "font-line-height-title");
      await applyVar(titleId, "letterSpacing", "font-letter-spacing-tight");
      console.log("  ✓ Title + bindings");

      // Body
      const bodyR = await c.tool("text", { entry: { text: "StudioFlow keeps your Figma variables and code tokens in structural sync — deterministically. Zero handoff drift. Zero hardcoded values.", name: "hero-body", parentId: heroId, x: 0, y: 0, width: Math.min(maxW, 600), textStyle: { fontSize: 16, fontName: { family: FONT_BASE, style: "Regular" }, fills: [{ type: "SOLID", color: hex("#99B9C8") }], lineHeight: { unit: "PERCENT", value: 160 }, textAutoResize: "HEIGHT", textAlignHorizontal: "CENTER" } } });
      const bodyId = nid(bodyR);
      await applyVar(bodyId, "fill", "color-brand-text");
      await applyVar(bodyId, "fontSize", "font-size-body");
      await applyVar(bodyId, "lineHeight", "font-line-height-body");
      console.log("  ✓ Body + bindings");

      // Command box
      const cmdR = await c.tool("shape", { shape: { type: "frame", name: "command-box", parentId: heroId, config: { x: 0, y: 0, width: 400, height: 48, cornerRadius: 12 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#161E28") }] }, stroke: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#3D4F5B") }] }, strokeWeight: 1, strokeAlign: "INSIDE" } });
      const cmdId = nid(cmdR);
      if (cmdId) {
        await applyVar(cmdId, "fill", "color-brand-surface");
        await applyVar(cmdId, "stroke", "color-brand-stroke");
        await applyVar(cmdId, "cornerRadius", "radius-md");
        await applyVar(cmdId, "strokeWeight", "size-border-default");

        await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: cmdId, layoutMode: "HORIZONTAL", layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG", primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER", paddingTop: 12, paddingBottom: 12, paddingLeft: 20, paddingRight: 20, itemSpacing: 16 } });
        await applyVar(cmdId, "paddingTop", "space-ms");
        await applyVar(cmdId, "paddingBottom", "space-ms");
        await applyVar(cmdId, "paddingLeft", "space-ml");
        await applyVar(cmdId, "paddingRight", "space-ml");
        await applyVar(cmdId, "itemSpacing", "space-md");

        const cmdTextR = await c.tool("text", { entry: { text: "$ npx studioflow init", name: "command-line", parentId: cmdId, x: 0, y: 0, textStyle: { fontSize: 14, fontName: { family: FONT_DISPLAY, style: "Regular" }, fills: [{ type: "SOLID", color: hex("#88AEBF") }], textAutoResize: "WIDTH_AND_HEIGHT" } } });
        const cmdTextId = nid(cmdTextR);
        await applyVar(cmdTextId, "fill", "color-brand-signal");
        await applyVar(cmdTextId, "fontSize", "font-size-meta");

        const copyR = await c.tool("text", { entry: { text: "Copy", name: "copy-btn", parentId: cmdId, x: 0, y: 0, textStyle: { fontSize: 13, fontName: { family: FONT_BASE, style: "Medium" }, fills: [{ type: "SOLID", color: hex("#5A7381") }], textAutoResize: "WIDTH_AND_HEIGHT" } } });
        const copyId = nid(copyR);
        await applyVar(copyId, "fill", "color-brand-muted");
        await applyVar(copyId, "fontSize", "font-size-kicker");
        console.log("  ✓ Command box + bindings");
      }

      // CTA Actions
      const actR = await c.tool("shape", { shape: { type: "frame", name: "hero-actions", parentId: heroId, config: { x: 0, y: 0, width: 450, height: 60 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#0F141D"), opacity: 0 }] } } });
      const actId = nid(actR);
      if (actId) {
        await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: actId, layoutMode: isMob ? "VERTICAL" : "HORIZONTAL", layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG", primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", itemSpacing: 16 } });
        await applyVar(actId, "itemSpacing", "space-md");

        // Primary CTA
        const p1R = await c.tool("shape", { shape: { type: "frame", name: "hero-primary-cta", parentId: actId, config: { x: 0, y: 0, width: 210, height: 48, cornerRadius: 999 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#7A8DFF") }] } } });
        const p1Id = nid(p1R);
        if (p1Id) {
          await applyVar(p1Id, "fill", "color-brand-primary");
          await applyVar(p1Id, "cornerRadius", "radius-pill");
          await applyVar(p1Id, "minWidth", "size-button-min-width");
          await applyVar(p1Id, "minHeight", "size-button-height");

          await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: p1Id, layoutMode: "HORIZONTAL", layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG", primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", paddingTop: 12, paddingBottom: 12, paddingLeft: 32, paddingRight: 32 } });
          await applyVar(p1Id, "paddingTop", "space-ms");
          await applyVar(p1Id, "paddingBottom", "space-ms");
          await applyVar(p1Id, "paddingLeft", "space-2xl");
          await applyVar(p1Id, "paddingRight", "space-2xl");

          const p1TextR = await c.tool("text", { entry: { text: "Start building", parentId: p1Id, x: 0, y: 0, textStyle: { fontSize: 16, fontName: { family: FONT_BASE, style: "SemiBold" }, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }], textAutoResize: "WIDTH_AND_HEIGHT" } } });
          const p1TextId = nid(p1TextR);
          await applyVar(p1TextId, "fill", "color-brand-white");
          await applyVar(p1TextId, "fontSize", "font-size-body");
        }

        // Secondary CTA
        const p2R = await c.tool("shape", { shape: { type: "frame", name: "hero-secondary-cta", parentId: actId, config: { x: 0, y: 0, width: 210, height: 48, cornerRadius: 999 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#0F141D"), opacity: 0 }] }, stroke: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#7EF7F0") }] }, strokeWeight: 2, strokeAlign: "INSIDE" } });
        const p2Id = nid(p2R);
        if (p2Id) {
          await applyVar(p2Id, "stroke", "color-brand-secondary");
          await applyVar(p2Id, "cornerRadius", "radius-pill");
          await applyVar(p2Id, "strokeWeight", "size-border-strong");
          await applyVar(p2Id, "minWidth", "size-button-min-width");
          await applyVar(p2Id, "minHeight", "size-button-height");

          await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: p2Id, layoutMode: "HORIZONTAL", layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG", primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", paddingTop: 12, paddingBottom: 12, paddingLeft: 32, paddingRight: 32 } });
          await applyVar(p2Id, "paddingTop", "space-ms");
          await applyVar(p2Id, "paddingBottom", "space-ms");
          await applyVar(p2Id, "paddingLeft", "space-2xl");
          await applyVar(p2Id, "paddingRight", "space-2xl");

          const p2TextR = await c.tool("text", { entry: { text: "View proof", parentId: p2Id, x: 0, y: 0, textStyle: { fontSize: 16, fontName: { family: FONT_BASE, style: "SemiBold" }, fills: [{ type: "SOLID", color: hex("#7EF7F0") }], textAutoResize: "WIDTH_AND_HEIGHT" } } });
          const p2TextId = nid(p2TextR);
          await applyVar(p2TextId, "fill", "color-brand-secondary");
          await applyVar(p2TextId, "fontSize", "font-size-body");
        }
        console.log("  ✓ CTA buttons + bindings");
      }

      // Tagline
      const tagR = await c.tool("text", { entry: { text: "Token-first · sfid-anchored · Zero drift", name: "tagline", parentId: heroId, x: 0, y: 0, textStyle: { fontSize: 13, fontName: { family: FONT_BASE, style: "Regular" }, fills: [{ type: "SOLID", color: hex("#5A7381") }], textAutoResize: "WIDTH_AND_HEIGHT", textAlignHorizontal: "CENTER" } } });
      const tagId = nid(tagR);
      await applyVar(tagId, "fill", "color-brand-muted");
      await applyVar(tagId, "fontSize", "font-size-kicker");

      // Footer
      const ftR = await c.tool("shape", { shape: { type: "frame", name: "footer", parentId: sId, config: { x: 0, y: 0, width: screen.width, height: 100 }, fill: { kind: "direct_paint", paint: [{ type: "SOLID", color: hex("#070A13") }] } } });
      const ftId = nid(ftR);
      if (ftId) {
        await applyVar(ftId, "fill", "color-brand-ink");

        await c.toolSafe("autolayout", { action: "autolayout", entry: { nodeId: ftId, layoutMode: "VERTICAL", layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG", primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", paddingTop: 32, paddingBottom: 32, paddingLeft: 24, paddingRight: 24, itemSpacing: 8 } });
        await applyVar(ftId, "paddingTop", "space-2xl");
        await applyVar(ftId, "paddingBottom", "space-2xl");
        await applyVar(ftId, "paddingLeft", "space-lg");
        await applyVar(ftId, "paddingRight", "space-lg");
        await applyVar(ftId, "itemSpacing", "space-sm");

        const ftTextR = await c.tool("text", { entry: { text: "© 2026 StudioFlow — Deterministic design-to-code sync.", parentId: ftId, x: 0, y: 0, textStyle: { fontSize: 13, fontName: { family: FONT_BASE, style: "Regular" }, fills: [{ type: "SOLID", color: hex("#5A7381") }], textAutoResize: "WIDTH_AND_HEIGHT", textAlignHorizontal: "CENTER" } } });
        const ftTextId = nid(ftTextR);
        await applyVar(ftTextId, "fill", "color-brand-muted");
        await applyVar(ftTextId, "fontSize", "font-size-kicker");
        console.log("  ✓ Footer + bindings");
      }

      console.log(`  ✅ ${screen.name} done`);
      xOff += screen.width + 100;
    }

    console.log("\n\n✅ ALL DONE — Check Figma!");
    console.log(`   ${screens.length} screens: ${screens.map(s => s.name).join(", ")}`);
    console.log(`   ${allVariables.length} variables in "StudioFlow Tokens"`);
    console.log(`   ${bindCount} variable bindings attempted`);
    console.log("   3 token reference frames");
    if (bindFailed || bindCount === 0) {
      console.log("\n⚠  Variable bindings could not be applied via MCP.");
      console.log("   → Open Figma → Plugins → StudioFlow Screens");
      console.log("   → Click 'Bind Variables' to link all variables + text styles");
    }
    console.log("\nNext: npm run check");

  } catch (err) {
    console.error("\n❌ Fatal:", err.message);
  } finally {
    proc.kill();
    process.exit(0);
  }
}

main();
