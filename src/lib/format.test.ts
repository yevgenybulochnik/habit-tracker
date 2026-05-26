import { describe, it, expect } from "vitest";
import { fmtVal, fmtSets } from "./format";
import type { Metric } from "../types";

const weighted = (weightUnit: string): Metric => ({
  id: "w",
  name: "Bench",
  unit: "reps",
  mode: "sets",
  weightUnit,
});
const repsM: Metric = {
  id: "r",
  name: "Pull-ups",
  unit: "reps",
  mode: "sets",
  setValue: "primary",
  setFields: [{ id: "r", label: "Reps", agg: "sum", primary: true }],
};
const timedM: Metric = {
  id: "g",
  name: "Guitar",
  unit: "min",
  mode: "sets",
  setValue: "primary",
  setFields: [
    { id: "min", label: "Minutes", unit: "min", agg: "sum", primary: true },
  ],
};

describe("fmtVal", () => {
  it("returns an em-dash for empty/zero", () => {
    expect(fmtVal(0, "min")).toBe("—");
    expect(fmtVal(undefined, "reps")).toBe("—");
  });
  it("formats minutes under an hour", () => {
    expect(fmtVal(30, "min")).toBe("30m");
  });
  it("formats whole hours", () => {
    expect(fmtVal(60, "min")).toBe("1h");
    expect(fmtVal(120, "min")).toBe("2h");
  });
  it("formats hours + minutes", () => {
    expect(fmtVal(90, "min")).toBe("1h 30m");
  });
  it("formats non-minute units with the unit suffix", () => {
    expect(fmtVal(5, "reps")).toBe("5 reps");
  });
});

describe("fmtSets", () => {
  it("summarizes weighted sets as volume", () => {
    expect(fmtSets([{ w: 100, r: 5 }], weighted("lbs"))).toBe(
      "1 set · 500 lbs vol",
    );
  });
  it("pluralizes and groups volume, honoring the weight unit", () => {
    expect(
      fmtSets(
        [
          { w: 100, r: 5 },
          { w: 100, r: 5 },
        ],
        weighted("kg"),
      ),
    ).toBe("2 sets · 1,000 kg vol");
  });
  it("defaults the weight unit to lbs", () => {
    expect(
      fmtSets([{ w: 10, r: 1 }], weighted(undefined as unknown as string)),
    ).toBe("1 set · 10 lbs vol");
  });
  it("summarizes reps-only sets as total reps", () => {
    expect(fmtSets([{ r: 12 }, { r: 8 }], repsM)).toBe("2 sets · 20 reps");
  });
  it("summarizes timed sets as total minutes", () => {
    expect(fmtSets([{ min: 20 }, { min: 15 }], timedM)).toBe("2 sets · 35 min");
  });
  it("returns an em-dash for empty", () => {
    expect(fmtSets([], repsM)).toBe("—");
  });
});
