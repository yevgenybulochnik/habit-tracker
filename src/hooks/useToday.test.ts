import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToday } from "./useToday";

/** A local time in May 2026. */
const may = (day: number, hour: number, min = 0) =>
  new Date(2026, 4, day, hour, min);

const MIN = 60_000;
const HOUR = 60 * MIN;

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

    act(() => {
      vi.advanceTimersByTime(MIN - 1);
    });
    expect(result.current).toBe("2026-05-24"); // 23:59:59.999

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("2026-05-25");
  });

  it("keeps rolling over on the nights after the first", () => {
    vi.setSystemTime(may(24, 23, 59));
    const { result } = renderHook(() => useToday());

    act(() => {
      vi.advanceTimersByTime(MIN);
    });
    act(() => {
      vi.advanceTimersByTime(24 * HOUR);
    });
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

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe("2026-05-26");
  });

  it("still rolls over at midnight after resuming with a stale timer", () => {
    vi.setSystemTime(may(24, 22));
    const { result } = renderHook(() => useToday());
    vi.setSystemTime(may(25, 8)); // the timer set at 22:00 has 2 hours left
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe("2026-05-25");

    act(() => {
      vi.advanceTimersByTime(16 * HOUR - 1);
    });
    expect(result.current).toBe("2026-05-25"); // 23:59:59.999

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("2026-05-26");
  });

  it("clears its timer and listener when unmounted", () => {
    vi.setSystemTime(may(24, 9));
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useToday());
    const listener = add.mock.calls.find(
      ([type]) => type === "visibilitychange",
    )?.[1];
    expect(listener).toBeDefined();
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("visibilitychange", listener);
  });
});
