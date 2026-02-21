# On Your Marks, Set, Go

This is the launch plan for first-time users who want a strong Claude Code -> Figma -> Claude Code experience with token-driven control.

## On Your Marks

From `studioflow-project`:

```bash
npm run setup:project
```

This installs and checks:
- dependencies,
- Claude CLI availability,
- project Claude config files,
- MCP bridge registration,
- token/build/check gates,
- canvas payload generation,
- deep bridge gate (`check:figma-bridge`).

When setup passes, the installer now stays open with an interactive launcher.
Use the simplified menu directly in the installer.

## Set

### Claude + Figma bridge setup

```bash
claude mcp add --transport http figma https://mcp.figma.com/mcp --scope user
claude mcp list
```

Open Claude and complete auth:

```bash
claude
```

Inside Claude:

```text
/mcp
```

### Claude playbook skills in this repo

Use these local playbooks as repeatable skills:
- `.claude/commands/studioflow-code-to-canvas.md`
- `.claude/commands/studioflow-design-to-code.md`
- `.claude/commands/studioflow-loop-verify.md`

### Optional live API gate (strict)

```bash
STUDIOFLOW_STRICT_FIGMA_BRIDGE=1 FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=... npm run check:figma-bridge
```

## Go: Main Menu

In the installer prompt:

```text
Select option [1-3, q]:
```

### 1) Send website to Figma (recommended)

```bash
npm run demo:figma:prep
FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=... npm run figma:variables:sync
claude
```

Credential setup now validates in strict order:
- Step 1: enter token, token is validated immediately against `/v1/me`
- Step 2: enter file URL/key, file access is validated against `/v1/files/{key}`

If token validation fails, the installer re-prompts token only.
If file validation fails, the installer re-prompts file key/URL only.
If you accidentally paste `Authorization: Bearer ...` or hidden characters, the installer sanitizes it and asks again.
Normal setup checks token + file access only. Variable API scope checks remain available via strict mode.

Inside Claude:
- run `/mcp`,
- then use this prompt:

```text
Use handoff/code-to-canvas.json.
Push the current website structure into Figma Canvas.
Create/update screens:
- Screen / Mobile (390)
- Screen / Tablet (768)
- Screen / Laptop (1280)
- Screen / Desktop (1440)
Preserve all sfid IDs.
Keep the design token-driven using the StudioFlow variable modes.
```

### 2) Create local proof report

```bash
npm run demo:website:capture
```

### 3) Advanced tools

```bash
# strict bridge/API validation
STUDIOFLOW_STRICT_FIGMA_BRIDGE=1 FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=... npm run check:figma-bridge
# full loop with proof artifact
npm run loop:run
npm run loop:proof
```

## Required Files In This Pipeline

- `handoff/code-to-canvas.json`
- `handoff/canvas-to-code.json`
- `handoff/canvas-to-code.template.json`
- `handoff/figma-variables.upsert.json`
- `tokens/figma-variables.json`
- `tokens/figma-breakpoint-variables.json`
- `proof/latest/index.html`
