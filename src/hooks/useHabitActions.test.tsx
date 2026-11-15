import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { DispatchContext, useHabitActions } from "./useHabitActions";

const today = "2026-11-15";

/** The hook for habit h1, with a mock dispatch to see what it sends. */
function setup() {
  const dispatch = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DispatchContext.Provider value={dispatch}>
      {children}
    </DispatchContext.Provider>
  );
  const { result } = renderHook(() => useHabitActions("h1", today), {
    wrapper,
  });
  return { actions: result.current, dispatch };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useHabitActions", () => {
  it("saves a whole day's entry on the day given", () => {
    const { actions, dispatch } = setup();
    actions.saveDay("2026-11-01", { m1: 5 });
    expect(dispatch).toHaveBeenCalledWith({
      type: "log/setDay",
      habitId: "h1",
      dateKey: "2026-11-01",
      entry: { m1: 5 },
    });
  });

  it("adds to, resets and changes the sets of a metric today", () => {
    const { actions, dispatch } = setup();
    const today_m1 = { habitId: "h1", metricId: "m1", dateKey: today };

    actions.add("m1", 15);
    actions.reset("m1");
    actions.addSet("m1", { w: 60, r: 8 });
    actions.removeSet("m1", 2);

    expect(dispatch.mock.calls.map(([a]) => a)).toEqual([
      { type: "log/add", ...today_m1, amount: 15 },
      { type: "log/reset", ...today_m1 },
      { type: "log/addSet", ...today_m1, set: { w: 60, r: 8 } },
      { type: "log/removeSet", ...today_m1, index: 2 },
    ]);
  });

  it("starts a timer now, and stops it into today", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_700_000_000_000);
    const { actions, dispatch } = setup();

    actions.startTimer("m1");
    vi.setSystemTime(1_700_000_600_000);
    actions.stopTimer("m1");

    expect(dispatch.mock.calls.map(([a]) => a)).toEqual([
      {
        type: "timer/start",
        habitId: "h1",
        metricId: "m1",
        now: 1_700_000_000_000,
      },
      {
        type: "timer/stop",
        habitId: "h1",
        metricId: "m1",
        now: 1_700_000_600_000,
        dateKey: today,
      },
    ]);
  });

  it("needs App's dispatch to be provided", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useHabitActions("h1", today))).toThrow(
      /DispatchContext/,
    );
  });
});
