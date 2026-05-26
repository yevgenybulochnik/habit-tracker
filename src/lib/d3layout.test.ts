import { describe, it, expect } from "vitest";
import {
  getRecentDays,
  countMonthBlocks,
  countHeatCols,
  fitCellSize,
  compactHeatLayout,
  compactCalLayout,
} from "./d3layout";
import { dk } from "./dates";

describe("getRecentDays", () => {
  it("returns a contiguous run of days for one month", () => {
    const days = getRecentDays(1, 0);
    expect(days[0].getDate()).toBe(1);
    expect(days.length).toBeGreaterThanOrEqual(28);
    expect(days.length).toBeLessThanOrEqual(31);
  });
  it("spans the requested number of months", () => {
    expect(countMonthBlocks(getRecentDays(3, 0))).toBe(3);
    expect(countMonthBlocks(getRecentDays(1, 0))).toBe(1);
  });
});

describe("fitCellSize", () => {
  it("clamps the cell size between 6 and 20", () => {
    const days = getRecentDays(4, 0);
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
    expect(countHeatCols(getRecentDays(2, 0), 5)).toBeGreaterThanOrEqual(1);
  });
});

describe("compactCalLayout", () => {
  it("produces one cell per day and one label per month", () => {
    const days = getRecentDays(2, 0);
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
    const days = getRecentDays(3, 0);
    const { cells, mLabels } = compactHeatLayout(days, 11, 2, 6, 24, 5);
    expect(cells).toHaveLength(days.length);
    expect(mLabels).toHaveLength(countMonthBlocks(days));
  });
});
