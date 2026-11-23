import { describe, expect, it } from "vitest";
import { setsPreset } from "./metrics";
import {
  captureFor,
  findStep,
  fitRoutine,
  routineProblems,
  stepChoices,
  stepFullName,
  stepName,
  stepShade,
} from "./routines";
import type { Habit, HabitStep, Metric, Routine } from "../types";

const reps = (id: string, name: string): Metric => ({
  id,
  name,
  mode: "sets",
  ...setsPreset("reps"),
});
const pushUps: Habit = {
  id: "push",
  name: "Push-ups",
  icon: "flex",
  color: "Orange",
  metrics: [reps("r", "Reps")],
  intensityMode: "total",
};
const pulls: Habit = {
  id: "pull",
  name: "Pull-ups",
  icon: "weightlifter",
  color: "Blue",
  metrics: [reps("p", "Pull-ups"), reps("c", "Chin-ups")],
  intensityMode: "total",
};
const reading: Habit = {
  id: "read",
  name: "Reading",
  icon: "book",
  color: "Purple",
  metrics: [{ id: "m", name: "Time", unit: "min" }],
  intensityMode: "total",
};
const habits = [pushUps, pulls, reading];

const step = (over: Partial<HabitStep> = {}): HabitStep => ({
  kind: "habit",
  id: "s1",
  habitId: "push",
  metricId: "r",
  by: "time",
  seconds: 60,
  count: 10,
  ...over,
});
const routine = (over: Partial<Routine> = {}): Routine => ({
  id: "r1",
  name: "Morning",
  rounds: 2,
  prep: 5,
  steps: [step(), { kind: "break", id: "s2", seconds: 30 }],
  ...over,
});

describe("how a step logs to its habit", () => {
  const weighted: Metric = {
    id: "m",
    name: "Lift",
    mode: "sets",
    ...setsPreset("weighted"),
  };

  it("asks for a count, or works it out from the time", () => {
    expect(captureFor({ id: "m", name: "Reps", unit: "reps" })).toBe("count");
    expect(captureFor({ id: "m", name: "Pages", unit: "pages" })).toBe("count");
    expect(captureFor(weighted)).toBe("count");
    expect(captureFor({ id: "m", name: "Time", unit: "min" })).toBe("minutes");
    expect(captureFor({ ...weighted, ...setsPreset("timed") })).toBe("minutes");
    expect(
      captureFor({ id: "m", name: "Done", unit: "count", mode: "done" }),
    ).toBe("check");
  });

  it("finds a step's habit and metric", () => {
    expect(findStep(habits, step({ habitId: "pull", metricId: "c" }))).toEqual({
      habit: pulls,
      metric: pulls.metrics[1],
    });
    expect(findStep(habits, step({ habitId: "gone" }))).toBeUndefined();
    expect(findStep(habits, step({ metricId: "gone" }))).toBeUndefined();
  });
});

describe("naming and colouring a step", () => {
  it("goes by the habit when it has one metric, else by the metric", () => {
    expect(stepName(pushUps, pushUps.metrics[0])).toBe("Push-ups");
    expect(stepName(pulls, pulls.metrics[1])).toBe("Chin-ups");
  });

  it("gives the full name the habit too when it goes by the metric", () => {
    expect(stepFullName(pushUps, pushUps.metrics[0])).toBe("Push-ups");
    expect(stepFullName(pulls, pulls.metrics[1])).toBe("Pull-ups · Chin-ups");
  });

  it("offers each habit as a step, or each metric of one with several", () => {
    expect(stepChoices([pushUps, pulls])).toEqual([
      { habitId: "push", metricId: "r", label: "Push-ups", icon: "flex" },
      {
        habitId: "pull",
        metricId: "p",
        label: "Pull-ups · Pull-ups",
        icon: "weightlifter",
      },
      {
        habitId: "pull",
        metricId: "c",
        label: "Pull-ups · Chin-ups",
        icon: "weightlifter",
      },
    ]);
  });

  it("steps each later metric down a shade of the habit's colour", () => {
    expect(stepShade(pushUps, pushUps.metrics[0])).toBe(4);
    expect(stepShade(pulls, pulls.metrics[0])).toBe(4);
    expect(stepShade(pulls, pulls.metrics[1])).toBe(3);
  });
});

describe("fitRoutine: a routine kept in line with the habits", () => {
  it("leaves a routine whose habits are all there as it is", () => {
    const r = routine();
    expect(fitRoutine(r, habits)).toBe(r);
  });

  it("drops a step whose habit or metric is gone", () => {
    const r = routine({
      steps: [
        step({ id: "a" }),
        step({ id: "b", habitId: "gone" }),
        step({ id: "c", habitId: "pull", metricId: "gone" }),
        { kind: "break", id: "d", seconds: 30 },
      ],
    });
    expect(fitRoutine(r, habits).steps.map((s) => s.id)).toEqual(["a", "d"]);
  });

  it("times a counted step whose metric no longer counts", () => {
    const r = routine({
      steps: [step({ habitId: "read", metricId: "m", by: "count" })],
    });
    expect(fitRoutine(r, habits).steps[0]).toEqual(
      step({ habitId: "read", metricId: "m", by: "time" }),
    );
  });
});

describe("routineProblems: what a routine needs before it's saved", () => {
  it("needs nothing when it's named and has a habit", () => {
    expect(routineProblems(routine(), habits)).toEqual([]);
  });

  it("needs a name and a habit", () => {
    expect(
      routineProblems(
        routine({
          name: "  ",
          steps: [{ kind: "break", id: "b", seconds: 30 }],
        }),
        habits,
      ),
    ).toEqual(["give it a name", "add a habit"]);
  });

  it("needs each step's habit chosen and each counted step's count", () => {
    expect(
      routineProblems(
        routine({
          steps: [
            step({ habitId: "", metricId: "" }),
            step({ by: "count", count: 0 }),
          ],
        }),
        habits,
      ),
    ).toEqual(["choose each step's habit", "give each counted step its count"]);
  });
});
