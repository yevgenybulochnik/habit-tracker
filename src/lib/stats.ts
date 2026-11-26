import type { DayLog, Habit, HabitLogs, SetEntry, Unit } from "../types";
import { addDays } from "./dates";
import {
  getUnit,
  isSetMetric,
  isDoneMetric,
  metricActive,
  metricVal,
} from "./metrics";
import { fmtSets, fmtVal } from "./format";
import { periodDays } from "./periods";

/** Intensity level 0–4 for a habit on a given day. */
export function logLevel(
  habit: Habit,
  log: DayLog | undefined,
  units: Unit[],
): number {
  if (!log) return 0;
  const ms = habit.metrics;
  if (!ms.length) return 0;
  if (habit.intensityMode === "coverage") {
    const done = ms.filter((m) => metricActive(m, log)).length;
    const p = done / ms.length;
    if (p <= 0) return 0;
    if (p < 0.25) return 1;
    if (p < 0.5) return 2;
    if (p < 1) return 3;
    return 4;
  }
  const total = ms.reduce((s, m) => s + metricVal(m, log), 0);
  if (total <= 0) return 0;
  const thr =
    habit.thresholds || getUnit(ms[0]?.unit || "count", units).thresholds;
  if (total < thr[0]) return 1;
  if (total < thr[1]) return 2;
  if (total < thr[2]) return 3;
  return 4;
}

export function logActive(
  h: Habit,
  log: DayLog | undefined,
  u: Unit[],
): boolean {
  return logLevel(h, log, u) > 0;
}

export function logSummary(h: Habit, log: DayLog | undefined): string {
  if (!log) return "No entry";
  const ms = h.metrics;
  const parts = ms
    .filter((m) => metricActive(m, log))
    .map((m) => {
      if (isDoneMetric(m)) return `${m.name} ✓`;
      if (isSetMetric(m))
        return `${m.name}: ${fmtSets(log[m.id] as SetEntry[], m)}`;
      return `${m.name}: ${fmtVal(log[m.id] as number, m.unit)}`;
    });
  return parts.length ? parts.join(", ") : "No entry";
}

export type HabitStats = {
  totalDays: number;
  totalVal: number;
  curStreak: number;
  lonStreak: number;
};

/**
 * Totals over every logged day, plus the streaks. A streak holds while the
 * habit's logs are no more than its period apart (a day apart for one due
 * every day), and is counted in days, from its first log to its last. The
 * current streak is still running while `today` (a date key) is within a
 * period of its last log: a period that isn't over yet doesn't break it. It
 * looks back a year; the longest is the best run in the year up to `today`.
 */
export function habitStats(
  h: Habit,
  logs: HabitLogs,
  u: Unit[],
  today: string,
): HabitStats {
  const es = Object.entries(logs || {});
  let td = 0,
    tv = 0;
  const ms = h.metrics;
  es.forEach(([, l]) => {
    if (logActive(h, l, u)) td++;
    tv += ms.reduce((s, m) => s + metricVal(m, l), 0);
  });
  const gap = periodDays(h.period);
  // How many days ago each day in the last year was logged, latest first.
  const ago: number[] = [];
  for (let i = 0; i <= 365; i++)
    if (logActive(h, logs[addDays(today, -i)], u)) ago.push(i);
  let cs2 = 0;
  if (ago.length && ago[0] <= gap) {
    let j = 0;
    while (j + 1 < ago.length && ago[j + 1] - ago[j] <= gap) j++;
    cs2 = ago[j] - ago[0] + 1;
  }
  let ls = 0;
  const inYear = ago.filter((i) => i <= 364);
  for (let a = 0; a < inYear.length; ) {
    let b = a;
    while (b + 1 < inYear.length && inYear[b + 1] - inYear[b] <= gap) b++;
    ls = Math.max(ls, inYear[b] - inYear[a] + 1);
    a = b + 1;
  }
  return { totalDays: td, totalVal: tv, curStreak: cs2, lonStreak: ls };
}
