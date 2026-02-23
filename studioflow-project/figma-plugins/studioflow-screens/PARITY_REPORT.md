# Plugin Panel Parity Report — Figma node 6:55

**Design:** [StudioFlow Plugin Design](https://www.figma.com/design/zjvQqnyOXOhVTT4lr5Y0Ko/StudioFlow-Plugin-Design?node-id=6-55)  
**Source of truth:** Figma export (HTML + CSS from design node 6:55).  
**Implementation:** `ui.html` — class names and values aligned to export.

---

## What could mess up the design (runtime / parity risks)

| Risk | Impact | Mitigation |
|------|--------|------------|
| **themeColors: true** | Figma injects `--figma-color-bg`, `--figma-color-text`, etc., and adds `figma-light` / `figma-dark` on `<html>`. If Figma or a future SDK applies these to `body`, our exact #2C2C2C / #E0E0E0 palette could be overridden. | Set **themeColors: false** in `figma.showUI()` so no theme is injected. Panel always uses our P palette. |
| **Injected theme after change** | If someone re-enables themeColors later, our colours could drift. | Defensive CSS: `html.figma-light body, html.figma-dark body { background: var(--bg) !important; color: var(--text) !important }` so our tokens win even if theme is turned on. |
| **Focus ring** | Browser/Figma default focus outline can look wrong (e.g. blue ring). | Use `:focus-visible` with 2px teal outline and offset so focus matches the design. |
| **Scrollbar** | Native scrollbar in `.log` can be light/gray and break the dark look. | Style `::-webkit-scrollbar` for `.log`: dark track/thumb and hover to match panel. |
| **Header / labels / copy** | Section labels in export: "CODE TO FIGMA" / "FIGMA TO CODE"; log placeholder "Awaiting action…". | ui.html matches; no version in header (version in footer only). |

---

## Summary (Figma export parity)

| Area | Value |
|------|--------|
| Panel width | 239px (showUI width: 239 in renderer.js & code.js) |
| Panel bg | #2c2c2c |
| Header bg | linear-gradient(119.89deg, rgba(126,247,240,.06), rgba(122,141,255,.08), rgba(126,247,240,.06)) + #2c2c2c |
| Header | pad 10px 12px; left: dot 5px #7ef7f0 + "Ready" 10px #666; right: "StudioFlow" 11px 600 #e0e0e0; gap 8px |
| Separators | #4a4a4a, 1px, box-shadow 0 -1px 0 rgba(0,0,0,1) |
| Context | bg #32353b; pad 8px 12px; dot + text #7a8dff, 11px |
| Section | bg #2a2a2a; pad 16px 12px; gap 12px; label 11px 600 #d5d5d5 letter-spacing .02em; desc 11px #666 line-height 140% |
| Btn (Sync to Figma) | bg #222222; border 1px #00ffee; radius 7px; pad 8px 12px; icon 16×16 white SVG; label 12px 500 #fff |
| Btn (Sync to Code) | bg #222222; border 1px #00b7ff; radius 7px; icon ⟳ 14px #e0e0e0; label 13px 500 #e0e0e0 |
| Log | header pad 5px 12px; label 11px 600 #666; clear 10px #666; area pad 6px 12px, min-height 80px; entry 10px #999 |
| Footer | pad 6px 12px; "StudioFlow v4.0.0" + links 10px #666; links gap 8px |

---

## Verification result

**Parity achieved** against the Figma export (HTML/CSS from design node 6:55). `ui.html` uses the same structure and class naming (`plugin-panel__*`), colours, type sizes, spacing, gradient (119.89deg), separator box-shadow, and buttons (first: 16×16 white sync SVG, border #00ffee; second: ⟳ 14px, border #00b7ff). showUI width set to 239 in both `renderer.js` and `code.js`; themeColors: false in both. Defensive CSS for `html.figma-light` / `html.figma-dark` and `:focus-visible` for focus ring.
