import { describe, expect, it } from "vitest";
import {
  arcs,
  finishCount,
  fmtCountdown,
  fmtElapsed,
  logSlots,
  pauseRun,
  phaseAt,
  resumeRun,
  roundArcs,
  runSeconds,
  schedule,
  skipBack,
  skipForward,
  slotProgress,
  startRun,
  timedSeconds,
  type Logged,
} from "./routineRun";
import type { HabitStep, Routine } from "../types";

const timed = (id: string, habitId: string, seconds: number): HabitStep => ({
  kind: "habit",
  id,
  habitId,
  metricId: "m",
  by: "time",
  seconds,
  count: 10,
});
// A minute each of push-ups and pull-ups, with 30 s breaks: twice.
const routine: Routine = {
  id: "r",
  name: "Push / Pull",
  rounds: 2,
  prep: 5,
  steps: [
    timed("a", "push", 60),
    { kind: "break", id: "b", seconds: 30 },
    timed("c", "pull", 60),
    { kind: "break", id: "d", seconds: 30 },
  ],
};
const T0 = 1_000_000;
const logged: Logged = { status: "logged", amount: 12, text: "12 reps" };

describe("schedule", () => {
  it("lays out every round and drops the last round's closing break", () => {
    const slots = schedule(routine);
    expect(slots.map((s) => s.key)).toEqual([
      "0:0",
      "0:1",
      "0:2",
      "0:3",
      "1:0",
      "1:1",
      "1:2",
    ]);
    expect(slots[4].start).toBe(180);
    expect(slots[6].end).toBe(330);
  });
});

describe("roundArcs", () => {
  it("gives each step of a round its share of the turn, breaks included", () => {
    expect(roundArcs(routine)).toEqual([
      [0, 1 / 3],
      [1 / 3, 1 / 2],
      [1 / 2, 5 / 6],
      [5 / 6, 1],
    ]);
  });
});

describe("phaseAt", () => {
  const slots = schedule(routine);
  it("counts down to the first slot, then walks the slots", () => {
    expect(phaseAt(slots, -3)).toMatchObject({ kind: "prep", remaining: 3 });
    expect(phaseAt(slots, 75)).toMatchObject({
      kind: "slot",
      index: 1,
      elapsed: 15,
      remaining: 15,
      progress: 0.5,
    });
    expect(phaseAt(slots, 330)).toEqual({ kind: "done" });
  });
});

describe("a run", () => {
  const slots = schedule(routine);

  it("keeps the routine as it was when it started", () => {
    expect(startRun(routine, T0).routine).toBe(routine);
  });

  it("starts after the get-ready and stands still while paused", () => {
    const run = startRun(routine, T0);
    expect(runSeconds(run, T0)).toBe(-5);
    const paused = pauseRun(run, T0 + 15_000); // 10 s in
    expect(runSeconds(paused, T0 + 60_000)).toBe(10);
    expect(runSeconds(resumeRun(paused, T0 + 60_000), T0 + 61_000)).toBe(11);
  });

  it("gets ready for as long as the routine says, or not at all", () => {
    const ten = startRun({ ...routine, prep: 10 }, T0);
    expect(phaseAt(slots, runSeconds(ten, T0 + 8_000), 10)).toEqual({
      kind: "prep",
      slot: slots[0],
      remaining: 2,
      progress: 0.8,
    });
    const none = startRun({ ...routine, prep: 0 }, T0);
    expect(runSeconds(none, T0)).toBe(0);
    expect(phaseAt(slots, runSeconds(none, T0), 0).kind).toBe("slot");
  });

  it("skips to the next slot, marking a cut-short habit skipped", () => {
    const run = startRun(routine, T0);
    const at = T0 + 25_000; // 20 s into the first habit
    const skipped = skipForward(run, slots, at);
    expect(runSeconds(skipped, at)).toBe(60);
    expect(skipped.results["0:0"]).toEqual({ status: "skipped" });
  });

  it("skips the get-ready", () => {
    const run = startRun(routine, T0);
    expect(runSeconds(skipForward(run, slots, T0 + 1_000), T0 + 1_000)).toBe(0);
  });

  it("keeps what a habit logged early when it's skipped", () => {
    const early = { ...startRun(routine, T0), results: { "0:0": logged } };
    expect(skipForward(early, slots, T0 + 25_000).results["0:0"]).toBe(logged);
  });

  it("goes back to the start of the slot, and un-skips a skipped one", () => {
    const run = skipForward(startRun(routine, T0), slots, T0 + 25_000);
    const at = T0 + 26_000; // 1 s into the break
    const back = skipBack(run, slots, at);
    expect(runSeconds(back, at)).toBe(0);
    expect(back.results["0:0"]).toBeUndefined();
  });

  it("restarts a slot well under way rather than going back past it", () => {
    const run = startRun(routine, T0);
    const at = T0 + 5_000 + 70_000; // 10 s into the break
    expect(runSeconds(skipBack(run, slots, at), at)).toBe(60);
  });

  it("goes back from the end into the last slot", () => {
    const run = { ...startRun(routine, T0), finished: true };
    const at = T0 + 5_000 + 400_000;
    const back = skipBack(run, slots, at);
    expect(runSeconds(back, at)).toBe(270);
    expect(back.finished).toBe(false);
  });
});

describe("steps done for a count, at your own pace", () => {
  // 10 pull-ups, then 45 s of push-ups, with breaks: twice.
  const counted: Routine = {
    id: "s",
    name: "Pull / Push",
    rounds: 2,
    prep: 0,
    steps: [
      { ...timed("a", "pull", 60), by: "count" },
      { kind: "break", id: "b", seconds: 30 },
      timed("c", "push", 45),
      { kind: "break", id: "d", seconds: 30 },
    ],
  };
  const open = schedule(counted);

  it("stays on a counted step until it's done, its stopwatch counting up", () => {
    expect(open[0]).toMatchObject({ start: 0, end: Infinity, open: true });
    expect(open[1].open).toBe(true);
    expect(phaseAt(open, 42)).toMatchObject({
      kind: "slot",
      index: 0,
      elapsed: 42,
      remaining: Infinity,
      progress: 0,
    });
  });

  it("goes on from when the step was done", () => {
    const done = schedule(counted, { "0:0": 42 });
    expect(done[1]).toMatchObject({ start: 42, end: 72, open: false });
    expect(done[2]).toMatchObject({ start: 72, end: 117 });
    expect(done[4]).toMatchObject({ start: 147, open: true });
    expect(phaseAt(done, 50)).toMatchObject({ index: 1, remaining: 22 });
  });

  it("is done when it's said to be, and the break starts", () => {
    const run = startRun(counted, T0);
    const at = T0 + 42_000;
    const done = finishCount(run, open, at);
    expect(done.ends).toEqual({ "0:0": 42 });
    expect(runSeconds(done, at)).toBe(42);
    expect(phaseAt(schedule(counted, done.ends), 42)).toMatchObject({
      index: 1,
      elapsed: 0,
    });
    // A timed step ends by the clock alone.
    expect(finishCount(done, schedule(counted, done.ends), T0 + 80_000)).toBe(
      done,
    );
  });

  it("skips a counted step where it stands, skipped unless it's logged", () => {
    const run = startRun(counted, T0);
    const at = T0 + 20_000;
    const skipped = skipForward(run, open, at);
    expect(skipped.ends).toEqual({ "0:0": 20 });
    expect(runSeconds(skipped, at)).toBe(20);
    expect(skipped.results["0:0"]).toEqual({ status: "skipped" });
    const kept = skipForward({ ...run, results: { "0:0": logged } }, open, at);
    expect(kept.results["0:0"]).toBe(logged);
  });

  it("goes back into a step just done, open again", () => {
    const run = { ...startRun(counted, T0), ends: { "0:0": 42 } };
    const at = T0 + 44_000; // 2 s into the break
    const back = skipBack(run, schedule(counted, run.ends), at);
    expect(back.ends).toEqual({});
    expect(runSeconds(back, at)).toBe(0);
  });

  it("gives every step an equal share of the ring, a break half", () => {
    expect(roundArcs(counted)).toEqual([
      [0, 1 / 3],
      [1 / 3, 1 / 2],
      [1 / 2, 5 / 6],
      [5 / 6, 1],
    ]);
    // Seven slots, the last round's closing break dropped: 5.5 shares.
    expect(arcs(open)[0]).toEqual([0, 2 / 11]);
    expect(arcs(open)[1]).toEqual([2 / 11, 3 / 11]);
  });

  it("hasn't begun what comes after an open step", () => {
    expect(slotProgress(open[2], 100)).toBe(0);
  });

  it("adds up its timed steps and breaks, without the counted ones", () => {
    expect(timedSeconds(counted)).toBe(180);
    expect(timedSeconds(routine)).toBe(330);
  });
});

describe("logSlots: the log's sections", () => {
  const slots = schedule(routine);
  const keys = (xs: { key: string }[]) => xs.map((s) => s.key);
  const all = () => true;

  it("adds each counted habit as the timer reaches it, the newest first", () => {
    expect(logSlots(slots, -3, all)).toEqual([]);
    expect(keys(logSlots(slots, 30, all))).toEqual(["0:0"]);
    expect(keys(logSlots(slots, 75, all))).toEqual(["0:0"]);
    expect(keys(logSlots(slots, 100, all))).toEqual(["0:2", "0:0"]);
    expect(keys(logSlots(slots, 200, all))).toEqual(["1:0", "0:2", "0:0"]);
  });

  it("adds a habit that logs itself once it has, when it ends", () => {
    const pullsCount = (s: { stepIndex: number }) => s.stepIndex === 2;
    expect(logSlots(slots, 30, pullsCount)).toEqual([]);
    expect(keys(logSlots(slots, 100, pullsCount))).toEqual(["0:2", "0:0"]);
  });

  it("adds a step done for a count once it's done", () => {
    const counted = {
      ...routine,
      steps: [{ ...timed("a", "p", 60), by: "count" as const }],
    };
    expect(logSlots(schedule(counted), 20, all)).toEqual([]);
    // Round 2's has begun, but isn't done.
    expect(keys(logSlots(schedule(counted, { "0:0": 42 }), 50, all))).toEqual([
      "0:0",
    ]);
  });
});

describe("the run's clocks", () => {
  it("counts down to the second that's left", () => {
    expect(fmtCountdown(65.2)).toBe("1:06");
    expect(fmtCountdown(0.1)).toBe("0:01");
    expect(fmtCountdown(-1)).toBe("0:00");
  });

  it("counts up the whole seconds gone", () => {
    expect(fmtElapsed(65.9)).toBe("1:05");
    expect(fmtElapsed(0.4)).toBe("0:00");
  });
});
