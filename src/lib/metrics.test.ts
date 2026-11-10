import { describe, it, expect } from "vitest";
import {
  getUnit,
  getQuickAdd,
  isSetMetric,
  metricVal,
  metricActive,
  setFieldsOf,
  aggregateSets,
  setVolume,
  setsMetricVal,
  primaryField,
  findLastSet,
  setUnitLabel,
  setsPreset,
  isDoneMetric,
  doneMetric,
} from "./metrics";
import { BUILTIN_UNITS } from "./defaults";
import type { Metric, HabitLogs } from "../types";

const minM: Metric = { id: "m1", name: "Run", unit: "min" };
const setM: Metric = {
  id: "m2",
  name: "Bench",
  unit: "reps",
  mode: "sets",
  weightUnit: "lbs",
};
const repsM: Metric = {
  id: "m3",
  name: "Pull-ups",
  unit: "reps",
  mode: "sets",
  setFields: [{ id: "r", label: "Reps", agg: "sum", primary: true }],
  setValue: "primary",
};
const timedM: Metric = {
  id: "m4",
  name: "Guitar",
  unit: "min",
  mode: "sets",
  setFields: [
    { id: "min", label: "Minutes", unit: "min", agg: "sum", primary: true },
  ],
  setValue: "primary",
};
const tempoM: Metric = {
  id: "m5",
  name: "Scales",
  unit: "min",
  mode: "sets",
  setValue: "primary",
  setFields: [
    { id: "bpm", label: "BPM", agg: "max" },
    { id: "min", label: "Minutes", unit: "min", agg: "sum", primary: true },
  ],
};

describe("isDoneMetric / doneMetric", () => {
  it("is true only for mode 'done'", () => {
    expect(
      isDoneMetric({ id: "d", name: "x", unit: "count", mode: "done" }),
    ).toBe(true);
    expect(isDoneMetric(minM)).toBe(false);
    expect(isDoneMetric(setM)).toBe(false);
  });
  it("doneMetric() builds a done-mode count metric", () => {
    const m = doneMetric();
    expect(m.mode).toBe("done");
    expect(m.unit).toBe("count");
    expect(typeof m.id).toBe("string");
    expect(m.id.length).toBeGreaterThan(0);
  });
});

describe("getUnit", () => {
  it("returns the matching unit", () => {
    expect(getUnit("min", BUILTIN_UNITS).label).toBe("Minutes");
  });
  it("falls back to a generic unit when id is unknown", () => {
    expect(getUnit("xyz", BUILTIN_UNITS)).toEqual({
      id: "xyz",
      label: "xyz",
      quickAdd: [1, 5, 10],
      thresholds: [1, 3, 5],
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

describe("setFieldsOf", () => {
  it("defaults to the weighted [weight, reps] schema, honoring weightUnit", () => {
    const f = setFieldsOf(setM);
    expect(f.map((x) => x.id)).toEqual(["w", "r"]);
    expect(f[0].unit).toBe("lbs");
    expect(f[1].primary).toBe(true);
  });
  it("returns the metric's declared fields when present", () => {
    expect(setFieldsOf(tempoM).map((x) => x.id)).toEqual(["bpm", "min"]);
  });
});

describe("aggregateSets", () => {
  const sets = [
    { w: 100, r: 5 },
    { w: 120, r: 3 },
  ];
  it("sums", () => {
    expect(aggregateSets(sets, { id: "w", label: "", agg: "sum" })).toBe(220);
  });
  it("maxes", () => {
    expect(aggregateSets(sets, { id: "w", label: "", agg: "max" })).toBe(120);
  });
  it("takes last", () => {
    expect(aggregateSets(sets, { id: "w", label: "", agg: "last" })).toBe(120);
  });
  it("averages", () => {
    expect(aggregateSets(sets, { id: "w", label: "", agg: "avg" })).toBe(110);
  });
  it("is safe on empty/undefined", () => {
    expect(aggregateSets([], { id: "w", label: "", agg: "sum" })).toBe(0);
    expect(aggregateSets(undefined, { id: "w", label: "", agg: "max" })).toBe(
      0,
    );
  });
});

describe("setVolume", () => {
  it("sums the product of all fields across sets", () => {
    expect(
      setVolume(
        [
          { w: 100, r: 5 },
          { w: 120, r: 3 },
        ],
        setFieldsOf(setM),
      ),
    ).toBe(860);
  });
});

describe("primaryField", () => {
  it("uses the field flagged primary", () => {
    expect(primaryField(tempoM).id).toBe("min");
  });
  it("falls back to the last field of the weighted default (reps)", () => {
    expect(primaryField(setM).id).toBe("r");
  });
});

describe("setsMetricVal", () => {
  it("weighted (default) → total volume", () => {
    expect(
      setsMetricVal(setM, [
        { w: 100, r: 5 },
        { w: 120, r: 3 },
      ]),
    ).toBe(860);
  });
  it("reps-only → total reps", () => {
    expect(setsMetricVal(repsM, [{ r: 12 }, { r: 8 }])).toBe(20);
  });
  it("timed → total minutes", () => {
    expect(setsMetricVal(timedM, [{ min: 20 }, { min: 15 }])).toBe(35);
  });
  it("tempo+time → primary (minutes), ignoring the max-agg field", () => {
    expect(
      setsMetricVal(tempoM, [
        { bpm: 120, min: 10 },
        { bpm: 90, min: 5 },
      ]),
    ).toBe(15);
  });
});

describe("setsPreset", () => {
  it("weighted → volume, weight+reps fields, honoring the weight unit", () => {
    const p = setsPreset("weighted", "kg");
    expect(p.setValue).toBe("volume");
    expect(p.setFields!.map((f) => f.id)).toEqual(["w", "r"]);
    expect(p.setFields![0].unit).toBe("kg");
    expect(p.weightUnit).toBe("kg");
  });
  it("reps → primary, single reps field", () => {
    const p = setsPreset("reps");
    expect(p.setValue).toBe("primary");
    expect(p.setFields!.map((f) => f.id)).toEqual(["r"]);
    expect(p.unit).toBe("reps");
  });
  it("timed → primary, single minutes field", () => {
    const p = setsPreset("timed");
    expect(p.setFields!.map((f) => f.id)).toEqual(["min"]);
    expect(p.unit).toBe("min");
  });
});

describe("setUnitLabel", () => {
  it("is the weight unit for weighted, the primary unit/label otherwise", () => {
    expect(setUnitLabel(setM)).toBe("lbs");
    expect(setUnitLabel(repsM)).toBe("reps");
    expect(setUnitLabel(timedM)).toBe("min");
  });
});

describe("metricVal", () => {
  it("returns the numeric value for a normal metric", () => {
    expect(metricVal(minM, { m1: 30 })).toBe(30);
  });
  it("returns total volume for a (default weighted) sets metric", () => {
    expect(metricVal(setM, { m2: [{ w: 50, r: 10 }] })).toBe(500);
  });
  it("returns total reps for a reps-only sets metric", () => {
    expect(metricVal(repsM, { m3: [{ r: 12 }, { r: 8 }] })).toBe(20);
  });
  it("returns 0 with no log", () => {
    expect(metricVal(minM, undefined)).toBe(0);
  });
});

describe("findLastSet", () => {
  it("returns the most recent logged set within 90 days", () => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const logs: HabitLogs = { [key]: { m4: [{ min: 20 }, { min: 30 }] } };
    expect(findLastSet(logs, "m4")).toEqual({ min: 30 });
  });
  it("returns null when nothing is found", () => {
    expect(findLastSet({}, "m4")).toBeNull();
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
