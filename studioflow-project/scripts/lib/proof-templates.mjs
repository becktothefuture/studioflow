export function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function overallGateStatus(gateResults) {
  return gateResults.every((gate) => gate.ok) ? "PASS" : "FAIL";
}

export function renderSummaryCardHtml({
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
      --bg: #050912;
      --panel: #0d1620;
      --text: #f6fbfd;
      --muted: #c0d2da;
      --stroke: #35515d;
      --good: #99bac8;
      --danger: #ff6a93;
      --accent: #d6e5eb;
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
    body {
      font-family: "Space Grotesk", "Inter", system-ui, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 10% 20%, rgba(153, 186, 200, 0.25), transparent 45%),
        radial-gradient(circle at 90% 80%, rgba(153, 186, 200, 0.14), transparent 50%),
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

export function renderHtmlReport({
  generatedAt,
  gateResults,
  tokenDiff,
  sfidSummary,
  breakpoints,
  screenshotsAvailable,
  reportPath
}) {
  const passCount = gateResults.filter((gate) => gate.ok).length;
  const totalCount = gateResults.length;
  const overallStatus = overallGateStatus(gateResults);

  const gatesRows = gateResults
    .map((gate) => {
      const status = gate.ok ? "PASS" : "FAIL";
      return `<tr><td>${htmlEscape(gate.command)}</td><td class="${gate.ok ? "pass" : "fail"}">${status}</td><td><pre>${htmlEscape(
        gate.stderr || gate.stdout || "-"
      )}</pre></td></tr>`;
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

  const breakpointTabs = breakpoints
    .map(
      (bp, index) =>
        `<button type="button" class="bp-tab${index === 0 ? " active" : ""}" data-breakpoint="${htmlEscape(bp.name)}">${htmlEscape(
          bp.label
        )} <span>${bp.width}px</span></button>`
    )
    .join("\n");

  const screenPanels = breakpoints
    .map((bp) => {
      const before = screenshotsAvailable
        ? `<img src="./before-${bp.name}.png" alt="before ${bp.name}" loading="lazy" decoding="async" />`
        : `<p>Before screenshot unavailable (first run baseline).</p>`;
      const after = screenshotsAvailable
        ? `<img src="./after-${bp.name}.png" alt="after ${bp.name}" loading="lazy" decoding="async" />`
        : `<p>After screenshot unavailable.</p>`;
      return `
<section class="bp-panel" data-breakpoint-panel="${htmlEscape(bp.name)}">
  <div class="pair">
    <article class="shot-card">
      <div class="shot-head">
        <h4>Before</h4>
        <p class="shot-meta">Native size pending...</p>
      </div>
      <div class="shot-frame">${before}</div>
    </article>
    <article class="shot-card">
      <div class="shot-head">
        <h4>After</h4>
        <p class="shot-meta">Native size pending...</p>
      </div>
      <div class="shot-frame">${after}</div>
    </article>
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
    @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Xanh+Mono:ital@0;1&display=swap");

    :root {
      --color-brand-ink: #070A13;
      --color-brand-signal: #88AEBF;
      --color-brand-bg: color-mix(in srgb, var(--color-brand-ink) 94%, var(--color-brand-signal));
      --color-brand-surface: color-mix(in srgb, var(--color-brand-ink) 88%, var(--color-brand-signal));
      --color-brand-panel: color-mix(in srgb, var(--color-brand-ink) 82%, var(--color-brand-signal));
      --color-brand-text: color-mix(in srgb, var(--color-brand-signal) 86%, white);
      --color-brand-muted: color-mix(in srgb, var(--color-brand-signal) 64%, var(--color-brand-ink));
      --color-brand-stroke: color-mix(in srgb, var(--color-brand-signal) 42%, var(--color-brand-ink));
      --color-brand-stroke-strong: color-mix(in srgb, var(--color-brand-signal) 70%, var(--color-brand-ink));
      --color-brand-primary: #7A8DFF;
      --color-brand-fail: #ff789f;

      --bg: var(--color-brand-bg);
      --panel: var(--color-brand-panel);
      --panel-soft: var(--color-brand-surface);
      --signal: var(--color-brand-signal);
      --text: var(--color-brand-text);
      --muted: var(--color-brand-muted);
      --stroke: var(--color-brand-stroke);
      --stroke-strong: var(--color-brand-stroke-strong);
      --fail: var(--color-brand-fail);
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      font-family: "Space Grotesk", "Inter", system-ui, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 10% 8%, color-mix(in srgb, var(--color-brand-primary) 24%, transparent), transparent 42%),
        radial-gradient(circle at 88% 86%, color-mix(in srgb, var(--signal) 18%, transparent), transparent 46%),
        var(--bg);
      padding: 12px;
    }

    .page {
      max-width: 1680px;
      margin: 0 auto;
      height: calc(100vh - 24px);
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      gap: 10px;
      border: 1px solid var(--stroke);
      border-radius: 16px;
      background: color-mix(in srgb, var(--panel) 92%, black);
      box-shadow: 0 22px 42px rgba(1, 4, 10, 0.42);
      padding: 12px;
      overflow: hidden;
    }

    h1, h2, h3, h4 { margin: 0; }
    p { margin: 0; }

    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .title {
      font-family: "Xanh Mono", "Space Grotesk", monospace;
      font-size: clamp(1.2rem, 1.8vw, 1.7rem);
      letter-spacing: -0.03em;
      line-height: 1.02;
    }

    .subtitle {
      color: var(--muted);
      margin-top: 3px;
      font-size: 0.82rem;
    }

    .path {
      background: color-mix(in srgb, var(--signal) 12%, transparent);
      border: 1px solid var(--stroke);
      border-radius: 999px;
      padding: 4px 9px;
      font-size: 0.74rem;
      color: var(--signal);
      max-width: 100%;
      white-space: nowrap;
      overflow: auto;
      scrollbar-width: thin;
    }

    .signal-strip {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 7px;
    }

    .chip {
      border: 1px solid var(--stroke);
      border-radius: 10px;
      background: color-mix(in srgb, var(--panel-soft) 84%, black);
      padding: 8px 9px;
      min-height: 56px;
    }

    .chip-label {
      font-size: 0.68rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .chip-value {
      margin-top: 4px;
      font-size: 1rem;
      font-weight: 700;
    }

    .chip-value.pass { color: var(--signal); }
    .chip-value.fail { color: var(--fail); }

    .workbench {
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(290px, 340px);
      gap: 10px;
    }

    .proof-stage {
      min-height: 0;
      border: 1px solid var(--stroke);
      border-radius: 12px;
      background: color-mix(in srgb, var(--panel-soft) 88%, black);
      padding: 8px;
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      gap: 8px;
    }

    .stage-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .stage-note {
      color: var(--muted);
      font-size: 0.8rem;
      letter-spacing: 0.01em;
    }

    .tab-list {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .bp-tab {
      border: 1px solid var(--stroke);
      background: rgba(10, 20, 30, 0.8);
      color: var(--text);
      border-radius: 999px;
      padding: 6px 10px;
      font-weight: 600;
      font-size: 0.8rem;
      cursor: pointer;
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }

    .bp-tab span {
      color: var(--muted);
      font-size: 0.68rem;
      font-weight: 500;
    }

    .bp-tab.active {
      color: var(--bg);
      background: var(--signal);
      border-color: color-mix(in srgb, var(--signal) 70%, black);
    }

    .bp-tab.active span { color: #0b1a22; }
    .bp-panels { min-height: 0; }
    .bp-panel { display: none; height: 100%; }
    .bp-panel.active { display: block; }

    .pair {
      height: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      min-height: 0;
    }

    .shot-card {
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      border: 1px solid var(--stroke);
      border-radius: 10px;
      background: color-mix(in srgb, var(--panel-soft) 80%, black);
      padding: 7px;
    }

    .shot-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 4px;
    }

    .shot-card h4 {
      font-size: 0.74rem;
      color: var(--signal);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .shot-meta {
      font-size: 0.72rem;
      color: var(--muted);
      white-space: nowrap;
    }

    .shot-frame {
      border: 1px solid color-mix(in srgb, var(--stroke-strong) 80%, black);
      border-radius: 8px;
      background: #03070f;
      overflow: auto;
      min-height: 0;
      height: 100%;
      padding: 7px;
      scrollbar-color: color-mix(in srgb, var(--signal) 60%, transparent) rgba(4, 10, 18, 0.8);
    }

    .shot-frame img {
      display: block;
      width: auto;
      height: auto;
      max-width: none;
      max-height: none;
      object-fit: none;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, var(--signal) 26%, black);
      box-shadow: 0 10px 18px rgba(0, 0, 0, 0.32);
      image-rendering: crisp-edges;
    }

    .shot-frame p {
      color: var(--muted);
      font-size: 0.84rem;
      margin: 0;
    }

    .deep-data {
      display: grid;
      grid-template-rows: repeat(3, minmax(0, 1fr));
      gap: 7px;
      min-height: 0;
      overflow: auto;
      padding-right: 2px;
    }

    details {
      border: 1px solid var(--stroke);
      border-radius: 10px;
      background: color-mix(in srgb, var(--panel) 88%, black);
      overflow: hidden;
      min-height: 0;
    }

    summary {
      cursor: pointer;
      padding: 8px 10px;
      font-weight: 600;
      color: var(--signal);
      letter-spacing: 0.02em;
      list-style: none;
      font-size: 0.82rem;
    }

    summary::-webkit-details-marker { display: none; }

    .detail-body {
      border-top: 1px solid var(--stroke);
      padding: 8px;
      max-height: 28vh;
      overflow: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
    }

    th, td {
      border: 1px solid var(--stroke);
      padding: 6px;
      vertical-align: top;
      text-align: left;
    }

    th {
      color: var(--signal);
      background: rgba(153, 186, 200, 0.18);
      position: sticky;
      top: 0;
      z-index: 1;
    }

    td.pass { color: var(--signal); font-weight: 700; }
    td.fail { color: var(--fail); font-weight: 700; }

    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--muted);
      font-size: 0.75rem;
    }

    code {
      background: rgba(153, 186, 200, 0.18);
      color: var(--signal);
      border: 1px solid var(--stroke);
      border-radius: 6px;
      padding: 2px 6px;
      font-size: 0.74rem;
    }

    @media (max-width: 1380px) {
      .workbench { grid-template-columns: 1fr; }
      .deep-data {
        overflow: visible;
        grid-template-rows: none;
      }
      .detail-body { max-height: 34vh; }
    }

    @media (max-width: 1140px) {
      body { padding: 10px; }
      .page {
        min-height: unset;
        height: auto;
      }
      .signal-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .pair { grid-template-columns: 1fr; }
      .proof-stage { min-height: 60vh; }
      .shot-frame { max-height: 56vh; }
      .path { border-radius: 10px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div>
        <h1 class="title">StudioFlow Loop Proof</h1>
        <p class="subtitle">Generated ${htmlEscape(generatedAt)}</p>
      </div>
      <p class="path"><code>${htmlEscape(reportPath)}</code></p>
    </header>

    <section class="signal-strip">
      <article class="chip">
        <p class="chip-label">Overall Status</p>
        <p class="chip-value ${overallStatus === "PASS" ? "pass" : "fail"}">${overallStatus}</p>
      </article>
      <article class="chip">
        <p class="chip-label">Gates</p>
        <p class="chip-value">${passCount}/${totalCount}</p>
      </article>
      <article class="chip">
        <p class="chip-label">Token Diff</p>
        <p class="chip-value">${tokenDiff.length}</p>
      </article>
      <article class="chip">
        <p class="chip-label">SFID Parity</p>
        <p class="chip-value">${sfidSummary.codeCount - sfidSummary.missingInPayload.length}/${sfidSummary.codeCount}</p>
      </article>
      <article class="chip">
        <p class="chip-label">Missing IDs</p>
        <p class="chip-value">${sfidSummary.missingInPayload.length + sfidSummary.missingInCode.length}</p>
      </article>
    </section>

    <section class="workbench">
      <section class="proof-stage">
        <div class="stage-header">
          <h2>Breakpoint Capture</h2>
          <p class="stage-note">Native 1:1 pixels. Scroll inside each frame to inspect.</p>
        </div>
        <div class="tab-list">${breakpointTabs}</div>
        <div class="bp-panels">${screenPanels}</div>
      </section>

      <aside class="deep-data">
        <details>
          <summary>Gate Results</summary>
          <div class="detail-body">
            <table>
              <thead><tr><th>Gate</th><th>Status</th><th>Output</th></tr></thead>
              <tbody>${gatesRows}</tbody>
            </table>
          </div>
        </details>

        <details>
          <summary>Token Diff (before vs after)</summary>
          <div class="detail-body">
            <table>
              <thead><tr><th>Token</th><th>Before</th><th>After</th></tr></thead>
              <tbody>${tokenRows}</tbody>
            </table>
          </div>
        </details>

        <details>
          <summary>SFID Delta</summary>
          <div class="detail-body">
            <p><strong>Code sfids:</strong> ${sfidSummary.codeCount}</p>
            <p><strong>Payload sfids:</strong> ${sfidSummary.payloadCount}</p>
            <p><strong>Missing in payload:</strong> ${htmlEscape(sfidSummary.missingInPayload.join(", ") || "none")}</p>
            <p><strong>Missing in code:</strong> ${htmlEscape(sfidSummary.missingInCode.join(", ") || "none")}</p>
          </div>
        </details>
      </aside>
    </section>
  </main>

  <script>
    (() => {
      const tabs = Array.from(document.querySelectorAll(".bp-tab"));
      const panels = Array.from(document.querySelectorAll(".bp-panel"));
      const shotCards = Array.from(document.querySelectorAll(".shot-card"));

      const activate = (name) => {
        tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.breakpoint === name));
        panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.breakpointPanel === name));
      };

      const lockNativeShotSize = () => {
        shotCards.forEach((card) => {
          const image = card.querySelector("img");
          const meta = card.querySelector(".shot-meta");

          if (!image) {
            if (meta) meta.textContent = "No capture";
            return;
          }

          const applyNativeSize = () => {
            if (!image.naturalWidth || !image.naturalHeight) return;
            image.style.width = image.naturalWidth + "px";
            image.style.height = image.naturalHeight + "px";
            if (meta) meta.textContent = image.naturalWidth + " x " + image.naturalHeight + "px";
          };

          if (image.complete) {
            applyNativeSize();
            return;
          }

          image.addEventListener("load", applyNativeSize, { once: true });
        });
      };

      tabs.forEach((tab) => {
        tab.addEventListener("click", () => activate(tab.dataset.breakpoint || ""));
      });

      if (tabs.length > 0) {
        activate(tabs[0].dataset.breakpoint || "");
      }

      lockNativeShotSize();
    })();
  </script>
</body>
</html>`;
}

export function renderMarkdownReport({ generatedAt, gateResults, tokenDiff, sfidSummary, runId }) {
  const gateLines = gateResults
    .map((gate) => `- ${gate.ok ? "PASS" : "FAIL"}: \`${gate.command}\``)
    .join("\n");

  const tokenLines = tokenDiff.length
    ? tokenDiff.slice(0, 50).map((diff) => `- \`${diff.name}\`: \`${diff.before}\` -> \`${diff.after}\``).join("\n")
    : "- No token changes vs previous proof baseline.";

  return `# StudioFlow Loop Proof\n\nGenerated: ${generatedAt}\nRun: ${runId}\n\n## Gate Results\n${gateLines}\n\n## SFID Parity\n- Code sfids: ${sfidSummary.codeCount}\n- Payload sfids: ${sfidSummary.payloadCount}\n- Missing in payload: ${sfidSummary.missingInPayload.join(", ") || "none"}\n- Missing in code: ${sfidSummary.missingInCode.join(", ") || "none"}\n\n## Token Diff\n${tokenLines}\n`;
}
