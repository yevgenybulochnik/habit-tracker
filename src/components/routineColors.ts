import { resolvePalette } from "../theme";
import { findStep, stepShade } from "../lib/routines";
import type { Habit, Metric, RoutineStep, ThemeName } from "../types";

/** A habit step's colour: its shade of the habit's palette (see
 *  `stepShade`). */
export function stepColor(
  { habit, metric }: { habit: Habit; metric: Metric },
  theme: ThemeName,
): string {
  return resolvePalette(habit.color, theme).shades[stepShade(habit, metric)];
}

/** Any step's colour: a habit's (see `stepColor`), or grey for a break or a
 *  habit that's gone. */
export function colorOf(
  step: RoutineStep,
  habits: Habit[],
  theme: ThemeName,
): string {
  const found = step.kind === "habit" ? findStep(habits, step) : undefined;
  return found ? stepColor(found, theme) : "var(--c-muted)";
}
