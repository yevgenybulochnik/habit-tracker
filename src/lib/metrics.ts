import type { DayLog, HabitLogs, Metric, SetEntry, SetField, Unit } from "../types";
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

/** The default schema for a sets metric that doesn't declare its own fields. */
export function weightedFields(weightUnit = "lbs"): SetField[] {
  return [
    { id: "w", label: "Weight", unit: weightUnit, agg: "max" },
    { id: "r", label: "Reps", agg: "sum", primary: true },
  ];
}

/** Resolve a sets metric's per-set fields (defaults to weighted [weight, reps]). */
export function setFieldsOf(m: Metric): SetField[] {
  return m.setFields && m.setFields.length ? m.setFields : weightedFields(m.weightUnit);
}

/** The field whose aggregate is the metric's headline value in "primary" mode. */
export function primaryField(m: Metric): SetField {
  const fields = setFieldsOf(m);
  return fields.find((f) => f.primary) || fields[fields.length - 1];
}

/** Aggregate one field across a day's sets per its agg rule. */
export function aggregateSets(sets: SetEntry[] | undefined, field: SetField): number {
  if (!Array.isArray(sets) || !sets.length) return 0;
  const vals = sets.map((s) => s[field.id] || 0);
  switch (field.agg) {
    case "max": return Math.max(...vals);
    case "last": return vals[vals.length - 1];
    case "avg": return vals.reduce((a, b) => a + b, 0) / vals.length;
    case "sum":
    default: return vals.reduce((a, b) => a + b, 0);
  }
}

/** Σ over sets of the product of all field values (e.g. weight × reps = lifting volume). */
export function setVolume(sets: SetEntry[] | undefined, fields: SetField[]): number {
  if (!Array.isArray(sets) || !sets.length) return 0;
  return sets.reduce((sum, s) => sum + fields.reduce((p, f) => p * (s[f.id] || 0), 1), 0);
}

/** A sets metric's headline numeric value: volume, or the primary field's aggregate. */
export function setsMetricVal(m: Metric, sets: SetEntry[] | undefined): number {
  const fields = setFieldsOf(m);
  if ((m.setValue ?? "volume") === "primary") return aggregateSets(sets, primaryField(m));
  return setVolume(sets, fields);
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

/** Numeric value of a metric in a day's log (schema-driven for sets metrics). */
export function metricVal(m: Metric, log: DayLog | undefined): number {
  if (!log) return 0;
  const v = log[m.id];
  if (isSetMetric(m)) return setsMetricVal(m, v as SetEntry[]);
  return (v as number) || 0;
}

/** Whether a metric has any logged activity in a day's log. */
export function metricActive(m: Metric, log: DayLog | undefined): boolean {
  if (!log) return false;
  const v = log[m.id];
  if (isSetMetric(m)) return Array.isArray(v) && v.length > 0;
  return ((v as number) || 0) > 0;
}

/** Most recent logged set for a metric, searching back up to 90 days. */
export function findLastSet(logs: HabitLogs, metricId: string): SetEntry | null {
  const today = new Date();
  for (let i = 0; i <= 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const v = logs[dk(d)]?.[metricId];
    if (Array.isArray(v) && v.length > 0) return v[v.length - 1];
  }
  return null;
}

/** Most recent set weight for a metric (legacy weighted helper). */
export function findLastWeight(logs: HabitLogs, metricId: string): number | null {
  const last = findLastSet(logs, metricId);
  return last ? last.w ?? null : null;
}
