# The StudioFlow Workflow

**Version 1.2** | A Design Engineering System by **Alexander Beck Studio**

---

## The Philosophy

Design and code drift apart. It’s a law of nature on busy projects. **StudioFlow** is our system for fighting that law. It’s a practical, verifiable workflow for building products where the design you see in Figma is the code you ship, and vice-versa.

This is not a framework or a library. It’s a set of rules and automated checks that create a durable, high-fidelity bridge between your design environment and your codebase. It’s built for teams who value craft, consistency, and shipping with confidence.

## The 5 Rules of StudioFlow

These aren’t suggestions. They are the core principles of the workflow, enforced by automated scripts at every stage.

1.  **The Whole-Page Rule:** Synchronization between code and design always happens on a complete, fully-assembled page. We don’t work on floating components; we work in context.

2.  **The Token-Only Rule:** All styling—colors, spacing, fonts, shadows, etc.—comes from a central token system. Hard-coded “magic numbers” are forbidden and will fail the build.

3.  **The Stable ID Rule:** Every important UI element gets a unique, matching ID in both code and Figma. This is the unbreakable link that makes reliable round-trips possible.

4.  **The UI Contract Rule:** A component’s visual structure (the “Layout”) is strictly separated from its business logic (the “Logic”). They communicate through a formal TypeScript contract, which prevents design changes from accidentally breaking functionality.

5.  **The Audit Trail Rule:** The design’s history is versioned alongside the code. After every design change, a structural “snapshot” of the Figma file is saved to the repository, creating a permanent, diff-able record of every visual decision.

---

## Repository & Architecture

The project structure is designed to support and enforce these rules.

```
studioflow-project/
├── README.md
├── docs/
│   └── STUDIOFLOW_WORKFLOW.md
├── assets/
│   └── studioflow-logo.svg
├── tokens/
│   ├── figma-variables.json         # Raw export from Figma (DTCG format)
│   ├── tokens.css                   # Generated
│   └── tokens.ts                    # Generated
├── scripts/
│   ├── build-tokens.mjs
│   ├── verify-no-hardcoded.mjs
│   ├── verify-id-sync.mjs
│   └── verify-tokens-sync.mjs
├── src/
│   ├── components/
│   │   ├── Hero/
│   │   │   ├── HeroLayout.tsx         # UI: Structure & Style
│   │   │   ├── HeroLogic.tsx          # Logic: State & Events
│   │   │   └── Hero.contract.ts       # The UI Contract
│   │   └── ...
│   └── ...
├── snapshots/
│   └── figma-2026-02-21.json      # The Audit Trail
├── .tool-versions                     # Pins tool versions for consistency
├── studioflow.manifest.json           # The Loop's "Black Box Recorder"
└── package.json
```

### Key Architectural Components:

*   **`studioflow.manifest.json`**: Records the who, what, and when of the last completed workflow loop. It’s your first stop for debugging when something looks off.
*   **`snapshots/`**: Contains timestamped JSON exports of your Figma file’s structure. This lets you `diff` your design changes just like you `diff` code.
*   **`Component.contract.ts`**: A simple TypeScript `interface` that defines a component's public API, creating a stable contract between its appearance and its behavior.

---

## The StudioFlow Loop: A Practical Guide

This is a disciplined process with verification gates to ensure nothing is left to chance.

### **Phase 1: Foundation**

**Step A: Solidify Your Tokens**
1.  Define your design system variables (color, space, etc.) in Figma.
2.  Export them to `tokens/figma-variables.json` using a plugin that supports the **W3C DTCG format**.
3.  Run `npm run build:tokens` to compile them into CSS and TypeScript.
4.  Commit the results. This is your single source of truth for style.

**Step B: Build the Page in Code**
1.  Code the initial UI, following the rules: use tokens for all styles and assign a `data-sfid` (StudioFlow ID) to every meaningful element.
2.  Define the component’s props in its `*.contract.ts` file and implement the state and event handlers in the `*Logic.tsx` file.

### **Phase 2: Sync to Design**

**Step C: Code-to-Figma Capture**
1.  With your page running in a browser, use an MCP tool like Claude Code to send it to Figma (`“Send this to Figma”`).
2.  This creates a new, full-page frame in your Figma workspace.
3.  **Practical Fallback:** If the MCP tool fails, don’t get stuck. Use a plugin like `html.to.design` to get your UI into Figma and keep moving.

**Step D: The Naming & Validation Pass**
1.  This part is tedious but critical. In the new Figma frame, rename the layers to match the `sfid:` convention from your code.
2.  Run your **ID Validation Plugin/Script**. This tool automatically checks for any mismatches, duplicates, or orphans between the Figma layer names and the `data-sfid` attributes in your code.
3.  **Fix all errors before proceeding.** A clean validation report is your gate to the next phase.

**Step E: Design Exploration**
1.  Now that you have a validated, 1:1 copy of your code in Figma, the design team can work their magic.
2.  Explore different layouts, create responsive variants, and refine visual details, always using the established Figma variables.

**Step F: Snapshot the Design**
1.  Once the design is approved, run `npm run snapshot:figma`.
2.  This script exports the structure of the final Figma frame into the `snapshots/` directory and commits it. Your design change is now a permanent part of the project’s history.

### **Phase 3: Sync Back to Code**

**Step G: Figma-to-Code Generation**
1.  Select the final, approved frame in the Figma desktop app.
2.  In your editor, prompt the AI to regenerate the UI, referencing the design and your rules.
    > **Example Prompt:** *"Regenerate the `HeroLayout.tsx` component from the selected Figma frame. Use our design tokens, match the `sfid:` layer names to `data-sfid` attributes, and ensure the code still satisfies the `Hero.contract.ts` interface."

**Step H: Merge & Full Verification**
1.  Merge the AI-generated code into your `*Layout.tsx` file.
2.  Run the master check: `npm run check`. This single command runs the entire verification suite:
    *   It type-checks the project to ensure the UI contract isn’t broken.
    *   It runs all `verify:*` scripts to enforce the token, ID, and sync rules.
    *   It runs visual regression tests to catch any unintended pixel changes.
3.  If all checks pass, you can commit with confidence.

**Step I: Update the Manifest**
1.  Run `npm run manifest:update` to log the details of the completed loop.
2.  Commit the updated manifest. The loop is now complete and auditable.

---

## Team & Security

*   **ID Sanitization:** The `verify-id-sync` script automatically strips any non-standard characters from IDs to prevent prompt injection.
*   **Loop Locking:** For teams, use a simple `studioflow.lock` file in your repo. Before starting a loop, a developer “claims” the components they’re working on to prevent edit conflicts.
*   **Safe Tooling:** Only use trusted MCP servers and keep them enabled only when needed. Be mindful of your Figma plan’s rate limits.

    rate limits.
