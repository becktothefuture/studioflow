// StudioFlow Figma Plugin — Generic Data-Driven Renderer
// This file is project-agnostic. It reads from the PAYLOAD variable
// (prepended by build-figma-plugin.mjs) and renders sections accordingly.
//
// Supported section types: nav, hero, card-section, split-section, footer
// Any project can generate a compatible PAYLOAD and reuse this renderer.

figma.showUI(__html__, { width: 270, height: 390, title: PAYLOAD.project + ' Screens', themeColors: true });

// ── Derived from PAYLOAD ───────────────────────────────────────────────────────
var SCREENS = PAYLOAD.screens;
var SECTIONS = PAYLOAD.sections;
var FONTS_CFG = PAYLOAD.fonts;

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.substring(0, 2), 16) / 255,
    g: parseInt(hex.substring(2, 4), 16) / 255,
    b: parseInt(hex.substring(4, 6), 16) / 255,
  };
}

var C = {};
for (var ck in PAYLOAD.colors) {
  C[ck] = hexToRgb(PAYLOAD.colors[ck]);
}

var CANVAS_GAP = 120;
var sfCollection = null;
var sfModeMap = {};
var SCALE_FACTORS = [0.729, 0.81, 0.9, 1.0]; // mobile, tablet, laptop, desktop

function send(type, d) { figma.ui.postMessage(Object.assign({ type: type }, d || {})); }
var log = function(text, level) { send('log', { text: text, level: level || 'info' }); };

// ── Message router ─────────────────────────────────────────────────────────────
figma.ui.onmessage = function(msg) {
  switch (msg.type) {
    case 'create-frames':
      createScreenFrames().then(function(r) { send('frames-done', { results: r }); })
        .catch(function(e) { send('error', { text: String(e) }); });
      break;
    case 'bind-variables':
      bindAllVariables().then(function(s) { send('bind-done', { stats: s }); })
        .catch(function(e) { send('error', { text: String(e) }); });
      break;
    case 'run-all':
      createScreenFrames().then(function(r) {
        return bindAllVariables().then(function(s) { send('all-done', { results: r, stats: s }); });
      }).catch(function(e) { send('error', { text: String(e) }); });
      break;
    case 'export-canvas':
      exportCanvasToCode().then(function(json) { send('export-done', { json: json }); })
        .catch(function(e) { send('error', { text: String(e) }); });
      break;
    case 'close':
      figma.closePlugin();
      break;
  }
};

// ── Selection change listener ──────────────────────────────────────────────────
function checkSelection() {
  var sel = figma.currentPage.selection;
  var screenName = null;
  if (sel.length === 1) {
    var node = sel[0];
    for (var si = 0; si < SCREENS.length; si++) {
      if (SCREENS[si].name === node.name) { screenName = node.name; break; }
    }
    // Also check ancestors
    if (!screenName) {
      var parent = node.parent;
      while (parent && parent.type !== 'PAGE') {
        for (var sj = 0; sj < SCREENS.length; sj++) {
          if (SCREENS[sj].name === parent.name) { screenName = parent.name; break; }
        }
        if (screenName) break;
        parent = parent.parent;
      }
    }
  }
  var hasScreens = false;
  var page = figma.currentPage;
  for (var pi = 0; pi < page.children.length; pi++) {
    for (var sk = 0; sk < SCREENS.length; sk++) {
      if (SCREENS[sk].name === page.children[pi].name) { hasScreens = true; break; }
    }
    if (hasScreens) break;
  }
  send('selection-update', { screenName: screenName, hasScreens: hasScreens });
}
figma.on('selectionchange', checkSelection);
// Initial check after UI loads
setTimeout(checkSelection, 300);

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT: Figma → Code
// ══════════════════════════════════════════════════════════════════════════════

function varValueToTokenString(name, resolvedType, val) {
  if (resolvedType === 'COLOR' && typeof val === 'object' && 'r' in val) {
    function h(v) { return Math.round(v * 255).toString(16).padStart(2, '0'); }
    return '#' + h(val.r) + h(val.g) + h(val.b);
  }
  if (resolvedType === 'STRING') return String(val);
  if (resolvedType === 'FLOAT' && typeof val === 'number') {
    var flatName = name.replace(/\//g, '-');
    if (flatName.indexOf('font-weight') === 0) return String(val);
    if (flatName.indexOf('font-line-height') === 0) return String(val / 100);
    if (flatName.indexOf('font-letter-spacing') === 0) return (val / 100) + 'em';
    if (flatName.indexOf('opacity') === 0) return String(val);
    return val + 'px';
  }
  return String(val);
}

function exportCanvasToCode() {
  log('Exporting variables from Figma…');

  return figma.variables.getLocalVariableCollectionsAsync().then(function(collections) {
    var sfCol = null;
    for (var ci = 0; ci < collections.length; ci++) {
      if (collections[ci].name === 'StudioFlow Tokens') { sfCol = collections[ci]; break; }
    }
    if (!sfCol) throw new Error('No "StudioFlow Tokens" collection found');

    // Build mode info
    var modes = sfCol.modes;
    var modeNames = {};
    for (var mi = 0; mi < modes.length; mi++) {
      modeNames[modes[mi].modeId] = modes[mi].name;
    }

    // Read all variables
    var varPromises = [];
    for (var vi = 0; vi < sfCol.variableIds.length; vi++) {
      varPromises.push(figma.variables.getVariableByIdAsync(sfCol.variableIds[vi]));
    }

    return Promise.all(varPromises).then(function(variables) {
      // Start with original token values from PAYLOAD
      var baseValues = {};
      for (var ti = 0; ti < PAYLOAD.tokens.length; ti++) {
        baseValues[PAYLOAD.tokens[ti].name] = PAYLOAD.tokens[ti].value;
      }

      // Build variableModes with values (override base with actual Figma values)
      var variableModes = [];
      for (var modi = 0; modi < modes.length; modi++) {
        var modeId = modes[modi].modeId;
        var modeName = modes[modi].name;
        var modeWidth = 0;
        for (var si = 0; si < PAYLOAD.screens.length; si++) {
          if (PAYLOAD.screens[si].breakpoint === modeName) { modeWidth = PAYLOAD.screens[si].width; break; }
        }

        // Start with a copy of base values
        var values = {};
        for (var bk in baseValues) { values[bk] = baseValues[bk]; }

        // Override with actual Figma variable values
        for (var vj = 0; vj < variables.length; vj++) {
          var v = variables[vj];
          if (!v) continue;
          var flatName = v.name.replace(/\//g, '-');
          var modeVal = v.valuesByMode[modeId];
          if (modeVal !== undefined) {
            values[flatName] = varValueToTokenString(v.name, v.resolvedType, modeVal);
          }
        }

        variableModes.push({ name: modeName, width: modeWidth, values: values });
      }

      // Build tokenFrames
      var tokenFrames = [];
      var tfConfig = PAYLOAD.tokenFrames || [];
      for (var tfi = 0; tfi < tfConfig.length; tfi++) {
        var tf = tfConfig[tfi];
        var tokenNames = [];
        for (var tni = 0; tni < PAYLOAD.tokens.length; tni++) {
          var prefix = PAYLOAD.tokens[tni].name.split('-')[0];
          if (tf.prefixes.indexOf(prefix) !== -1) {
            tokenNames.push(PAYLOAD.tokens[tni].name);
          }
        }
        tokenFrames.push({ name: tf.name, tokenNames: tokenNames });
      }

      // Walk screen frames to collect sfids
      var allSfids = [];
      var screenEntries = [];
      var page = figma.currentPage;

      function collectSfids(node) {
        var sfid = null;
        try { sfid = node.getPluginData('sfid'); } catch (_e) {}
        if (sfid && sfid.indexOf('sfid:') === 0 && allSfids.indexOf(sfid) === -1) {
          allSfids.push(sfid);
        }
        if ('children' in node) {
          for (var chi = 0; chi < node.children.length; chi++) {
            collectSfids(node.children[chi]);
          }
        }
      }

      for (var pi = 0; pi < page.children.length; pi++) {
        var pnode = page.children[pi];
        for (var ski = 0; ski < SCREENS.length; ski++) {
          if (SCREENS[ski].name === pnode.name) {
            var frameSfids = [];
            function collectScreenSfids(node) {
              var sfid = null;
              try { sfid = node.getPluginData('sfid'); } catch (_e) {}
              if (sfid && sfid.indexOf('sfid:') === 0 && frameSfids.indexOf(sfid) === -1) {
                frameSfids.push(sfid);
              }
              if ('children' in node) {
                for (var chi = 0; chi < node.children.length; chi++) {
                  collectScreenSfids(node.children[chi]);
                }
              }
            }
            collectScreenSfids(pnode);
            screenEntries.push({
              name: SCREENS[ski].name,
              breakpoint: SCREENS[ski].breakpoint,
              width: SCREENS[ski].width,
              usesOnlyTokens: true,
              sfids: frameSfids.sort(),
            });
            for (var sfi = 0; sfi < frameSfids.length; sfi++) {
              if (allSfids.indexOf(frameSfids[sfi]) === -1) allSfids.push(frameSfids[sfi]);
            }
          }
        }
      }

      allSfids.sort();

      var canvasPayload = {
        generatedAt: new Date().toISOString(),
        source: 'figma-canvas',
        integration: PAYLOAD.integration || 'canvas-central',
        workflowVersion: PAYLOAD.workflowVersion || '4.0.0',
        canvasProvider: 'figma',
        integrationMode: 'code-first',
        clientSession: {
          agent: 'studioflow-plugin',
          sessionId: 'figma-plugin-' + Date.now(),
        },
        tokenFrames: tokenFrames,
        variableModes: variableModes,
        screens: screenEntries,
        sfids: allSfids,
      };

      var jsonStr = JSON.stringify(canvasPayload, null, 2);
      log('Export ready: ' + variableModes.length + ' modes, ' + allSfids.length + ' sfids, ' + tokenFrames.length + ' token frames', 'success');
      return jsonStr;
    });
  });
}

// ── Token variable creation ────────────────────────────────────────────────────
function tokenToGroupedName(flatName) {
  var idx = flatName.indexOf('-');
  if (idx === -1) return flatName;
  return flatName.substring(0, idx) + '/' + flatName.substring(idx + 1);
}

function hexToRgba(hex) {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.substring(0, 2), 16) / 255,
    g: parseInt(hex.substring(2, 4), 16) / 255,
    b: parseInt(hex.substring(4, 6), 16) / 255,
    a: 1,
  };
}

function createTokenVariables() {
  var tokens = PAYLOAD.tokens;

  return figma.variables.getLocalVariableCollectionsAsync().then(function(collections) {
    // Remove existing StudioFlow Tokens collection
    var removePromises = [];
    for (var ci = 0; ci < collections.length; ci++) {
      if (collections[ci].name === 'StudioFlow Tokens') {
        var col = collections[ci];
        for (var vi = 0; vi < col.variableIds.length; vi++) {
          (function(id) {
            removePromises.push(figma.variables.getVariableByIdAsync(id).then(function(v) {
              if (v) v.remove();
            }));
          })(col.variableIds[vi]);
        }
        removePromises.push(Promise.resolve().then(function() { col.remove(); }));
      }
    }

    return Promise.all(removePromises).then(function() {
      // Create fresh collection with breakpoint modes
      var newCol = figma.variables.createVariableCollection('StudioFlow Tokens');
      var defaultModeId = newCol.modes[0].modeId;
      newCol.renameMode(defaultModeId, 'mobile');
      var tabletModeId = newCol.addMode('tablet');
      var laptopModeId = newCol.addMode('laptop');
      var desktopModeId = newCol.addMode('desktop');
      var allModeIds = [defaultModeId, tabletModeId, laptopModeId, desktopModeId];

      var created = 0;
      var skipped = 0;

      for (var ti = 0; ti < tokens.length; ti++) {
        var t = tokens[ti];
        var groupedName = tokenToGroupedName(t.name);
        var resolvedType = null;
        var value = null;
        var perModeValues = null;

        if (t.name.indexOf('color-') === 0 && t.value.indexOf('#') === 0) {
          resolvedType = 'COLOR';
          value = hexToRgba(t.value);
        } else if (t.value.indexOf('px') !== -1 && t.value.indexOf('rgba') === -1 && t.value.indexOf('clamp') === -1 && t.value.indexOf(' ') === -1) {
          var num = parseFloat(t.value);
          if (!isNaN(num)) { resolvedType = 'FLOAT'; value = num; }
        } else if (t.name.indexOf('font-family') !== -1) {
          resolvedType = 'STRING';
          value = t.value;
        } else if (t.value.indexOf('em') !== -1 && t.value.indexOf('rem') === -1) {
          var emVal = parseFloat(t.value);
          if (!isNaN(emVal)) {
            resolvedType = 'FLOAT';
            value = t.name.indexOf('letter-spacing') !== -1 ? Math.round(emVal * 100) : emVal;
          }
        } else if (t.name.indexOf('font-weight') !== -1 || t.name.indexOf('opacity') !== -1 || t.name.indexOf('line-height') !== -1) {
          var pf = parseFloat(t.value);
          if (!isNaN(pf) && t.value.indexOf('(') === -1) {
            resolvedType = 'FLOAT';
            value = t.name.indexOf('line-height') !== -1 ? Math.round(pf * 100) : pf;
          }
        } else if (t.name.indexOf('font-size') !== -1 && t.value.indexOf('clamp') !== -1) {
          var cm = t.value.match(/clamp\((\d+)px,\s*([\d.]+)vw,\s*(\d+)px\)/);
          if (cm) {
            var clampMin = parseInt(cm[1]);
            var clampVw = parseFloat(cm[2]);
            var clampMax = parseInt(cm[3]);
            resolvedType = 'FLOAT';
            perModeValues = [];
            for (var bpi = 0; bpi < PAYLOAD.screens.length && bpi < allModeIds.length; bpi++) {
              perModeValues.push(Math.round(Math.max(clampMin, Math.min(PAYLOAD.screens[bpi].width * clampVw / 100, clampMax))));
            }
            value = perModeValues[perModeValues.length - 1];
          }
        }

        // Determine if this token should scale per breakpoint (90% reduction)
        var shouldScale = resolvedType === 'FLOAT' && !perModeValues && (
          t.name.indexOf('space-') === 0 ||
          t.name.indexOf('size-') === 0 ||
          t.name.indexOf('radius-') === 0 ||
          t.name.indexOf('font-size-') === 0
        );

        if (resolvedType !== null && value !== null) {
          try {
            var v = figma.variables.createVariable(groupedName, newCol, resolvedType);
            for (var mi = 0; mi < allModeIds.length; mi++) {
              var modeVal;
              if (perModeValues) {
                modeVal = perModeValues[mi] !== undefined ? perModeValues[mi] : value;
              } else if (shouldScale) {
                modeVal = Math.round(value * SCALE_FACTORS[mi]);
              } else {
                modeVal = value;
              }
              v.setValueForMode(allModeIds[mi], modeVal);
            }
            created++;
          } catch (_e) {
            skipped++;
          }
        } else {
          skipped++;
        }
      }

      // Screen-width variable with exact breakpoint widths per mode
      try {
        var screenWidthVar = figma.variables.createVariable('size/screen-width', newCol, 'FLOAT');
        for (var swi = 0; swi < allModeIds.length && swi < PAYLOAD.screens.length; swi++) {
          screenWidthVar.setValueForMode(allModeIds[swi], PAYLOAD.screens[swi].width);
        }
        created++;
      } catch (_e2) {}

      // Store collection and mode references for frame mode assignment
      sfCollection = newCol;
      sfModeMap = {};
      sfModeMap['mobile'] = defaultModeId;
      sfModeMap['tablet'] = tabletModeId;
      sfModeMap['laptop'] = laptopModeId;
      sfModeMap['desktop'] = desktopModeId;

      log('Created ' + created + ' grouped variables (' + skipped + ' skipped)', 'success');
    });
  });
}

// ── Variable map ───────────────────────────────────────────────────────────────
function buildVarMap() {
  return figma.variables.getLocalVariableCollectionsAsync().then(function(collections) {
    var map = new Map();
    var promises = [];
    for (var ci = 0; ci < collections.length; ci++) {
      var col = collections[ci];
      for (var vi = 0; vi < col.variableIds.length; vi++) {
        (function(id) {
          promises.push(figma.variables.getVariableByIdAsync(id).then(function(v) {
            if (!v) return;
            // Map both grouped (color/brand-ink) and flat (color-brand-ink) keys
            var flatName = v.name.replace(/\//g, '-');
            map.set(flatName, v);
            map.set(v.name.split('/').pop(), v);
          }));
        })(col.variableIds[vi]);
      }
    }
    return Promise.all(promises).then(function() {
      log(collections.length + ' variable collections loaded');
      return map;
    });
  });
}

// ── Font loader ────────────────────────────────────────────────────────────────
function loadFonts() {
  var display = FONTS_CFG.fallback;
  var body = FONTS_CFG.fallback;

  function tryLoad(family, style) {
    return figma.loadFontAsync({ family: family, style: style }).then(function() {
      loadedFonts[family + '/' + style] = true;
      return true;
    }).catch(function() { return false; });
  }

  // Load all style variants for all three font families in parallel
  var families = [FONTS_CFG.display, FONTS_CFG.body, FONTS_CFG.fallback];
  var styles = ['Regular', 'Medium', 'SemiBold', 'Semi Bold', 'Bold'];
  var loads = [];
  for (var fi = 0; fi < families.length; fi++) {
    for (var si = 0; si < styles.length; si++) {
      loads.push(tryLoad(families[fi], styles[si]));
    }
  }

  return Promise.all(loads).then(function() {
    if (loadedFonts[FONTS_CFG.display + '/Regular']) {
      display = FONTS_CFG.display;
      log('Display font: ' + FONTS_CFG.display);
    } else {
      log(FONTS_CFG.display + ' unavailable, using ' + FONTS_CFG.fallback, 'warn');
    }
    if (loadedFonts[FONTS_CFG.body + '/Regular']) {
      body = FONTS_CFG.body;
    }
    var loaded = Object.keys(loadedFonts);
    log('Loaded ' + loaded.length + ' font styles');
    return { display: display, body: body };
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function solid(color, opacity) {
  return { type: 'SOLID', color: color, opacity: opacity === undefined ? 1 : opacity };
}

function bindFill(node, color, variable) {
  if (variable) {
    try { node.fills = [figma.variables.setBoundVariableForPaint(solid(color), 'color', variable)]; return; } catch (_e) {}
  }
  node.fills = [solid(color)];
}

function bindVar(node, prop, variable) {
  if (variable) { try { node.setBoundVariable(prop, variable); } catch (_e) {} }
}

function bindCornerRadius(node, r, variable) {
  node.cornerRadius = r;
  if (variable) {
    try { node.setBoundVariable('cornerRadius', variable); } catch (_e) {
      var corners = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
      for (var ci = 0; ci < corners.length; ci++) {
        try { node.setBoundVariable(corners[ci], variable); } catch (_e2) {}
      }
    }
  }
}

var loadedFonts = {};
function mapFontStyle(family, style) {
  if (style === 'SemiBold' && !loadedFonts[family + '/SemiBold'] && loadedFonts[family + '/Semi Bold']) {
    return 'Semi Bold';
  }
  return style;
}

// ── Text Style creation ────────────────────────────────────────────────────────
function createTextStyles() {
  var defs = [
    { name: 'StudioFlow/Display', family: FONTS_CFG.display, style: 'Regular' },
    { name: 'StudioFlow/Body', family: FONTS_CFG.body, style: 'Regular' },
    { name: 'StudioFlow/Body Medium', family: FONTS_CFG.body, style: 'Medium' },
    { name: 'StudioFlow/Body SemiBold', family: FONTS_CFG.body, style: 'SemiBold' },
    { name: 'StudioFlow/Body Bold', family: FONTS_CFG.body, style: 'Bold' },
  ];
  var fontLoads = [];
  for (var i = 0; i < defs.length; i++) {
    (function(def) {
      var mapped = mapFontStyle(def.family, def.style);
      fontLoads.push(
        figma.loadFontAsync({ family: def.family, style: mapped })
          .then(function() { loadedFonts[def.family + '/' + mapped] = true; return true; })
          .catch(function() { return false; })
      );
    })(defs[i]);
  }
  return Promise.all(fontLoads).then(function() {
    var existing;
    try { existing = figma.getLocalTextStyles(); } catch (_e) { existing = []; }
    for (var ri = 0; ri < existing.length; ri++) {
      if (existing[ri].name.indexOf('StudioFlow/') === 0) {
        try { existing[ri].remove(); } catch (_e2) {}
      }
    }
    var styleMap = {};
    var created = 0;
    for (var j = 0; j < defs.length; j++) {
      var def = defs[j];
      var mapped = mapFontStyle(def.family, def.style);
      if (!loadedFonts[def.family + '/' + mapped]) continue;
      try {
        var ts = figma.createTextStyle();
        ts.name = def.name;
        ts.fontName = { family: def.family, style: mapped };
        ts.fontSize = 16;
        styleMap[def.family + '/' + mapped] = ts.id;
        if (mapped !== def.style) styleMap[def.family + '/' + def.style] = ts.id;
        created++;
      } catch (_e3) {}
    }
    log('Created ' + created + ' text styles');
    return styleMap;
  });
}

function colorForStyle(style) {
  if (style === 'signal' || style === 'code') return C.signal || C.text;
  if (style === 'muted') return C.muted || C.text;
  return C.text;
}

// Create a VERTICAL auto-layout frame
function vFrame(name, opts) {
  var f = figma.createFrame();
  f.name = name;
  f.layoutMode = 'VERTICAL';
  f.primaryAxisSizingMode = opts.hugHeight === false ? 'FIXED' : 'AUTO';
  f.counterAxisSizingMode = opts.fillWidth ? 'FILL' : (opts.fixedWidth ? 'FIXED' : 'AUTO');
  f.primaryAxisAlignItems = opts.alignY || 'MIN';
  f.counterAxisAlignItems = opts.alignX || 'MIN';
  f.itemSpacing = opts.gap !== undefined ? opts.gap : 8;
  if (opts.pad !== undefined) { f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = opts.pad; }
  if (opts.padX !== undefined) { f.paddingLeft = f.paddingRight = opts.padX; }
  if (opts.padY !== undefined) { f.paddingTop = f.paddingBottom = opts.padY; }
  if (opts.padT !== undefined) f.paddingTop = opts.padT;
  if (opts.padB !== undefined) f.paddingBottom = opts.padB;
  f.fills = opts.fills !== undefined ? opts.fills : [];
  if (opts.stretch) f.layoutAlign = 'STRETCH';
  if (opts.cornerRadius) f.cornerRadius = opts.cornerRadius;
  if (opts.clip) f.clipsContent = true;
  return f;
}

// Create a HORIZONTAL auto-layout frame
function hFrame(name, opts) {
  var f = figma.createFrame();
  f.name = name;
  f.layoutMode = 'HORIZONTAL';
  f.primaryAxisSizingMode = opts.hugWidth ? 'AUTO' : 'FIXED';
  f.counterAxisSizingMode = opts.hugHeight === false ? 'FIXED' : 'AUTO';
  f.primaryAxisAlignItems = opts.alignX || 'MIN';
  f.counterAxisAlignItems = opts.alignY || 'CENTER';
  f.itemSpacing = opts.gap !== undefined ? opts.gap : 8;
  if (opts.pad !== undefined) { f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = opts.pad; }
  if (opts.padX !== undefined) { f.paddingLeft = f.paddingRight = opts.padX; }
  if (opts.padY !== undefined) { f.paddingTop = f.paddingBottom = opts.padY; }
  f.fills = opts.fills !== undefined ? opts.fills : [];
  if (opts.stretch) f.layoutAlign = 'STRETCH';
  if (opts.cornerRadius) f.cornerRadius = opts.cornerRadius;
  if (opts.wrap) f.layoutWrap = 'WRAP';
  return f;
}

// Create a text node
function txt(name, text, opts) {
  var t = figma.createText();
  t.name = name;
  var fam = opts.font || FONTS_CFG.fallback;
  var sty = mapFontStyle(fam, opts.style || 'Regular');
  if (!loadedFonts[fam + '/' + sty]) {
    fam = FONTS_CFG.fallback;
    sty = mapFontStyle(fam, opts.style || 'Regular');
  }
  t.fontName = { family: fam, style: sty };
  t.characters = text;
  t.fontSize = opts.size || 16;
  if (opts.lineHeight !== undefined) t.lineHeight = { unit: 'PERCENT', value: opts.lineHeight };
  if (opts.letterSpacing !== undefined) t.letterSpacing = { unit: 'PERCENT', value: opts.letterSpacing };
  if (opts.upperCase) t.textCase = 'UPPER';
  t.fills = [solid(opts.color || C.text)];
  if (opts.stretch) {
    t.layoutAlign = 'STRETCH';
    t.textAutoResize = 'HEIGHT';
  } else {
    t.textAutoResize = 'WIDTH_AND_HEIGHT';
  }
  if (opts.maxWidth) {
    t.textAutoResize = 'HEIGHT';
    t.resize(opts.maxWidth, t.height);
    t.layoutAlign = 'STRETCH';
  }
  return t;
}

// ── Main ───────────────────────────────────────────────────────────────────────
function createScreenFrames() {
  return createTokenVariables().then(function() {
  return buildVarMap().then(function(vars) {
    return loadFonts().then(function(fonts) {
      var page = figma.currentPage;
      var xOffset = 0;
      var existingPos = new Map();

      var PLUGIN_PANEL_NAME = 'Plugin Panel';

      // Remove any previous screen frames and record their positions
      for (var ni = page.children.length - 1; ni >= 0; ni--) {
        var node = page.children[ni];
        var isOurs = node.name === PLUGIN_PANEL_NAME;
        for (var sk = 0; sk < SCREENS.length; sk++) {
          if (node.name === SCREENS[sk].name) { isOurs = true; break; }
        }
        if (isOurs) {
          existingPos.set(node.name, { x: node.x, y: node.y });
          node.remove();
        } else {
          var r = node.x + (node.width || 0);
          if (r > xOffset) xOffset = r + CANVAS_GAP;
        }
      }

      // If all existing frames were ours, start from 0
      if (existingPos.size > 0 && page.children.length === 0) xOffset = 0;

      var results = [];
      var desktopBp = SCREENS[SCREENS.length - 1].breakpoint;
      var desktopScale = PAYLOAD.scale[desktopBp];

      for (var si = 0; si < SCREENS.length; si++) {
        var screen = SCREENS[si];
        var bpScale = PAYLOAD.scale[screen.breakpoint];
        var scale = { titlePx: desktopScale.titlePx, h2Px: desktopScale.h2Px, compact: bpScale.compact };
        log('Building: ' + screen.name + ' (' + screen.width + 'px)');

        var prev = existingPos.get(screen.name);
        var frame = figma.createFrame();
        frame.name = screen.name;
        if (prev) {
          frame.x = prev.x;
          frame.y = prev.y;
        } else {
          frame.x = xOffset;
          frame.y = 0;
          xOffset += screen.width + CANVAS_GAP;
        }

        frame.resize(screen.width, 100);
        frame.layoutMode = 'VERTICAL';
        frame.primaryAxisSizingMode = 'AUTO';
        frame.counterAxisSizingMode = 'FIXED';
        frame.primaryAxisAlignItems = 'CENTER';
        frame.counterAxisAlignItems = 'CENTER';
        frame.itemSpacing = 0;
        frame.clipsContent = false;
        bindFill(frame, C.bg, vars.get('color-brand-bg'));

        // Set the variable mode for this breakpoint
        if (sfCollection && sfModeMap[screen.breakpoint]) {
          try { frame.setExplicitVariableModeForCollection(sfCollection, sfModeMap[screen.breakpoint]); } catch (_e) {}
        }

        // Bind frame width to the screen-width variable
        bindVar(frame, 'width', vars.get('size-screen-width'));

        var shellW = Math.min(screen.width, 1200);
        var shellPad = scale.compact ? 8 : 24;
        var shell = vFrame('content-shell', { gap: shellPad, padX: shellPad, padY: shellPad, fills: [] });
        shell.resize(shellW, 100);
        shell.layoutMode = 'VERTICAL';
        shell.primaryAxisSizingMode = 'AUTO';
        shell.counterAxisSizingMode = 'FIXED';
        shell.counterAxisAlignItems = 'MIN';
        frame.appendChild(shell);

        var ctx = { screen: screen, scale: scale, vars: vars, fonts: fonts };

        for (var sci = 0; sci < SECTIONS.length; sci++) {
          renderSection(shell, SECTIONS[sci], ctx);
        }

        results.push({ id: frame.id, name: frame.name, width: frame.width });
        log('  Done: ' + screen.name, 'success');
      }

      // ── Plugin Panel design frame ──────────────────────────────────────────
      var ppPrev = existingPos.get(PLUGIN_PANEL_NAME);
      var ppFrame = renderPluginPanel(PLUGIN_PANEL_NAME, fonts);
      if (ppPrev) {
        ppFrame.x = ppPrev.x;
        ppFrame.y = ppPrev.y;
      } else {
        ppFrame.x = xOffset;
        ppFrame.y = 0;
      }
      results.push({ id: ppFrame.id, name: ppFrame.name, width: ppFrame.width });
      log('  Done: ' + PLUGIN_PANEL_NAME, 'success');

      return results;
    });
  });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// PLUGIN PANEL DESIGN
// ══════════════════════════════════════════════════════════════════════════════

function renderPluginPanel(name, fonts) {
  var P = {
    bg:      hexToRgb('#2C2C2C'),
    surface: hexToRgb('#383838'),
    border:  hexToRgb('#4A4A4A'),
    text:    hexToRgb('#E0E0E0'),
    muted:   hexToRgb('#999999'),
    dim:     hexToRgb('#666666'),
    push:    hexToRgb('#7EF7F0'),
    pushFg:  hexToRgb('#0A0A0A'),
    pull:    hexToRgb('#7A8DFF'),
    pullFg:  hexToRgb('#FFFFFF'),
  };

  var W = 270;
  var font = fonts.body || FONTS_CFG.fallback;

  var root = vFrame(name, { gap: 0, fills: [solid(P.bg)], clip: true });
  root.resize(W, 100);
  root.counterAxisSizingMode = 'FIXED';
  root.primaryAxisSizingMode = 'AUTO';

  // ── Header (gradient bg, status dot in brand row) ──
  var headerBg = vFrame('header-bg', { gap: 0, fills: [
    solid(P.bg),
    { type: 'GRADIENT_LINEAR', gradientStops: [
      { position: 0, color: { r: P.push.r, g: P.push.g, b: P.push.b, a: 0.06 } },
      { position: 0.5, color: { r: P.pull.r, g: P.pull.g, b: P.pull.b, a: 0.08 } },
      { position: 1, color: { r: P.push.r, g: P.push.g, b: P.push.b, a: 0.06 } },
    ], gradientTransform: [[0.87, 0.5, 0], [-0.5, 0.87, 0.25]] },
  ], stretch: true });
  headerBg.layoutAlign = 'STRETCH';
  headerBg.counterAxisSizingMode = 'AUTO';

  var header = hFrame('header', { gap: 6, padX: 12, padY: 10, fills: [], stretch: true, alignX: 'SPACE_BETWEEN', alignY: 'CENTER' });
  header.layoutAlign = 'STRETCH';
  header.counterAxisSizingMode = 'AUTO';

  var brandRow = hFrame('brand', { gap: 5, hugWidth: true, fills: [], alignY: 'CENTER' });
  brandRow.counterAxisSizingMode = 'AUTO';
  brandRow.appendChild(txt('brand-name', 'StudioFlow', { font: font, style: 'SemiBold', size: 11, color: P.text }));
  var statusDotH = figma.createEllipse();
  statusDotH.name = 'status-dot';
  statusDotH.resize(5, 5);
  statusDotH.fills = [solid(P.push)];
  brandRow.appendChild(statusDotH);
  brandRow.appendChild(txt('status-text', 'Ready', { font: font, style: 'Regular', size: 8, color: P.dim }));

  header.appendChild(brandRow);
  header.appendChild(txt('version', 'v4.0', { font: font, style: 'Regular', size: 9, color: P.dim }));
  headerBg.appendChild(header);

  var headerSep = figma.createRectangle();
  headerSep.name = 'header-sep';
  headerSep.resize(W, 1);
  headerSep.fills = [solid(P.border)];

  root.appendChild(headerBg);
  root.appendChild(headerSep);

  // ── Context banner (sync target) ──
  var contextBanner = hFrame('context', { gap: 4, padX: 12, padY: 5, fills: [{ type: 'SOLID', color: P.pull, opacity: 0.08 }], stretch: true, alignY: 'CENTER' });
  contextBanner.layoutAlign = 'STRETCH';
  contextBanner.counterAxisSizingMode = 'AUTO';
  var contextDot = figma.createEllipse();
  contextDot.name = 'context-dot';
  contextDot.resize(5, 5);
  contextDot.fills = [solid(P.pull)];
  contextBanner.appendChild(contextDot);
  contextBanner.appendChild(txt('context-text', 'Target: entire page', { font: font, style: 'Regular', size: 9, color: P.pull }));

  var contextSep = figma.createRectangle();
  contextSep.name = 'context-sep';
  contextSep.resize(W, 1);
  contextSep.fills = [solid(P.border)];

  root.appendChild(contextBanner);
  root.appendChild(contextSep);

  // ── Section helper (no arrow badges, just label) ──
  function sectionBlock(label, desc) {
    var sec = vFrame('section', { gap: 6, padX: 12, padY: 10, fills: [], stretch: true });
    sec.layoutAlign = 'STRETCH';
    sec.counterAxisSizingMode = 'AUTO';
    sec.appendChild(txt('section-label', label, { font: font, style: 'SemiBold', size: 9, color: P.muted }));
    sec.appendChild(txt('section-desc', desc, { font: font, style: 'Regular', size: 9, color: P.dim, stretch: true, lineHeight: 140 }));
    return sec;
  }

  // ── Solid button ──
  function btnSolid(icon, label, bgColor, fgColor) {
    var b = hFrame('btn', { gap: 5, padX: 12, padY: 8, fills: [solid(bgColor)], cornerRadius: 6, alignX: 'CENTER', alignY: 'CENTER' });
    b.layoutAlign = 'STRETCH';
    b.counterAxisSizingMode = 'AUTO';
    b.primaryAxisSizingMode = 'FIXED';
    b.primaryAxisAlignItems = 'CENTER';
    b.appendChild(txt('btn-icon', icon, { font: font, style: 'Regular', size: 12, color: fgColor }));
    b.appendChild(txt('btn-label', label, { font: font, style: 'Bold', size: 11, color: fgColor }));
    return b;
  }

  // ── Ghost button (transparent bg, teal border) ──
  function btnGhost(icon, label) {
    var b = hFrame('btn', { gap: 5, padX: 12, padY: 8, fills: [solid(P.bg, 0)], cornerRadius: 6, alignX: 'CENTER', alignY: 'CENTER' });
    b.layoutAlign = 'STRETCH';
    b.counterAxisSizingMode = 'AUTO';
    b.primaryAxisSizingMode = 'FIXED';
    b.primaryAxisAlignItems = 'CENTER';
    b.strokes = [solid(P.push)];
    b.strokeWeight = 1;
    b.strokeAlign = 'INSIDE';
    b.appendChild(txt('btn-icon', icon, { font: font, style: 'Regular', size: 12, color: P.text }));
    b.appendChild(txt('btn-label', label, { font: font, style: 'Bold', size: 11, color: P.text }));
    return b;
  }

  // ── Code → Figma section ──
  var pushSec = sectionBlock('CODE → FIGMA', 'Rebuild all screen frames and token variables on this canvas from code.');
  pushSec.appendChild(btnSolid('⟳', 'Sync to Figma', P.push, P.pushFg));

  var pushSep = figma.createRectangle();
  pushSep.name = 'push-sep';
  pushSep.resize(W, 1);
  pushSep.fills = [solid(P.border)];

  root.appendChild(pushSec);
  root.appendChild(pushSep);

  // ── Figma → Code section (ghost button) ──
  var syncSec = sectionBlock('FIGMA → CODE', 'Send your design changes back to the codebase in one step.');
  syncSec.appendChild(btnGhost('⟳', 'Sync to Code'));

  var syncSep = figma.createRectangle();
  syncSep.name = 'sync-sep';
  syncSep.resize(W, 1);
  syncSep.fills = [solid(P.border)];

  root.appendChild(syncSec);
  root.appendChild(syncSep);

  // ── Log ──
  var logHeader = hFrame('log-header', { gap: 0, padX: 12, padY: 5, fills: [], stretch: true, alignX: 'SPACE_BETWEEN', alignY: 'CENTER' });
  logHeader.layoutAlign = 'STRETCH';
  logHeader.counterAxisSizingMode = 'AUTO';
  logHeader.appendChild(txt('log-label', 'LOG', { font: font, style: 'SemiBold', size: 9, color: P.dim }));
  logHeader.appendChild(txt('log-clear', 'Clear', { font: font, style: 'Regular', size: 8, color: P.dim }));

  var logSep = figma.createRectangle();
  logSep.name = 'log-sep';
  logSep.resize(W, 1);
  logSep.fills = [solid(P.border)];

  var logArea = vFrame('log-area', { gap: 1, padX: 12, padY: 6, fills: [], stretch: true });
  logArea.layoutAlign = 'STRETCH';
  logArea.counterAxisSizingMode = 'AUTO';
  logArea.minHeight = 80;
  logArea.appendChild(txt('log-entry', 'Awaiting action…', { font: font, style: 'Regular', size: 8, color: P.muted, stretch: true }));

  root.appendChild(logHeader);
  root.appendChild(logSep);
  root.appendChild(logArea);

  // ── Footer ──
  var footerSep = figma.createRectangle();
  footerSep.name = 'footer-sep';
  footerSep.resize(W, 1);
  footerSep.fills = [solid(P.border)];
  root.appendChild(footerSep);

  var footer = hFrame('footer', { gap: 0, padX: 12, padY: 6, fills: [], stretch: true, alignX: 'SPACE_BETWEEN', alignY: 'CENTER' });
  footer.layoutAlign = 'STRETCH';
  footer.counterAxisSizingMode = 'AUTO';

  footer.appendChild(txt('footer-brand', 'StudioFlow v4.0.0', { font: font, style: 'Regular', size: 8, color: P.dim }));

  var footerRight = hFrame('footer-right', { gap: 8, hugWidth: true, fills: [], alignY: 'CENTER' });
  footerRight.counterAxisSizingMode = 'AUTO';
  footerRight.appendChild(txt('footer-docs', 'Docs ↗', { font: font, style: 'Regular', size: 8, color: P.dim }));
  footerRight.appendChild(txt('footer-github', 'GitHub ↗', { font: font, style: 'Regular', size: 8, color: P.dim }));
  footer.appendChild(footerRight);
  root.appendChild(footer);

  log('  Plugin Panel');
  return root;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION DISPATCHER
// ══════════════════════════════════════════════════════════════════════════════

function renderSection(parent, section, ctx) {
  switch (section.type) {
    case 'nav': renderNav(parent, section, ctx); break;
    case 'hero': renderHero(parent, section, ctx); break;
    case 'card-section': renderCardSection(parent, section, ctx); break;
    case 'split-section': renderSplitSection(parent, section, ctx); break;
    case 'footer': renderFooter(parent, section, ctx); break;
    default: log('  Unknown section type: ' + section.type, 'warn');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION RENDERERS
// ══════════════════════════════════════════════════════════════════════════════

// ── Nav ────────────────────────────────────────────────────────────────────────
function renderNav(parent, section, ctx) {
  var content = section.content;
  var nav = hFrame('top-nav', {
    gap: 8, padX: 16, padY: 8,
    alignX: 'SPACE_BETWEEN', alignY: 'CENTER',
    fills: [solid(C.surface)], stretch: true, cornerRadius: 20,
  });
  nav.strokes = [solid(C.stroke)];
  nav.strokeWeight = 1;
  nav.strokeAlign = 'INSIDE';
  nav.layoutAlign = 'STRETCH';
  nav.counterAxisSizingMode = 'AUTO';
  parent.appendChild(nav);

  var brand = txt('brand-name', content.brand || PAYLOAD.project, {
    font: ctx.fonts.display, style: 'Regular', size: 22, color: C.text,
    letterSpacing: -3,
  });
  nav.appendChild(brand);

  if (!ctx.scale.compact && content.links) {
    var links = hFrame('nav-links', { gap: 4, hugWidth: true, fills: [] });
    for (var li = 0; li < content.links.length; li++) {
      var chip = hFrame('nav-link', {
        gap: 0, hugWidth: true, padX: 8, padY: 4,
        fills: [], cornerRadius: 999,
      });
      chip.counterAxisSizingMode = 'AUTO';
      chip.appendChild(txt('link-' + content.links[li], content.links[li], {
        font: ctx.fonts.body, style: 'Regular', size: 14, color: C.muted,
      }));
      links.appendChild(chip);
    }
    nav.appendChild(links);
  } else if (content.links) {
    nav.appendChild(txt('nav-links', content.links.slice(0, 3).join('  '), {
      font: ctx.fonts.body, style: 'Regular', size: 13, color: C.muted,
    }));
  }

  log('  Nav bar');
}

// ── Hero ───────────────────────────────────────────────────────────────────────
function renderHero(parent, section, ctx) {
  var content = section.content;
  var sfids = section.sfids || {};
  var maxW = Math.min(ctx.screen.width - (ctx.scale.compact ? 16 : 48), 780);

  var panel = vFrame(sfids.root || 'hero-content', {
    gap: 16, pad: ctx.scale.compact ? 16 : 44,
    fills: [solid(C.surface)], stretch: true, cornerRadius: 20,
  });
  if (sfids.root) panel.setPluginData('sfid', sfids.root);
  panel.strokes = [solid(C.stroke)];
  panel.strokeWeight = 1;
  panel.strokeAlign = 'INSIDE';
  panel.layoutAlign = 'STRETCH';
  panel.counterAxisSizingMode = 'AUTO';
  bindVar(panel, 'itemSpacing', ctx.vars.get('space-md'));
  bindCornerRadius(panel, 20, ctx.vars.get('radius-lg'));
  parent.appendChild(panel);

  // Announcement
  if (content.announcement) {
    panel.appendChild(txt('announcement', content.announcement, {
      font: ctx.fonts.body, style: 'Regular', size: 14, color: C.signal,
      upperCase: true, letterSpacing: 16, stretch: true,
    }));
  }

  // Kicker
  if (content.kicker) {
    var kicker = txt(sfids.kicker || 'hero-kicker', content.kicker.toUpperCase(), {
      font: ctx.fonts.body, style: 'Regular', size: 13, color: C.muted,
      upperCase: true, letterSpacing: 16, stretch: true,
    });
    if (sfids.kicker) kicker.setPluginData('sfid', sfids.kicker);
    bindVar(kicker, 'fontSize', ctx.vars.get('font-size-kicker'));
    panel.appendChild(kicker);
  }

  // Title
  var titleSize = ctx.scale.titlePx;
  var title = txt(sfids.title || 'hero-title', content.title, {
    font: ctx.fonts.display, style: 'Regular', size: titleSize, color: C.text,
    lineHeight: 96, letterSpacing: -3, maxWidth: maxW,
  });
  if (sfids.title) title.setPluginData('sfid', sfids.title);
  panel.appendChild(title);

  // Body / value statement
  if (content.body) {
    var body = txt(sfids.body || 'hero-body', content.body, {
      font: ctx.fonts.body, style: 'Regular', size: 16, color: C.muted,
      lineHeight: 160, maxWidth: Math.min(maxW, 700),
    });
    if (sfids.body) body.setPluginData('sfid', sfids.body);
    bindVar(body, 'fontSize', ctx.vars.get('font-size-body'));
    panel.appendChild(body);
  }

  // Supporting paragraph
  if (content.supportingParagraph) {
    panel.appendChild(txt('section-copy', content.supportingParagraph, {
      font: ctx.fonts.body, style: 'Regular', size: 16, color: C.muted,
      lineHeight: 160, stretch: true,
    }));
  }

  // Command box
  if (content.commandLine) {
    var cmdBox = hFrame('command-box', {
      gap: 8, padX: 16, padY: 8,
      alignX: 'SPACE_BETWEEN', alignY: 'CENTER',
      fills: [solid(C.panel)], stretch: true, cornerRadius: 12,
    });
    cmdBox.strokes = [solid(C.strokeStrong)];
    cmdBox.strokeWeight = 1;
    cmdBox.strokeAlign = 'INSIDE';
    cmdBox.layoutAlign = 'STRETCH';
    cmdBox.counterAxisSizingMode = 'AUTO';
    panel.appendChild(cmdBox);

    cmdBox.appendChild(txt('command-line', content.commandLine, {
      font: ctx.fonts.body, style: 'Regular', size: 16, color: C.signal,
    }));

    var copyBtn = hFrame('command-copy', {
      gap: 0, hugWidth: true, padX: 8, padY: 2,
      fills: [], cornerRadius: 999,
    });
    copyBtn.counterAxisSizingMode = 'AUTO';
    copyBtn.strokes = [solid(C.strokeStrong)];
    copyBtn.strokeWeight = 1;
    copyBtn.strokeAlign = 'INSIDE';
    copyBtn.appendChild(txt('copy-label', 'Copy', {
      font: ctx.fonts.body, style: 'Regular', size: 14, color: C.text,
    }));
    cmdBox.appendChild(copyBtn);
  }

  // Command hint
  if (content.commandHint) {
    panel.appendChild(txt('command-hint', content.commandHint, {
      font: ctx.fonts.body, style: 'Regular', size: 14, color: C.muted,
      lineHeight: 160, stretch: true,
    }));
  }

  // Actions (CTAs)
  if (content.primaryCta || content.secondaryCta) {
    var actions;
    if (ctx.scale.compact) {
      actions = vFrame(sfids.actions || 'hero-actions', { gap: 8, fills: [], stretch: true });
      actions.layoutAlign = 'STRETCH';
      actions.counterAxisSizingMode = 'AUTO';
    } else {
      actions = hFrame(sfids.actions || 'hero-actions', { gap: 8, hugWidth: true, fills: [] });
      actions.counterAxisSizingMode = 'AUTO';
    }
    if (sfids.actions) actions.setPluginData('sfid', sfids.actions);
    bindVar(actions, 'itemSpacing', ctx.vars.get('space-sm'));
    panel.appendChild(actions);

    if (content.primaryCta) renderButton(actions, content.primaryCta, true, sfids.primaryCta, ctx);
    if (content.secondaryCta) renderButton(actions, content.secondaryCta, false, sfids.secondaryCta, ctx);
  }

  log('  Hero block');
}

// ── Button ─────────────────────────────────────────────────────────────────────
function renderButton(parent, label, isPrimary, sfid, ctx) {
  var btn = hFrame(sfid || (isPrimary ? 'primary-cta' : 'secondary-cta'), {
    gap: 4, padX: 24, padY: 8, hugWidth: !ctx.scale.compact,
    alignX: 'CENTER', alignY: 'CENTER',
    fills: isPrimary ? [solid(C.primary)] : [solid(C.ink, 0)],
    cornerRadius: 999,
  });
  if (sfid) btn.setPluginData('sfid', sfid);
  btn.counterAxisSizingMode = 'AUTO';
  if (ctx.scale.compact) {
    btn.layoutAlign = 'STRETCH';
    btn.primaryAxisSizingMode = 'FIXED';
    btn.primaryAxisAlignItems = 'CENTER';
  } else {
    btn.minWidth = 210;
    bindVar(btn, 'minWidth', ctx.vars.get('size-button-min-width'));
  }
  if (!isPrimary) {
    btn.strokes = [solid(C.strokeStrong)];
    btn.strokeWeight = 1;
    btn.strokeAlign = 'INSIDE';
  }
  bindCornerRadius(btn, 999, ctx.vars.get('radius-pill'));
  bindVar(btn, 'paddingTop', ctx.vars.get('space-sm'));
  bindVar(btn, 'paddingBottom', ctx.vars.get('space-sm'));
  bindVar(btn, 'paddingLeft', ctx.vars.get('space-lg'));
  bindVar(btn, 'paddingRight', ctx.vars.get('space-lg'));

  btn.appendChild(txt('label', label, {
    font: ctx.fonts.body, style: 'Medium', size: 16,
    color: isPrimary ? C.ink : C.text,
  }));
  parent.appendChild(btn);
}

// ── Card Section ───────────────────────────────────────────────────────────────
function renderCardSection(parent, section, ctx) {
  var content = section.content;
  var wrapper = buildSectionWrapper(section.name || 'section', parent);

  appendSectionTitle(wrapper, content.title, ctx);
  appendSectionBody(wrapper, content.body, ctx);

  var grid = buildGrid(section.name + '-grid', wrapper, ctx.scale, content.columns || 2);

  var isCompact = content.cardStyle === 'compact';
  var items = content.items || [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var card = vFrame('card', {
      gap: isCompact ? 2 : 4,
      pad: isCompact ? 8 : 16,
      fills: isCompact ? [solid(C.panel)] : [solid(C.surface)],
      cornerRadius: isCompact ? 12 : 20,
    });
    card.strokes = [solid(C.stroke)];
    card.strokeWeight = 1;
    card.strokeAlign = 'INSIDE';
    card.layoutAlign = 'STRETCH';
    card.counterAxisSizingMode = 'AUTO';
    card.layoutGrow = 1;

    card.appendChild(txt('heading', item.heading, {
      font: ctx.fonts.body, style: isCompact ? 'Medium' : 'SemiBold',
      size: isCompact ? 16 : 22, color: C.text, stretch: true,
      letterSpacing: isCompact ? 0 : -3,
    }));

    var lines = item.lines || [];
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      card.appendChild(txt('line-' + li, line.text, {
        font: ctx.fonts.body, style: 'Regular',
        size: line.style === 'signal' || line.style === 'code' ? 13 : 14,
        color: colorForStyle(line.style || 'muted'),
        stretch: true, lineHeight: 150,
      }));
    }

    grid.appendChild(card);
  }

  log('  ' + (section.name || 'Card section'));
}

// ── Split Section ──────────────────────────────────────────────────────────────
function renderSplitSection(parent, section, ctx) {
  var content = section.content;
  var panels = content.panels || [];

  var wrapper;
  if (ctx.scale.compact) {
    wrapper = vFrame(section.name || 'split-section', { gap: 8, fills: [], stretch: true });
  } else {
    wrapper = hFrame(section.name || 'split-section', { gap: 8, fills: [], stretch: true });
  }
  wrapper.layoutAlign = 'STRETCH';
  wrapper.counterAxisSizingMode = 'AUTO';
  parent.appendChild(wrapper);

  for (var pi = 0; pi < panels.length; pi++) {
    var panelData = panels[pi];

    var panel = vFrame('panel-card', {
      gap: 8, pad: 16,
      fills: [solid(C.surface)], cornerRadius: 20,
    });
    panel.strokes = [solid(C.stroke)];
    panel.strokeWeight = 1;
    panel.strokeAlign = 'INSIDE';
    panel.layoutAlign = 'STRETCH';
    panel.counterAxisSizingMode = 'AUTO';
    panel.layoutGrow = 1;
    wrapper.appendChild(panel);

    // Title
    var titleSize = panelData.titleStyle === 'small' ? 22 : ctx.scale.h2Px;
    panel.appendChild(txt('section-title', panelData.title, {
      font: ctx.fonts.display, style: 'Regular', size: titleSize, color: C.text,
      letterSpacing: -3, stretch: true,
    }));

    // Body
    if (panelData.body) {
      panel.appendChild(txt('section-copy', panelData.body, {
        font: ctx.fonts.body, style: 'Regular', size: 16, color: C.muted,
        lineHeight: 160, stretch: true,
      }));
    }

    // Items list
    var itemList = vFrame('item-list', { gap: 4, fills: [], stretch: true });
    itemList.layoutAlign = 'STRETCH';
    itemList.counterAxisSizingMode = 'AUTO';
    panel.appendChild(itemList);

    var items = panelData.items || [];
    for (var ii = 0; ii < items.length; ii++) {
      var item = items[ii];
      var si = vFrame('step-item', {
        gap: 2, pad: 8,
        fills: [solid(C.panel)], cornerRadius: 12,
      });
      si.strokes = [solid(C.stroke)];
      si.strokeWeight = 1;
      si.strokeAlign = 'INSIDE';
      si.layoutAlign = 'STRETCH';
      si.counterAxisSizingMode = 'AUTO';

      si.appendChild(txt('heading', item.heading, {
        font: ctx.fonts.body, style: 'SemiBold', size: 16, color: C.text, stretch: true,
      }));

      var lines = item.lines || [];
      for (var li = 0; li < lines.length; li++) {
        si.appendChild(txt('line-' + li, lines[li].text, {
          font: ctx.fonts.body, style: 'Regular',
          size: lines[li].style === 'signal' ? 13 : 14,
          color: colorForStyle(lines[li].style || 'muted'),
          stretch: true, lineHeight: 150,
        }));
      }

      itemList.appendChild(si);
    }
  }

  log('  ' + (section.name || 'Split section'));
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function renderFooter(parent, section, ctx) {
  var content = section.content;

  var footer = vFrame('footer', {
    gap: 8, pad: ctx.scale.compact ? 8 : 16,
    fills: [solid(C.surface)], stretch: true, cornerRadius: 20,
  });
  footer.strokes = [solid(C.stroke)];
  footer.strokeWeight = 1;
  footer.strokeAlign = 'INSIDE';
  footer.layoutAlign = 'STRETCH';
  footer.counterAxisSizingMode = 'AUTO';
  parent.appendChild(footer);

  // Footer columns
  var cols;
  if (ctx.scale.compact) {
    cols = vFrame('footer-columns', { gap: 8, fills: [], stretch: true });
  } else {
    cols = hFrame('footer-columns', { gap: 8, fills: [], stretch: true });
  }
  cols.layoutAlign = 'STRETCH';
  cols.counterAxisSizingMode = 'AUTO';
  footer.appendChild(cols);

  var groups = content.groups || [];
  for (var gi = 0; gi < groups.length; gi++) {
    var group = groups[gi];
    var g = vFrame('footer-group', { gap: 2, fills: [] });
    g.layoutAlign = 'STRETCH';
    g.counterAxisSizingMode = 'AUTO';
    g.layoutGrow = 1;

    g.appendChild(txt('title', group.title, {
      font: ctx.fonts.body, style: 'SemiBold', size: 22, color: C.text,
      stretch: true, letterSpacing: -3,
    }));

    var links = group.links || [];
    for (var li = 0; li < links.length; li++) {
      g.appendChild(txt('link', links[li], {
        font: ctx.fonts.body, style: 'Regular', size: 14, color: C.muted, stretch: true,
      }));
    }
    cols.appendChild(g);
  }

  // Legal line
  if (content.legalLine) {
    footer.appendChild(txt('footer-legal', content.legalLine, {
      font: ctx.fonts.body, style: 'Regular', size: 14, color: C.muted, stretch: true,
    }));
  }

  log('  Footer');
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function buildSectionWrapper(name, parent) {
  var section = vFrame(name, { gap: 8, pad: 0, fills: [], stretch: true });
  section.layoutAlign = 'STRETCH';
  section.counterAxisSizingMode = 'AUTO';
  parent.appendChild(section);
  return section;
}

function appendSectionTitle(section, text, ctx) {
  if (!text) return;
  section.appendChild(txt('section-title', text, {
    font: ctx.fonts.display, style: 'Regular', size: ctx.scale.h2Px, color: C.text,
    letterSpacing: -3, stretch: true,
  }));
}

function appendSectionBody(section, text, ctx) {
  if (!text) return;
  section.appendChild(txt('section-copy', text, {
    font: ctx.fonts.body, style: 'Regular', size: 16, color: C.muted,
    lineHeight: 160, stretch: true,
  }));
}

function buildGrid(name, parent, scale, desiredCols) {
  var grid;
  if (scale.compact) {
    grid = vFrame(name, { gap: 8, fills: [], stretch: true });
  } else {
    grid = hFrame(name, { gap: 8, fills: [], stretch: true, wrap: true });
    grid.counterAxisSpacing = 8;
  }
  grid.layoutAlign = 'STRETCH';
  grid.counterAxisSizingMode = 'AUTO';
  parent.appendChild(grid);
  return grid;
}

// ══════════════════════════════════════════════════════════════════════════════
// VARIABLE BINDING
// ══════════════════════════════════════════════════════════════════════════════

function bindAllVariables() {
  return createTextStyles().then(function(textStyleMap) {
    return figma.variables.getLocalVariableCollectionsAsync().then(function(collections) {
      var colorByHex = new Map();
      var floatByVal = new Map();
      var promises = [];

      for (var ci = 0; ci < collections.length; ci++) {
        var col = collections[ci];
        for (var vi = 0; vi < col.variableIds.length; vi++) {
          (function(colRef, id) {
            promises.push(figma.variables.getVariableByIdAsync(id).then(function(v) {
              if (!v) return;
              var flatName = v.name.replace(/\//g, '-');
              var modeId = colRef.modes[colRef.modes.length - 1] ? colRef.modes[colRef.modes.length - 1].modeId : (colRef.modes[0] ? colRef.modes[0].modeId : undefined);
              if (!modeId) return;
              var val = v.valuesByMode[modeId];
              if (val === undefined) return;
              if (v.resolvedType === 'COLOR' && typeof val === 'object' && 'r' in val) {
                var hex = toHex(val);
                if (!colorByHex.has(hex)) colorByHex.set(hex, v);
              } else if (v.resolvedType === 'FLOAT' && typeof val === 'number') {
                if (!floatByVal.has(val)) floatByVal.set(val, []);
                floatByVal.get(val).push({ variable: v, flatName: flatName });
              }
            }));
          })(col, col.variableIds[vi]);
        }
      }

      return Promise.all(promises).then(function() {
        log('Binding: ' + colorByHex.size + ' colors, ' + floatByVal.size + ' numeric values');
        var visited = 0;
        var bound = 0;

        function findFloat(value, prefix) {
          var candidates = floatByVal.get(value);
          if (!candidates) return null;
          for (var i = 0; i < candidates.length; i++) {
            if (candidates[i].flatName.indexOf(prefix) === 0) return candidates[i];
          }
          return null;
        }

        function walk(node) {
          visited++;

          // Fills (immediate)
          if ('fills' in node && Array.isArray(node.fills)) {
            for (var fi = 0; fi < node.fills.length; fi++) {
              var fill = node.fills[fi];
              if (fill.type === 'SOLID' && fill.color) {
                var mv = colorByHex.get(toHex(fill.color));
                if (mv) { try { node.setBoundVariable('fills/' + fi + '/color', mv); bound++; } catch (_e) {} }
              }
            }
          }

          // Strokes (immediate)
          if ('strokes' in node && Array.isArray(node.strokes)) {
            for (var sti = 0; sti < node.strokes.length; sti++) {
              var s = node.strokes[sti];
              if (s.type === 'SOLID' && s.color) {
                var sv = colorByHex.get(toHex(s.color));
                if (sv) { try { node.setBoundVariable('strokes/' + sti + '/color', sv); bound++; } catch (_e) {} }
              }
            }
          }

          // Numeric field bindings
          var numericFields = [
            ['paddingTop', 'space-'], ['paddingRight', 'space-'],
            ['paddingBottom', 'space-'], ['paddingLeft', 'space-'],
            ['itemSpacing', 'space-'], ['strokeWeight', 'size-border-'],
            ['fontSize', 'font-size-'], ['minWidth', 'size-'],
            ['maxWidth', 'size-'], ['minHeight', 'size-'],
            ['cornerRadius', 'radius-'],
          ];

          var isText = node.type === 'TEXT';
          var deferred = [];

          for (var nfi = 0; nfi < numericFields.length; nfi++) {
            var prop = numericFields[nfi][0];
            var prefix = numericFields[nfi][1];
            if (prop in node && typeof node[prop] === 'number') {
              var match = findFloat(node[prop], prefix);
              if (match) {
                if (isText) {
                  deferred.push({ prop: prop, variable: match.variable });
                } else {
                  try { node.setBoundVariable(prop, match.variable); bound++; } catch (_e) {}
                }
              }
            }
          }

          // Text nodes: collect deferred bindings, apply text style, then bind
          if (isText) {
            if (node.lineHeight && node.lineHeight.unit === 'PERCENT') {
              var lhMatch = findFloat(node.lineHeight.value, 'font-line-height-');
              if (lhMatch) deferred.push({ prop: 'lineHeight', variable: lhMatch.variable });
            }
            if (node.letterSpacing && node.letterSpacing.unit === 'PERCENT' && node.letterSpacing.value !== 0) {
              var lsMatch = findFloat(node.letterSpacing.value, 'font-letter-spacing-');
              if (lsMatch) deferred.push({ prop: 'letterSpacing', variable: lsMatch.variable });
            }

            // Apply text style (links font family)
            if (node.fontName && node.fontName !== figma.mixed && textStyleMap) {
              var fontKey = node.fontName.family + '/' + node.fontName.style;
              if (textStyleMap[fontKey]) {
                try { node.textStyleId = textStyleMap[fontKey]; bound++; } catch (_e) {}
              }
            }

            // Apply deferred bindings after text style
            for (var di = 0; di < deferred.length; di++) {
              try { node.setBoundVariable(deferred[di].prop, deferred[di].variable); bound++; } catch (_e) {}
            }
          }

          if ('children' in node) {
            for (var chi = 0; chi < node.children.length; chi++) walk(node.children[chi]);
          }
        }

        var page = figma.currentPage;
        for (var pci = 0; pci < page.children.length; pci++) {
          var pnode = page.children[pci];
          if (SCREENS.some(function(s) { return s.name === pnode.name; })) {
            log('  Walking "' + pnode.name + '"');
            walk(pnode);
          }
        }

        log('Done: ' + bound + ' bindings across ' + visited + ' nodes', 'success');
        return { visited: visited, bound: bound };
      });
    });
  });
}

// ── Utility ────────────────────────────────────────────────────────────────────
function toHex(c) {
  function h(v) { return Math.round(v * 255).toString(16).padStart(2, '0'); }
  return '#' + h(c.r) + h(c.g) + h(c.b);
}
