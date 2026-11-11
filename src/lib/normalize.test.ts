import { describe, it, expect } from "vitest";
import { normalizeState, SCHEMA_VERSION } from "./normalize";
import { BUILTIN_UNITS, DEFAULT_CONFIG } from "./defaults";
import type { PersistedState } from "../types";

/** Normalize data that must be accepted, and return the state. */
function accept(raw: unknown): PersistedState {
  const result = normalizeState(raw);
  if (!result.ok) throw new Error(`rejected: ${result.reason}`);
  return result.state;
}

/** Normalize data that must be rejected, and return the reason. */
function reject(raw: unknown): string {
  const result = normalizeState(raw);
  if (result.ok) throw new Error("accepted");
  return result.reason;
}

// What the v2 app stored: no units, no config, no schema version; a habit may
// have no metrics or intensity mode, and a sets metric only a weight unit.
const v2 = {
  habits: [
    { id: "h1", name: "Read", emoji: "📚", color: "Blue" },
    {
      id: "h2",
      name: "Lift",
      emoji: "🏋️",
      description: "Push day",
      color: "Red",
      metrics: [
        {
          id: "m1",
          name: "Bench",
          unit: "reps",
          mode: "sets",
          weightUnit: "kg",
        },
        { id: "m2", name: "Warm-up", unit: "min" },
      ],
      intensityMode: "coverage",
    },
  ],
  logs: {
    h2: { "2026-05-24": { m1: [{ w: 60, r: 8 }], m2: 10 } },
  },
};

// The same data in the current format.
const v2Normalized: PersistedState = {
  schemaVersion: 1,
  habits: [
    {
      id: "h1",
      name: "Read",
      emoji: "📚",
      color: "Blue",
      metrics: [],
      intensityMode: "total",
    },
    {
      id: "h2",
      name: "Lift",
      emoji: "🏋️",
      description: "Push day",
      color: "Red",
      metrics: [
        {
          id: "m1",
          name: "Bench",
          unit: "reps",
          mode: "sets",
          weightUnit: "kg",
          setValue: "volume",
          setFields: [
            { id: "w", label: "Weight", unit: "kg", agg: "max" },
            { id: "r", label: "Reps", agg: "sum", primary: true },
          ],
        },
        { id: "m2", name: "Warm-up", unit: "min" },
      ],
      intensityMode: "coverage",
    },
  ],
  logs: {
    h2: { "2026-05-24": { m1: [{ w: 60, r: 8 }], m2: 10 } },
  },
  units: BUILTIN_UNITS,
  config: DEFAULT_CONFIG,
};

describe("normalizeState", () => {
  it("is at schema version 1", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });

  it("brings v2-shaped data up to the current format", () => {
    expect(accept(v2)).toEqual(v2Normalized);
  });

  it("gives the same result when run twice", () => {
    const once = accept(v2);
    expect(accept(once)).toEqual(once);
  });

  it("leaves current-format data as it is", () => {
    expect(accept(v2Normalized)).toEqual(v2Normalized);
  });

  it("does not modify its input", () => {
    const input = structuredClone(v2);
    accept(input);
    expect(input).toEqual(v2);
  });

  it("drops top-level keys it doesn't know", () => {
    expect(accept({ ...v2, extra: 1 })).toEqual(v2Normalized);
  });
});

describe("normalizeState — rejected data", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a number", 42],
    ["a boolean", true],
    ["a string", "habits"],
    ["a JSON string of valid data", JSON.stringify(v2)],
    ["an array", [v2]],
  ])("rejects %s", (_, raw) => {
    expect(reject(raw)).toBe("not an object");
  });

  it("rejects data with no list of habits", () => {
    expect(reject({})).toBe("habits is missing");
    expect(reject({ logs: {} })).toBe("habits is missing");
    expect(reject({ habits: null })).toBe("habits is missing");
    expect(reject({ habits: { h1: {} } })).toBe("habits is not a list");
  });

  it("rejects a habit that isn't an object or has no id", () => {
    expect(reject({ habits: ["Read"] })).toBe("habits[0] is not an object");
    expect(reject({ habits: [v2.habits[0], { name: "Read" }] })).toBe(
      "habits[1] has no id",
    );
    expect(reject({ habits: [{ id: 7, name: "Read" }] })).toBe(
      "habits[0] has no id",
    );
  });

  it("rejects metrics that aren't a list of objects with ids", () => {
    const habit = (metrics: unknown) => ({
      habits: [{ id: "h1", name: "Read", metrics }],
    });
    expect(reject(habit("min"))).toBe("habits[0].metrics is not a list");
    expect(reject(habit([null]))).toBe("habits[0].metrics[0] is not an object");
    expect(reject(habit([{ name: "Pages", unit: "count" }]))).toBe(
      "habits[0].metrics[0] has no id",
    );
  });

  it("rejects set fields that aren't a list of objects with ids", () => {
    const metric = (setFields: unknown) => ({
      habits: [
        {
          id: "h1",
          name: "Lift",
          metrics: [
            { id: "m1", name: "Bench", unit: "reps", mode: "sets", setFields },
          ],
        },
      ],
    });
    expect(reject(metric("w,r"))).toBe(
      "habits[0].metrics[0].setFields is not a list",
    );
    expect(reject(metric([{ label: "Reps", agg: "sum" }]))).toBe(
      "habits[0].metrics[0].setFields[0] has no id",
    );
  });

  it("rejects logs, units, config or timers of the wrong type", () => {
    expect(reject({ habits: [], logs: [] })).toBe("logs is not an object");
    expect(reject({ habits: [], logs: { h1: 3 } })).toBe(
      "logs.h1 is not an object",
    );
    expect(reject({ habits: [], units: {} })).toBe("units is not a list");
    expect(reject({ habits: [], config: "dark" })).toBe(
      "config is not an object",
    );
    expect(reject({ habits: [], timers: [] })).toBe("timers is not an object");
  });

  it("rejects a unit without an id or its number lists", () => {
    const unit = { id: "km", label: "Km", quickAdd: [1], thresholds: [1, 3] };
    const units = (u: unknown) => ({ habits: [], units: [u] });
    expect(reject(units("km"))).toBe("units[0] is not an object");
    expect(reject(units({ ...unit, id: undefined }))).toBe(
      "units[0] has no id",
    );
    expect(reject(units({ ...unit, quickAdd: undefined }))).toBe(
      "units[0].quickAdd is not a list of numbers",
    );
    expect(reject(units({ ...unit, thresholds: ["1", "3"] }))).toBe(
      "units[0].thresholds is not a list of numbers",
    );
  });

  it("rejects data from a newer schema version", () => {
    expect(reject({ ...v2Normalized, schemaVersion: 2 })).toBe(
      "schema version 2 is newer than this app understands",
    );
    expect(reject({ ...v2Normalized, schemaVersion: "1" })).toBe(
      "schemaVersion is not a number",
    );
  });
});

describe("normalizeState — habits and metrics", () => {
  const withMetric = (metric: object) =>
    accept({ habits: [{ id: "h1", name: "Lift", metrics: [metric] }] })
      .habits[0].metrics[0];

  it("treats any intensity mode other than coverage as total", () => {
    const modes = accept({
      habits: [
        { id: "a", name: "A", intensityMode: "coverage" },
        { id: "b", name: "B", intensityMode: "total" },
        { id: "c", name: "C", intensityMode: "brightest" },
        { id: "d", name: "D" },
      ],
    }).habits.map((h) => h.intensityMode);
    expect(modes).toEqual(["coverage", "total", "total", "total"]);
  });

  it("gives a sets metric with no schema the weighted one, in lbs", () => {
    const m = withMetric({
      id: "m",
      name: "Bench",
      unit: "reps",
      mode: "sets",
    });
    expect(m.setValue).toBe("volume");
    expect(m.setFields).toEqual([
      { id: "w", label: "Weight", unit: "lbs", agg: "max" },
      { id: "r", label: "Reps", agg: "sum", primary: true },
    ]);
  });

  it("treats an empty list of set fields as no schema", () => {
    const m = withMetric({
      id: "m",
      name: "Bench",
      unit: "reps",
      mode: "sets",
      weightUnit: "kg",
      setFields: [],
    });
    expect(m.setFields?.map((f) => f.unit)).toEqual(["kg", undefined]);
  });

  it("keeps a sets metric's own schema and value mode", () => {
    const timed = {
      id: "m",
      name: "Guitar",
      unit: "min",
      mode: "sets",
      setValue: "primary",
      setFields: [
        { id: "bpm", label: "BPM", agg: "max" },
        { id: "min", label: "Minutes", unit: "min", agg: "sum", primary: true },
      ],
    };
    expect(withMetric(timed)).toEqual(timed);
  });

  it("makes the value mode explicit when a schema has none", () => {
    const m = withMetric({
      id: "m",
      name: "Pull-ups",
      unit: "reps",
      mode: "sets",
      setFields: [{ id: "r", label: "Reps", agg: "sum", primary: true }],
    });
    expect(m.setValue).toBe("volume");
  });

  it("adds no sets fields to numeric or check-off metrics", () => {
    const plain = { id: "m", name: "Run", unit: "min" };
    const done = { id: "m", name: "Completed", unit: "count", mode: "done" };
    expect(withMetric(plain)).toEqual(plain);
    expect(withMetric(done)).toEqual(done);
  });
});

describe("normalizeState — config", () => {
  const config = (c: unknown) => accept({ habits: [], config: c }).config;

  it("fills in the settings a partial config lacks", () => {
    expect(config({ numMonths: 6 })).toEqual({
      ...DEFAULT_CONFIG,
      numMonths: 6,
    });
    expect(config({ theme: "light", dashView: "calendar" })).toEqual({
      ...DEFAULT_CONFIG,
      theme: "light",
      dashView: "calendar",
    });
  });

  it("keeps a month gap of zero", () => {
    expect(config({ monthGap: 0 }).monthGap).toBe(0);
  });

  it("replaces unusable settings with the defaults", () => {
    expect(
      config({
        numMonths: 0,
        monthGap: Infinity,
        theme: "sepia",
        dashView: undefined,
      }),
    ).toEqual(DEFAULT_CONFIG);
  });

  it("uses the default config when there is none", () => {
    expect(config(undefined)).toEqual(DEFAULT_CONFIG);
  });
});

describe("normalizeState — units", () => {
  const units = (u: unknown) => accept({ habits: [], units: u }).units;
  const km = {
    id: "km",
    label: "Km",
    quickAdd: [1, 5],
    thresholds: [2, 5, 10],
  };

  it("uses the built-in units when there are none", () => {
    expect(units(undefined)).toEqual(BUILTIN_UNITS);
    expect(units([])).toEqual(BUILTIN_UNITS);
  });

  it("keeps stored units in order and adds the missing built-ins after", () => {
    const reps = BUILTIN_UNITS.find((u) => u.id === "reps")!;
    expect(units([km, reps]).map((u) => u.id)).toEqual([
      "km",
      "reps",
      "min",
      "count",
    ]);
  });

  it("keeps an edited built-in unit instead of restoring it", () => {
    const edited = BUILTIN_UNITS.map((u) =>
      u.id === "min" ? { ...u, thresholds: [20, 40, 90] } : u,
    );
    expect(units(edited)).toEqual(edited);
  });
});

describe("normalizeState — logs and timers", () => {
  it("starts with empty logs when there are none", () => {
    expect(accept({ habits: [] }).logs).toEqual({});
  });

  it("keeps running timers", () => {
    const timers = { "h1:m1": 1_716_500_000_000 };
    expect(accept({ habits: [], timers }).timers).toEqual(timers);
  });

  it("drops timers that aren't timestamps", () => {
    const timers = { "h1:m1": 1_716_500_000_000, "h1:m2": "soon", h2: null };
    expect(accept({ habits: [], timers }).timers).toEqual({
      "h1:m1": 1_716_500_000_000,
    });
  });

  it("adds no timers when there are none", () => {
    expect(accept({ habits: [] })).not.toHaveProperty("timers");
  });
});
