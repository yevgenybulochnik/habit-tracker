import { describe, it, expect } from "vitest";
import { fmtVal, fmtSets } from "./format";

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
  it("summarizes a single set", () => {
    expect(fmtSets([{ w: 100, r: 5 }], "lbs")).toBe("1 set · 500 lbs vol");
  });
  it("pluralizes and groups volume", () => {
    expect(fmtSets([{ w: 100, r: 5 }, { w: 100, r: 5 }], "kg")).toBe("2 sets · 1,000 kg vol");
  });
  it("defaults the weight unit to lbs", () => {
    expect(fmtSets([{ w: 10, r: 1 }], undefined)).toBe("1 set · 10 lbs vol");
  });
  it("returns an em-dash for empty", () => {
    expect(fmtSets([], "lbs")).toBe("—");
  });
});
