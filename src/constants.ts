import type { CSSProperties } from "react";
import * as d3 from "d3";
import type { AppConfig, Palette, ThemeName, Unit } from "./types";

export const STORAGE_KEY = "habit-tracker-v3";

// Concrete hex per theme. `emptyCell`/`cellStroke`/`futureCell` are used by the
// d3 SVG (where CSS vars can't reach) — the rest also back the CSS variables below.
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
    emptyCell: "#161b22",
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
    emptyCell: "#ebedf0",
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

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const WK_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const F = "'JetBrains Mono', monospace";
export const D3E = d3.easeCubicInOut;

export const BUILTIN_UNITS: Unit[] = [
  {
    id: "min",
    label: "Minutes",
    quickAdd: [15, 30, 60],
    thresholds: [15, 30, 60],
  },
  {
    id: "reps",
    label: "Reps",
    quickAdd: [5, 10, 25],
    thresholds: [10, 25, 50],
  },
  { id: "count", label: "Count", quickAdd: [1, 5, 10], thresholds: [1, 3, 5] },
];

export const EMOJIS = [
  "🎯",
  "💪",
  "📚",
  "🧘",
  "🏃",
  "💧",
  "🎨",
  "✍️",
  "🎵",
  "💤",
  "🍎",
  "🧠",
  "🌱",
  "⚡",
  "🔥",
  "🏋️",
];

export const CSS = `
@keyframes fadeSlideLeft{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
@keyframes fadeSlideRight{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:translateX(0)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(.92) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes backdropIn{from{opacity:0;backdrop-filter:blur(0)}to{opacity:1;backdrop-filter:blur(4px)}}
@keyframes dateShiftLeft{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
@keyframes dateShiftRight{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
@keyframes pulseGlow{0%,100%{box-shadow:0 0 8px rgba(57,211,83,.3)}50%{box-shadow:0 0 20px rgba(57,211,83,.6)}}
.stagger-child{animation:fadeUp .7s cubic-bezier(.16,1,.3,1) both}
.panel-slide-left{animation:fadeSlideLeft .65s cubic-bezier(.16,1,.3,1) both}
.panel-slide-right{animation:fadeSlideRight .65s cubic-bezier(.16,1,.3,1) both}
.modal-backdrop{animation:backdropIn .4s ease both}
.modal-content{animation:scaleIn .5s cubic-bezier(.16,1,.3,1) both}
.date-shift-left{animation:dateShiftLeft .45s cubic-bezier(.16,1,.3,1) both}
.date-shift-right{animation:dateShiftRight .45s cubic-bezier(.16,1,.3,1) both}
.save-pulse{animation:pulseGlow 1s ease}
/* >=16px keeps iOS Safari from auto-zooming when an input is focused.
   !important overrides the smaller inline font sizes on individual fields. */
input,select,textarea{font-size:16px !important}
`;

export const inpS: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: C.bg,
  color: C.text,
  fontSize: 14,
  fontFamily: F,
  outline: "none",
  boxSizing: "border-box",
};
export const lbl: CSSProperties = {
  display: "block",
  fontSize: 11,
  color: C.muted,
  fontFamily: F,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

export const DEFAULT_CONFIG: AppConfig = {
  numMonths: 4,
  monthGap: 5,
  theme: "dark",
  dashView: "quick",
};
