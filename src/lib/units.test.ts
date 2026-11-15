import { describe, it, expect } from "vitest";
import {
  NEW_UNIT_FIELDS,
  buildUnit,
  normalizeUnitId,
  parseNumList,
  unitFields,
} from "./units";

describe("parseNumList", () => {
  it("reads a comma-separated list", () => {
    expect(parseNumList("1, 5,10")).toEqual([1, 5, 10]);
  });

  it("keeps only positive whole numbers", () => {
    expect(parseNumList("2, x, 0, -3, , 7.5, 4")).toEqual([2, 7, 4]);
  });

  it("is empty for blank input", () => {
    expect(parseNumList("")).toEqual([]);
    expect(parseNumList(" , ")).toEqual([]);
  });
});

describe("normalizeUnitId", () => {
  it("trims, lowercases and joins words with underscores", () => {
    expect(normalizeUnitId("  Fl  Oz ")).toBe("fl_oz");
    expect(normalizeUnitId("lbs")).toBe("lbs");
  });
});

describe("unitFields", () => {
  it("turns a unit into form fields", () => {
    expect(
      unitFields({
        id: "km",
        label: "Kilometres",
        quickAdd: [1, 5],
        thresholds: [2, 5, 10],
      }),
    ).toEqual({
      id: "km",
      label: "Kilometres",
      quickAdd: "1, 5",
      thresholds: "2, 5, 10",
    });
  });
});

describe("buildUnit", () => {
  const fields = {
    id: " Fl Oz ",
    label: " Fluid ounces ",
    quickAdd: "4, 8, 12",
    thresholds: "8, 32, 64",
  };

  it("builds a unit from the fields", () => {
    expect(buildUnit(fields, ["reps", "min"])).toEqual({
      ok: true,
      unit: {
        id: "fl_oz",
        label: "Fluid ounces",
        quickAdd: [4, 8, 12],
        thresholds: [8, 32, 64],
      },
    });
  });

  it("keeps at most three quick-add amounts and thresholds", () => {
    const result = buildUnit(
      { ...fields, quickAdd: "1, 2, 3, 4", thresholds: "5, 6, 7, 8" },
      [],
    );
    expect(result).toMatchObject({
      ok: true,
      unit: { quickAdd: [1, 2, 3], thresholds: [5, 6, 7] },
    });
  });

  it("starts new units from usable defaults", () => {
    const result = buildUnit({ ...NEW_UNIT_FIELDS, id: "x", label: "X" }, []);
    expect(result).toMatchObject({
      ok: true,
      unit: { quickAdd: [1, 5, 10], thresholds: [1, 3, 5] },
    });
  });

  it.each([
    ["no id", { id: "  " }, /ID/],
    ["no label", { label: " " }, /label/],
    ["no quick-add amount", { quickAdd: "0, x" }, /quick-add/],
    ["no threshold", { thresholds: "" }, /threshold/],
  ])("refuses %s", (_, change, error) => {
    const result = buildUnit({ ...fields, ...change }, []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(error);
  });

  it("refuses an id another unit has, after normalizing it", () => {
    const result = buildUnit(fields, ["reps", "fl_oz"]);
    expect(result).toEqual({
      ok: false,
      error: 'There\'s already a unit with the ID "fl_oz".',
    });
  });
});
