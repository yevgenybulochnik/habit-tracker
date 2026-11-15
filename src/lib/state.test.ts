import { describe, it, expect } from "vitest";
import { reduce, type Action, type AppState } from "./state";
import { BUILTIN_UNITS, DEFAULT_CONFIG } from "./defaults";
import type { Habit } from "../types";

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
