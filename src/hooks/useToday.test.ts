import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToday } from "./useToday";

/** A local time in May 2026. */
const may = (day: number, hour: number, min = 0) =>
  new Date(2026, 4, day, hour, min);

const MIN = 60_000;
const HOUR = 60 * MIN;

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
/** Run the next animation frame, which is when a new day is applied. */
const nextFrame = () =>
  act(() => {
    vi.advanceTimersToNextFrame();
  });
const becomeVisible = () =>
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useToday", () => {
  it("returns today's key", () => {
    vi.setSystemTime(may(24, 9));
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe("2026-05-24");
  });

  it("rolls over when midnight passes", () => {
    vi.setSystemTime(may(24, 23, 59));
    const { result } = renderHook(() => useToday());

    advance(MIN - 1); // 23:59:59.999
    expect(result.current).toBe("2026-05-24");

    advance(1);
    nextFrame();
    expect(result.current).toBe("2026-05-25");
  });

  it("keeps rolling over on the nights after the first", () => {
    vi.setSystemTime(may(24, 23, 59));
    const { result } = renderHook(() => useToday());

    advance(MIN);
    advance(24 * HOUR);
    nextFrame();
    expect(result.current).toBe("2026-05-26");
  });

  // A backgrounded iOS home-screen app is frozen, so its timers don't fire,
  // and it resumes where it left off instead of reloading. setSystemTime
  // moves the clock the same way: no timer fires.
  it("re-checks the date when the app becomes visible again", () => {
    vi.setSystemTime(may(24, 22));
    const { result } = renderHook(() => useToday());

    vi.setSystemTime(may(26, 8));
    expect(result.current).toBe("2026-05-24");

    becomeVisible();
    nextFrame();
    expect(result.current).toBe("2026-05-26");
  });

  it("still rolls over at midnight after resuming with a stale timer", () => {
    vi.setSystemTime(may(24, 22));
    const { result } = renderHook(() => useToday());
    vi.setSystemTime(may(25, 8)); // the timer set at 22:00 has 2 hours left
    becomeVisible();
    nextFrame();
    expect(result.current).toBe("2026-05-25");

    advance(16 * HOUR - 1); // 23:59:59.999
    expect(result.current).toBe("2026-05-25");

    advance(1);
    nextFrame();
    expect(result.current).toBe("2026-05-26");
  });

  // Timers and animation frames that came due while the page was frozen or
  // asleep run when it wakes. Changing the day only on the next frame lets
  // them go first: d3 re-syncs its animation clock on its own pending frame,
  // and a re-render before that would start animations against a stale clock.
  it("changes the day on the next animation frame, not before", () => {
    vi.setSystemTime(may(24, 23, 59));
    const { result } = renderHook(() => useToday());

    const order: string[] = [];
    requestAnimationFrame(() => order.push(`earlier frame: ${result.current}`));
    advance(MIN); // the midnight timer fires
    expect(result.current).toBe("2026-05-24");

    nextFrame();
    expect(result.current).toBe("2026-05-25");
    // A frame callback that was already waiting ran first, on the old day
    expect(order).toEqual(["earlier frame: 2026-05-24"]);
  });

  it("waits for a frame after becoming visible, too", () => {
    vi.setSystemTime(may(24, 22));
    const { result } = renderHook(() => useToday());
    vi.setSystemTime(may(25, 8));

    becomeVisible();
    expect(result.current).toBe("2026-05-24");
    nextFrame();
    expect(result.current).toBe("2026-05-25");
  });

  it("clears its timer, frame and listener when unmounted", () => {
    vi.setSystemTime(may(24, 23, 59));
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useToday());
    const listener = add.mock.calls.find(
      ([type]) => type === "visibilitychange",
    )?.[1];
    expect(listener).toBeDefined();
    expect(vi.getTimerCount()).toBe(1); // the midnight timer

    advance(MIN);
    expect(vi.getTimerCount()).toBe(2); // the next midnight + a waiting frame

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("visibilitychange", listener);
  });
});
