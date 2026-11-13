import { describe, it, expect } from "vitest";
import {
  getRecentDays,
  countMonthBlocks,
  countHeatCols,
  fitCellSize,
  compactHeatLayout,
  compactCalLayout,
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

describe("compactCalLayout", () => {
  it("produces one cell per day and one label per month", () => {
    const days = getRecentDays(2, 0, today);
    const { cells, mLabels } = compactCalLayout(days, 12, 2, 6, 24, 5);
    expect(cells).toHaveLength(days.length);
    expect(mLabels).toHaveLength(2);
    expect(cells[0].key).toBe(dk(days[0]));
    expect(typeof cells[0].x).toBe("number");
    expect(typeof cells[0].y).toBe("number");
  });
});

describe("compactHeatLayout", () => {
  it("produces one cell per day and a label per month block", () => {
    const days = getRecentDays(3, 0, today);
    const { cells, mLabels } = compactHeatLayout(days, 11, 2, 6, 24, 5);
    expect(cells).toHaveLength(days.length);
    expect(mLabels).toHaveLength(countMonthBlocks(days));
  });
});
