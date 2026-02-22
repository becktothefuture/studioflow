// StudioFlow Screens — Figma Plugin
// Creates the 4 breakpoint screen frames with the actual hero design,
// binds available token variables, and preserves all sfid anchors.

figma.showUI(__html__, { width: 360, height: 560, title: 'StudioFlow Screens' });

// ── Screen definitions ────────────────────────────────────────────────────────
const SCREENS = [
  { name: 'Screen / Mobile',  width: 390,  height: 812,  breakpoint: 'mobile',  coll: 'StudioFlow/mobile',  compact: true  },
  { name: 'Screen / Tablet',  width: 768,  height: 1024, breakpoint: 'tablet',  coll: 'StudioFlow/tablet',  compact: true  },
  { name: 'Screen / Laptop',  width: 1280, height: 800,  breakpoint: 'laptop',  coll: 'StudioFlow/laptop',  compact: false },
  { name: 'Screen / Desktop', width: 1440, height: 900,  breakpoint: 'desktop', coll: 'StudioFlow/desktop', compact: false },
];

// ── Content from HeroLogic.tsx ────────────────────────────────────────────────
const CONTENT = {
  kicker:       'StudioFlow / Code → Canvas → Code',
  title:        'Preserve one intent\nfrom code to design.',
  body:         'StudioFlow keeps semantic identity stable across code and design through deterministic contracts and naming parity.',
  primaryCta:   'Start First Verified Loop',
  secondaryCta: 'Inspect Proof + Guarantees',
};

// Resolved clamp() values per breakpoint
// font-size-title: clamp(56px, 6vw, 92px)
// font-size-h2:    clamp(26px, 4vw, 42px)
const SCALE = {
  mobile:  { titlePx: 56, h2Px: 26, compact: true  },
  tablet:  { titlePx: 56, h2Px: 31, compact: true  },
  laptop:  { titlePx: 77, h2Px: 42, compact: false },
  desktop: { titlePx: 86, h2Px: 42, compact: false },
};

// Computed hex for STRING-type color variables (color-mix formulas resolved)
// All channels are 0–1 floats for Figma.
const C = {
  ink:          { r: 0.027, g: 0.039, b: 0.074 }, // #070A13
  bg:           { r: 0.059, g: 0.078, b: 0.118 }, // #0F1430 ≈ color-brand-bg
  surface:      { r: 0.086, g: 0.118, b: 0.157 }, // #161E28 ≈ color-brand-surface
  panel:        { r: 0.118, g: 0.157, b: 0.196 }, // #1E2832 ≈ color-brand-panel
  text:         { r: 0.600, g: 0.725, b: 0.784 }, // #99B9C8 ≈ color-brand-text
  muted:        { r: 0.353, g: 0.451, b: 0.506 }, // #5A7381 ≈ color-brand-muted
  stroke:       { r: 0.239, g: 0.310, b: 0.357 }, // #3D4F5B ≈ color-brand-stroke
  strokeStrong: { r: 0.380, g: 0.490, b: 0.545 }, // #617D8B ≈ color-brand-stroke-strong
  primary:      { r: 0.478, g: 0.553, b: 1.000 }, // #7A8DFF color-brand-primary
  secondary:    { r: 0.494, g: 0.969, b: 0.941 }, // #7EF7F0 color-brand-secondary
  signal:       { r: 0.533, g: 0.682, b: 0.749 }, // #88AEBF color-brand-signal
};

const CANVAS_GAP = 120;
function send(type, d) { if (!d) d = {}; figma.ui.postMessage(Object.assign({ type: type }, d)); }
const log  = (text, level = 'info') => send('log', { text, level });

// ── Message router ─────────────────────────────────────────────────────────────
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'create-frames':
      try {
        const results = await createScreenFrames();
        send('frames-done', { results });
      } catch (e) { send('error', { text: String(e) }); }
      break;

    case 'bind-variables':
      try {
        const stats = await bindAllVariables();
        send('bind-done', { stats });
      } catch (e) { send('error', { text: String(e) }); }
      break;

    case 'run-all':
      try {
        const results = await createScreenFrames();
        const stats   = await bindAllVariables();
        send('all-done', { results, stats });
      } catch (e) { send('error', { text: String(e) }); }
      break;

    case 'close':
      figma.closePlugin();
      break;
  }
};

// ── Variable map ───────────────────────────────────────────────────────────────
async function buildVarMap() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const map = new Map(); // collectionName → Map(shortName → Variable)

  for (const col of collections) {
    const byName = new Map();
    for (const id of col.variableIds) {
      const v = await figma.variables.getVariableByIdAsync(id);
      if (!v) continue;
      byName.set(v.name.split('/').pop(), v);
    }
    map.set(col.name, byName);
  }

  log(`${collections.length} variable collections loaded`);
  return map;
}

// ── Font loader ────────────────────────────────────────────────────────────────
async function loadFonts() {
  let display = 'Space Grotesk';
  let body    = 'Space Grotesk';

  // Try Xanh Mono (display font from tokens)
  try {
    await figma.loadFontAsync({ family: 'Xanh Mono', style: 'Regular' });
    display = 'Xanh Mono';
    log('Display font: Xanh Mono ✓');
  } catch {
    log('Xanh Mono unavailable — using Space Grotesk for display', 'warn');
  }

  // Load Space Grotesk variants
  for (const style of ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    try { await figma.loadFontAsync({ family: 'Space Grotesk', style }); }
    catch {
      try { await figma.loadFontAsync({ family: 'Inter', style: style === 'SemiBold' ? 'Semi Bold' : style }); }
      catch { /* skip */ }
      if (body === 'Space Grotesk') body = 'Inter';
    }
  }

  // Always load Inter Regular as safe fallback
  try { await figma.loadFontAsync({ family: 'Inter', style: 'Regular' }); } catch {}

  return { display, body };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function solid(color, opacity = 1) {
  return { type: 'SOLID', color, opacity };
}

function bindFill(node, color, variable) {
  if (variable) {
    try {
      node.fills = [figma.variables.setBoundVariableForPaint(solid(color), 'color', variable)];
      return;
    } catch { /* fall through */ }
  }
  node.fills = [solid(color)];
}

function bindVar(node, prop, variable) {
  if (variable) {
    try { node.setBoundVariable(prop, variable); } catch { /* skip */ }
  }
}

function bindCornerRadius(node, r, variable) {
  node.cornerRadius = r;
  if (variable) {
    try {
      // Try uniform first
      node.setBoundVariable('cornerRadius', variable);
    } catch {
      // Fall back to individual corners
      for (const p of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) {
        try { node.setBoundVariable(p, variable); } catch {}
      }
    }
  }
}

// ── Main entry ────────────────────────────────────────────────────────────────
async function createScreenFrames() {
  const varMap = await buildVarMap();
  const fonts  = await loadFonts();

  const page = figma.currentPage;
  const existingByName = new Map();
  for (const node of page.children) {
    if (node.type === 'FRAME') existingByName.set(node.name, node);
  }

  // X offset: place new frames to the right, or reset if page only has our frames
  let xOffset = 0;
  const onlyOurs = page.children.length > 0 &&
    page.children.every(n => SCREENS.some(s => s.name === n.name));
  if (!onlyOurs) {
    for (const n of page.children) {
      const r = n.x + (n.width || 0);
      if (r > xOffset) xOffset = r + CANVAS_GAP;
    }
  }

  const results = [];

  for (const screen of SCREENS) {
    const vars  = varMap.get(screen.coll) || new Map();
    const scale = SCALE[screen.breakpoint];

    let frame = existingByName.get(screen.name);
    const isNew = !frame;

    if (isNew) {
      frame = figma.createFrame();
      frame.name = screen.name;
      frame.x = xOffset;
      frame.y = 0;
      log(`Created: ${screen.name}`);
    } else {
      // Remove old children to rebuild fresh
      while (frame.children.length) frame.children[0].remove();
      log(`Rebuilding: ${screen.name}`, 'warn');
    }

    if (isNew) xOffset += screen.width + CANVAS_GAP;

    // Screen frame: fixed viewport size, no auto-layout (children are absolutely placed)
    frame.resize(screen.width, screen.height);
    frame.layoutMode = 'NONE';
    frame.clipsContent = true;

    // Background: color-brand-ink (bound)
    bindFill(frame, C.ink, vars.get('color-brand-ink'));

    // Build hero section inside the screen
    buildHeroSection(frame, screen, scale, vars, fonts);

    results.push({ id: frame.id, name: frame.name, width: frame.width });
    log(`  ✓ ${screen.name}  id:${frame.id}`, 'success');
  }

  return results;
}

// ── Hero section ───────────────────────────────────────────────────────────────
function buildHeroSection(screenFrame, screen, scale, vars, fonts) {
  // hero-root: fills the screen, centers content
  const root = figma.createFrame();
  root.name = 'sfid:hero-root';
  root.setPluginData('sfid', 'sfid:hero-root');
  root.resize(screen.width, screen.height);
  root.x = 0;
  root.y = 0;
  root.layoutMode = 'VERTICAL';
  root.primaryAxisAlignItems = 'CENTER';
  root.counterAxisAlignItems = 'CENTER';
  root.primaryAxisSizingMode = 'FIXED';
  root.counterAxisSizingMode = 'FIXED';
  root.fills = [];        // transparent — screen frame has the bg

  // Shell padding: space-sm on mobile, space-lg on desktop
  const shellPad  = scale.compact ? 8  : 24;
  const shellPadV = scale.compact ? 32 : 64;
  root.paddingTop    = shellPadV;
  root.paddingBottom = shellPadV;
  root.paddingLeft   = shellPad;
  root.paddingRight  = shellPad;

  screenFrame.appendChild(root);

  // hero-content: the card panel
  const panel = buildPanel(root, screen, scale, vars, fonts);
  return root;
}

// ── Panel (hero-content) ───────────────────────────────────────────────────────
function buildPanel(parent, screen, scale, vars, fonts) {
  const panel = figma.createFrame();
  panel.name = 'sfid:hero-content';
  panel.setPluginData('sfid', 'sfid:hero-content');

  panel.layoutMode = 'VERTICAL';
  panel.primaryAxisSizingMode = 'AUTO';   // hug height
  panel.counterAxisSizingMode = 'FIXED';  // fixed width (fills parent)
  panel.layoutAlign = 'STRETCH';

  // Inner padding: space-md (16) on mobile, space-xl (44) on desktop
  const padVal = scale.compact ? 16 : 44;
  const padVar = vars.get(scale.compact ? 'space-md' : 'space-xl');
  panel.paddingTop    = padVal;
  panel.paddingBottom = padVal;
  panel.paddingLeft   = padVal;
  panel.paddingRight  = padVal;
  for (const p of ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight']) {
    bindVar(panel, p, padVar);
  }

  // Gap between rows: space-md (16)
  panel.itemSpacing = 16;
  bindVar(panel, 'itemSpacing', vars.get('space-md'));

  // Background: color-brand-surface (STRING variable, use computed hex)
  panel.fills = [solid(C.surface)];

  // Border: 1px color-brand-stroke
  panel.strokes = [solid(C.stroke)];
  panel.strokeWeight = 1;
  panel.strokeAlign = 'INSIDE';
  bindVar(panel, 'strokeWeight', vars.get('size-border-default'));

  // Corner radius: radius-lg (20px)
  bindCornerRadius(panel, 20, vars.get('radius-lg'));

  panel.clipsContent = false;

  parent.appendChild(panel);

  // ── Row: kicker ──────────────────────────────────────────────────────────────
  const kicker = figma.createText();
  kicker.name = 'sfid:hero-kicker';
  kicker.setPluginData('sfid', 'sfid:hero-kicker');
  kicker.fontName    = { family: fonts.body, style: 'Regular' };
  kicker.characters  = CONTENT.kicker.toUpperCase();
  kicker.fontSize    = 13;
  bindVar(kicker, 'fontSize', vars.get('font-size-kicker'));
  kicker.letterSpacing  = { unit: 'PIXELS', value: 2.08 }; // 0.16em × 13px
  kicker.textCase       = 'UPPER';
  kicker.fills          = [solid(C.muted)];
  kicker.layoutAlign    = 'STRETCH';
  kicker.textAutoResize = 'HEIGHT';
  panel.appendChild(kicker);

  // ── Row: title ───────────────────────────────────────────────────────────────
  const titleSize = scale.titlePx;
  const title = figma.createText();
  title.name = 'sfid:hero-title';
  title.setPluginData('sfid', 'sfid:hero-title');
  // Try display font, fall back to body
  try {
    title.fontName = { family: fonts.display, style: 'Regular' };
  } catch {
    title.fontName = { family: fonts.body, style: 'Regular' };
  }
  title.characters    = CONTENT.title;
  title.fontSize      = titleSize;
  title.lineHeight    = { unit: 'PERCENT', value: 96 };  // 0.96 → 96%
  title.letterSpacing = { unit: 'PIXELS', value: -(titleSize * 0.03) }; // -0.03em
  title.fills         = [solid(C.text)];
  title.layoutAlign   = 'STRETCH';
  title.textAutoResize = 'HEIGHT';
  panel.appendChild(title);

  // ── Row: body ────────────────────────────────────────────────────────────────
  const body = figma.createText();
  body.name = 'sfid:hero-body';
  body.setPluginData('sfid', 'sfid:hero-body');
  body.fontName    = { family: fonts.body, style: 'Regular' };
  body.characters  = CONTENT.body;
  body.fontSize    = 16;
  bindVar(body, 'fontSize', vars.get('font-size-body'));
  body.lineHeight  = { unit: 'PERCENT', value: 160 }; // 1.6 → 160%
  body.fills       = [solid(C.muted)];
  body.layoutAlign = 'STRETCH';
  body.textAutoResize = 'HEIGHT';
  panel.appendChild(body);

  // ── Row: actions ─────────────────────────────────────────────────────────────
  const actions = figma.createFrame();
  actions.name = 'sfid:hero-actions';
  actions.setPluginData('sfid', 'sfid:hero-actions');
  actions.fills = [];

  // Stacked vertically on mobile, side-by-side on desktop
  actions.layoutMode = scale.compact ? 'VERTICAL' : 'HORIZONTAL';
  actions.primaryAxisSizingMode = 'AUTO';
  actions.counterAxisSizingMode = 'AUTO';
  actions.itemSpacing = 8;
  bindVar(actions, 'itemSpacing', vars.get('space-sm'));
  actions.layoutAlign = 'STRETCH';
  panel.appendChild(actions);

  // Primary button
  buildButton(actions, true, scale, vars, fonts);
  // Secondary button
  buildButton(actions, false, scale, vars, fonts);

  return panel;
}

// ── Button ─────────────────────────────────────────────────────────────────────
function buildButton(parent, isPrimary, scale, vars, fonts) {
  const btn = figma.createFrame();
  const sfid = isPrimary ? 'sfid:hero-primary-cta' : 'sfid:hero-secondary-cta';
  btn.name = sfid;
  btn.setPluginData('sfid', sfid);

  btn.layoutMode = 'HORIZONTAL';
  btn.primaryAxisAlignItems = 'CENTER';
  btn.counterAxisAlignItems = 'CENTER';
  btn.primaryAxisSizingMode = scale.compact ? 'FIXED' : 'AUTO'; // fill width on mobile
  btn.counterAxisSizingMode = 'AUTO';

  // Padding: space-sm (8) vertical, space-lg (24) horizontal
  btn.paddingTop    = 8;
  btn.paddingBottom = 8;
  btn.paddingLeft   = 24;
  btn.paddingRight  = 24;
  bindVar(btn, 'paddingTop',    vars.get('space-sm'));
  bindVar(btn, 'paddingBottom', vars.get('space-sm'));
  bindVar(btn, 'paddingLeft',   vars.get('space-lg'));
  bindVar(btn, 'paddingRight',  vars.get('space-lg'));

  // On mobile: stretch to fill actions (which is STRETCH itself)
  if (scale.compact) {
    btn.layoutAlign = 'STRETCH';
  } else {
    // On desktop: min-width 210px
    btn.minWidth = 210;
    bindVar(btn, 'minWidth', vars.get('size-button-min-width'));
  }

  // Pill radius (999 → Figma will cap at half height)
  bindCornerRadius(btn, 999, vars.get('radius-pill'));

  // Colors
  if (isPrimary) {
    bindFill(btn, C.primary, vars.get('color-brand-primary'));
    btn.strokes = [];
  } else {
    btn.fills   = [solid(C.ink, 0)]; // transparent bg
    btn.strokes = [solid(C.strokeStrong)];
    btn.strokeWeight = 1;
    btn.strokeAlign  = 'INSIDE';
    bindVar(btn, 'strokeWeight', vars.get('size-border-default'));
  }

  // Label
  const label = figma.createText();
  label.fontName = { family: fonts.body, style: 'Medium' };
  label.characters = isPrimary ? CONTENT.primaryCta : CONTENT.secondaryCta;
  label.fontSize = 15;
  label.textAutoResize = 'WIDTH_AND_HEIGHT';

  if (isPrimary) {
    // Dark text on bright primary button
    bindFill(label, C.ink, vars.get('color-brand-ink'));
  } else {
    label.fills = [solid(C.text)];
  }

  btn.appendChild(label);
  parent.appendChild(btn);
  return btn;
}

// ── Bind all token variables ───────────────────────────────────────────────────
// Walks screen frames and wires up any FLOAT/COLOR variables not yet bound.
async function bindAllVariables() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const colorByHex  = new Map(); // hex → Variable
  const floatByVal  = new Map(); // value → [{variable, name}]

  for (const col of collections) {
    for (const id of col.variableIds) {
      const v = await figma.variables.getVariableByIdAsync(id);
      if (!v) continue;

      const shortName = v.name.split('/').pop();
      const modeId    = col.modes[0] ? col.modes[0].modeId : undefined;
      if (!modeId) continue;
      const val = v.valuesByMode[modeId];
      if (val === undefined) continue;

      if (v.resolvedType === 'COLOR' && typeof val === 'object' && 'r' in val) {
        const hex = toHex(val);
        if (!colorByHex.has(hex)) colorByHex.set(hex, v);
      } else if (v.resolvedType === 'FLOAT' && typeof val === 'number') {
        if (!floatByVal.has(val)) floatByVal.set(val, []);
        floatByVal.get(val).push({ variable: v, name: shortName });
      }
    }
  }

  log(`Binding: ${colorByHex.size} colors, ${floatByVal.size} numeric values indexed`);

  const page = figma.currentPage;
  let visited = 0;
  let bound   = 0;

  function walk(node) {
    visited++;

    // Fills
    if ('fills' in node && Array.isArray(node.fills)) {
      node.fills.forEach((fill, i) => {
        if (fill.type === 'SOLID' && fill.color) {
          const v = colorByHex.get(toHex(fill.color));
          if (v) try { node.setBoundVariable(`fills/${i}/color`, v); bound++; } catch {}
        }
      });
    }

    // Strokes
    if ('strokes' in node && Array.isArray(node.strokes)) {
      node.strokes.forEach((s, i) => {
        if (s.type === 'SOLID' && s.color) {
          const v = colorByHex.get(toHex(s.color));
          if (v) try { node.setBoundVariable(`strokes/${i}/color`, v); bound++; } catch {}
        }
      });
    }

    // Numeric fields
    const numericFields = [
      ['paddingTop',    'space-'],
      ['paddingRight',  'space-'],
      ['paddingBottom', 'space-'],
      ['paddingLeft',   'space-'],
      ['itemSpacing',   'space-'],
      ['strokeWeight',  'size-border-'],
      ['fontSize',      'font-size-'],
      ['minWidth',      'size-'],
      ['maxWidth',      'size-'],
      ['cornerRadius',  'radius-'],
    ];

    for (const [prop, prefix] of numericFields) {
      if (prop in node && typeof node[prop] === 'number') {
        const candidates = floatByVal.get(node[prop]);
        const match = candidates ? candidates.find(function(c) { return c.name.startsWith(prefix); }) : undefined;
        if (match) try { node.setBoundVariable(prop, match.variable); bound++; } catch {}
      }
    }

    if ('children' in node) {
      for (const child of node.children) walk(child);
    }
  }

  for (const node of page.children) {
    if (SCREENS.some(s => s.name === node.name)) {
      log(`  Walking "${node.name}"`);
      walk(node);
    }
  }

  log(`Done: ${bound} bindings across ${visited} nodes`, 'success');
  return { visited, bound };
}

// ── Utility ────────────────────────────────────────────────────────────────────
function toHex({ r, g, b }) {
  const h = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
