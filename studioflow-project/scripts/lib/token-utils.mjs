export function isTokenLeaf(value) {
  return !!value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "value");
}

export function flattenTokens(input, prefix = []) {
  const rows = [];
  for (const [key, value] of Object.entries(input)) {
    const next = [...prefix, key];
    if (isTokenLeaf(value)) {
      rows.push({ name: next.join("-"), value: String(value.value), path: next });
      continue;
    }
    if (value && typeof value === "object") {
      rows.push(...flattenTokens(value, next));
    }
  }
  return rows;
}
