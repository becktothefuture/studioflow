import fs from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  exchangePath,
  extractCodeSfids,
  loadJson,
  manifestPath,
  readWorkflowConfig,
  rootDir,
  writeJson
} from "./lib/workflow-utils.mjs";

const proofRoot = path.join(rootDir, "proof");
const historyDir = path.join(proofRoot, "history");
const latestDir = path.join(proofRoot, "latest");
const port = Number(process.env.STUDIOFLOW_PROOF_PORT || 4174);
const baseUrl = `http://127.0.0.1:${port}`;

function run(command, args, { allowFailure = false, env = {} } = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    env: { ...process.env, ...env }
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    command: `${command} ${args.join(" ")}`,
    allowFailure
  };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveProofPayloadPath(workflow) {
  const canonicalPayloadPath = exchangePath(workflow, "canvasToCode");
  const templatePayloadPath = exchangePath(workflow, "canvasToCodeTemplate");

  if (await pathExists(canonicalPayloadPath)) {
    return {
      payloadPath: canonicalPayloadPath,
      canonicalPayloadPath
    };
  }

  if (await pathExists(templatePayloadPath)) {
    return {
      payloadPath: templatePayloadPath,
      canonicalPayloadPath
    };
  }

  const bootstrap = run("npm", ["run", "loop:code-to-canvas"]);
  if (!bootstrap.ok) {
    throw new Error(`Could not prepare proof payload: ${bootstrap.command}\n${bootstrap.stderr || bootstrap.stdout || ""}`);
  }

  if (await pathExists(templatePayloadPath)) {
    return {
      payloadPath: templatePayloadPath,
      canonicalPayloadPath
    };
  }

  throw new Error("Could not find handoff/canvas-to-code.template.json after bootstrapping.");
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function listHistoryRuns() {
  try {
    const entries = await fs.readdir(historyDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

async function copyIfExists(fromPath, toPath) {
  try {
    await fs.copyFile(fromPath, toPath);
    return true;
  } catch {
    return false;
  }
}

function flattenTokenMap(input, prefix = [], output = {}) {
  for (const [key, value] of Object.entries(input ?? {})) {
    const next = [...prefix, key];
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "value")) {
      output[next.join("-")] = String(value.value);
      continue;
    }

    if (value && typeof value === "object") {
      flattenTokenMap(value, next, output);
    }
  }

  return output;
}

function buildTokenDiff(before, after) {
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changed = [];
  for (const name of names) {
    if ((before[name] ?? null) !== (after[name] ?? null)) {
      changed.push({
        name,
        before: before[name] ?? null,
        after: after[name] ?? null
      });
    }
  }
  return changed;
}

async function waitForServer(url, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // ignore while waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for preview server at ${url}`);
}

function startPreviewServer() {
  const child = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: rootDir,
    stdio: "pipe",
    env: { ...process.env }
  });

  child.stdout.on("data", () => {
    // keep process alive and avoid backpressure
  });

  child.stderr.on("data", () => {
    // keep process alive and avoid backpressure
  });

  return child;
}

async function captureScreenshots(workflow, destinationDir) {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const breakpoint of workflow.breakpoints) {
      const context = await browser.newContext({
        viewport: {
          width: Number(breakpoint.width),
          height: Number(process.env.STUDIOFLOW_PROOF_HEIGHT || 900)
        }
      });

      const page = await context.newPage();
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await page.screenshot({
        path: path.join(destinationDir, `after-${breakpoint.name}.png`),
        fullPage: true
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function overallGateStatus(gateResults) {
  return gateResults.every((gate) => gate.ok) ? "PASS" : "FAIL";
}

function renderSummaryCardHtml({
  generatedAt,
  runId,
  gateResults,
  tokenDiff,
  sfidSummary,
  provider,
  breakpointsCount
}) {
  const passCount = gateResults.filter((gate) => gate.ok).length;
  const totalCount = gateResults.length;
  const status = overallGateStatus(gateResults);
  const statusClass = status === "PASS" ? "status-pass" : "status-fail";
  const sfidParity = `${sfidSummary.codeCount - sfidSummary.missingInPayload.length}/${sfidSummary.codeCount}`;
  const evidence =
    tokenDiff.length > 0
      ? tokenDiff
          .slice(0, 3)
          .map((row) => `<li><code>${htmlEscape(row.name)}</code>: ${htmlEscape(row.before ?? "")} -> ${htmlEscape(row.after ?? "")}</li>`)
          .join("")
      : "<li>No token changes</li>";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>StudioFlow Summary Card</title>
  <style>
    :root {
      --bg: #040916;
      --panel: #0b1733;
      --text: #eaf1ff;
      --muted: #9eb3da;
      --stroke: #2e4f90;
      --good: #62f9f1;
      --danger: #ff6a93;
      --accent: #4f70ff;
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
    body {
      font-family: "Space Grotesk", "Inter", system-ui, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 10% 20%, rgba(98, 249, 241, 0.16), transparent 45%),
        radial-gradient(circle at 90% 80%, rgba(79, 112, 255, 0.24), transparent 50%),
        var(--bg);
      padding: 36px;
    }

    .card {
      width: 100%;
      height: 100%;
      border: 1px solid var(--stroke);
      border-radius: 24px;
      background: color-mix(in srgb, var(--panel) 92%, black);
      box-shadow: 0 24px 48px rgba(4, 9, 22, 0.45);
      display: grid;
      grid-template-rows: auto auto auto 1fr auto;
      gap: 14px;
      padding: 26px 28px;
    }

    .title {
      margin: 0;
      font-size: 46px;
      line-height: 1;
      letter-spacing: -0.03em;
    }

    .subline {
      margin: 0;
      font-size: 16px;
      color: var(--muted);
    }

    .status-strip {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 100px;
      border-radius: 999px;
      padding: 7px 14px;
      font-weight: 700;
      font-size: 16px;
      letter-spacing: 0.06em;
    }

    .status-pass {
      background: color-mix(in srgb, var(--good) 18%, transparent);
      border: 1px solid color-mix(in srgb, var(--good) 58%, transparent);
      color: var(--good);
    }

    .status-fail {
      background: color-mix(in srgb, var(--danger) 18%, transparent);
      border: 1px solid color-mix(in srgb, var(--danger) 58%, transparent);
      color: var(--danger);
    }

    .status-text {
      margin: 0;
      font-size: 18px;
      color: var(--text);
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .kpi {
      border: 1px solid var(--stroke);
      border-radius: 14px;
      padding: 12px;
      background: color-mix(in srgb, var(--panel) 88%, black);
    }

    .kpi-label {
      margin: 0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
    }

    .kpi-value {
      margin: 6px 0 0;
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
    }

    .evidence {
      border: 1px solid var(--stroke);
      border-radius: 14px;
      padding: 12px 14px;
      background: color-mix(in srgb, var(--panel) 88%, black);
    }

    .evidence-title {
      margin: 0 0 8px;
      font-size: 14px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .evidence ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 6px;
      font-size: 14px;
      line-height: 1.3;
    }

    code {
      color: var(--good);
      font-size: 13px;
    }

    .footer {
      margin: 0;
      font-size: 15px;
      color: var(--accent);
      letter-spacing: 0.02em;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <article class="card">
    <header>
      <h1 class="title">StudioFlow Loop Proof</h1>
      <p class="subline">${htmlEscape(generatedAt)} · ${htmlEscape(runId)}</p>
    </header>

    <section class="status-strip">
      <span class="badge ${statusClass}">${status}</span>
      <p class="status-text">Gates passed: <strong>${passCount}/${totalCount}</strong></p>
    </section>

    <section class="kpi-grid">
      <div class="kpi">
        <p class="kpi-label">Token Changes</p>
        <p class="kpi-value">${tokenDiff.length}</p>
      </div>
      <div class="kpi">
        <p class="kpi-label">SFID Parity</p>
        <p class="kpi-value">${htmlEscape(sfidParity)}</p>
      </div>
      <div class="kpi">
        <p class="kpi-label">Breakpoints</p>
        <p class="kpi-value">${breakpointsCount}</p>
      </div>
      <div class="kpi">
        <p class="kpi-label">Provider</p>
        <p class="kpi-value" style="font-size:18px;">${htmlEscape(provider)}</p>
      </div>
    </section>

    <section class="evidence">
      <h2 class="evidence-title">Evidence</h2>
      <ul>${evidence}</ul>
    </section>

    <p class="footer">Code ↔ Canvas ↔ Code, verified</p>
  </article>
</body>
</html>`;
}

async function captureSummaryCard(runDir) {
  const htmlPath = path.join(runDir, "summary-card.html");
  const pngPath = path.join(runDir, "summary-card.png");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.goto(pathToFileURL(htmlPath).toString(), { waitUntil: "load" });
    await page.screenshot({
      path: pngPath,
      type: "png",
      clip: { x: 0, y: 0, width: 1200, height: 630 }
    });
  } finally {
    await browser.close();
  }
}

function renderHtmlReport({
  generatedAt,
  gateResults,
  tokenDiff,
  sfidSummary,
  breakpoints,
  screenshotsAvailable,
  reportPath
}) {
  const gatesRows = gateResults
    .map((gate) => {
      const status = gate.ok ? "PASS" : "FAIL";
      return `<tr><td>${htmlEscape(gate.command)}</td><td>${status}</td><td><pre>${htmlEscape(gate.stderr || gate.stdout || "-")}</pre></td></tr>`;
    })
    .join("\n");

  const tokenRows = tokenDiff.length
    ? tokenDiff
        .slice(0, 200)
        .map(
          (row) =>
            `<tr><td>${htmlEscape(row.name)}</td><td>${htmlEscape(row.before ?? "")}</td><td>${htmlEscape(
              row.after ?? ""
            )}</td></tr>`
        )
        .join("\n")
    : `<tr><td colspan="3">No token changes vs previous proof baseline.</td></tr>`;

  const screenBlocks = breakpoints
    .map((bp) => {
      const before = screenshotsAvailable
        ? `<img src="./before-${bp.name}.png" alt="before ${bp.name}" />`
        : `<p>Before screenshot unavailable (first run baseline).</p>`;
      const after = screenshotsAvailable
        ? `<img src="./after-${bp.name}.png" alt="after ${bp.name}" />`
        : `<p>After screenshot unavailable.</p>`;
      return `
<section>
  <h3>${htmlEscape(bp.label)} (${bp.width}px)</h3>
  <div class="pair">
    <div><h4>Before</h4>${before}</div>
    <div><h4>After</h4>${after}</div>
  </div>
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>StudioFlow Loop Proof</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; color: #111827; }
    h1, h2, h3, h4 { margin: 0 0 8px; }
    .meta, .summary { margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
    img { width: 100%; border: 1px solid #d1d5db; border-radius: 8px; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>StudioFlow Loop Proof</h1>
  <div class="meta">
    <p><strong>Generated:</strong> ${htmlEscape(generatedAt)}</p>
    <p><strong>Report Path:</strong> <code>${htmlEscape(reportPath)}</code></p>
  </div>

  <div class="summary">
    <h2>SFID Parity Summary</h2>
    <p><strong>Code sfids:</strong> ${sfidSummary.codeCount}</p>
    <p><strong>Payload sfids:</strong> ${sfidSummary.payloadCount}</p>
    <p><strong>Missing in payload:</strong> ${sfidSummary.missingInPayload.join(", ") || "none"}</p>
    <p><strong>Missing in code:</strong> ${sfidSummary.missingInCode.join(", ") || "none"}</p>
  </div>

  <h2>Gate Results</h2>
  <table>
    <thead><tr><th>Gate</th><th>Status</th><th>Output</th></tr></thead>
    <tbody>${gatesRows}</tbody>
  </table>

  <h2>Token Diff (before vs after)</h2>
  <table>
    <thead><tr><th>Token</th><th>Before</th><th>After</th></tr></thead>
    <tbody>${tokenRows}</tbody>
  </table>

  <h2>Before/After Screenshots</h2>
  ${screenBlocks}
</body>
</html>`;
}

function renderMarkdownReport({ generatedAt, gateResults, tokenDiff, sfidSummary, runId }) {
  const gateLines = gateResults
    .map((gate) => `- ${gate.ok ? "PASS" : "FAIL"}: \`${gate.command}\``)
    .join("\n");

  const tokenLines = tokenDiff.length
    ? tokenDiff.slice(0, 50).map((diff) => `- \`${diff.name}\`: \`${diff.before}\` -> \`${diff.after}\``).join("\n")
    : "- No token changes vs previous proof baseline.";

  return `# StudioFlow Loop Proof\n\nGenerated: ${generatedAt}\nRun: ${runId}\n\n## Gate Results\n${gateLines}\n\n## SFID Parity\n- Code sfids: ${sfidSummary.codeCount}\n- Payload sfids: ${sfidSummary.payloadCount}\n- Missing in payload: ${sfidSummary.missingInPayload.join(", ") || "none"}\n- Missing in code: ${sfidSummary.missingInCode.join(", ") || "none"}\n\n## Token Diff\n${tokenLines}\n`;
}

async function main() {
  const workflow = await readWorkflowConfig();
  await ensureDir(historyDir);

  const runId = timestamp();
  const runDir = path.join(historyDir, runId);
  await ensureDir(runDir);

  const tokenPath = path.join(rootDir, "tokens", "figma-variables.json");
  const tokenAfter = await loadJson(tokenPath);

  const historyRuns = await listHistoryRuns();
  const previousRun = historyRuns.filter((entry) => entry !== runId).at(-1);

  let tokenBefore = tokenAfter;
  if (previousRun) {
    try {
      tokenBefore = await loadJson(path.join(historyDir, previousRun, "tokens-after.json"));
    } catch {
      tokenBefore = tokenAfter;
    }
  }

  await writeJson(path.join(runDir, "tokens-before.json"), tokenBefore);
  await writeJson(path.join(runDir, "tokens-after.json"), tokenAfter);

  const preview = startPreviewServer();
  let screenshotsAvailable = true;
  try {
    await waitForServer(baseUrl);
    await captureScreenshots(workflow, runDir);
  } catch (error) {
    screenshotsAvailable = false;
    await fs.writeFile(
      path.join(runDir, "screenshots-error.txt"),
      `${error instanceof Error ? error.message : String(error)}\n`,
      "utf8"
    );
  } finally {
    preview.kill("SIGTERM");
  }

  for (const breakpoint of workflow.breakpoints) {
    const beforeFile = path.join(runDir, `before-${breakpoint.name}.png`);
    if (previousRun) {
      const copied = await copyIfExists(path.join(historyDir, previousRun, `after-${breakpoint.name}.png`), beforeFile);
      if (!copied && screenshotsAvailable) {
        await copyIfExists(path.join(runDir, `after-${breakpoint.name}.png`), beforeFile);
      }
    } else if (screenshotsAvailable) {
      await copyIfExists(path.join(runDir, `after-${breakpoint.name}.png`), beforeFile);
    }
  }

  const tokenDiff = buildTokenDiff(flattenTokenMap(tokenBefore), flattenTokenMap(tokenAfter));

  const codeSfids = await extractCodeSfids();
  const { payloadPath, canonicalPayloadPath } = await resolveProofPayloadPath(workflow);
  const payload = await loadJson(payloadPath).catch(() => ({ sfids: [] }));
  const payloadSfids = Array.isArray(payload.sfids)
    ? payload.sfids.map((sfid) => String(sfid))
    : [];

  const codeSet = new Set(codeSfids);
  const payloadSet = new Set(payloadSfids);
  const sfidSummary = {
    codeCount: codeSfids.length,
    payloadCount: payloadSfids.length,
    missingInPayload: codeSfids.filter((sfid) => !payloadSet.has(sfid)),
    missingInCode: payloadSfids.filter((sfid) => !codeSet.has(sfid))
  };

  const manifest = await loadJson(manifestPath).catch(() => ({}));
  const verifyCanvasEnv =
    payloadPath === canonicalPayloadPath
      ? {}
      : { STUDIOFLOW_INPUT: path.relative(rootDir, payloadPath) };

  const gateResults = [
    run("npm", ["run", "test:contracts"]),
    run("npm", ["run", "loop:verify-canvas"], { env: verifyCanvasEnv }),
    run("npm", ["run", "verify:tokens-sync"]),
    run("npm", ["run", "verify:no-hardcoded"]),
    run("npm", ["run", "verify:id-sync"])
  ];

  const generatedAt = new Date().toISOString();
  const provider = payload?.canvasProvider || manifest?.canvasProvider || "unknown";
  const summary = {
    generatedAt,
    runId,
    previousRun: previousRun ?? null,
    screenshotsAvailable,
    summaryCardDimensions: { width: 1200, height: 630 },
    provider,
    tokenDiffCount: tokenDiff.length,
    tokenDiff,
    sfidSummary,
    gateResults
  };

  await writeJson(path.join(runDir, "summary.json"), summary);
  await fs.writeFile(path.join(runDir, "summary.md"), renderMarkdownReport({ generatedAt, gateResults, tokenDiff, sfidSummary, runId }), "utf8");
  await fs.writeFile(
    path.join(runDir, "index.html"),
    renderHtmlReport({
      generatedAt,
      gateResults,
      tokenDiff,
      sfidSummary,
      breakpoints: workflow.breakpoints,
      screenshotsAvailable,
      reportPath: `proof/history/${runId}`
    }),
    "utf8"
  );
  await fs.writeFile(
    path.join(runDir, "summary-card.html"),
    renderSummaryCardHtml({
      generatedAt,
      runId,
      gateResults,
      tokenDiff,
      sfidSummary,
      provider,
      breakpointsCount: workflow.breakpoints.length
    }),
    "utf8"
  );

  try {
    await captureSummaryCard(runDir);
  } catch (error) {
    await fs.writeFile(
      path.join(runDir, "summary-card-error.txt"),
      `${error instanceof Error ? error.message : String(error)}\n`,
      "utf8"
    );
  }

  await fs.rm(latestDir, { recursive: true, force: true });
  await fs.mkdir(latestDir, { recursive: true });
  const files = await fs.readdir(runDir);
  await Promise.all(files.map((file) => fs.copyFile(path.join(runDir, file), path.join(latestDir, file))));

  const failedGate = gateResults.find((gate) => !gate.ok);
  if (failedGate) {
    console.error(`Loop proof failed because gate failed: ${failedGate.command}`);
    process.exit(1);
  }

  console.log(`Proof report generated: proof/history/${runId}/index.html`);
  console.log("Latest proof alias: proof/latest/index.html");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
