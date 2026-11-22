import { describe, it, expect } from "vitest";
import { normalizeRun, normalizeState, SCHEMA_VERSION } from "./normalize";
import type { Run } from "./routineRun";
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
  schemaVersion: SCHEMA_VERSION,
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
  groups: [],
  routines: [],
};

describe("normalizeState", () => {
  it("is at schema version 4", () => {
    expect(SCHEMA_VERSION).toBe(4);
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
    const newer = SCHEMA_VERSION + 1;
    expect(reject({ ...v2Normalized, schemaVersion: newer })).toBe(
      `schema version ${newer} is newer than this app understands`,
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

  it("stamps the migrated data with the current version", () => {
    const state = accept({
      schemaVersion: 1,
      habits: [{ id: "h1", name: "Lift", metrics: [weighted] }],
    });
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
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

describe("normalizeState — groups", () => {
  const music = { id: "g1", name: "Music", emoji: "🎵", collapsed: false };
  const fitness = { id: "g2", name: "Fitness", emoji: "🏋️", collapsed: true };
  const groupOf = (groupId: unknown, groups: unknown = [music]) =>
    accept({ habits: [{ id: "h1", name: "Piano", groupId }], groups })
      .habits[0];

  it("starts with no groups when there are none", () => {
    expect(accept({ habits: [] }).groups).toEqual([]);
  });

  it("keeps groups in their stored order", () => {
    expect(accept({ habits: [], groups: [fitness, music] }).groups).toEqual([
      fitness,
      music,
    ]);
  });

  it("fills in what a group lacks: open, with a name and an emoji", () => {
    expect(accept({ habits: [], groups: [{ id: "g1" }] }).groups).toEqual([
      { id: "g1", name: "", emoji: "📁", collapsed: false },
    ]);
  });

  it("rejects groups that aren't a list of objects with ids", () => {
    expect(reject({ habits: [], groups: {} })).toBe("groups is not a list");
    expect(reject({ habits: [], groups: [null] })).toBe(
      "groups[0] is not an object",
    );
    expect(reject({ habits: [], groups: [{ name: "Music" }] })).toBe(
      "groups[0] has no id",
    );
  });

  it("keeps a habit's group", () => {
    expect(groupOf("g1").groupId).toBe("g1");
  });

  it("drops a habit's group when no group has that id", () => {
    expect(groupOf("gone")).not.toHaveProperty("groupId");
    expect(groupOf("g1", [])).not.toHaveProperty("groupId");
  });

  it("drops a group id that isn't a string", () => {
    expect(groupOf(7)).not.toHaveProperty("groupId");
    expect(groupOf(null)).not.toHaveProperty("groupId");
  });

  it("gives the same result when run twice", () => {
    const once = accept({
      habits: [
        { id: "h1", name: "Piano", groupId: "g1" },
        { id: "h2", name: "Run", groupId: "gone" },
      ],
      groups: [music, { id: "g2" }],
    });
    expect(accept(once)).toEqual(once);
  });
});

describe("normalizeState — routines", () => {
  const pushUps = {
    id: "push",
    name: "Push-ups",
    metrics: [{ id: "r", name: "Reps", unit: "reps" }],
  };
  const reading = {
    id: "read",
    name: "Reading",
    metrics: [{ id: "m", name: "Time", unit: "min" }],
  };
  const pushStep = {
    kind: "habit",
    id: "s1",
    habitId: "push",
    metricId: "r",
    by: "count",
    seconds: 45,
    count: 12,
  };
  const pause = { kind: "break", id: "s2", seconds: 20 };
  const morning = {
    id: "r1",
    name: "Morning",
    rounds: 3,
    prep: 0,
    steps: [pushStep, pause],
  };
  const routinesOf = (routines: unknown) =>
    accept({ habits: [pushUps, reading], routines }).routines;

  it("starts with no routines when there are none", () => {
    expect(accept({ habits: [] }).routines).toEqual([]);
  });

  it("keeps routines in their stored order, as they are", () => {
    const evening = { ...morning, id: "r2", name: "Evening" };
    expect(routinesOf([evening, morning])).toEqual([evening, morning]);
  });

  it("fills in what a routine lacks", () => {
    expect(routinesOf([{ id: "r1" }])).toEqual([
      { id: "r1", name: "", rounds: 1, prep: 5, steps: [] },
    ]);
    expect(
      routinesOf([{ ...morning, rounds: 0, prep: -1, name: 7 }])[0],
    ).toMatchObject({ name: "", rounds: 1, prep: 5 });
  });

  it("fills in what a step lacks: timed, a minute, a count of 10", () => {
    const [r] = routinesOf([
      {
        ...morning,
        steps: [
          { kind: "habit", id: "a", habitId: "push", metricId: "r" },
          { kind: "break", id: "b" },
        ],
      },
    ]);
    expect(r.steps).toEqual([
      {
        kind: "habit",
        id: "a",
        habitId: "push",
        metricId: "r",
        by: "time",
        seconds: 60,
        count: 10,
      },
      { kind: "break", id: "b", seconds: 30 },
    ]);
  });

  it("drops a step whose habit or metric is gone", () => {
    const [r] = routinesOf([
      {
        ...morning,
        steps: [
          { ...pushStep, habitId: "gone" },
          { ...pushStep, id: "s3", metricId: "gone" },
          { ...pushStep, id: "s4", habitId: 7 },
          pause,
        ],
      },
    ]);
    expect(r.steps).toEqual([pause]);
  });

  it("times a counted step on a metric that doesn't count", () => {
    const [r] = routinesOf([
      {
        ...morning,
        steps: [{ ...pushStep, habitId: "read", metricId: "m" }],
      },
    ]);
    expect(r.steps[0]).toMatchObject({ by: "time", seconds: 45 });
  });

  it("rejects routines and steps that aren't lists of objects with ids", () => {
    expect(reject({ habits: [], routines: {} })).toBe("routines is not a list");
    expect(reject({ habits: [], routines: [{ name: "x" }] })).toBe(
      "routines[0] has no id",
    );
    expect(reject({ habits: [], routines: [{ id: "r", steps: 1 }] })).toBe(
      "routines[0].steps is not a list",
    );
    expect(
      reject({
        habits: [],
        routines: [{ id: "r", steps: [{ kind: "break" }] }],
      }),
    ).toBe("routines[0].steps[0] has no id");
  });

  it("rejects a step that's neither a habit nor a break", () => {
    expect(
      reject({
        habits: [],
        routines: [{ id: "r", steps: [{ id: "s", kind: "rest" }] }],
      }),
    ).toBe("routines[0].steps[0] is neither a habit nor a break");
  });

  it("gives the same result when run twice", () => {
    const once = accept({
      habits: [pushUps, reading],
      routines: [morning, { id: "r2" }],
    });
    expect(accept(once)).toEqual(once);
  });
});

describe("normalizeRun: a run in progress as stored", () => {
  const run: Run = {
    routine: {
      id: "r1",
      name: "Morning",
      rounds: 2,
      prep: 5,
      steps: [
        {
          kind: "habit",
          id: "s1",
          habitId: "h1",
          metricId: "m1",
          by: "count",
          seconds: 60,
          count: 10,
        },
        { kind: "break", id: "s2", seconds: 30 },
      ],
    },
    startedAt: 1_000_000,
    pausedAt: 1_030_000,
    pausedMs: 2_000,
    shiftMs: -500,
    ends: { "0:0": 41.5 },
    results: {
      "0:0": { status: "logged", amount: 10, text: "10 reps", set: { r: 10 } },
      "1:0": { status: "skipped" },
    },
    finished: true,
  };

  it("reads a run back as it was", () => {
    expect(normalizeRun(JSON.parse(JSON.stringify(run)))).toEqual(run);
  });

  it("keeps the routine as it was, though its habits are gone", () => {
    expect(normalizeRun(run)?.routine.steps).toHaveLength(2);
  });

  it("gives up on anything that isn't a run", () => {
    expect(normalizeRun(null)).toBeNull();
    expect(normalizeRun("run")).toBeNull();
    expect(normalizeRun({ ...run, routine: { name: "x" } })).toBeNull();
    expect(normalizeRun({ ...run, startedAt: "soon" })).toBeNull();
  });

  it("drops what it can't read of its ends and results", () => {
    const out = normalizeRun({
      ...run,
      pausedAt: "x",
      pausedMs: undefined,
      ends: { "0:0": 41.5, "1:0": "x" },
      results: {
        ...run.results,
        "0:2": { status: "logged", amount: "ten" },
        "1:2": "skipped",
      },
      finished: "yes",
    });
    expect(out).toEqual({
      ...run,
      pausedAt: undefined,
      pausedMs: 0,
      ends: { "0:0": 41.5 },
      finished: false,
    });
  });
});
