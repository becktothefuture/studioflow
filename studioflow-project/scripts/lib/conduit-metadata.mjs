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

export function createConduitStyleLayer() {
  return {
    semanticStyles: [
      {
        name: "Card",
        assignments: {
          "fills/0/color": "color-brand-surface",
          "strokes/0/color": "color-brand-stroke",
          cornerRadius: "radius-lg",
          "effects/dropShadow": "shadow-card"
        }
      },
      {
        name: "Button/Primary",
        assignments: {
          "fills/0/color": "color-brand-primary",
          "text/fills/0/color": "color-brand-ink",
          cornerRadius: "radius-pill",
          paddingY: "space-sm",
          paddingX: "space-lg"
        }
      },
      {
        name: "Text/Body",
        assignments: {
          fontFamily: "font-family-base",
          fontSize: "font-size-body",
          lineHeight: "font-line-height-body",
          "fills/0/color": "color-brand-muted"
        }
      }
    ],
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
    elementPropertyMappings: [
      { sfid: "sfid:hero-content", property: "style", style: "Card" },
      { sfid: "sfid:hero-primary-cta", property: "style", style: "Button/Primary" },
      { sfid: "sfid:hero-title", property: "style", style: "Text/Body" }
    ]
  };
}
