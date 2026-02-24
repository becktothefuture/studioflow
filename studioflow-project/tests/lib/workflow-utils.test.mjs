import { describe, it, expect } from "vitest";
import { sanitizeId, duplicateValues, uniqueValues, setTokenValueByPath, groupTokenFrame } from "../../scripts/lib/workflow-utils.mjs";

describe("sanitizeId", () => {
  it("lowercases and strips invalid characters", () => {
    expect(sanitizeId("sfid:Hero-Root")).toBe("sfid:hero-root");
  });

  it("trims whitespace", () => {
    expect(sanitizeId("  sfid:test  ")).toBe("sfid:test");
  });

  it("removes special characters", () => {
    expect(sanitizeId("sfid:test@#$value")).toBe("sfid:testvalue");
  });
});

describe("duplicateValues", () => {
  it("returns duplicated values", () => {
    expect(duplicateValues(["a", "b", "a", "c", "b"])).toEqual(["a", "b"]);
  });

  it("returns empty for unique values", () => {
    expect(duplicateValues(["a", "b", "c"])).toEqual([]);
  });
});

describe("uniqueValues", () => {
  it("deduplicates values", () => {
    expect(uniqueValues(["a", "b", "a"])).toEqual(["a", "b"]);
  });
});

describe("setTokenValueByPath", () => {
  it("updates a nested token value", () => {
    const root = { color: { brand: { ink: { value: "#000" } } } };
    const updated = setTokenValueByPath(root, ["color", "brand", "ink"], "#fff");
    expect(updated).toBe(true);
    expect(root.color.brand.ink.value).toBe("#fff");
  });

  it("returns false for invalid path", () => {
    const root = { color: {} };
    expect(setTokenValueByPath(root, ["color", "missing", "token"], "x")).toBe(false);
  });
});

describe("groupTokenFrame", () => {
  const tokenFrames = [
    { name: "Tokens / Colors", prefixes: ["color"] },
    { name: "Tokens / Typography", prefixes: ["font"] },
    { name: "Tokens / Spacing", prefixes: ["space", "size", "radius", "shadow", "opacity", "z"] }
  ];

  it("matches color tokens", () => {
    expect(groupTokenFrame("color-brand-ink", tokenFrames)).toBe("Tokens / Colors");
  });

  it("matches font tokens", () => {
    expect(groupTokenFrame("font-size-body", tokenFrames)).toBe("Tokens / Typography");
  });

  it("matches space tokens", () => {
    expect(groupTokenFrame("space-md", tokenFrames)).toBe("Tokens / Spacing");
  });

  it("falls back to last frame for unknown prefix", () => {
    expect(groupTokenFrame("unknown-token", tokenFrames)).toBe("Tokens / Spacing");
  });
});
