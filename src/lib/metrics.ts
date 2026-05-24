import type { DayLog, HabitLogs, Metric, SetEntry, Unit } from "../types";
import { dk } from "./dates";

/** Resolve a unit by id, falling back to a generic count-like unit. */
export function getUnit(id: string, units: Unit[]): Unit {
  return units.find((u) => u.id === id) || { id, label: id, quickAdd: [1, 5, 10], thresholds: [1, 3, 5] };
}

export function getQuickAdd(uid: string, units: Unit[]): number[] {
  return getUnit(uid, units).quickAdd;
}

export function isSetMetric(m: Metric): boolean {
  return m.mode === "sets";
}

export function setsVolume(sets: SetEntry[] | undefined): number {
  if (!Array.isArray(sets) || !sets.length) return 0;
  return sets.reduce((s, st) => s + (st.w || 0) * (st.r || 0), 0);
}

export function setsTotalReps(sets: SetEntry[] | undefined): number {
  if (!Array.isArray(sets)) return 0;
  return sets.reduce((s, st) => s + (st.r || 0), 0);
}

export function setsMaxWeight(sets: SetEntry[] | undefined): number {
  if (!Array.isArray(sets) || !sets.length) return 0;
  return Math.max(...sets.map((st) => st.w || 0));
}

/** Numeric value of a metric in a day's log (volume for sets metrics). */
export function metricVal(m: Metric, log: DayLog | undefined): number {
  if (!log) return 0;
  const v = log[m.id];
  if (isSetMetric(m)) return setsVolume(v as SetEntry[]);
  return (v as number) || 0;
}

/** Whether a metric has any logged activity in a day's log. */
export function metricActive(m: Metric, log: DayLog | undefined): boolean {
  if (!log) return false;
  const v = log[m.id];
  if (isSetMetric(m)) return Array.isArray(v) && v.length > 0;
  return ((v as number) || 0) > 0;
}

/** Most recent set weight for a metric, searching back up to 90 days. */
export function findLastWeight(logs: HabitLogs, metricId: string): number | null {
  const today = new Date();
  for (let i = 0; i <= 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayLog = logs[dk(d)];
    const v = dayLog?.[metricId];
    if (Array.isArray(v) && v.length > 0) {
      return v[v.length - 1].w;
    }
  }
  return null;
}
