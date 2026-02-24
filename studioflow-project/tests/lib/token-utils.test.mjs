import { describe, it, expect } from "vitest";
import { flattenTokens, isTokenLeaf } from "../../scripts/lib/token-utils.mjs";

describe("isTokenLeaf", () => {
  it("returns true for objects with a value property", () => {
    expect(isTokenLeaf({ value: "#fff" })).toBe(true);
  });

  it("returns false for plain objects", () => {
    expect(isTokenLeaf({ nested: { value: "x" } })).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isTokenLeaf(null)).toBe(false);
    expect(isTokenLeaf(undefined)).toBe(false);
  });
});

describe("flattenTokens", () => {
  it("flattens a nested token structure", () => {
    const input = {
      color: {
        brand: {
          ink: { value: "#070A13" },
          signal: { value: "#88AEBF" }
        }
      },
      space: {
        sm: { value: "8px" }
      }
    };

    const result = flattenTokens(input);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: "color-brand-ink", value: "#070A13", path: ["color", "brand", "ink"] });
    expect(result[1]).toEqual({ name: "color-brand-signal", value: "#88AEBF", path: ["color", "brand", "signal"] });
    expect(result[2]).toEqual({ name: "space-sm", value: "8px", path: ["space", "sm"] });
  });

  it("returns empty array for empty input", () => {
    expect(flattenTokens({})).toEqual([]);
  });
});
