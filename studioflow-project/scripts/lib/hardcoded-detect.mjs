export const colorRegex = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\brgba?\([^\)]+\)|\bhsla?\([^\)]+\)/g;
export const calcRegex = /\bcalc\([^\)]+\)/g;
export const arbitraryValueRegex = /\[[^\]\n]+\]/g;
export const numberUnitRegex = /\b(?!0(?:\.0+)?(?:px|rem|em|%)?\b)\d*\.?\d+(?:px|rem|em|vh|vw|vmin|vmax|%)\b/g;

export function collectMatches(regex, line) {
  return [...line.matchAll(regex)].map((m) => m[0]);
}
