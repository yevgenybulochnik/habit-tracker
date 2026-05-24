import type { SetEntry } from "../types";
import { setsVolume } from "./metrics";

/** Human-readable value, e.g. 90 min → "1h 30m", 5 reps → "5 reps". */
export function fmtVal(v: number | undefined, unit: string): string {
  if (!v || v <= 0) return "—";
  if (unit === "min") {
    if (v < 60) return `${v}m`;
    const h = Math.floor(v / 60), r = v % 60;
    return r > 0 ? `${h}h ${r}m` : `${h}h`;
  }
  return `${v} ${unit}`;
}

/** Summarize sets, e.g. "3 sets · 1,500 lbs vol". */
export function fmtSets(sets: SetEntry[] | undefined, wUnit: string | undefined): string {
  if (!Array.isArray(sets) || !sets.length) return "—";
  return `${sets.length} set${sets.length !== 1 ? "s" : ""} · ${setsVolume(sets).toLocaleString()} ${wUnit || "lbs"} vol`;
}
