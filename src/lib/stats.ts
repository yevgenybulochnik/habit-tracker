import type { DayLog, Habit, HabitLogs, SetEntry, Unit } from "../types";
import { dk } from "./dates";
import { getUnit, isSetMetric, metricActive, metricVal } from "./metrics";
import { fmtSets, fmtVal } from "./format";

/** Intensity level 0–4 for a habit on a given day. */
export function logLevel(
  habit: Habit,
  log: DayLog | undefined,
  units: Unit[],
): number {
  if (!log) return 0;
  const ms = habit.metrics || [];
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
  const ms = h.metrics || [];
  const parts = ms
    .filter((m) => metricActive(m, log))
    .map((m) => {
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

export function habitStats(h: Habit, logs: HabitLogs, u: Unit[]): HabitStats {
  const es = Object.entries(logs || {});
  let td = 0,
    tv = 0;
  const ms = h.metrics || [];
  es.forEach(([, l]) => {
    if (logActive(h, l, u)) td++;
    tv += ms.reduce((s, m) => s + metricVal(m, l), 0);
  });
  let cs2 = 0;
  const t = new Date();
  for (let i = 0; i <= 365; i++) {
    const d = new Date(t);
    d.setDate(d.getDate() - i);
    if (logActive(h, logs[dk(d)], u)) cs2++;
    else break;
  }
  let ls = 0,
    cc = 0;
  for (let i = 364; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (logActive(h, logs[dk(d)], u)) {
      cc++;
      ls = Math.max(ls, cc);
    } else cc = 0;
  }
  return { totalDays: td, totalVal: tv, curStreak: cs2, lonStreak: ls };
}
