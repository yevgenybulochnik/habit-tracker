import { describe, it, expect } from "vitest";
import { logLevel, logActive, logSummary, habitStats } from "./stats";
import { BUILTIN_UNITS } from "./defaults";
import type { Habit, HabitLogs } from "../types";

// "min" unit thresholds are [15, 30, 60].
const minHabit: Habit = {
  id: "h1",
  name: "Run",
  emoji: "🏃",
  color: "Green",
  metrics: [{ id: "m1", name: "Minutes", unit: "min" }],
  intensityMode: "total",
};

const coverageHabit = (n: number): Habit => ({
  id: "h2",
  name: "Routine",
  emoji: "🧘",
  color: "Blue",
  intensityMode: "coverage",
  metrics: Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    name: `M${i}`,
    unit: "count",
  })),
});

describe("logLevel (total mode)", () => {
  it.each([
    [0, 0],
    [10, 1],
    [20, 2],
    [45, 3],
    [60, 4],
    [100, 4],
  ])("min total %i → level %i", (val, level) => {
    expect(logLevel(minHabit, { m1: val }, BUILTIN_UNITS)).toBe(level);
  });
  it("returns 0 for no log", () => {
    expect(logLevel(minHabit, undefined, BUILTIN_UNITS)).toBe(0);
  });
  it("a marked daily check-off lands at the middle shade (level 2)", () => {
    const doneH: Habit = {
      id: "hd",
      name: "Meditate",
      emoji: "🧘",
      color: "Green",
      intensityMode: "total",
      metrics: [{ id: "d", name: "Completed", unit: "count", mode: "done" }],
    };
    expect(logLevel(doneH, { d: 0 }, BUILTIN_UNITS)).toBe(0);
    expect(logLevel(doneH, { d: 1 }, BUILTIN_UNITS)).toBe(2);
  });
});

describe("logLevel (coverage mode)", () => {
  it("scales with fraction of metrics completed", () => {
    const h = coverageHabit(4);
    expect(logLevel(h, {}, BUILTIN_UNITS)).toBe(0);
    expect(logLevel(h, { c0: 1 }, BUILTIN_UNITS)).toBe(2); // .25
    expect(logLevel(h, { c0: 1, c1: 1 }, BUILTIN_UNITS)).toBe(3); // .5
    expect(logLevel(h, { c0: 1, c1: 1, c2: 1, c3: 1 }, BUILTIN_UNITS)).toBe(4); // 1.0
  });
  it("returns level 1 for a small fraction (<.25)", () => {
    const h = coverageHabit(5);
    expect(logLevel(h, { c0: 1 }, BUILTIN_UNITS)).toBe(1); // .2
  });
});

describe("logActive", () => {
  it("is true when level > 0", () => {
    expect(logActive(minHabit, { m1: 30 }, BUILTIN_UNITS)).toBe(true);
    expect(logActive(minHabit, { m1: 0 }, BUILTIN_UNITS)).toBe(false);
  });
});

describe("logSummary", () => {
  it("returns 'No entry' with no active metrics", () => {
    expect(logSummary(minHabit, undefined)).toBe("No entry");
    expect(logSummary(minHabit, { m1: 0 })).toBe("No entry");
  });
  it("lists active metrics", () => {
    expect(logSummary(minHabit, { m1: 90 })).toBe("Minutes: 1h 30m");
  });
});

describe("habitStats", () => {
  const today = "2026-05-24";
  // Today + yesterday active, a gap, then a 3-day run further back.
  const logs: HabitLogs = {
    "2026-05-24": { m1: 30 },
    "2026-05-23": { m1: 30 },
    "2026-05-22": { m1: 0 }, // inactive — breaks the streak
    "2026-05-21": { m1: 30 },
    "2026-05-20": { m1: 30 },
    "2026-05-19": { m1: 30 },
  };
  const stats = habitStats(minHabit, logs, BUILTIN_UNITS, today);

  it("counts total active days", () => expect(stats.totalDays).toBe(5));
  it("sums total value", () => expect(stats.totalVal).toBe(150));
  it("computes the current streak ending today", () =>
    expect(stats.curStreak).toBe(2));
  it("computes the longest streak", () => expect(stats.lonStreak).toBe(3));

  it("measures streaks from the given today, not the clock", () => {
    // Two days later nothing has been logged since the 24th
    const later = habitStats(minHabit, logs, BUILTIN_UNITS, "2026-05-26");
    expect(later.curStreak).toBe(0);
    expect(later.lonStreak).toBe(3);
    // On the 21st the 3-day run is the current streak
    const earlier = habitStats(minHabit, logs, BUILTIN_UNITS, "2026-05-21");
    expect(earlier.curStreak).toBe(3);
  });

  it("follows a streak across a month boundary", () => {
    const span: HabitLogs = {
      "2026-03-02": { m1: 30 },
      "2026-03-01": { m1: 30 },
      "2026-02-28": { m1: 30 },
      "2026-02-27": { m1: 30 },
    };
    const s = habitStats(minHabit, span, BUILTIN_UNITS, "2026-03-02");
    expect(s.curStreak).toBe(4);
    expect(s.lonStreak).toBe(4);
  });

  it("only looks for the longest streak in the year up to today", () => {
    const old: HabitLogs = {
      "2025-05-24": { m1: 30 }, // 365 days before today: outside the window
      "2025-05-25": { m1: 30 }, // 364 days before: the oldest day counted
    };
    const s = habitStats(minHabit, old, BUILTIN_UNITS, today);
    expect(s.totalDays).toBe(2);
    expect(s.lonStreak).toBe(1);
  });
});
