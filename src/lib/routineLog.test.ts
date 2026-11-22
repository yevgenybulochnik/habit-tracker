import { describe, expect, it } from "vitest";
import { setsPreset } from "./metrics";
import {
  carriedFields,
  countUnit,
  fmtLogged,
  lastCount,
  logActions,
  loggedResult,
  loggedValue,
  relogActions,
  todaySummary,
} from "./routineLog";
import type { DayLog, Metric, SetEntry } from "../types";

const TODAY = "2026-11-21";
const at = { habitId: "h", metricId: "m", dateKey: TODAY };
const reps: Metric = { id: "m", name: "Reps", unit: "reps" };
const mins: Metric = { id: "m", name: "Time", unit: "min" };
const done: Metric = { id: "m", name: "Done", unit: "count", mode: "done" };
const weighted: Metric = {
  id: "m",
  name: "Lift",
  mode: "sets",
  ...setsPreset("weighted"),
};
const timedSets: Metric = { ...weighted, ...setsPreset("timed") };

describe("the value a habit slot logs", () => {
  it("is the count", () => {
    expect(loggedValue(reps, "count", 12)).toBe(12);
  });

  it("rounds a time to the app's whole minutes, at least one", () => {
    expect(loggedValue(mins, "minutes", 20)).toBe(1);
    expect(loggedValue(mins, "minutes", 30)).toBe(1);
    expect(loggedValue(mins, "minutes", 90)).toBe(2);
  });

  it("gives a timed set its tenths of a minute", () => {
    expect(loggedValue(timedSets, "minutes", 45)).toBe(0.8);
  });

  it("checks a check-off off", () => {
    expect(loggedValue(done, "check", 60)).toBe(1);
  });
});

describe("logActions", () => {
  it("adds a set with the carried weight and the counted reps", () => {
    expect(logActions("h", weighted, 12, { w: 50 }, TODAY)).toEqual([
      { type: "log/addSet", ...at, set: { w: 50, r: 12 } },
    ]);
  });

  it("adds to a plain amount", () => {
    expect(logActions("h", reps, 12, {}, TODAY)).toEqual([
      { type: "log/add", ...at, amount: 12 },
    ]);
  });

  it("checks a check-off off once, however often it's logged", () => {
    expect(logActions("h", done, 1, {}, TODAY)).toEqual([
      { type: "log/reset", ...at },
      { type: "log/add", ...at, amount: 1 },
    ]);
  });
});

describe("loggedResult", () => {
  it("remembers the set it added", () => {
    expect(loggedResult(weighted, 12, { w: 50 })).toEqual({
      status: "logged",
      amount: 12,
      text: "12 reps",
      set: { w: 50, r: 12 },
    });
    expect(loggedResult(reps, 12, {})).toEqual({
      status: "logged",
      amount: 12,
      text: "12 reps",
    });
  });
});

describe("relogActions: changing what a slot logged", () => {
  const relog = (
    m: Metric,
    was: number,
    day: DayLog,
    value: number,
    extra: SetEntry = {},
  ) =>
    relogActions("h", m, loggedResult(m, was, extra), value, extra, day, TODAY);

  it("changes its set where it is, the latest of any alike", () => {
    const day = {
      m: [
        { w: 50, r: 12 },
        { w: 50, r: 12 },
        { w: 40, r: 8 },
      ],
      x: 3,
    };
    expect(relog(weighted, 12, day, 14, { w: 50 })).toEqual([
      {
        type: "log/setDay",
        habitId: "h",
        dateKey: TODAY,
        entry: {
          m: [
            { w: 50, r: 12 },
            { w: 50, r: 14 },
            { w: 40, r: 8 },
          ],
          x: 3,
        },
      },
    ]);
  });

  it("takes its set back for nothing", () => {
    const day = {
      m: [
        { w: 40, r: 10 },
        { w: 50, r: 12 },
        { w: 50, r: 8 },
      ],
    };
    expect(relog(weighted, 12, day, 0, { w: 50 })).toEqual([
      { type: "log/removeSet", ...at, index: 1 },
    ]);
  });

  it("adds a new set when its own was removed from the habit", () => {
    const day = { m: [{ w: 40, r: 10 }] };
    expect(relog(weighted, 12, day, 14, { w: 50 })).toEqual([
      { type: "log/addSet", ...at, set: { w: 50, r: 14 } },
    ]);
    expect(relog(weighted, 12, day, 0, { w: 50 })).toEqual([]);
  });

  it("adds the difference to a plain count, never taking it below zero", () => {
    expect(relog(reps, 12, { m: 30 }, 15)).toEqual([
      { type: "log/add", ...at, amount: 3 },
    ]);
    expect(relog(reps, 12, { m: 30 }, 0)).toEqual([
      { type: "log/add", ...at, amount: -12 },
    ]);
    // Lowered on the habit's card since: it gives back no more than is there.
    expect(relog(reps, 12, { m: 5 }, 0)).toEqual([
      { type: "log/add", ...at, amount: -5 },
    ]);
  });

  it("takes back a check-off or minutes", () => {
    expect(relog(done, 1, { m: 1 }, 0)).toEqual([
      { type: "log/add", ...at, amount: -1 },
    ]);
    expect(relog(mins, 2, { m: 5 }, 0)).toEqual([
      { type: "log/add", ...at, amount: -2 },
    ]);
  });
});

describe("what a habit's sets suggest", () => {
  const logs = {
    "2026-11-19": { m: [{ w: 45, r: 10 }] },
    "2026-11-20": {
      m: [
        { w: 50, r: 12 },
        { w: 55, r: 8 },
      ],
    },
  };

  it("carries the other fields of the latest set", () => {
    expect(carriedFields(weighted, logs, TODAY)).toEqual({ w: 55 });
    expect(carriedFields(weighted, {}, TODAY)).toEqual({ w: 0 });
    expect(carriedFields(reps, logs, TODAY)).toEqual({});
  });

  it("suggests the latest set's count", () => {
    expect(lastCount(weighted, logs, TODAY)).toBe(8);
    expect(lastCount(weighted, {}, TODAY)).toBeUndefined();
    expect(lastCount(reps, logs, TODAY)).toBeUndefined();
  });
});

describe("words for what's logged", () => {
  it("counts in the counted field's unit, not a weighted metric's volume", () => {
    expect(countUnit(weighted)).toBe("reps");
    expect(countUnit({ id: "m", name: "Pages", unit: "pages" })).toBe("pages");
  });

  it("says what a slot logged", () => {
    expect(fmtLogged(weighted, 12)).toBe("12 reps");
    expect(fmtLogged(mins, 2)).toBe("2m");
    expect(fmtLogged(done, 1)).toBe("done");
  });

  it("sums up the metric today", () => {
    expect(todaySummary(reps, { m: 30 })).toBe("30 reps");
    expect(todaySummary(done, undefined)).toBe("not yet today");
    expect(todaySummary(done, { m: 1 })).toBe("done today");
    expect(todaySummary(weighted, { m: [{ w: 50, r: 12 }] })).toMatch(/^1 set/);
  });
});
