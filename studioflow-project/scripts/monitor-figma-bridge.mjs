import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const runtimeDir = path.join(rootDir, ".bridge-monitor");
const pidPath = path.join(runtimeDir, "figma-bridge-monitor.pid.json");
const statePath = path.join(runtimeDir, "figma-bridge-monitor.state.json");
const logPath = path.join(runtimeDir, "figma-bridge-monitor.log");

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseArgs(argv) {
  const options = {
    action: "run",
    daemon: false,
    once: false,
    intervalSec: parsePositiveInt(process.env.STUDIOFLOW_MONITOR_INTERVAL, 60),
    deepEvery: parsePositiveInt(process.env.STUDIOFLOW_MONITOR_DEEP_EVERY, 5),
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--spawn") {
      options.action = "spawn";
      continue;
    }
    if (arg === "--stop") {
      options.action = "stop";
      continue;
    }
    if (arg === "--status") {
      options.action = "status";
      continue;
    }
    if (arg === "--once") {
      options.once = true;
      continue;
    }
    if (arg === "--daemon") {
      options.daemon = true;
      continue;
    }

    if (arg === "--interval" && argv[i + 1]) {
      options.intervalSec = parsePositiveInt(argv[i + 1], options.intervalSec);
      i += 1;
      continue;
    }
    if (arg.startsWith("--interval=")) {
      options.intervalSec = parsePositiveInt(arg.split("=", 2)[1], options.intervalSec);
      continue;
    }

    if (arg === "--deep-every" && argv[i + 1]) {
      options.deepEvery = parsePositiveInt(argv[i + 1], options.deepEvery);
      i += 1;
      continue;
    }
    if (arg.startsWith("--deep-every=")) {
      options.deepEvery = parsePositiveInt(arg.split("=", 2)[1], options.deepEvery);
    }
  }

  return options;
}

function printHelp() {
  console.log("StudioFlow Figma bridge monitor");
  console.log("");
  console.log("Usage:");
  console.log("  npm run monitor:figma-bridge");
  console.log("  npm run monitor:figma-bridge -- --once");
  console.log("  npm run monitor:figma-bridge:start -- --interval 60 --deep-every 5");
  console.log("  npm run monitor:figma-bridge:status");
  console.log("  npm run monitor:figma-bridge:stop");
  console.log("");
  console.log("Flags:");
  console.log("  --interval <sec>      quick check frequency (default: 60)");
  console.log("  --deep-every <count>  deep check cadence in cycles (default: 5)");
  console.log("  --once                run one cycle and exit");
  console.log("  --spawn               run detached in background");
  console.log("  --status              show monitor status");
  console.log("  --stop                stop detached monitor");
}

async function ensureRuntimeDir() {
  await fsp.mkdir(runtimeDir, { recursive: true });
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function truncateOutput(text, maxChars = 600) {
  const output = String(text || "").trim();
  if (!output) return "";
  if (output.length <= maxChars) return output;
  return `${output.slice(0, maxChars)}...`;
}

function runCommand(command, args, { timeoutMs = 180_000 } = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    timeout: timeoutMs,
    env: { ...process.env }
  });

  return {
    command: `${command} ${args.join(" ")}`,
    status: result.status,
    ok: result.status === 0,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    error: result.error ? String(result.error.message || result.error) : ""
  };
}

function runQuickCheck() {
  const result = runCommand("npm", ["run", "--silent", "check:mcp"], { timeoutMs: 60_000 });
  const detail = truncateOutput(result.stderr || result.stdout || result.error);
  return { ...result, label: "quick", detail };
}

function runDeepCheck() {
  const result = runCommand("npm", ["run", "--silent", "check:figma-bridge"], { timeoutMs: 240_000 });
  const detail = truncateOutput(result.stderr || result.stdout || result.error);
  return { ...result, label: "deep", detail };
}

function formatPassFail(ok) {
  return ok ? "PASS" : "FAIL";
}

function shouldRunDeep(cycle, deepEvery) {
  return cycle === 1 || cycle % deepEvery === 0;
}

async function runCycle(context) {
  const now = new Date();
  const quick = runQuickCheck();
  const deepDue = shouldRunDeep(context.cycle, context.deepEvery);
  const deep = deepDue ? runDeepCheck() : null;

  if (deep) {
    context.lastDeepOk = deep.ok;
  }

  const effectiveDeepOk = context.lastDeepOk !== false;
  const overallOk = quick.ok && effectiveDeepOk;
  context.failStreak = overallOk ? 0 : context.failStreak + 1;

  const deepStatus = deep ? formatPassFail(deep.ok) : effectiveDeepOk ? "SKIP" : "STALE-FAIL";
  const line =
    `[${now.toISOString()}] quick=${formatPassFail(quick.ok)} ` +
    `deep=${deepStatus} overall=${formatPassFail(overallOk)} ` +
    `failStreak=${context.failStreak}`;

  console.log(line);

  let lastError = null;
  if (!overallOk) {
    const failed = !quick.ok ? quick : deep || { detail: "Most recent deep check failed." };
    lastError = failed.detail || "Unknown bridge monitor error.";
    if (lastError) {
      console.log(`  detail: ${lastError.split("\n")[0]}`);
    }
  }

  await writeJson(statePath, {
    updatedAt: now.toISOString(),
    cycle: context.cycle,
    intervalSec: context.intervalSec,
    deepEvery: context.deepEvery,
    quick: {
      ok: quick.ok,
      status: quick.status,
      command: quick.command
    },
    deep: deep
      ? {
          ran: true,
          ok: deep.ok,
          status: deep.status,
          command: deep.command
        }
      : {
          ran: false,
          ok: effectiveDeepOk,
          status: null,
          command: "npm run --silent check:figma-bridge"
        },
    overallOk,
    failStreak: context.failStreak,
    lastError
  });

  return overallOk;
}

function cleanupPidFileForCurrentProcess() {
  try {
    if (!fs.existsSync(pidPath)) return;
    const raw = fs.readFileSync(pidPath, "utf8");
    const current = JSON.parse(raw);
    if (current?.pid === process.pid) {
      fs.unlinkSync(pidPath);
    }
  } catch {
    // best-effort cleanup
  }
}

async function runMonitor(options) {
  await ensureRuntimeDir();
  const context = {
    cycle: 0,
    intervalSec: options.intervalSec,
    deepEvery: options.deepEvery,
    failStreak: 0,
    lastDeepOk: true
  };

  if (options.daemon) {
    await writeJson(pidPath, {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      intervalSec: options.intervalSec,
      deepEvery: options.deepEvery
    });
    process.on("exit", cleanupPidFileForCurrentProcess);
  }

  let keepRunning = true;
  process.on("SIGINT", () => {
    keepRunning = false;
  });
  process.on("SIGTERM", () => {
    keepRunning = false;
  });

  while (keepRunning) {
    context.cycle += 1;
    const ok = await runCycle(context);
    if (options.once) {
      process.exit(ok ? 0 : 1);
    }
    await new Promise((resolve) => setTimeout(resolve, options.intervalSec * 1000));
  }
}

async function spawnMonitor(options) {
  await ensureRuntimeDir();

  const existing = await readJsonIfExists(pidPath);
  if (existing?.pid && isProcessRunning(existing.pid)) {
    console.log(`Bridge monitor already running (pid ${existing.pid}).`);
    console.log(`Status: npm run monitor:figma-bridge:status`);
    return;
  }

  const outFd = fs.openSync(logPath, "a");
  const args = [
    path.join("scripts", "monitor-figma-bridge.mjs"),
    "--daemon",
    "--interval",
    String(options.intervalSec),
    "--deep-every",
    String(options.deepEvery)
  ];

  const child = spawn(process.execPath, args, {
    cwd: rootDir,
    env: { ...process.env },
    detached: true,
    stdio: ["ignore", outFd, outFd]
  });

  child.unref();
  fs.closeSync(outFd);

  await writeJson(pidPath, {
    pid: child.pid,
    startedAt: new Date().toISOString(),
    intervalSec: options.intervalSec,
    deepEvery: options.deepEvery
  });

  console.log(`Started bridge monitor (pid ${child.pid}).`);
  console.log(`Log file: ${path.relative(rootDir, logPath)}`);
  console.log(`Status: npm run monitor:figma-bridge:status`);
}

async function stopMonitor() {
  const existing = await readJsonIfExists(pidPath);
  if (!existing?.pid) {
    console.log("Bridge monitor is not running.");
    return;
  }

  if (!isProcessRunning(existing.pid)) {
    await fsp.rm(pidPath, { force: true });
    console.log("Removed stale bridge monitor pid file.");
    return;
  }

  process.kill(existing.pid, "SIGTERM");
  const timeoutAt = Date.now() + 5000;
  while (Date.now() < timeoutAt && isProcessRunning(existing.pid)) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (isProcessRunning(existing.pid)) {
    process.kill(existing.pid, "SIGKILL");
  }

  await fsp.rm(pidPath, { force: true });
  console.log(`Stopped bridge monitor (pid ${existing.pid}).`);
}

async function monitorStatus() {
  const [existing, state] = await Promise.all([readJsonIfExists(pidPath), readJsonIfExists(statePath)]);
  const running = Boolean(existing?.pid && isProcessRunning(existing.pid));

  if (running) {
    console.log(`Bridge monitor: RUNNING (pid ${existing.pid})`);
  } else {
    console.log("Bridge monitor: STOPPED");
  }

  if (state) {
    console.log(`Last update: ${state.updatedAt}`);
    console.log(
      `Last result: quick=${formatPassFail(Boolean(state.quick?.ok))} deep=${state.deep?.ran ? formatPassFail(Boolean(state.deep?.ok)) : "SKIP"} overall=${formatPassFail(Boolean(state.overallOk))}`
    );
    console.log(`Fail streak: ${state.failStreak ?? 0}`);
    if (state.lastError) {
      console.log(`Last error: ${String(state.lastError).split("\n")[0]}`);
    }
  } else {
    console.log("No state yet. Start monitor or run once first.");
  }

  console.log(`State file: ${path.relative(rootDir, statePath)}`);
  console.log(`Log file: ${path.relative(rootDir, logPath)}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (options.action === "spawn") {
    await spawnMonitor(options);
    return;
  }
  if (options.action === "stop") {
    await stopMonitor();
    return;
  }
  if (options.action === "status") {
    await monitorStatus();
    return;
  }

  await runMonitor(options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
