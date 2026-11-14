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
  schemaVersion: 2,
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
          unit: "volume",
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
  it("is at schema version 2", () => {
    expect(SCHEMA_VERSION).toBe(2);
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
    expect(reject({ ...v2Normalized, schemaVersion: 3 })).toBe(
      "schema version 3 is newer than this app understands",
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
    const bare = { id: "m", name: "Bench", unit: "volume", mode: "sets" };
    expect(withMetric(bare)).toEqual({
      ...bare,
      setValue: "volume",
      setFields: [
        { id: "w", label: "Weight", unit: "lbs", agg: "max" },
        { id: "r", label: "Reps", agg: "sum", primary: true },
      ],
    });
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
    expect(m).toMatchObject({ setFields: [{ unit: "kg" }, { id: "r" }] });
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
    expect(m).toMatchObject({ setValue: "volume" });
  });

  it("adds no sets fields to numeric or check-off metrics", () => {
    const plain = { id: "m", name: "Run", unit: "min" };
    const done = { id: "m", name: "Completed", unit: "count", mode: "done" };
    expect(withMetric(plain)).toEqual(plain);
    expect(withMetric(done)).toEqual(done);
  });
});

// Version 2 gave weighted sets the "volume" unit; before it they were "reps".
describe("normalizeState — weighted sets from before the volume unit", () => {
  const weighted = {
    id: "w",
    name: "Bench",
    unit: "reps",
    mode: "sets",
    weightUnit: "lbs",
    setValue: "volume",
    setFields: [
      { id: "w", label: "Weight", unit: "lbs", agg: "max" },
      { id: "r", label: "Reps", agg: "sum", primary: true },
    ],
  };
  const repsOnly = {
    id: "p",
    name: "Pull-ups",
    unit: "reps",
    mode: "sets",
    setValue: "primary",
    setFields: [{ id: "r", label: "Reps", agg: "sum", primary: true }],
  };
  const pushUps = { id: "u", name: "Push-ups", unit: "reps" };

  /** The units of the metrics after normalizing them as version-1 data. */
  const unitsOf = (metrics: object[], schemaVersion: number | undefined = 1) =>
    accept({
      schemaVersion,
      habits: [{ id: "h1", name: "Lift", metrics }],
    }).habits[0].metrics.map((m) => m.unit);

  it("moves a weighted metric from reps to volume", () => {
    expect(unitsOf([weighted])).toEqual(["volume"]);
  });

  it("does the same for data from before versions", () => {
    expect(unitsOf([weighted], undefined)).toEqual(["volume"]);
    // ...including a sets metric that had no schema yet
    const bare = { id: "b", name: "Squat", unit: "reps", mode: "sets" };
    expect(unitsOf([bare], undefined)).toEqual(["volume"]);
  });

  it("changes nothing else about the metric", () => {
    const [m] = accept({
      schemaVersion: 1,
      habits: [{ id: "h1", name: "Lift", metrics: [weighted] }],
    }).habits[0].metrics;
    expect(m).toEqual({ ...weighted, unit: "volume" });
  });

  it("leaves reps that really are reps", () => {
    expect(unitsOf([repsOnly, pushUps])).toEqual(["reps", "reps"]);
    // One field, so its "volume" is just the reps added up
    const summed = { ...repsOnly, setValue: "volume" };
    expect(unitsOf([summed])).toEqual(["reps"]);
  });

  it("leaves a weighted metric that was given another unit", () => {
    expect(unitsOf([{ ...weighted, unit: "tonnage" }])).toEqual(["tonnage"]);
  });

  it("leaves data that is already at version 2", () => {
    expect(unitsOf([weighted], 2)).toEqual(["reps"]);
  });

  // The habit form only allows "sum total" colouring when every metric has
  // the same unit, and switches to coverage otherwise.
  describe("intensity mode", () => {
    const modeOf = (
      metrics: object[],
      intensityMode = "total",
      schemaVersion = 1,
    ) =>
      accept({
        schemaVersion,
        habits: [{ id: "h1", name: "Lift", metrics, intensityMode }],
      }).habits[0].intensityMode;
    const squat = { ...weighted, id: "s", name: "Squat" };

    it("becomes coverage when the move leaves a habit with mixed units", () => {
      expect(modeOf([weighted, repsOnly])).toBe("coverage");
      expect(modeOf([pushUps, weighted])).toBe("coverage");
    });

    it("stays total when the metrics still share a unit", () => {
      expect(modeOf([weighted])).toBe("total");
      expect(modeOf([weighted, squat])).toBe("total"); // both volume now
    });

    it("stays coverage where it already was", () => {
      expect(modeOf([weighted, squat], "coverage")).toBe("coverage");
      expect(modeOf([weighted, repsOnly], "coverage")).toBe("coverage");
    });

    it("is left alone on a habit the move didn't touch", () => {
      const run = { id: "run", name: "Run", unit: "min" };
      expect(modeOf([run, pushUps])).toBe("total");
    });

    it("is left alone on data already at version 2", () => {
      const moved = { ...weighted, unit: "volume" };
      expect(modeOf([moved, repsOnly], "total", 2)).toBe("total");
    });
  });

  it("stamps the migrated data as version 2", () => {
    const state = accept({
      schemaVersion: 1,
      habits: [{ id: "h1", name: "Lift", metrics: [weighted] }],
    });
    expect(state.schemaVersion).toBe(2);
    expect(state.units.map((u) => u.id)).toContain("volume");
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
      "volume",
    ]);
  });

  it("adds a built-in unit that is newer than the stored data", () => {
    // What was stored before the volume unit existed
    const older = BUILTIN_UNITS.filter((u) => u.id !== "volume");
    expect(units(older)).toEqual(BUILTIN_UNITS);
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
