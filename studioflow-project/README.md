# StudioFlow README

<div align="center">
  <a href="https://www.beck.fyi/" target="_blank">
    <img src="./assets/studioflow-logo.png" alt="StudioFlow Logo" width="120">
  </a>
  <h1>StudioFlow</h1>
  <p>A Design Engineering System by <strong>Alexander Beck Studio</strong></p>
  <p><em>For teams who value craft, consistency, and shipping with confidence.</em></p>

  <div>
    <img src="https://img.shields.io/badge/status-active-blue?style=for-the-badge" alt="Workflow Status">
    <img src="https://img.shields.io/badge/version-1.2-orange?style=for-the-badge" alt="Version 1.2">
    <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="MIT License">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge" alt="PRs Welcome">
  </div>

  <div>
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="Built with React">
    <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Built with Vite">
    <img src="https://img.shields.io/badge/Figma-F24E1E?style=for-the-badge&logo=figma&logoColor=white" alt="Uses Figma">
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="Built with TypeScript">
  </div>
</div>

---

**StudioFlow** is a practical, verifiable system for building products where the design you see in Figma is the code you ship. It is not a library or a framework, but a set of rules and automated checks that create a durable, high-fidelity bridge between your design environment and your codebase.

It solves one of the most persistent problems in product development: **design-to-code drift**.

<div align="center">
  <img src="./assets/studioflow-workflow-diagram.png" alt="StudioFlow Workflow Diagram" width="700">
</div>

## The 5 Rules of StudioFlow

These are the core principles of the workflow, enforced by automated scripts at every stage.

| Rule | Description |
|---|---|
| 1. **Whole-Page** | Synchronization always happens on a complete, assembled page. No floating components. |
| 2. **Token-Only** | All styling comes from a central token system. No hard-coded "magic numbers." |
| 3. **Stable ID** | Every important UI element has a unique, matching ID in both code and Figma. |
| 4. **UI Contract** | A component's visual structure is strictly separated from its business logic by a formal TypeScript contract. |
| 5. **Audit Trail** | The design's history is versioned alongside the code via structural snapshots committed to the repository. |

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm (v9+)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build token artifacts:
   ```bash
   npm run build:tokens
   ```
3. Run all verification checks:
   ```bash
   npm run check
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## The Workflow in Practice

The full, detailed workflow is documented in [`/docs/STUDIOFLOW_WORKFLOW.md`](./docs/STUDIOFLOW_WORKFLOW.md). The high-level loop is:

1. Foundation: define tokens in Figma, export them, and build the initial UI in code.
2. Code -> Design Sync: use an MCP client to send the live browser preview into Figma.
3. Validation & Exploration: validate ID sync and iterate in Figma.
4. Snapshot: commit a structural snapshot of the final Figma design.
5. Design -> Code Sync: regenerate UI from approved Figma frames.
6. Merge & Verify: run `npm run check` and ship.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
