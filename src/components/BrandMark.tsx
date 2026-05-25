import { C } from "../constants";

// The 3x3 grid mark used in the header, mirroring the PWA icon. Cells 0,1,3,8
// (row-major, 0-indexed) are green — the same active set the icon paints.
export const ICON_CELLS = [0, 1, 3, 8];

export default function BrandMark({
  size = 18,
  active = ICON_CELLS,
}: {
  size?: number;
  active?: number[];
}) {
  const on = new Set(active);
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
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          style={{
            borderRadius: size * 0.08,
            background: on.has(i) ? C.green4 : C.borderLight,
            transition: "background .4s ease",
          }}
        />
      ))}
    </span>
  );
}
