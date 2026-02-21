# The StudioFlow Workflow

**Version 1.2** | A Design Engineering System by **Alexander Beck Studio**

---

## The Philosophy

Design and code drift apart on busy projects. **StudioFlow** is a practical, verifiable workflow for building products where the design in Figma is the code you ship.

This is not a framework or library. It is a set of rules and automated checks that create a durable bridge between design and code.

## The 5 Rules of StudioFlow

1. **Whole-Page Rule:** Synchronization between code and design happens on complete, assembled pages.
2. **Token-Only Rule:** All style values come from tokens. Hard-coded magic numbers fail verification.
3. **Stable ID Rule:** Important UI elements use stable, shared IDs (`sfid:*`) in both code and Figma.
4. **UI Contract Rule:** Layout and logic are separated and connected by typed contracts.
5. **Audit Trail Rule:** Figma snapshots are versioned with code for traceable visual history.

## Repository & Architecture

```text
studioflow-project/
├── docs/STUDIOFLOW_WORKFLOW.md
├── tokens/figma-variables.json
├── tokens/tokens.css
├── tokens/tokens.ts
├── scripts/build-tokens.mjs
├── scripts/verify-no-hardcoded.mjs
├── scripts/verify-id-sync.mjs
├── scripts/verify-tokens-sync.mjs
├── scripts/snapshot-figma.mjs
├── scripts/manifest-update.mjs
├── src/components/Hero/Hero.contract.ts
├── src/components/Hero/HeroLayout.tsx
├── src/components/Hero/HeroLogic.tsx
├── snapshots/
└── studioflow.manifest.json
```

## Practical Loop

### 1) Foundation

1. Define variables in Figma.
2. Export DTCG JSON into `tokens/figma-variables.json`.
3. Run `npm run build:tokens`.
4. Build pages using `data-sfid` attributes on meaningful elements.

### 2) Sync To Design

1. Push the complete rendered page into Figma.
2. Ensure layers are named to align with `sfid:*` IDs.
3. Run `npm run verify:id-sync` and resolve mismatches.

### 3) Explore & Approve

1. Designers iterate in Figma using variables.
2. Once approved, run `npm run snapshot:figma`.
3. Commit the snapshot to preserve an audit trail.

### 4) Sync Back To Code

1. Regenerate layout code from approved Figma frames.
2. Keep business logic in `*Logic.tsx` and types in `*.contract.ts`.
3. Run `npm run check` and `npm run build` before merge.

## Security & Reliability Notes

- ID validation sanitizes non-standard characters to reduce injection risk.
- Token verification catches hard-coded colors and spacing patterns, including `calc(...)` and Tailwind arbitrary values.
- Manifest updates store loop metadata (`lastSnapshot`, `lastVerification`, and matched IDs).
