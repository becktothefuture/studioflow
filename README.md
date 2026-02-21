# StudioFlow

<div align="center">
  <img src="./assets/hero-banner.png" alt="StudioFlow Hero Banner: DESIGN · CODE · VERIFY · REPEAT">
</div>

<div align="center">
  <img src="./assets/divider.png" alt="Decorative Divider" width="700">
</div>

**StudioFlow** is a practical, verifiable system for building products where the design you see in Figma is the code you ship. It’s not a library or a framework, but a set of rules and automated checks that create a durable, high-fidelity bridge between your design environment and your codebase.

It solves one of the most persistent problems in product development: **design-to-code drift**.

<div align="center">
  <img src="./assets/workflow-diagram.png" alt="StudioFlow Workflow Diagram: A circular loop showing BUILD → TOKENS → SYNC → DESIGN → REFINE → MERGE" width="500">
</div>

<div align="center">
  <img src="./assets/divider.png" alt="Decorative Divider" width="700">
</div>

<div align="center">
  <img src="./assets/rules-card.png" alt="The 5 Rules of StudioFlow: Whole-Page, Token-Only, Stable ID, UI Contract, Audit Trail" width="700">
</div>

<br>

| Rule | Description |
|---|---|
| 1. **Whole-Page** | Synchronization always happens on a complete, assembled page. No floating components. |
| 2. **Token-Only** | All styling comes from a central token system. No hard-coded “magic numbers.” |
| 3. **Stable ID** | Every important UI element has a unique, matching ID in both code and Figma. |
| 4. **UI Contract** | A component’s visual structure is strictly separated from its business logic by a formal TypeScript contract. |
| 5. **Audit Trail** | The design’s history is versioned alongside the code via structural “snapshots” committed to the repository. |

<br>
<div align="center">
  <img src="./assets/divider.png" alt="Decorative Divider" width="700">
</div>
<br>

## Getting Started

### Prerequisites

- **Node.js** (v18+)
- **Figma Desktop App** (Pro, Organization, or Enterprise seat)
- **MCP-compatible Editor** (e.g., [Cursor](https://cursor.sh/), VS Code)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/alexanderbeck-studio/studioflow.git
    cd studioflow
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the verification suite:**
    ```bash
    npm run check
    ```

4.  **Start the development server:**
    ```bash
    npm run dev
    ```

## The Workflow in Practice

The full, detailed workflow is documented in [`/docs/WORKFLOW.md`](./docs/WORKFLOW.md). The high-level loop is:

1.  **Foundation:** Build the initial UI in code, defining tokens and assigning stable IDs.
2.  **Code → Design Sync:** Use an MCP client to send the live browser preview into Figma.
3.  **Validation & Exploration:** Run a script to validate that all IDs are synced. Once validated, designers can refine the UI in Figma.
4.  **Snapshot:** Commit a structural snapshot of the final Figma design to the repository.
5.  **Design → Code Sync:** Use an MCP client to generate new UI code from the refined Figma design.
6.  **Merge & Verify:** Merge the new code and run `npm run check` to type-check, validate invariants, and run visual regression tests.

<div align="center">
  <img src="./assets/footer.png" alt="StudioFlow Footer: SF Monogram and Alexander Beck Studio · London">
</div>
