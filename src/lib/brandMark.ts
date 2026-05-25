// Pattern data for the header BrandMark's pure-CSS animation. Kept here (pure, no
// React/DOM) so the "always a mix" invariant can be unit-tested and the component
// stays thin. Each frame is the list of green cell indices in the 3x3 grid
// (row-major, 0..8); the glyph cycles through them in lockstep and loops.

// The icon's green set — also the static fallback shown under prefers-reduced-motion.
export const ICON_CELLS = [0, 1, 3, 8];

// Fixed patterns the glyph cycles through. Every frame is a mix (never all-on or
// all-off) so the mark always reads as a grid — guarded by brandMark.test.ts.
export const FRAMES: number[][] = [
  [0, 1, 3, 8], // icon
  [1, 2, 4, 7],
  [2, 4, 5, 6],
  [3, 5, 7, 8],
  [1, 3, 4, 6],
  [0, 2, 4, 8],
];
