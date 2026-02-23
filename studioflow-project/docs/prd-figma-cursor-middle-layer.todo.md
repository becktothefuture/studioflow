# PRD Execution Todo — Figma/Cursor Middle Layer

Source PRD: `docs/prd-figma-cursor-middle-layer.md`

## MVP Track (US-001 to US-007)

- [x] US-001: Create canonical `docs/DESIGN_SYSTEM_STANDARD.md` with spacing, typography, colour roles, radii, motion, and 4 breakpoints.
- [x] US-001: Link standard doc from `docs/DESIGN_SYSTEM_AND_FIGMA_SYNC.md`.
- [x] US-002: Add `scripts/report-token-coverage.mjs`.
- [x] US-002: Add npm command `npm run report:token-coverage`.
- [x] US-003: Add `conduitVersion` to generated `handoff/code-to-canvas.json`.
- [x] US-004: Generate bidirectional mapping artifact `handoff/code-to-figma-mapping.json`.
- [x] US-005: Add single entrypoint `npm run conduit:generate`.
- [x] US-006: Enforce stable ordering in generated token arrays/frame token names/mapping.
- [x] US-007: Define error taxonomy and expose deterministic error codes + recovery hints in verification output.

## Next Chunks (Post-MVP)

- [ ] US-008: Add phase-3 verification artifact (`bound`, `unbound`, `couldBeStyles`) under `handoff/` or `proof/`.
- [ ] US-009: Wire `styleLayer` payload into plugin/conduit apply path for real style creation + assignment.
- [x] US-010: Implement shared `handoff/trust-ledger.json` lifecycle.
- [x] US-011: Implement preview/commit flow with immutable receipts in `proof/receipts/`.
- [x] US-012: Add single-action recovery UX in CLI/plugin output ordering.
- [x] US-013: Implement `handoff/band-context.json` bridge with stale-context detection.

## Validation Checklist Per Chunk

- [x] `npm run conduit:generate`
- [x] `npm run report:token-coverage`
- [x] `npm run check`
