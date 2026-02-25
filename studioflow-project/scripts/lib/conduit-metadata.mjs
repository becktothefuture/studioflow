export const CONDUIT_VERSION = "1.0.0";

const HEX_COLOR_REGEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{3})$/i;
const PURE_PX_REGEX = /^\d*\.?\d+px$/i;
const PURE_EM_REGEX = /^\d*\.?\d+em$/i;
const PURE_NUMBER_REGEX = /^\d*\.?\d+$/;
const CLAMP_PX_REGEX = /^clamp\(\d+px,\s*[\d.]+vw,\s*\d+px\)$/i;

const FLOAT_BINDABLE_BY_PREFIX = [
  { prefix: "space-", properties: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "itemSpacing"] },
  { prefix: "size-border-", properties: ["strokeWeight"] },
  { prefix: "size-", properties: ["minWidth", "maxWidth", "minHeight"] },
  { prefix: "radius-", properties: ["cornerRadius"] },
  { prefix: "font-size-", properties: ["fontSize"] },
  { prefix: "font-line-height-", properties: ["lineHeight"] },
  { prefix: "font-letter-spacing-", properties: ["letterSpacing"] }
];

export function tokenToFigmaVariableName(flatTokenName) {
  const idx = flatTokenName.indexOf("-");
  if (idx === -1) {
    return flatTokenName;
  }
  return `${flatTokenName.slice(0, idx)}/${flatTokenName.slice(idx + 1)}`;
}

export function inferFigmaType(tokenName, tokenValue) {
  if (tokenName.startsWith("color-") && HEX_COLOR_REGEX.test(tokenValue)) {
    return "COLOR";
  }

  if (PURE_PX_REGEX.test(tokenValue)) {
    return "FLOAT";
  }

  if (tokenName.startsWith("font-family-")) {
    return "STRING";
  }

  if (PURE_EM_REGEX.test(tokenValue) && !tokenValue.includes("rem")) {
    return "FLOAT";
  }

  if (
    (tokenName.includes("font-weight") || tokenName.includes("opacity") || tokenName.includes("line-height")) &&
    PURE_NUMBER_REGEX.test(tokenValue)
  ) {
    return "FLOAT";
  }

  if (tokenName.startsWith("font-size-") && CLAMP_PX_REGEX.test(tokenValue)) {
    return "FLOAT";
  }

  return null;
}

function bindablePropertiesForToken(tokenName, figmaType) {
  if (figmaType === "COLOR") {
    return ["fills/*/color", "strokes/*/color"];
  }

  if (figmaType === "FLOAT") {
    for (const rule of FLOAT_BINDABLE_BY_PREFIX) {
      if (tokenName.startsWith(rule.prefix)) {
        return rule.properties;
      }
    }
  }

  if (figmaType === "STRING" && tokenName.startsWith("font-family-")) {
    return ["textStyle/fontFamily"];
  }

  return ["resolved"];
}

export function createCodeToFigmaMapping(tokens) {
  return [...tokens]
    .map((token) => {
      const figmaType = inferFigmaType(token.name, token.value);
      const bindableProperties = bindablePropertiesForToken(token.name, figmaType);

      return {
        codeTokenName: token.name,
        cssVarName: `--${token.name}`,
        cssVarReference: `var(--${token.name})`,
        figmaGroupedName: tokenToFigmaVariableName(token.name),
        figmaType: figmaType ?? "RESOLVED",
        bindingMode: bindableProperties[0] === "resolved" ? "resolved" : "variable-bound",
        bindableFigmaProperties: bindableProperties
      };
    })
    .sort((a, b) => a.codeTokenName.localeCompare(b.codeTokenName));
}

function buildStyleAssignments(styleName, tokenNames) {
  const has = (tokenName) => tokenNames.has(tokenName);

  if (styleName === "Surface/Card") {
    const assignments = {};
    if (has("color-brand-surface")) assignments["fills/0/color"] = "color-brand-surface";
    if (has("color-brand-stroke")) assignments["strokes/0/color"] = "color-brand-stroke";
    if (has("radius-lg")) assignments.cornerRadius = "radius-lg";
    if (has("shadow-card")) assignments["effects/dropShadow"] = "shadow-card";
    return assignments;
  }

  if (styleName === "Action/ButtonPrimary") {
    const assignments = {};
    if (has("color-brand-primary")) assignments["fills/0/color"] = "color-brand-primary";
    if (has("color-brand-ink")) assignments["text/fills/0/color"] = "color-brand-ink";
    if (has("radius-pill")) assignments.cornerRadius = "radius-pill";
    if (has("space-sm")) assignments.paddingY = "space-sm";
    if (has("space-lg")) assignments.paddingX = "space-lg";
    return assignments;
  }

  if (styleName === "Text/Heading") {
    const assignments = {};
    if (has("font-family-display")) assignments.fontFamily = "font-family-display";
    if (has("font-size-title")) assignments.fontSize = "font-size-title";
    if (has("font-line-height-title")) assignments.lineHeight = "font-line-height-title";
    if (has("color-brand-text")) assignments["fills/0/color"] = "color-brand-text";
    return assignments;
  }

  const assignments = {};
  if (has("font-family-base")) assignments.fontFamily = "font-family-base";
  if (has("font-size-body")) assignments.fontSize = "font-size-body";
  if (has("font-line-height-body")) assignments.lineHeight = "font-line-height-body";
  if (has("color-brand-muted")) assignments["fills/0/color"] = "color-brand-muted";
  return assignments;
}

function inferStyleForSfid(sfid) {
  const key = sfid.replace(/^sfid:/, "").toLowerCase();
  if (key.includes("cta") || key.includes("button")) return "Action/ButtonPrimary";
  if (key.includes("title") || key.includes("heading") || key.endsWith("/h1") || key.endsWith("/h2")) return "Text/Heading";
  if (key.includes("body") || key.includes("copy") || key.includes("text") || key.includes("paragraph")) return "Text/Body";
  if (key.includes("card") || key.includes("panel") || key.includes("root") || key.includes("content") || key.includes("section")) {
    return "Surface/Card";
  }
  return null;
}

export function createConduitStyleLayer({ sfids, tokenNames }) {
  const tokenSet = new Set(tokenNames);
  const semanticStyleNames = ["Surface/Card", "Action/ButtonPrimary", "Text/Heading", "Text/Body"];
  const semanticStyles = semanticStyleNames
    .map((name) => ({
      name,
      assignments: buildStyleAssignments(name, tokenSet)
    }))
    .filter((style) => Object.keys(style.assignments).length > 0);

  const availableStyleNames = new Set(semanticStyles.map((style) => style.name));
  const elementPropertyMappings = [...sfids]
    .sort((a, b) => a.localeCompare(b))
    .map((sfid) => ({ sfid, property: "style", style: inferStyleForSfid(sfid) }))
    .filter((mapping) => mapping.style && availableStyleNames.has(mapping.style));

  return {
    semanticStyles,
    specialStyles: [
      {
        name: "Gradient/Brand Plus20Hue",
        type: "linear-gradient",
        notes: "Special style placeholder for Figma style creation; resolved at apply time.",
        stops: [
          { token: "color-brand-primary", position: 0 },
          { token: "color-brand-secondary", position: 1 }
        ]
      }
    ],
    elementPropertyMappings
  };
}
