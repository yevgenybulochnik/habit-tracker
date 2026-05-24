import type { CSSProperties } from "react";
import * as d3 from "d3";
import type { AppConfig, Unit } from "./types";

export const STORAGE_KEY = "habit-tracker-v3";

export const C = {
  bg: "#0d1117", surface: "#161b22", surfaceLight: "#1c2128",
  border: "#30363d", borderLight: "#484f58",
  text: "#e6edf3", muted: "#8b949e", dim: "#484f58",
  accent: "#58a6ff", accentDim: "rgba(88,166,255,0.12)",
  danger: "#f85149", success: "#39d353", successDim: "rgba(57,211,83,0.12)", green4: "#39d353",
};

export const PALETTES = [
  { name: "Green", shades: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] },
  { name: "Blue", shades: ["#161b22", "#0a3069", "#0550ae", "#1f6feb", "#58a6ff"] },
  { name: "Purple", shades: ["#161b22", "#3b1f63", "#6639ba", "#8957e5", "#bc8cff"] },
  { name: "Orange", shades: ["#161b22", "#5a2d0c", "#9b4215", "#d29922", "#e3b341"] },
  { name: "Pink", shades: ["#161b22", "#5e103e", "#bf3989", "#db61a2", "#f778ba"] },
  { name: "Red", shades: ["#161b22", "#67060c", "#bd561d", "#da3633", "#f85149"] },
];

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const WK_FULL = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
export const F = "'JetBrains Mono', monospace";
export const D3E = d3.easeCubicInOut;

export const BUILTIN_UNITS: Unit[] = [
  { id: "min", label: "Minutes", quickAdd: [15,30,60], thresholds: [15,30,60] },
  { id: "reps", label: "Reps", quickAdd: [5,10,25], thresholds: [10,25,50] },
  { id: "count", label: "Count", quickAdd: [1,5,10], thresholds: [1,3,5] },
];

export const EMOJIS = ["🎯","💪","📚","🧘","🏃","💧","🎨","✍️","🎵","💤","🍎","🧠","🌱","⚡","🔥","🏋️"];

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
`;

export const inpS: CSSProperties = {width:"100%",padding:"10px 12px",borderRadius:6,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:14,fontFamily:F,outline:"none",boxSizing:"border-box"};
export const lbl: CSSProperties = {display:"block",fontSize:11,color:C.muted,fontFamily:F,marginBottom:6,textTransform:"uppercase",letterSpacing:".08em"};

export const DEFAULT_CONFIG: AppConfig = { numMonths: 4, monthGap: 5, autoBackup: true };
