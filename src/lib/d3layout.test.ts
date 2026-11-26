import { describe, it, expect } from "vitest";
import {
  getRecentDays,
  countMonthBlocks,
  countHeatCols,
  fitCellSize,
  compactHeatLayout,
  compactCalLayout,
  blockPieces,
  piecePath,
} from "./d3layout";
import { addDays, dk } from "./dates";

const today = "2026-05-24";

describe("getRecentDays", () => {
  it("returns every day of today's month", () => {
    const days = getRecentDays(1, 0, today);
    expect(days).toHaveLength(31);
    expect(dk(days[0])).toBe("2026-05-01");
    expect(dk(days[30])).toBe("2026-05-31");
  });
  it("spans the requested number of months, ending with today's", () => {
    const days = getRecentDays(3, 0, today);
    expect(dk(days[0])).toBe("2026-03-01");
    expect(dk(days[days.length - 1])).toBe("2026-05-31");
    expect(days).toHaveLength(31 + 30 + 31);
    expect(countMonthBlocks(days)).toBe(3);
    expect(countMonthBlocks(getRecentDays(1, 0, today))).toBe(1);
  });
  it("returns consecutive days", () => {
    const keys = getRecentDays(3, 0, today).map(dk);
    keys.slice(1).forEach((k, i) => expect(k).toBe(addDays(keys[i], 1)));
  });
  it("shifts the window back by the month offset, across a year", () => {
    const days = getRecentDays(2, -4, today);
    expect(dk(days[0])).toBe("2025-12-01");
    expect(dk(days[days.length - 1])).toBe("2026-01-31");
  });
  it("lands on a shorter month from the 31st", () => {
    const days = getRecentDays(1, -3, "2026-05-31");
    expect(dk(days[0])).toBe("2026-02-01");
    expect(days).toHaveLength(28);
  });
});

describe("fitCellSize", () => {
  it("clamps the cell size between 6 and 20", () => {
    const days = getRecentDays(4, 0, today);
    const heat = fitCellSize(days, 400, "heatmap", 2, 6, 5);
    const cal = fitCellSize(days, 400, "calendar", 2, 6, 5);
    for (const s of [heat, cal]) {
      expect(s).toBeGreaterThanOrEqual(6);
      expect(s).toBeLessThanOrEqual(20);
    }
  });
});

describe("countHeatCols", () => {
  it("returns at least one column", () => {
    expect(countHeatCols(getRecentDays(2, 0, today), 5)).toBeGreaterThanOrEqual(
      1,
    );
  });
});

// The days of May 2026 after the 24th
const afterToday = [25, 26, 27, 28, 29, 30, 31].map((d) => `2026-05-${d}`);

describe("compactCalLayout", () => {
  it("produces one cell per day and one label per month", () => {
    const days = getRecentDays(2, 0, today);
    const { cells, mLabels } = compactCalLayout(days, 12, 2, 6, 24, 5, today);
    expect(cells).toHaveLength(days.length);
    expect(mLabels).toHaveLength(2);
    expect(cells[0].key).toBe(dk(days[0]));
    expect(typeof cells[0].x).toBe("number");
    expect(typeof cells[0].y).toBe("number");
  });
  it("marks the days after today as future", () => {
    const days = getRecentDays(2, 0, today);
    const { cells } = compactCalLayout(days, 12, 2, 6, 24, 5, today);
    expect(cells.filter((c) => c.future).map((c) => c.key)).toEqual(afterToday);
  });
  it("has no future days in a window that ends before today", () => {
    const days = getRecentDays(2, -2, today);
    const { cells } = compactCalLayout(days, 12, 2, 6, 24, 5, today);
    expect(cells.some((c) => c.future)).toBe(false);
  });
});

describe("compactHeatLayout", () => {
  it("produces one cell per day and a label per month block", () => {
    const days = getRecentDays(3, 0, today);
    const { cells, mLabels } = compactHeatLayout(days, 11, 2, 6, 24, 5, today);
    expect(cells).toHaveLength(days.length);
    expect(mLabels).toHaveLength(countMonthBlocks(days));
  });
  it("marks the days after today as future", () => {
    const days = getRecentDays(3, 0, today);
    const { cells } = compactHeatLayout(days, 11, 2, 6, 24, 5, today);
    expect(cells.filter((c) => c.future).map((c) => c.key)).toEqual(afterToday);
  });
  it("moves the future boundary with today", () => {
    const days = getRecentDays(1, 0, today);
    const { cells } = compactHeatLayout(days, 11, 2, 6, 24, 5, "2026-05-30");
    expect(cells.filter((c) => c.future).map((c) => c.key)).toEqual([
      "2026-05-31",
    ]);
  });
});

describe("blockPieces", () => {
  // May 2026: the 18th is a Monday, the 24th a Sunday.
  const may = getRecentDays(1, 0, today);
  const heat = compactHeatLayout(may, 10, 2, 0, 0, 5, today).cells;
  const cal = compactCalLayout(may, 10, 2, 0, 0, 5, today).cells;
  const cell = (cells: typeof heat, key: string) =>
    cells.find((c) => c.key === key)!;
  /** Blocks from each start key through its last day. */
  const blocks = (...spans: [string, string][]) => {
    const of = new Map<string, string>();
    for (const [start, end] of spans)
      for (let k = start; k <= end; k = addDays(k, 1)) of.set(k, start);
    return (key: string) => of.get(key) ?? null;
  };

  it("draws a block down a heatmap column as one piece", () => {
    const [p, ...rest] = blockPieces(
      heat,
      blocks(["2026-05-20", "2026-05-22"]),
      2,
    );
    expect(rest).toHaveLength(0);
    const wed = cell(heat, "2026-05-20");
    expect(p).toMatchObject({
      key: "2026-05-20#0",
      block: "2026-05-20",
      x: wed.x,
      y: wed.y,
      w: 10,
      h: 34, // three cells and the two gaps between them
      openStart: false,
      openEnd: false,
    });
  });

  it("breaks a block where the week turns, each piece open where it carries on", () => {
    const ps = blockPieces(heat, blocks(["2026-05-23", "2026-05-26"]), 2);
    expect(ps.map((p) => p.key)).toEqual(["2026-05-23#0", "2026-05-23#1"]);
    expect(ps[0]).toMatchObject({ h: 22, openStart: false, openEnd: true });
    expect(ps[1]).toMatchObject({
      x: cell(heat, "2026-05-25").x,
      y: cell(heat, "2026-05-25").y,
      h: 22,
      openStart: true,
      openEnd: false,
    });
  });

  it("runs along a row in the calendar", () => {
    const ps = blockPieces(cal, blocks(["2026-05-23", "2026-05-25"]), 2);
    expect(ps).toHaveLength(2);
    expect(ps[0]).toMatchObject({ w: 22, h: 10, openEnd: true });
    expect(ps[1]).toMatchObject({ w: 10, h: 10, openStart: true });
  });

  it("keeps blocks that touch apart, and leaves days in none undrawn", () => {
    const ps = blockPieces(
      heat,
      blocks(["2026-05-18", "2026-05-19"], ["2026-05-20", "2026-05-20"]),
      2,
    );
    expect(ps.map((p) => p.block)).toEqual(["2026-05-18", "2026-05-20"]);
    expect(ps.map((p) => p.h)).toEqual([22, 10]);
  });

  it("breaks a block where a month ends", () => {
    const two = getRecentDays(2, 1, today); // May and June
    const cells = compactHeatLayout(two, 10, 2, 0, 0, 5, today).cells;
    const ps = blockPieces(cells, blocks(["2026-05-30", "2026-06-02"]), 2);
    expect(ps.map((p) => [p.openStart, p.openEnd])).toEqual([
      [false, true],
      [true, false],
    ]);
  });

  it("marks a piece that's all to come", () => {
    const ps = blockPieces(heat, blocks(["2026-05-24", "2026-05-26"]), 2);
    expect(ps.map((p) => p.future)).toEqual([false, true]);
  });
});

describe("piecePath", () => {
  const p = {
    key: "k#0",
    block: "k",
    x: 0,
    y: 0,
    w: 10,
    h: 30,
    openStart: false,
    openEnd: false,
    future: false,
  };

  it("rounds every corner of a whole block", () => {
    expect(piecePath(p, 2, "heatmap")).toBe(
      "M2,0 H8 A2,2 0 0 1 10,2 V28 A2,2 0 0 1 8,30 H2 A2,2 0 0 1 0,28 V2 A2,2 0 0 1 2,0 Z",
    );
  });

  it("squares the end that carries on: the bottom in the heatmap", () => {
    expect(piecePath({ ...p, openEnd: true }, 2, "heatmap")).toBe(
      "M2,0 H8 A2,2 0 0 1 10,2 V30 A0,0 0 0 1 10,30 H0 A0,0 0 0 1 0,30 V2 A2,2 0 0 1 2,0 Z",
    );
  });

  it("…and the right in the calendar", () => {
    const row = { ...p, w: 30, h: 10, openEnd: true };
    expect(piecePath(row, 2, "calendar")).toBe(
      "M2,0 H30 A0,0 0 0 1 30,0 V10 A0,0 0 0 1 30,10 H2 A2,2 0 0 1 0,8 V2 A2,2 0 0 1 2,0 Z",
    );
  });

  it("keeps the rounding within a small piece", () => {
    const tiny = { ...p, w: 4, h: 4 };
    expect(piecePath(tiny, 6, "heatmap")).toBe(
      "M2,0 H2 A2,2 0 0 1 4,2 V2 A2,2 0 0 1 2,4 H2 A2,2 0 0 1 0,2 V2 A2,2 0 0 1 2,0 Z",
    );
  });
});
