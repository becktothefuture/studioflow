# StudioFlow

**StudioFlow** is a practical workflow for creating a high-fidelity, verifiable bridge between your code and your Figma designs. It’s a set of rules and scripts that help you fight design-to-code drift and ship with confidence.

It is **not** a magic, no-code solution. It’s a **code-first** process for teams who value craft and discipline.

<br>
<div align="center">
  <img src="./assets/divider.png" alt="Decorative Divider" width="700">
</div>
<br>

## The Core Idea: A Verifiable Loop

The goal is to make the relationship between code and design explicit and testable. StudioFlow is built around a six-step loop that starts in code, moves to Figma for design refinement, and then returns to code for implementation.

<div align="center">
  <img src="./assets/workflow-diagram.png" alt="StudioFlow Workflow Diagram: A circular loop showing BUILD → TOKENS → SYNC → DESIGN → REFINE → MERGE" width="500">
</div>

### How does it work?

1.  **BUILD:** You start by writing code. Build your UI using a shared set of design tokens (colors, spacing, etc.).

2.  **TOKENS:** Your design tokens are the single source of truth for style. They are defined in a format that both Figma and your code can read.

3.  **SYNC:** This is the critical step. You use a tool to get your coded UI *into* Figma. **Yes, this requires code.** You can use an AI-powered editor with Figma access (like Cursor) to “send” your browser preview to a new Figma frame, or you can use a community plugin like `html.to.design`.

4.  **DESIGN:** Now that you have a 1:1 copy of your code in Figma, designers can work their magic. They can explore layouts, refine details, and create variants, all while using the same design tokens.

5.  **REFINE:** Once the design is approved in Figma, you bring those changes back into your codebase. Again, this can be done with an AI assistant that can read the Figma file and generate the updated code, or it can be done manually.

6.  **MERGE:** You merge the new code, and run a suite of verification scripts to ensure nothing broke. These scripts check that you’re only using design tokens, that your layer names match your code, and that your UI contracts are still valid.

This loop ensures that your Figma file is never just a picture of the app; it’s a direct, verifiable representation of the code itself.

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
