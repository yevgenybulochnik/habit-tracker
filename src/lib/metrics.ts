import type {
  DayLog,
  HabitLogs,
  Metric,
  SetEntry,
  SetField,
  Unit,
} from "../types";
import { dk } from "./dates";

/** Resolve a unit by id, falling back to a generic count-like unit. */
export function getUnit(id: string, units: Unit[]): Unit {
  return (
    units.find((u) => u.id === id) || {
      id,
      label: id,
      quickAdd: [1, 5, 10],
      thresholds: [1, 3, 5],
    }
  );
}

export function getQuickAdd(uid: string, units: Unit[]): number[] {
  return getUnit(uid, units).quickAdd;
}

export function isSetMetric(m: Metric): boolean {
  return m.mode === "sets";
}

/** A binary daily check-off metric (stored as 0/1). */
export function isDoneMetric(m: Metric): boolean {
  return m.mode === "done";
}

/** The default metric for a habit created without any: a daily check-off. */
export function doneMetric(): Metric {
  return {
    id: `m_${Date.now()}`,
    name: "Completed",
    mode: "done",
    unit: "count",
  };
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
  return m.setFields && m.setFields.length
    ? m.setFields
    : weightedFields(m.weightUnit);
}

/** The field whose aggregate is the metric's headline value in "primary" mode. */
export function primaryField(m: Metric): SetField {
  const fields = setFieldsOf(m);
  return fields.find((f) => f.primary) || fields[fields.length - 1];
}

/** Aggregate one field across a day's sets per its agg rule. */
export function aggregateSets(
  sets: SetEntry[] | undefined,
  field: SetField,
): number {
  if (!Array.isArray(sets) || !sets.length) return 0;
  const vals = sets.map((s) => s[field.id] || 0);
  switch (field.agg) {
    case "max":
      return Math.max(...vals);
    case "last":
      return vals[vals.length - 1];
    case "avg":
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    case "sum":
    default:
      return vals.reduce((a, b) => a + b, 0);
  }
}

/** Σ over sets of the product of all field values (e.g. weight × reps = lifting volume). */
export function setVolume(
  sets: SetEntry[] | undefined,
  fields: SetField[],
): number {
  if (!Array.isArray(sets) || !sets.length) return 0;
  return sets.reduce(
    (sum, s) => sum + fields.reduce((p, f) => p * (s[f.id] || 0), 1),
    0,
  );
}

/** A sets metric's headline numeric value: volume, or the primary field's aggregate. */
export function setsMetricVal(m: Metric, sets: SetEntry[] | undefined): number {
  const fields = setFieldsOf(m);
  if ((m.setValue ?? "volume") === "primary")
    return aggregateSets(sets, primaryField(m));
  return setVolume(sets, fields);
}

/** Built-in sets schemas chosen in the habit form. */
export type SetPreset = "weighted" | "reps" | "timed";

/** The metric fields a sets preset writes (schema + value mode + unit). */
export function setsPreset(
  kind: SetPreset,
  weightUnit = "lbs",
): Pick<Metric, "setFields" | "setValue" | "weightUnit" | "unit"> {
  switch (kind) {
    case "reps":
      return {
        setValue: "primary",
        unit: "reps",
        setFields: [{ id: "r", label: "Reps", agg: "sum", primary: true }],
      };
    case "timed":
      return {
        setValue: "primary",
        unit: "min",
        setFields: [
          {
            id: "min",
            label: "Minutes",
            unit: "min",
            agg: "sum",
            primary: true,
          },
        ],
      };
    case "weighted":
    default:
      return {
        setValue: "volume",
        unit: "reps",
        weightUnit,
        setFields: [
          { id: "w", label: "Weight", unit: weightUnit, agg: "max" },
          { id: "r", label: "Reps", agg: "sum", primary: true },
        ],
      };
  }
}

/** Short unit label for a sets metric's badge, e.g. "lbs" | "reps" | "min". */
export function setUnitLabel(m: Metric): string {
  if ((m.setValue ?? "volume") === "volume")
    return setFieldsOf(m).find((f) => f.unit)?.unit || "lbs";
  const p = primaryField(m);
  return p.unit || p.label.toLowerCase();
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
export function findLastSet(
  logs: HabitLogs,
  metricId: string,
): SetEntry | null {
  const today = new Date();
  for (let i = 0; i <= 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const v = logs[dk(d)]?.[metricId];
    if (Array.isArray(v) && v.length > 0) return v[v.length - 1];
  }
  return null;
}
