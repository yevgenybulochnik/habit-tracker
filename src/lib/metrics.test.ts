import { describe, it, expect } from "vitest";
import {
  getUnit, getQuickAdd, isSetMetric,
  setsVolume, setsTotalReps, setsMaxWeight,
  metricVal, metricActive, findLastWeight,
} from "./metrics";
import { BUILTIN_UNITS } from "../constants";
import type { Metric, HabitLogs } from "../types";

const minM: Metric = { id: "m1", name: "Run", unit: "min" };
const setM: Metric = { id: "m2", name: "Bench", unit: "reps", mode: "sets", weightUnit: "lbs" };

describe("getUnit", () => {
  it("returns the matching unit", () => {
    expect(getUnit("min", BUILTIN_UNITS).label).toBe("Minutes");
  });
  it("falls back to a generic unit when id is unknown", () => {
    expect(getUnit("xyz", BUILTIN_UNITS)).toEqual({
      id: "xyz", label: "xyz", quickAdd: [1, 5, 10], thresholds: [1, 3, 5],
    });
  });
});

describe("getQuickAdd", () => {
  it("returns the unit's quick-add values", () => {
    expect(getQuickAdd("reps", BUILTIN_UNITS)).toEqual([5, 10, 25]);
  });
});

describe("isSetMetric", () => {
  it("is true only for mode 'sets'", () => {
    expect(isSetMetric(setM)).toBe(true);
    expect(isSetMetric(minM)).toBe(false);
  });
});

describe("sets aggregation", () => {
  const sets = [{ w: 100, r: 5 }, { w: 120, r: 3 }];
  it("setsVolume sums weight × reps", () => {
    expect(setsVolume(sets)).toBe(100 * 5 + 120 * 3);
  });
  it("setsTotalReps sums reps", () => {
    expect(setsTotalReps(sets)).toBe(8);
  });
  it("setsMaxWeight returns the heaviest set", () => {
    expect(setsMaxWeight(sets)).toBe(120);
  });
  it("handles empty / undefined safely", () => {
    expect(setsVolume([])).toBe(0);
    expect(setsVolume(undefined)).toBe(0);
    expect(setsTotalReps(undefined)).toBe(0);
    expect(setsMaxWeight([])).toBe(0);
  });
});

describe("metricVal", () => {
  it("returns the numeric value for a normal metric", () => {
    expect(metricVal(minM, { m1: 30 })).toBe(30);
  });
  it("returns total volume for a sets metric", () => {
    expect(metricVal(setM, { m2: [{ w: 50, r: 10 }] })).toBe(500);
  });
  it("returns 0 with no log", () => {
    expect(metricVal(minM, undefined)).toBe(0);
  });
});

describe("metricActive", () => {
  it("is true when a normal metric is > 0", () => {
    expect(metricActive(minM, { m1: 5 })).toBe(true);
    expect(metricActive(minM, { m1: 0 })).toBe(false);
  });
  it("is true when a sets metric has at least one set", () => {
    expect(metricActive(setM, { m2: [{ w: 10, r: 1 }] })).toBe(true);
    expect(metricActive(setM, { m2: [] })).toBe(false);
  });
});

describe("findLastWeight", () => {
  it("returns the weight of the most recent logged set within 90 days", () => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const logs: HabitLogs = { [key]: { m2: [{ w: 95, r: 5 }, { w: 135, r: 3 }] } };
    expect(findLastWeight(logs, "m2")).toBe(135);
  });
  it("returns null when nothing is found", () => {
    expect(findLastWeight({}, "m2")).toBeNull();
  });
});
