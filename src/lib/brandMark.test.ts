import { describe, it, expect } from "vitest";
import { FRAMES, ICON_CELLS } from "./brandMark";

describe("BrandMark frames", () => {
  it("has at least one frame to cycle through", () => {
    expect(FRAMES.length).toBeGreaterThan(0);
  });

  it("every frame is a mix — never all-grey or all-green", () => {
    for (const frame of FRAMES) {
      const cells = new Set(frame);
      expect(cells.size).toBe(frame.length); // no duplicate cells in a frame
      expect(cells.size).toBeGreaterThanOrEqual(1); // never all-grey (0 green)
      expect(cells.size).toBeLessThanOrEqual(8); // never all-green (9 green)
    }
  });

  it("only references valid 3x3 cell indices (0..8)", () => {
    for (const frame of [...FRAMES, ICON_CELLS]) {
      for (const cell of frame) {
        expect(Number.isInteger(cell)).toBe(true);
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThanOrEqual(8);
      }
    }
  });

  it("icon fallback is itself a valid mixed pattern", () => {
    const cells = new Set(ICON_CELLS);
    expect(cells.size).toBe(ICON_CELLS.length);
    expect(cells.size).toBeGreaterThanOrEqual(1);
    expect(cells.size).toBeLessThanOrEqual(8);
  });
});
