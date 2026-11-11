import type { SetEntry, SetsMetric } from "../types";
import { primaryField, setsMetricVal } from "./metrics";

/** Human-readable value, e.g. 90 min → "1h 30m", 5 reps → "5 reps". */
export function fmtVal(v: number | undefined, unit: string): string {
  if (!v || v <= 0) return "—";
  if (unit === "min") {
    if (v < 60) return `${v}m`;
    const h = Math.floor(v / 60),
      r = v % 60;
    return r > 0 ? `${h}h ${r}m` : `${h}h`;
  }
  return `${v} ${unit}`;
}

/** Summarize sets per the metric's schema, e.g. "3 sets · 1,500 lbs vol",
 *  "4 sets · 48 reps", "2 sets · 35 min". */
export function fmtSets(sets: SetEntry[] | undefined, m: SetsMetric): string {
  if (!Array.isArray(sets) || !sets.length) return "—";
  const n = sets.length;
  const val = setsMetricVal(m, sets).toLocaleString();
  let unit: string;
  if (m.setValue === "volume") {
    const weightField = m.setFields.find((f) => f.unit);
    unit = `${weightField?.unit || "lbs"} vol`;
  } else {
    const p = primaryField(m);
    unit = p.unit || p.label.toLowerCase();
  }
  return `${n} set${n !== 1 ? "s" : ""} · ${val} ${unit}`;
}
