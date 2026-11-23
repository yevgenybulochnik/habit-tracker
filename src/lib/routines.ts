// Routines: habits done one after another, each for a time or for a count at
// your own pace, with timed breaks between, repeated for some rounds. This is
// what a routine is and how its steps stand to the habits; running one is in
// `routineRun`, and what a step logs is in `routineLog`.
import { isDoneMetric, isSetMetric, primaryField } from "./metrics";
import type { IconId } from "./icons";
import type { Habit, HabitStep, Metric, Routine, RoutineStep } from "../types";

/** The get-ready a new routine has, in seconds. */
export const PREP_SECONDS = 5;

/** The get-ready lengths a routine can be given. */
export const PREP_CHOICES = [0, 3, 5, 10, 15, 20, 30, 45, 60];

/** The lengths a timed step or a break can be given. */
export const STEP_SECONDS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 300];

/** The count a step is given when it's first done by count. */
export const DEFAULT_COUNT = 10;

/** A step done for a count, as long as it takes. */
export const byCount = (s: RoutineStep): boolean =>
  s.kind === "habit" && s.by === "count";

/**
 * How a habit step reaches its habit: a count, entered afterwards or the one
 * it was done for (reps, pages), or worked out from its time (minutes, a
 * check-off).
 */
export type Capture = "count" | "minutes" | "check";

export function captureFor(m: Metric): Capture {
  if (isDoneMetric(m)) return "check";
  if (isSetMetric(m))
    return primaryField(m).unit === "min" ? "minutes" : "count";
  return m.unit === "min" ? "minutes" : "count";
}

/** A step's habit and metric, if both still exist. */
export function findStep(
  habits: Habit[],
  step: HabitStep,
): { habit: Habit; metric: Metric } | undefined {
  const habit = habits.find((h) => h.id === step.habitId);
  const metric = habit?.metrics.find((m) => m.id === step.metricId);
  return habit && metric ? { habit, metric } : undefined;
}

// ---- Naming a step ----------------------------------------------------------
// A step is one metric of a habit. Most habits have one, and the step goes by
// the habit (its metric is just "Reps"). A habit with several (Pull-ups with
// pull-ups and chin-ups) is told apart by the metric. Multi-metric habits are
// to be retired, so this is the one place that knows about them.

const byMetric = (habit: Habit) => habit.metrics.length > 1;

/** What a step is called where space is short: "Push-ups", or "Chin-ups". */
export const stepName = (habit: Habit, metric: Metric) =>
  byMetric(habit) ? metric.name : habit.name;

/** Its name with the habit's too when it goes by the metric:
 *  "Pull-ups · Chin-ups". */
export const stepFullName = (habit: Habit, metric: Metric) =>
  byMetric(habit) ? `${habit.name} · ${metric.name}` : habit.name;

/** What a step can be, for the editor's menu: each habit, or each metric of
 *  a habit with several, with the habit's icon. */
export function stepChoices(
  habits: Habit[],
): { habitId: string; metricId: string; label: string; icon: IconId }[] {
  return habits.flatMap((h) =>
    h.metrics.map((m) => ({
      habitId: h.id,
      metricId: m.id,
      label: stepFullName(h, m),
      icon: h.icon,
    })),
  );
}

/** Which of the habit's palette shades a step is drawn in: the brightest for
 *  its first metric and a step down for each after, so one habit's metrics
 *  don't look alike in the ring. */
export function stepShade(habit: Habit, metric: Metric): number {
  const i = Math.max(0, habit.metrics.indexOf(metric));
  return 4 - (i % 3);
}

// ---- Keeping routines in line with the habits ---------------------------------

/**
 * The routine with only the steps that still stand: a habit step whose habit
 * or metric is gone is dropped, and one done by count is timed once its
 * metric no longer counts. The same routine when nothing changes.
 */
export function fitRoutine(r: Routine, habits: Habit[]): Routine {
  let changed = false;
  const steps: RoutineStep[] = [];
  for (const s of r.steps) {
    if (s.kind === "break") {
      steps.push(s);
      continue;
    }
    const found = findStep(habits, s);
    if (!found) changed = true;
    else if (s.by === "count" && captureFor(found.metric) !== "count") {
      steps.push({ ...s, by: "time" });
      changed = true;
    } else steps.push(s);
  }
  return changed ? { ...r, steps } : r;
}

/** Each routine kept in line with the habits (see `fitRoutine`). */
export const fitRoutines = (routines: Routine[], habits: Habit[]) =>
  routines.map((r) => fitRoutine(r, habits));

/** What a routine needs before it can be saved, if anything. */
export function routineProblems(r: Routine, habits: Habit[]): string[] {
  const habitSteps = r.steps.filter((s) => s.kind === "habit");
  return [
    !r.name.trim() && "give it a name",
    !habitSteps.length && "add a habit",
    habitSteps.some((s) => !findStep(habits, s)) && "choose each step's habit",
    habitSteps.some((s) => s.by === "count" && !(s.count > 0)) &&
      "give each counted step its count",
  ].filter((p): p is string => !!p);
}
