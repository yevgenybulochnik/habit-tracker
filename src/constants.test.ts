import { describe, it, expect } from "vitest";
import { THEMES, THEME_CSS, DEFAULT_CONFIG } from "./constants";

describe("themes", () => {
  it("defines dark and light with matching keys", () => {
    expect(Object.keys(THEMES.light).sort()).toEqual(Object.keys(THEMES.dark).sort());
    expect(THEMES.dark.bg).toBe("#0d1117");
    expect(THEMES.light.bg).toBe("#ffffff");
  });

  it("THEME_CSS sets dark defaults on :root and overrides for light", () => {
    expect(THEME_CSS).toContain(":root{");
    expect(THEME_CSS).toContain("--c-bg:#0d1117");
    expect(THEME_CSS).toContain('[data-theme="light"]{');
    expect(THEME_CSS).toContain("--c-bg:#ffffff");
  });

  it("defaults to the dark theme", () => {
    expect(DEFAULT_CONFIG.theme).toBe("dark");
  });
});
