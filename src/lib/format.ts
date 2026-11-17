import type { SetEntry, SetsMetric } from "../types";
import { setsMetricVal, setUnitLabel } from "./metrics";

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

/** A running timer's clock: "05:30" under an hour, "2:05:30" after. */
export function fmtClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Summarize sets per the metric's schema, e.g. "3 sets · 1,500 lbs vol",
 *  "4 sets · 48 reps", "2 sets · 35 min". */
export function fmtSets(sets: SetEntry[] | undefined, m: SetsMetric): string {
  if (!Array.isArray(sets) || !sets.length) return "—";
  const n = sets.length;
  const val = setsMetricVal(m, sets).toLocaleString();
  const unit = setUnitLabel(m) + (m.setValue === "volume" ? " vol" : "");
  return `${n} set${n !== 1 ? "s" : ""} · ${val} ${unit}`;
}
