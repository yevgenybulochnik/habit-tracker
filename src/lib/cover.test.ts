import { describe, it, expect } from "vitest";
import { blockNote, coverBlocks, dueLabel, isDone, nextDue } from "./cover";
import { BUILTIN_UNITS } from "./defaults";
import type { Habit, HabitLogs } from "../types";

const daily: Habit = {
  id: "h1",
  name: "Run",
  icon: "run",
  color: "Green",
  metrics: [{ id: "m1", name: "Minutes", unit: "min" }],
  intensityMode: "total",
};
const every = (n: number, unit: "day" | "week" = "day"): Habit => ({
  ...daily,
  period: { every: n, unit },
});
const active = (...days: string[]): HabitLogs =>
  Object.fromEntries(days.map((d) => [d, { m1: 30 }]));

const today = "2026-05-24"; // a Sunday

describe("nextDue", () => {
  const due = (h: Habit, l: HabitLogs) => nextDue(h, l, BUILTIN_UNITS, today);

  it("is a period after the last log", () => {
    expect(due(every(2), active("2026-05-24"))).toBe("2026-05-26");
    expect(due(every(2), active("2026-05-20", "2026-05-23"))).toBe(
      "2026-05-25",
    );
    expect(due(every(1, "week"), active("2026-05-20"))).toBe("2026-05-27");
  });

  it("is today when the last log's period ends today", () => {
    expect(due(every(2), active("2026-05-22"))).toBe("2026-05-24");
    expect(due(daily, active("2026-05-23"))).toBe("2026-05-24");
  });

  it("is null with no streak running", () => {
    expect(due(every(2), active("2026-05-21"))).toBeNull();
    expect(due(every(2), {})).toBeNull();
  });

  it("goes by logs that count, not entries reset to nothing", () => {
    const l = { ...active("2026-05-23"), "2026-05-24": { m1: 0 } };
    expect(due(every(2), l)).toBe("2026-05-25");
  });
});

describe("isDone", () => {
  const done = (h: Habit, l: HabitLogs) => isDone(h, l, BUILTIN_UNITS, today);

  it("is done while a log still covers today", () => {
    expect(done(every(2), active("2026-05-24"))).toBe(true);
    expect(done(every(2), active("2026-05-23"))).toBe(true);
    expect(done(every(1, "week"), active("2026-05-18"))).toBe(true);
  });

  it("isn't once the next log is due", () => {
    expect(done(every(2), active("2026-05-22"))).toBe(false);
    expect(done(every(1, "week"), active("2026-05-17"))).toBe(false);
    expect(done(every(2), {})).toBe(false);
  });

  it("is logged today, for a habit due every day", () => {
    expect(done(daily, active("2026-05-24"))).toBe(true);
    expect(done(daily, active("2026-05-23"))).toBe(false);
    expect(done(daily, { "2026-05-24": { m1: 0 } })).toBe(false);
  });
});

describe("dueLabel", () => {
  it("says when, from today", () => {
    expect(dueLabel("2026-05-24", today)).toBe("today");
    expect(dueLabel("2026-05-25", today)).toBe("tomorrow");
  });

  it("names a day in the coming week", () => {
    expect(dueLabel("2026-05-26", today)).toBe("Tue");
    expect(dueLabel("2026-05-30", today)).toBe("Sat");
  });

  it("dates one further off", () => {
    expect(dueLabel("2026-05-31", today)).toBe("May 31");
    expect(dueLabel("2026-06-07", today)).toBe("Jun 7");
  });
});

describe("coverBlocks", () => {
  it("covers a period from each log", () => {
    const b = coverBlocks(every(3), active("2026-05-18"), BUILTIN_UNITS);
    const block = { start: "2026-05-18", end: "2026-05-20" };
    expect(b.get("2026-05-18")).toEqual(block);
    expect(b.get("2026-05-19")).toEqual(block);
    expect(b.get("2026-05-20")).toEqual(block);
    expect(b.has("2026-05-21")).toBe(false);
    expect(b.has("2026-05-17")).toBe(false);
  });

  it("ends a block where the next log starts one", () => {
    const b = coverBlocks(
      every(2),
      active("2026-05-18", "2026-05-20", "2026-05-21"),
      BUILTIN_UNITS,
    );
    expect(b.get("2026-05-19")).toEqual({
      start: "2026-05-18",
      end: "2026-05-19",
    });
    expect(b.get("2026-05-20")).toEqual({
      start: "2026-05-20",
      end: "2026-05-20",
    });
    expect(b.get("2026-05-22")).toEqual({
      start: "2026-05-21",
      end: "2026-05-22",
    });
  });

  it("leaves a day no log covers out: the streak broke there", () => {
    const b = coverBlocks(
      every(2),
      active("2026-05-18", "2026-05-21"),
      BUILTIN_UNITS,
    );
    expect(b.has("2026-05-20")).toBe(false);
  });

  it("runs past today, to the day before the next log is due", () => {
    const b = coverBlocks(every(1, "week"), active(today), BUILTIN_UNITS);
    expect(b.get(today)).toEqual({ start: today, end: "2026-05-30" });
  });

  it("only counts logs with something in them", () => {
    const b = coverBlocks(every(2), { "2026-05-18": { m1: 0 } }, BUILTIN_UNITS);
    expect(b.size).toBe(0);
  });
});

describe("blockNote", () => {
  const block = { start: "2026-05-18", end: "2026-05-20" };

  it("says how far a log carries the streak, on its day", () => {
    expect(blockNote(block, "2026-05-18")).toBe("covers to May 20");
  });

  it("says which log covers a day without one", () => {
    expect(blockNote(block, "2026-05-19")).toBe("covered by May 18");
  });

  it("has nothing to add for a log that covers only its own day", () => {
    const one = { start: "2026-05-18", end: "2026-05-18" };
    expect(blockNote(one, "2026-05-18")).toBeNull();
  });
});
