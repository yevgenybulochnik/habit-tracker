import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { RUN_KEY } from "../lib/defaults";
import { setsPreset } from "../lib/metrics";
import type { Action } from "../lib/state";
import type { Habit, HabitStep, Logs, Routine } from "../types";
import { useRoutineRun } from "./useRoutineRun";

const TODAY = "2026-11-22";
const T0 = new Date(`${TODAY}T09:00:00`).getTime();

const habit = (id: string, metric: Habit["metrics"][number]): Habit => ({
  id,
  name: id,
  emoji: "⭐",
  color: "Blue",
  metrics: [metric],
  intensityMode: "total",
});
const push = habit("push", {
  id: "r",
  name: "Reps",
  mode: "sets",
  ...setsPreset("reps"),
});
const lift = habit("lift", {
  id: "w",
  name: "Lift",
  mode: "sets",
  ...setsPreset("weighted"),
});
const plank = habit("plank", { id: "m", name: "Time", unit: "min" });
const habits = [push, lift, plank];

const step = (
  habitId: string,
  metricId: string,
  over: Partial<HabitStep> = {},
): HabitStep => ({
  kind: "habit",
  id: `${habitId}-step`,
  habitId,
  metricId,
  by: "time",
  seconds: 60,
  count: 8,
  ...over,
});
const routine = (
  steps: Routine["steps"],
  over: Partial<Routine> = {},
): Routine => ({
  id: "r1",
  name: "Morning",
  rounds: 1,
  prep: 0,
  steps,
  ...over,
});

type Props = { habits: Habit[]; logs: Logs };

/** The hook as App mounts it, with a mock dispatch to see what it logs. */
function setup(logs: Logs = {}) {
  const dispatch = vi.fn<(a: Action) => void>();
  const hook = renderHook(
    (p: Props) => useRoutineRun({ ...p, today: TODAY, dispatch }),
    { initialProps: { habits, logs } },
  );
  return { ...hook, dispatch };
}

/** Move the clock to `ms` after T0 and let the next frame tick, which falls
 *  due within 16 ms (so times read after are a frame late at most). */
function at(ms: number) {
  act(() => {
    vi.setSystemTime(T0 + ms);
    vi.advanceTimersByTime(16);
  });
}

const logged = (dispatch: ReturnType<typeof setup>["dispatch"]) =>
  dispatch.mock.calls.map(([a]) => a);

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({
    toFake: ["Date", "requestAnimationFrame", "cancelAnimationFrame"],
    now: T0,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useRoutineRun", () => {
  it("starts with the get-ready, and saves the run", () => {
    const { result } = setup();
    act(() =>
      result.current.actions.start(routine([step("plank", "m")], { prep: 5 })),
    );
    expect(result.current.phase.kind).toBe("prep");
    expect(result.current.seconds).toBe(-5);
    expect(JSON.parse(localStorage.getItem(RUN_KEY)!).routine.id).toBe("r1");
  });

  it("logs a timed habit that logs itself as it ends, once", () => {
    const { result, dispatch } = setup();
    act(() => result.current.actions.start(routine([step("plank", "m")])));
    at(30_000);
    expect(logged(dispatch)).toEqual([]);
    at(61_000);
    at(62_000);
    expect(logged(dispatch)).toEqual([
      {
        type: "log/add",
        habitId: "plank",
        metricId: "m",
        dateKey: TODAY,
        amount: 1,
      },
    ]);
    expect(result.current.run?.results["0:0"]).toEqual({
      status: "logged",
      amount: 1,
      text: "1m",
    });
  });

  it("leaves a counted habit for its count, then logs and changes it", () => {
    const { result, dispatch, rerender } = setup();
    act(() =>
      result.current.actions.start(
        routine([step("push", "r", { seconds: 20 })]),
      ),
    );
    at(21_000);
    expect(logged(dispatch)).toEqual([]);
    const slot = result.current.slots[0];
    act(() => result.current.actions.logCount(slot, 15, {}));
    const at0 = { habitId: "push", metricId: "r", dateKey: TODAY };
    expect(logged(dispatch)).toEqual([
      { type: "log/addSet", ...at0, set: { r: 15 } },
    ]);
    expect(result.current.run?.results["0:0"]).toMatchObject({ amount: 15 });

    // The set is in the day now; changing the count replaces it there.
    rerender({ habits, logs: { push: { [TODAY]: { r: [{ r: 15 }] } } } });
    act(() => result.current.actions.logCount(slot, 12, {}));
    expect(logged(dispatch)[1]).toEqual({
      type: "log/setDay",
      habitId: "push",
      dateKey: TODAY,
      entry: { r: [{ r: 12 }] },
    });

    rerender({ habits, logs: { push: { [TODAY]: { r: [{ r: 12 }] } } } });
    act(() => result.current.actions.skipCount(slot));
    expect(logged(dispatch)[2]).toEqual({
      type: "log/removeSet",
      ...at0,
      index: 0,
    });
    expect(result.current.run?.results["0:0"]).toEqual({ status: "skipped" });
  });

  it("logs a step done for a count at Done, with the carried weight", () => {
    const { result, dispatch } = setup({
      lift: { "2026-11-20": { w: [{ w: 50, r: 10 }] } },
    });
    act(() =>
      result.current.actions.start(
        routine([
          step("lift", "w", { by: "count" }),
          { kind: "break", id: "b", seconds: 30 },
          step("plank", "m"),
        ]),
      ),
    );
    at(41_000);
    expect(result.current.phase).toMatchObject({ kind: "slot", index: 0 });
    act(() => result.current.actions.done());
    expect(logged(dispatch)).toEqual([
      {
        type: "log/addSet",
        habitId: "lift",
        metricId: "w",
        dateKey: TODAY,
        set: { w: 50, r: 8 },
      },
    ]);
    expect(result.current.phase).toMatchObject({
      kind: "slot",
      index: 1,
      elapsed: 0,
    });
    expect(result.current.run?.ends["0:0"]).toBeCloseTo(41, 1);
  });

  it("stands still while paused", () => {
    const { result } = setup();
    act(() => result.current.actions.start(routine([step("plank", "m")])));
    at(10_000);
    act(() => result.current.actions.pause());
    at(40_000);
    expect(result.current.seconds).toBeCloseTo(10, 1);
    act(() => result.current.actions.resume());
    at(45_000);
    expect(result.current.seconds).toBeCloseTo(15, 1);
  });

  it("picks the run up again after a reload", () => {
    const first = setup();
    act(() =>
      first.result.current.actions.start(routine([step("plank", "m")])),
    );
    at(10_000);
    first.unmount();

    const { result } = setup();
    expect(result.current.run?.routine.id).toBe("r1");
    expect(result.current.seconds).toBeCloseTo(10, 1);
  });

  it("lets go of a habit deleted during the run", () => {
    const { result, dispatch, rerender } = setup();
    act(() => result.current.actions.start(routine([step("plank", "m")])));
    rerender({ habits: [push, lift], logs: {} });
    at(61_000);
    expect(logged(dispatch)).toEqual([]);
    expect(result.current.run?.results["0:0"]).toEqual({ status: "skipped" });
  });

  it("finishes at the last slot, and End clears the run", () => {
    const { result } = setup();
    act(() => result.current.actions.start(routine([step("plank", "m")])));
    at(61_000);
    expect(result.current.phase.kind).toBe("done");
    expect(result.current.run?.finished).toBe(true);
    expect(result.current.running).toBe(false);
    act(() => result.current.actions.end());
    expect(result.current.run).toBeNull();
    expect(localStorage.getItem(RUN_KEY)).toBeNull();
  });
});
