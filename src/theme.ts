import type { Palette, ThemeName } from "./types";

// Concrete hex per theme. `cellStroke`/`futureCell` are used by the d3 SVG
// (where CSS vars can't reach) — the rest also back the CSS variables below.
export const THEMES: Record<ThemeName, Record<string, string>> = {
  dark: {
    bg: "#0d1117",
    surface: "#161b22",
    surfaceLight: "#1c2128",
    border: "#30363d",
    borderLight: "#484f58",
    text: "#e6edf3",
    muted: "#8b949e",
    dim: "#484f58",
    accent: "#58a6ff",
    accentDim: "rgba(88,166,255,0.12)",
    danger: "#f85149",
    success: "#39d353",
    successDim: "rgba(57,211,83,0.12)",
    green4: "#39d353",
    cellStroke: "rgba(255,255,255,0.06)",
    futureCell: "#1c2128",
  },
  light: {
    bg: "#ffffff",
    surface: "#f6f8fa",
    surfaceLight: "#eaeef2",
    border: "#d0d7de",
    borderLight: "#afb8c1",
    text: "#1f2328",
    muted: "#656d76",
    dim: "#8c959f",
    accent: "#0969da",
    accentDim: "rgba(9,105,218,0.12)",
    danger: "#cf222e",
    success: "#1a7f37",
    successDim: "rgba(26,127,55,0.12)",
    green4: "#2da44e",
    cellStroke: "rgba(27,31,36,0.10)",
    futureCell: "#f0f2f4",
  },
};

// UI chrome tokens. Each is a CSS variable so components keep using `C.bg` etc.
// unchanged while the value swaps with the active theme (see THEME_CSS).
const C_KEYS = [
  "bg",
  "surface",
  "surfaceLight",
  "border",
  "borderLight",
  "text",
  "muted",
  "dim",
  "accent",
  "accentDim",
  "danger",
  "success",
  "successDim",
  "green4",
] as const;
export const C = Object.fromEntries(
  C_KEYS.map((k) => [k, `var(--c-${k})`]),
) as Record<(typeof C_KEYS)[number], string>;

// :root holds the dark defaults (so vars resolve even before a theme is set, and
// on the loading screen); [data-theme="light"] overrides them.
const declFor = (t: ThemeName) =>
  C_KEYS.map((k) => `--c-${k}:${THEMES[t][k]}`).join(";");
export const THEME_CSS = `:root{${declFor("dark")}}[data-theme="light"]{${declFor("light")}}`;

export const PALETTES = [
  {
    name: "Green",
    shades: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  },
  {
    name: "Blue",
    shades: ["#161b22", "#0a3069", "#0550ae", "#1f6feb", "#58a6ff"],
  },
  {
    name: "Purple",
    shades: ["#161b22", "#3b1f63", "#6639ba", "#8957e5", "#bc8cff"],
  },
  {
    name: "Orange",
    shades: ["#161b22", "#5a2d0c", "#9b4215", "#d29922", "#e3b341"],
  },
  {
    name: "Pink",
    shades: ["#161b22", "#5e103e", "#bf3989", "#db61a2", "#f778ba"],
  },
  {
    name: "Red",
    shades: ["#161b22", "#67060c", "#bd561d", "#da3633", "#f85149"],
  },
];

// Light-theme intensity ramps: empty (light grey) → pale → deep, so a higher
// count is a DARKER block (reads correctly on a white background). The dark
// PALETTES above keep the contribution-graph convention (higher = brighter),
// which stays legible on the dark background.
const LIGHT_PALETTES: Record<string, string[]> = {
  Green: ["#ebedf0", "#aceebb", "#4ac26b", "#2da44e", "#116329"],
  Blue: ["#ebedf0", "#b6e3ff", "#54aeff", "#0969da", "#0a3069"],
  Purple: ["#ebedf0", "#ecd8ff", "#c297ff", "#8250df", "#4c2889"],
  Orange: ["#ebedf0", "#ffd8b5", "#fb8f44", "#bc4c00", "#762c00"],
  Pink: ["#ebedf0", "#ffbedd", "#ff80c8", "#bf3989", "#772057"],
  Red: ["#ebedf0", "#ffcecb", "#ff8182", "#cf222e", "#82071e"],
};

/** Resolve a habit's 5-shade intensity ramp for the active theme. */
export function resolvePalette(name: string, theme: ThemeName): Palette {
  const base = PALETTES.find((p) => p.name === name) || PALETTES[0];
  if (theme === "light") {
    return {
      name: base.name,
      shades: LIGHT_PALETTES[name] || LIGHT_PALETTES[PALETTES[0].name],
    };
  }
  return base;
}

export const F = "'JetBrains Mono', monospace";
