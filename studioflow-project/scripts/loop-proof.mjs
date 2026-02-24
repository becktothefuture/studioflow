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
import {
  htmlEscape,
  overallGateStatus,
  renderSummaryCardHtml,
  renderHtmlReport,
  renderMarkdownReport
} from "./lib/proof-templates.mjs";

function parseProofArgs() {
  const args = { component: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--component" && argv[i + 1]) {
      args.component = argv[i + 1];
      i++;
    }
  }
  return args;
}

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
        deviceScaleFactor: 1,
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

async function captureComponentScreenshots(workflow, destinationDir, componentName) {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const breakpoint of workflow.breakpoints) {
      const context = await browser.newContext({
        deviceScaleFactor: 1,
        viewport: {
          width: Number(breakpoint.width),
          height: Number(process.env.STUDIOFLOW_PROOF_HEIGHT || 900)
        }
      });

      const page = await context.newPage();
      await page.goto(baseUrl, { waitUntil: "networkidle" });

      const selector = `[data-sfid^="sfid:${componentName}"]`;
      const element = await page.$(selector);

      if (element) {
        await element.screenshot({
          path: path.join(destinationDir, `after-${breakpoint.name}.png`)
        });
      } else {
        await page.screenshot({
          path: path.join(destinationDir, `after-${breakpoint.name}.png`),
          fullPage: true
        });
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
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

async function main() {
  const proofArgs = parseProofArgs();
  const workflow = await readWorkflowConfig();
  await ensureDir(historyDir);

  const componentSuffix = proofArgs.component ? `-${proofArgs.component}` : "";
  const runId = `${timestamp()}${componentSuffix}`;
  const runDir = path.join(historyDir, runId);
  await ensureDir(runDir);

  const screenshotDir = proofArgs.component
    ? path.join(runDir, proofArgs.component)
    : runDir;
  if (proofArgs.component) {
    await ensureDir(screenshotDir);
  }

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
    if (proofArgs.component) {
      await captureComponentScreenshots(workflow, screenshotDir, proofArgs.component);
    } else {
      await captureScreenshots(workflow, runDir);
    }
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
    component: proofArgs.component ?? null,
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
      reportPath: `proof/history/${runId}`,
      component: proofArgs.component ?? null
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

  if (proofArgs.component) {
    const componentLatest = path.join(latestDir, proofArgs.component);
    await fs.mkdir(componentLatest, { recursive: true });
    const componentFiles = await fs.readdir(screenshotDir);
    await Promise.all(componentFiles.map((file) =>
      fs.copyFile(path.join(screenshotDir, file), path.join(componentLatest, file))
    ));
  }

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
