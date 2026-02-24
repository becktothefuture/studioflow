import { describe, it, expect } from "vitest";
import { colorRegex, calcRegex, numberUnitRegex, collectMatches } from "../../scripts/lib/hardcoded-detect.mjs";

describe("colorRegex", () => {
  it("matches hex colors", () => {
    const matches = collectMatches(colorRegex, "color: #ff0000;");
    expect(matches).toContain("#ff0000");
  });

  it("matches rgba colors", () => {
    const matches = collectMatches(colorRegex, "background: rgba(0, 0, 0, 0.5);");
    expect(matches).toHaveLength(1);
  });
});

describe("calcRegex", () => {
  it("matches calc expressions", () => {
    const matches = collectMatches(calcRegex, "width: calc(100% - 20px);");
    expect(matches).toContain("calc(100% - 20px)");
  });
});

describe("numberUnitRegex", () => {
  it("matches pixel values", () => {
    const matches = collectMatches(numberUnitRegex, "padding: 16px;");
    expect(matches).toContain("16px");
  });

  it("does not match zero values", () => {
    const matches = collectMatches(numberUnitRegex, "margin: 0px;");
    expect(matches).toHaveLength(0);
  });
});
