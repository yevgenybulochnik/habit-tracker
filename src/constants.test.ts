import { describe, it, expect } from "vitest";
import { THEMES, THEME_CSS, DEFAULT_CONFIG, resolvePalette, CSS } from "./constants";

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};

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

  it("defaults the dashboard view to quick", () => {
    expect(DEFAULT_CONFIG.dashView).toBe("quick");
  });
});

describe("input zoom prevention", () => {
  it("forces form controls to >=16px so iOS Safari doesn't auto-zoom on focus", () => {
    expect(CSS).toContain("font-size:16px !important");
    expect(CSS).toMatch(/input\s*,\s*select\s*,\s*textarea/);
  });
});

describe("resolvePalette", () => {
  it("light theme ramps darker as intensity rises (higher = darker)", () => {
    const s = resolvePalette("Green", "light").shades;
    expect(lum(s[1])).toBeGreaterThan(lum(s[4])); // low count lighter than high count
    expect(lum(s[2])).toBeGreaterThan(lum(s[3]));
  });
  it("dark theme keeps higher = brighter (unchanged)", () => {
    const s = resolvePalette("Green", "dark").shades;
    expect(lum(s[4])).toBeGreaterThan(lum(s[1]));
  });
  it("falls back to a 5-shade ramp for an unknown color", () => {
    expect(resolvePalette("Nope", "light").shades).toHaveLength(5);
    expect(resolvePalette("Nope", "dark").shades).toHaveLength(5);
  });
});
