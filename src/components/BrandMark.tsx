import { C } from "../constants";

// The 3x3 grid mark. Cells 0,1,3,8 are the icon's green set (also the
// reduced-motion fallback).
const ICON_CELLS = [0, 1, 3, 8];

// Pure-CSS looping pattern cycle.
// The glyph cycles through FRAMES (each = the green cell indices for that frame).
// Every frame keeps a mix — never all-green, never all-grey — so the mark always
// reads as a grid. Animation is 100% CSS: every cell shares one duration with no
// delay, so the grid advances through frames in lockstep and loops seamlessly.
// The per-cell @keyframes are generated below from FRAMES (build-time JS; nothing
// runs at runtime but the CSS engine). Disabled under prefers-reduced-motion.
const FRAMES: number[][] = [
  [0, 1, 3, 8], // icon
  [1, 2, 4, 7],
  [2, 4, 5, 6],
  [3, 5, 7, 8],
  [1, 3, 4, 6],
  [0, 2, 4, 8],
];
const DUR = 18; // seconds for one full loop through all frames (~3s per frame)
const SNAP = 0.1; // fraction of a frame spent transitioning (rest is a flat hold)

const GREEN = "var(--c-green4)";
const GREY = "var(--c-borderLight)";
const F = FRAMES.length;

// Build one @keyframes per distinct on/off sequence; map each cell to its name.
const animFor: string[] = [];
let KEYFRAMES = "";
{
  const bySeq = new Map<string, string>();
  for (let cell = 0; cell < 9; cell++) {
    const seq = FRAMES.map((f) => (f.includes(cell) ? 1 : 0));
    const sig = seq.join("");
    let name = bySeq.get(sig);
    if (!name) {
      name = `bm${sig}`;
      bySeq.set(sig, name);
      const col = (i: number) => (seq[i] ? GREEN : GREY);
      // start mid-hold on the last frame's colour so the loop wraps seamlessly
      let stops = `0%{background:${col(F - 1)}}`;
      for (let i = 0; i < F; i++) {
        const snapAt = (((i + SNAP) / F) * 100).toFixed(3);
        const holdEnd = (((i + 1) / F) * 100).toFixed(3);
        stops += `${snapAt}%{background:${col(i)}}${holdEnd}%{background:${col(i)}}`;
      }
      KEYFRAMES += `@keyframes ${name}{${stops}}`;
    }
    animFor[cell] = name;
  }
  KEYFRAMES += `@media (prefers-reduced-motion: reduce){.brand-cell{animation:none!important}}`;
}

export default function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        gap: size * 0.11,
        width: size,
        height: size,
        flexShrink: 0,
        filter: `drop-shadow(0 0 6px ${C.successDim})`,
      }}
    >
      <style>{KEYFRAMES}</style>
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className="brand-cell"
          style={{
            borderRadius: size * 0.08,
            background: ICON_CELLS.includes(i) ? GREEN : GREY,
            animation: `${animFor[i]} ${DUR}s linear infinite`,
          }}
        />
      ))}
    </span>
  );
}
