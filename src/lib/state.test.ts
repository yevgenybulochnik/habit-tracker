import { describe, it, expect } from "vitest";
import { isTiming, reduce, type Action, type AppState } from "./state";
import { BUILTIN_UNITS, DEFAULT_CONFIG } from "./defaults";
import { SCHEMA_VERSION } from "./normalize";
import type { Group, Habit, PersistedState, Routine, Unit } from "../types";

function habit(id: string, name = id): Habit {
  return {
    id,
    name,
    emoji: "📚",
    color: "Blue",
    metrics: [{ id: "m1", name: "Time", unit: "min" }],
    intensityMode: "total",
  };
}

function state(over: Partial<AppState> = {}): AppState {
  return {
    habits: [],
    logs: {},
    units: BUILTIN_UNITS,
    config: DEFAULT_CONFIG,
    groups: [],
    routines: [],
    timers: {},
    ...over,
  };
}

/** Freeze the whole tree, so a reducer that mutates its input throws. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/** Run the reducer on a frozen copy of `s`, proving it doesn't mutate it. */
function run(s: AppState, action: Action): AppState {
  return reduce(deepFreeze(structuredClone(s)), action);
}

describe("reduce: habits", () => {
  it("adds a habit with the given id and empty logs", () => {
    const { id: _, ...props } = habit("h1", "Read");
    const out = run(state({ habits: [habit("h0")] }), {
      type: "habit/add",
      id: "h1",
      habit: props,
    });
    expect(out.habits.map((h) => h.id)).toEqual(["h0", "h1"]);
    expect(out.habits[1]).toEqual(habit("h1", "Read"));
    expect(out.logs.h1).toEqual({});
  });

  it("updates the habit with the same id and keeps the others", () => {
    const s = state({ habits: [habit("h1"), habit("h2")] });
    const out = reduce(s, {
      type: "habit/update",
      habit: { ...habit("h2"), name: "Renamed" },
    });
    expect(out.habits.map((h) => h.name)).toEqual(["h1", "Renamed"]);
    expect(out.habits[0]).toBe(s.habits[0]);
  });

  it("deletes a habit along with its logs and running timers", () => {
    const s = state({
      habits: [habit("h1"), habit("h2")],
      logs: {
        h1: { "2026-11-15": { m1: 5 } },
        h2: { "2026-11-15": { m1: 7 } },
      },
      timers: { "h1:m1": 1000, "h2:m1": 2000 },
    });
    const out = run(s, { type: "habit/delete", id: "h1" });
    expect(out.habits.map((h) => h.id)).toEqual(["h2"]);
    expect(out.logs).toEqual({ h2: { "2026-11-15": { m1: 7 } } });
    expect(out.timers).toEqual({ "h2:m1": 2000 });
  });

  it("moves a habit to the position of another", () => {
    const s = state({ habits: [habit("a"), habit("b"), habit("c")] });
    const out = run(s, { type: "habit/reorder", activeId: "c", overId: "a" });
    expect(out.habits.map((h) => h.id)).toEqual(["c", "a", "b"]);
  });
});

describe("reduce: logs", () => {
  const day = "2026-11-15";
  const where = { habitId: "h1", metricId: "m1", dateKey: day };

  it("sets a whole day's entry and keeps the other days", () => {
    const s = state({ logs: { h1: { "2026-11-14": { m1: 3 } } } });
    const out = run(s, {
      type: "log/setDay",
      habitId: "h1",
      dateKey: day,
      entry: { m1: 5, m2: 1 },
    });
    expect(out.logs.h1).toEqual({
      "2026-11-14": { m1: 3 },
      [day]: { m1: 5, m2: 1 },
    });
  });

  it("adds an amount to the day's value and keeps the other metrics", () => {
    const s = state({ logs: { h1: { [day]: { m1: 10, m2: 4 } } } });
    const out = run(s, { type: "log/add", ...where, amount: 5 });
    expect(out.logs.h1[day]).toEqual({ m1: 15, m2: 4 });
  });

  it("adds from zero when nothing is logged yet", () => {
    const out = run(state(), { type: "log/add", ...where, amount: 5 });
    expect(out.logs).toEqual({ h1: { [day]: { m1: 5 } } });
  });

  it("resets the day's value to zero and keeps the other metrics", () => {
    const s = state({ logs: { h1: { [day]: { m1: 10, m2: 4 } } } });
    const out = run(s, { type: "log/reset", ...where });
    expect(out.logs.h1[day]).toEqual({ m1: 0, m2: 4 });
  });

  it("adds a set after the day's existing sets", () => {
    const s = state({ logs: { h1: { [day]: { m1: [{ w: 60, r: 8 }] } } } });
    const out = run(s, { type: "log/addSet", ...where, set: { w: 65, r: 6 } });
    expect(out.logs.h1[day].m1).toEqual([
      { w: 60, r: 8 },
      { w: 65, r: 6 },
    ]);
  });

  it("starts the day's sets with the first one", () => {
    const out = run(state(), { type: "log/addSet", ...where, set: { r: 10 } });
    expect(out.logs).toEqual({ h1: { [day]: { m1: [{ r: 10 }] } } });
  });

  it("removes the set at an index and keeps the rest", () => {
    const sets = [{ r: 1 }, { r: 2 }, { r: 3 }];
    const s = state({ logs: { h1: { [day]: { m1: sets } } } });
    const out = run(s, { type: "log/removeSet", ...where, index: 1 });
    expect(out.logs.h1[day].m1).toEqual([{ r: 1 }, { r: 3 }]);
  });
});

describe("isTiming", () => {
  const twoMetrics: Habit = {
    ...habit("h1"),
    metrics: [
      { id: "m1", name: "Time", unit: "min" },
      { id: "m2", name: "Rest", unit: "min" },
    ],
  };

  it("is true while any of the habit's metrics has a timer running", () => {
    expect(isTiming(twoMetrics, { "h1:m2": 1000 })).toBe(true);
  });

  it("is false with no timer running, or only another habit's", () => {
    expect(isTiming(twoMetrics, {})).toBe(false);
    expect(isTiming(twoMetrics, { "h2:m1": 1000 })).toBe(false);
  });
});

describe("reduce: timers", () => {
  const day = "2026-11-15";
  const metric = { habitId: "h1", metricId: "m1" };
  const MIN = 60_000;

  it("starts a timer at the given time and keeps the others", () => {
    const s = state({ timers: { "h2:m1": 500 } });
    const out = run(s, { type: "timer/start", ...metric, now: 1000 });
    expect(out.timers).toEqual({ "h2:m1": 500, "h1:m1": 1000 });
  });

  it("stops a timer and adds its rounded minutes to the given day", () => {
    const s = state({
      logs: { h1: { [day]: { m1: 5 } } },
      timers: { "h1:m1": 1000, "h2:m1": 500 },
    });
    const out = run(s, {
      type: "timer/stop",
      ...metric,
      now: 1000 + 10.6 * MIN,
      dateKey: day,
    });
    expect(out.timers).toEqual({ "h2:m1": 500 });
    expect(out.logs.h1[day].m1).toBe(5 + 11);
  });

  it("logs at least a minute for a timer stopped straight away", () => {
    const s = state({ timers: { "h1:m1": 1000 } });
    const out = run(s, {
      type: "timer/stop",
      ...metric,
      now: 1000 + 0.2 * MIN,
      dateKey: day,
    });
    expect(out.logs.h1[day].m1).toBe(1);
  });

  it("changes nothing when stopping a timer that isn't running", () => {
    const s = state({ timers: { "h2:m1": 500 } });
    const out = reduce(s, {
      type: "timer/stop",
      ...metric,
      now: 1000,
      dateKey: day,
    });
    expect(out).toBe(s);
  });
});

describe("reduce: units and config", () => {
  const pages: Unit = {
    id: "pages",
    label: "pages",
    quickAdd: [5, 10],
    thresholds: [10, 30, 60],
  };

  it("adds a unit", () => {
    const out = run(state({ units: [] }), { type: "unit/add", unit: pages });
    expect(out.units).toEqual([pages]);
  });

  it("ignores a new unit whose id is taken", () => {
    const s = state({ units: [pages] });
    const out = reduce(s, {
      type: "unit/add",
      unit: { ...pages, label: "Pages" },
    });
    expect(out).toBe(s);
  });

  it("merges changes into the unit with the given id", () => {
    const other = { ...pages, id: "other" };
    const s = state({ units: [pages, other] });
    const out = run(s, {
      type: "unit/update",
      id: "pages",
      changes: { quickAdd: [1] },
    });
    expect(out.units).toEqual([{ ...pages, quickAdd: [1] }, other]);
  });

  it("deletes a unit", () => {
    const s = state({ units: [pages, { ...pages, id: "other" }] });
    const out = run(s, { type: "unit/delete", id: "pages" });
    expect(out.units.map((u) => u.id)).toEqual(["other"]);
  });

  it("merges changes into the config", () => {
    const out = run(state(), {
      type: "config/update",
      changes: { dashView: "calendar" },
    });
    expect(out.config).toEqual({ ...DEFAULT_CONFIG, dashView: "calendar" });
  });
});

describe("reduce: groups", () => {
  const music: Group = {
    id: "g1",
    name: "Music",
    emoji: "🎵",
    collapsed: false,
  };
  const fitness: Group = {
    id: "g2",
    name: "Fitness",
    emoji: "🏋️",
    collapsed: false,
  };
  const inGroup = (id: string, groupId: string) => ({ ...habit(id), groupId });

  it("adds a group at the end", () => {
    const out = run(state({ groups: [music] }), {
      type: "group/add",
      group: fitness,
    });
    expect(out.groups).toEqual([music, fitness]);
  });

  it("ignores a group whose id is taken", () => {
    const out = run(state({ groups: [music] }), {
      type: "group/add",
      group: { ...fitness, id: "g1" },
    });
    expect(out.groups).toEqual([music]);
  });

  it("adds a habit straight into a group", () => {
    const { id: _, ...props } = inGroup("h1", "g1");
    const out = run(state({ groups: [music] }), {
      type: "habit/add",
      id: "h1",
      habit: props,
    });
    expect(out.habits[0].groupId).toBe("g1");
  });

  it("renames a group, changes its emoji, or folds it shut", () => {
    const s = state({ groups: [music, fitness] });
    const out = run(s, {
      type: "group/update",
      id: "g1",
      changes: { name: "Practice", emoji: "🎹", collapsed: true },
    });
    expect(out.groups).toEqual([
      { id: "g1", name: "Practice", emoji: "🎹", collapsed: true },
      fitness,
    ]);
  });

  it("sets a group's habits, moving them from other groups", () => {
    const s = state({
      groups: [music, fitness],
      habits: [inGroup("piano", "g1"), inGroup("run", "g2"), habit("water")],
    });
    const out = run(s, {
      type: "group/setMembers",
      id: "g1",
      habitIds: ["run", "water"],
    });
    expect(out.habits.map((h) => [h.id, h.groupId])).toEqual([
      ["piano", undefined],
      ["run", "g1"],
      ["water", "g1"],
    ]);
  });

  it("deletes a group, leaving its habits in no group", () => {
    const s = state({
      groups: [music, fitness],
      habits: [inGroup("piano", "g1"), inGroup("run", "g2")],
      logs: { piano: { "2026-11-01": { m1: 20 } } },
    });
    const out = run(s, { type: "group/delete", id: "g1" });
    expect(out.groups).toEqual([fitness]);
    expect(out.habits).toEqual([habit("piano"), inGroup("run", "g2")]);
    expect(out.logs).toEqual(s.logs);
  });

  it("moves a group to where another one is", () => {
    const third: Group = { ...music, id: "g3", name: "Mind" };
    const out = run(state({ groups: [music, fitness, third] }), {
      type: "group/reorder",
      activeId: "g3",
      overId: "g1",
    });
    expect(out.groups.map((g) => g.id)).toEqual(["g3", "g1", "g2"]);
  });
});

describe("reduce: routines", () => {
  const morning: Routine = {
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
        by: "time",
        seconds: 60,
        count: 10,
      },
      { kind: "break", id: "s2", seconds: 30 },
      {
        kind: "habit",
        id: "s3",
        habitId: "h2",
        metricId: "m1",
        by: "time",
        seconds: 60,
        count: 10,
      },
    ],
  };
  const evening: Routine = { ...morning, id: "r2", name: "Evening" };
  const withRoutines = (routines: Routine[]) =>
    state({ habits: [habit("h1"), habit("h2")], routines });

  it("adds a routine at the end", () => {
    const out = run(withRoutines([morning]), {
      type: "routine/add",
      routine: evening,
    });
    expect(out.routines).toEqual([morning, evening]);
  });

  it("ignores a routine whose id is taken", () => {
    const s = withRoutines([morning]);
    expect(
      run(s, { type: "routine/add", routine: { ...evening, id: "r1" } }),
    ).toEqual(s);
  });

  it("replaces the routine with the same id and keeps the others", () => {
    const renamed = { ...morning, name: "Early" };
    const out = run(withRoutines([morning, evening]), {
      type: "routine/update",
      routine: renamed,
    });
    expect(out.routines).toEqual([renamed, evening]);
  });

  it("deletes a routine", () => {
    const out = run(withRoutines([morning, evening]), {
      type: "routine/delete",
      id: "r1",
    });
    expect(out.routines).toEqual([evening]);
  });

  it("drops a deleted habit's steps from the routines", () => {
    const out = run(withRoutines([morning]), {
      type: "habit/delete",
      id: "h2",
    });
    expect(out.routines[0].steps.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("keeps the routines in line with a habit's changed metrics", () => {
    const counted = {
      ...morning,
      steps: morning.steps.map((s) =>
        s.kind === "habit" ? { ...s, by: "count" as const } : s,
      ),
    };
    const s = state({
      habits: [
        { ...habit("h1"), metrics: [{ id: "m1", name: "Reps", unit: "reps" }] },
        habit("h2"),
      ],
      routines: [counted],
    });
    // h1's reps become minutes, which aren't counted; h2 loses its metric.
    const out = run(s, {
      type: "habit/update",
      habit: {
        ...habit("h1"),
        metrics: [{ id: "m1", name: "Time", unit: "min" }],
      },
    });
    expect(out.routines[0].steps[0]).toMatchObject({ id: "s1", by: "time" });
    const out2 = run(s, {
      type: "habit/update",
      habit: { ...habit("h2"), metrics: [] },
    });
    expect(out2.routines[0].steps.map((x) => x.id)).toEqual(["s1", "s2"]);
  });
});

describe("reduce: replacing everything", () => {
  const saved: PersistedState = {
    schemaVersion: SCHEMA_VERSION,
    habits: [{ ...habit("h9"), groupId: "g1" }],
    logs: { h9: { "2026-11-01": { m1: 2 } } },
    units: [],
    config: { ...DEFAULT_CONFIG, theme: "light" },
    groups: [{ id: "g1", name: "Music", emoji: "🎵", collapsed: false }],
    routines: [{ id: "r9", name: "Practice", rounds: 1, prep: 0, steps: [] }],
    timers: { "h9:m1": 1000 },
  };
  const before = state({
    habits: [habit("h1")],
    logs: { h1: {} },
    timers: { "h1:m1": 500 },
  });

  it("loads stored state, keeping its running timers", () => {
    const out = run(before, { type: "state/load", state: saved });
    expect(out).toEqual({
      habits: saved.habits,
      logs: saved.logs,
      units: saved.units,
      config: saved.config,
      groups: saved.groups,
      routines: saved.routines,
      timers: saved.timers,
    });
  });

  it("loads stored state that has no timers", () => {
    const { timers: _, ...noTimers } = saved;
    const out = run(before, { type: "state/load", state: noTimers });
    expect(out.timers).toEqual({});
  });

  it("imports a backup without bringing back its timers", () => {
    const out = run(before, { type: "state/import", state: saved });
    expect(out).toEqual({
      habits: saved.habits,
      logs: saved.logs,
      units: saved.units,
      config: saved.config,
      groups: saved.groups,
      routines: saved.routines,
      timers: {},
    });
  });
});
