You are a senior design engineer at Alexander Beck Studio. Your task is to scaffold a new project that perfectly implements the **StudioFlow** workflow.

**Objective:** Create a new, runnable repository named `studioflow-project` that fully implements the StudioFlow system, including all its rules, scripts, and architectural patterns.

**Core Directives:**

1.  **Follow the 5 Rules:** The generated code and scripts must strictly enforce the Whole-Page, Token-Only, Stable ID, UI Contract, and Audit Trail rules.
2.  **Build a Complete Repo:** Generate every file and directory as specified. No placeholders or `// TODO` comments.
3.  **Implement All Scripts:** All `npm` scripts in `package.json` must be fully functional and robust.
4.  **Write Practical Verification Logic:** The `verify-*.mjs` scripts must be practical and catch real-world issues (e.g., different color formats, `calc()` functions, Tailwind arbitrary values).

---

**Instructions:**

Generate the complete repository for `studioflow-project`. Follow the file structure and content specifications below.

**1. Repository Structure**

```
studioflow-project/
├── README.md
├── docs/
│   └── WORKFLOW.md
├── assets/
│   └── logo.png
├── tokens/
│   ├── figma-variables.json
│   ├── tokens.css
│   └── tokens.ts
├── scripts/
│   ├── build-tokens.mjs
│   ├── verify-no-hardcoded.mjs
│   ├── verify-id-sync.mjs
│   └── verify-tokens-sync.mjs
├── src/
│   ├── components/
│   │   ├── Hero/
│   │   │   ├── HeroLayout.tsx
│   │   │   ├── HeroLogic.tsx
│   │   │   └── Hero.contract.ts
│   ├── styles/
│   │   ├── globals.css
│   │   └── tokens.css
│   └── main.tsx
├── snapshots/
│   └── .gitkeep
├── .tool-versions
├── studioflow.manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .gitignore
└── LICENSE
```

**2. `package.json`**

```json
{
  "name": "studioflow-project",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "build:tokens": "node scripts/build-tokens.mjs",
    "verify:no-hardcoded": "node scripts/verify-no-hardcoded.mjs",
    "verify:id-sync": "node scripts/verify-id-sync.mjs",
    "verify:tokens-sync": "node scripts/verify-tokens-sync.mjs",
    "check": "npm run verify:tokens-sync && npm run verify:no-hardcoded && npm run verify:id-sync && tsc --noEmit",
    "snapshot:figma": "echo \"Figma snapshot script not yet implemented\"",
    "manifest:update": "echo \"Manifest update script not yet implemented\""
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.17",
    "@types/react-dom": "^18.2.7",
    "@vitejs/plugin-react": "^4.2.1",
    "style-dictionary": "^3.9.2",
    "typescript": "^5.2.2",
    "vite": "^5.0.0",
    "glob": "^10.3.10"
  }
}
```

**3. Initial Files & Content**

*   **`docs/WORKFLOW.md`**: Populate with the complete StudioFlow Workflow documentation.
*   **`assets/`**: Include the `logo.png` and `workflow-diagram.png`.
*   **`README.md`**: Use the provided polished `README.md` content.
*   **`studioflow.manifest.json`**: Create an initial manifest file with default values.
*   **Component Placeholders**: Create the `HeroLayout.tsx`, `HeroLogic.tsx`, and `Hero.contract.ts` files with basic, internally consistent boilerplate.

**Output Format:**

Provide the complete repository tree, followed by each file’s full contents. The final project must be runnable with `npm install && npm run dev`.
