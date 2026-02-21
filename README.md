# StudioFlow

**StudioFlow** is a practical workflow for creating a high-fidelity, verifiable bridge between your code and your Figma designs. It’s a set of rules and scripts that help you fight design-to-code drift and ship with confidence.

It is **not** a magic, no-code solution. It’s a **code-first** process for teams who value craft and discipline.

<br>
<div align="center">
  <img src="./assets/divider.png" alt="Decorative Divider" width="700">
</div>
<br>


## If you're totally new: what this is (plain English)

Think of StudioFlow as a **quality-control system between Figma and code**.

Most teams have this problem:
- Designers update Figma
- Developers update code
- After a few days, they no longer match

StudioFlow fixes that with **rules + scripts + a repeatable loop**.

### What it entails (the moving parts)

You are using 4 things together:

1. **Figma file**
   - The place where designs are explored and approved.
2. **Codebase (React/TS here)**
   - The place where the real product is built.
3. **Design tokens**
   - Shared values (colors, spacing, type sizes) used by both Figma and code, so style stays consistent.
4. **Verification scripts**
   - Automated checks that fail when someone hardcodes styles, breaks ID mapping, or drifts from tokens.

### How this helps you (concrete benefits)

- **Less rework:** fewer "this looks different from Figma" rounds.
- **Safer changes:** scripts catch mistakes before merge.
- **Faster onboarding:** new teammates follow one documented loop instead of guessing.
- **Traceability:** snapshots + manifest show what changed and when.

### In one sentence

StudioFlow is a **disciplined design-to-code workflow** where Figma is the visual source of approval, code is the shipped reality, and scripts continuously keep them aligned.

## The Core Idea: A Verifiable Loop

The goal is to make the relationship between code and design explicit and testable. StudioFlow is built around a decisive loop where **Figma is the approval source** and **CodeCode is the default implementation path**.

<div align="center">
  <img src="./assets/workflow-diagram.png" alt="StudioFlow Workflow Diagram: A circular loop showing BUILD → TOKENS → SYNC → DESIGN → REFINE → MERGE" width="500">
</div>

### How does it work?

1.  **BUILD:** You start by writing code. Build your UI using a shared set of design tokens (colors, spacing, etc.).

2.  **TOKENS:** Your design tokens are the single source of truth for style. They are defined in a format that both Figma and your code can read.

3.  **SYNC (Bootstrap/Exception):** You only push coded UI *into* Figma when creating a first frame or recovering from drift. Use MCP sync first, and use `html.to.design` only as fallback.

4.  **DESIGN:** Now that you have a 1:1 copy of your code in Figma, designers can work their magic. They can explore layouts, refine details, and create variants, all while using the same design tokens.

5.  **REFINE (Default):** Once the design is approved in Figma, regenerate/update code through CodeCode from the selected frame.

6.  **MERGE:** You merge the new code, and run a suite of verification scripts to ensure nothing broke. These scripts check that you’re only using design tokens, that your layer names match your code, and that your UI contracts are still valid.

This loop ensures that your Figma file is never just a picture of the app; it’s a direct, verifiable representation of the code itself.

### Decision policy (short version)

* **Default:** Figma-approved frame → CodeCode generation.
* **Fallback:** HTML → Figma only for initial import or MCP outage.
* **Ops rule:** Review Figma MCP changes from the last 14 days before planning each new loop.

<br>
<div align="center">
  <img src="./assets/divider.png" alt="Decorative Divider" width="700">
</div>
<br>

## What This Repo Gives You

This repository is a starter kit for implementing the StudioFlow workflow. It includes:

*   **The full workflow documentation:** A detailed guide in `/docs/WORKFLOW.md`.
*   **Verification Scripts:** A set of Node.js scripts in `/scripts` to check for hard-coded values, out-of-sync tokens, and mismatched IDs.
*   **Example Component:** A sample `Hero` component that demonstrates the Layout/Logic/Contract pattern.
*   **Boilerplate:** All the necessary configuration for a modern React + Vite + TypeScript project.

### To get started:

1.  Clone the repo: `git clone https://github.com/becktothefuture/studioflow.git`
2.  Install dependencies: `npm install`
3.  Run the dev server: `npm run dev`
4.  Read the full guide: [`/docs/WORKFLOW.md`](./docs/WORKFLOW.md)

<br>
<div align="center">
  <img src="./assets/divider.png" alt="Decorative Divider" width="700">
</div>
<br>
