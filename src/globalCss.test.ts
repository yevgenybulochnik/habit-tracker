import { describe, it, expect } from "vitest";
import { CSS } from "./globalCss";

describe("input zoom prevention", () => {
  it("forces form controls to >=16px so iOS Safari doesn't auto-zoom on focus", () => {
    expect(CSS).toContain("font-size:16px !important");
    expect(CSS).toMatch(/input\s*,\s*select\s*,\s*textarea/);
  });
});
