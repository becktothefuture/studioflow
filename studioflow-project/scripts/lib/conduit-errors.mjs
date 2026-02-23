export const CONDUIT_ERROR_TAXONOMY = {
  SF_SOURCE_INVALID: {
    code: "SF_SOURCE_INVALID",
    title: "Payload source is invalid",
    cause: "The incoming payload is not marked as figma-canvas/figma.",
    fastestFix: "Set payload.source to \"figma-canvas\" and re-export from Figma.",
    safeFallback: "Run `npm run loop:code-to-canvas` to regenerate a fresh baseline payload.",
    matchers: ["Expected source to be one of"]
  },
  SF_MODE_MISMATCH: {
    code: "SF_MODE_MISMATCH",
    title: "Mode set is incomplete or mismatched",
    cause: "One or more required breakpoint modes are missing or have incorrect widths.",
    fastestFix: "Re-export all four modes (mobile/tablet/laptop/desktop) from Figma.",
    safeFallback: "Use `npm run loop:code-to-canvas` to re-seed required modes before re-export.",
    matchers: ["Missing variable modes", "Mode width mismatch"]
  },
  SF_SFID_NOT_FOUND: {
    code: "SF_SFID_NOT_FOUND",
    title: "Required sfid is missing",
    cause: "Payload sfids do not match source `data-sfid` anchors.",
    fastestFix: "Restore missing `data-sfid` anchors and export payload again.",
    safeFallback: "Run `npm run verify:id-sync` to identify the exact missing anchor.",
    matchers: ["Payload sfids missing code IDs", "Screen ", " is missing sfids"]
  },
  SF_TOKEN_FRAME_MISSING: {
    code: "SF_TOKEN_FRAME_MISSING",
    title: "Token frame coverage is incomplete",
    cause: "Required token frame names or frame token assignments are missing.",
    fastestFix: "Regenerate handoff with `npm run conduit:generate`.",
    safeFallback: "Ensure `studioflow.workflow.json` tokenFrames matches payload frame names.",
    matchers: ["Missing token frames", "Token frames are missing token names"]
  },
  SF_TOKEN_MODE_VALUE_MISSING: {
    code: "SF_TOKEN_MODE_VALUE_MISSING",
    title: "Token value missing for one or more modes",
    cause: "A required token was not exported in every breakpoint mode.",
    fastestFix: "Re-export variables from Figma after confirming all tokens exist in each mode.",
    safeFallback: "Run `npm run verify:tokens-sync` and then regenerate payload.",
    matchers: ["is missing token values"]
  },
  SF_SCREEN_MISMATCH: {
    code: "SF_SCREEN_MISMATCH",
    title: "Screen metadata does not match workflow",
    cause: "One or more screens are missing or have name/width mismatch.",
    fastestFix: "Recreate screens from plugin defaults and re-export payload.",
    safeFallback: "Regenerate baseline with `npm run conduit:generate` and sync screens again.",
    matchers: ["Missing screen for breakpoint", "Screen name mismatch", "Screen width mismatch", "usesOnlyTokens=true"]
  },
  SF_STYLE_APPLY_FAILED: {
    code: "SF_STYLE_APPLY_FAILED",
    title: "Style layer apply failed",
    cause: "Style mapping in conduit references missing styles or unsupported properties.",
    fastestFix: "Re-run plugin apply and verify style names in conduit `styleLayer`.",
    safeFallback: "Proceed with token bindings only and mark style layer as resolved fallback.",
    matchers: ["style creation failed", "style apply failed"]
  },
  SF_PREVIEW_STALE: {
    code: "SF_PREVIEW_STALE",
    title: "Preview artifact is stale",
    cause: "The conduit payload changed after preview, so commit no longer matches reviewed output.",
    fastestFix: "Run `npm run conduit:preview` again, then commit using the new run ID.",
    safeFallback: "Do not commit stale preview data; regenerate preview to restore determinism.",
    matchers: ["Preview runId mismatch", "preview hash mismatch"]
  },
  SF_CONTEXT_STALE: {
    code: "SF_CONTEXT_STALE",
    title: "Band context is stale",
    cause: "Shared Cursor/Figma selection context expired and may no longer represent intended target.",
    fastestFix: "Refresh context in Figma selection or rerun preview with `--screen`/`--sfid`.",
    safeFallback: "Continue without Band Mode only after explicit manual target verification.",
    matchers: ["context stale"]
  },
  SF_PREVIEW_GATE_FAILED: {
    code: "SF_PREVIEW_GATE_FAILED",
    title: "Preview quality gates failed",
    cause: "A required quality gate failed while preparing preview output.",
    fastestFix: "Run `npm run check` and resolve the first reported failure.",
    safeFallback: "Use `npm run conduit:doctor -- --code SF_PREVIEW_GATE_FAILED` for recovery guidance.",
    matchers: ["Preview quality gates failed"]
  },
  SF_COMMIT_GATE_FAILED: {
    code: "SF_COMMIT_GATE_FAILED",
    title: "Commit quality gates failed",
    cause: "Pre-commit verification failed, so commit could not be finalized safely.",
    fastestFix: "Run `npm run check` and fix all failing gates before retrying commit.",
    safeFallback: "Re-run preview to get a fresh deterministic baseline before commit.",
    matchers: ["Commit blocked due to failed quality gates"]
  },
  SF_CONTRACT_INVALID: {
    code: "SF_CONTRACT_INVALID",
    title: "Payload failed contract validation",
    cause: "Payload structure does not satisfy the canvas exchange contract.",
    fastestFix: "Fix the first listed validation error and rerun verification.",
    safeFallback: "Regenerate payload using `npm run conduit:generate` and repeat export.",
    matchers: []
  }
};

export function classifyConduitError(message) {
  for (const entry of Object.values(CONDUIT_ERROR_TAXONOMY)) {
    if (entry.matchers.some((matcher) => message.includes(matcher))) {
      return entry;
    }
  }
  return CONDUIT_ERROR_TAXONOMY.SF_CONTRACT_INVALID;
}

export function formatConduitValidationError(message) {
  const entry = classifyConduitError(message);
  return `[${entry.code}] ${message}\n  fastestFix: ${entry.fastestFix}\n  safeFallback: ${entry.safeFallback}`;
}
