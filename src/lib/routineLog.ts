// What a routine's habit slot logs to its habit, and how that's changed or
// taken back later. Everything here returns the reducer's actions for the
// caller to dispatch; nothing is logged directly.
import { fmtSets, fmtVal } from "./format";
import {
  findLastSet,
  isDoneMetric,
  isSetMetric,
  primaryField,
} from "./metrics";
import type { Capture } from "./routines";
import type { Logged } from "./routineRun";
import type { Action } from "./state";
import type { DayLog, HabitLogs, Metric, SetEntry } from "../types";

/** The value logged for a slot: the count, or minutes from its seconds. The
 *  app's minutes are whole numbers, at least one (a set's can be tenths). */
export function loggedValue(m: Metric, capture: Capture, amount: number) {
  if (capture === "check") return 1;
  if (capture === "count") return amount;
  return isSetMetric(m)
    ? Math.round(amount / 6) / 10
    : Math.max(1, Math.round(amount / 60));
}

/** The set a sets metric logs: the counted `value` with its other fields. */
const setOf = (m: Metric, value: number, extra: SetEntry): SetEntry =>
  isSetMetric(m) ? { ...extra, [primaryField(m).id]: value } : {};

/** The actions that log `value` (see `loggedValue`) to the metric today. */
export function logActions(
  habitId: string,
  m: Metric,
  value: number,
  extra: SetEntry,
  today: string,
): Action[] {
  const at = { habitId, metricId: m.id, dateKey: today };
  if (isDoneMetric(m))
    return [
      { type: "log/reset", ...at },
      { type: "log/add", ...at, amount: 1 },
    ];
  if (isSetMetric(m))
    return [{ type: "log/addSet", ...at, set: setOf(m, value, extra) }];
  return [{ type: "log/add", ...at, amount: value }];
}

/** A slot's result once `logActions` has logged `value` for it. */
export const loggedResult = (
  m: Metric,
  value: number,
  extra: SetEntry,
): Logged => ({
  status: "logged",
  amount: value,
  text: fmtLogged(m, value),
  ...(isSetMetric(m) && { set: setOf(m, value, extra) }),
});

const sameSet = (a: SetEntry, b: SetEntry) =>
  Object.keys({ ...a, ...b }).every((k) => (a[k] ?? 0) === (b[k] ?? 0));

/** The index of the last of `xs` that passes, or -1. */
function lastIndex<T>(xs: T[], test: (x: T) => boolean): number {
  for (let i = xs.length - 1; i >= 0; i--) if (test(xs[i])) return i;
  return -1;
}

/**
 * The actions that change what a slot logged (`was`) to `value`, or take it
 * back for 0. Its set is changed where it stands in the day (the latest alike,
 * if there are several); one since removed from the habit is logged anew. A
 * plain amount gets the difference, never giving back more than the day still
 * holds.
 */
export function relogActions(
  habitId: string,
  m: Metric,
  was: Logged,
  value: number,
  extra: SetEntry,
  day: DayLog | undefined,
  today: string,
): Action[] {
  const at = { habitId, metricId: m.id, dateKey: today };
  const v = day?.[m.id];
  if (isSetMetric(m)) {
    const sets = Array.isArray(v) ? v : [];
    const own = was.set ?? setOf(m, was.amount, {});
    const i = lastIndex(sets, (s) => sameSet(s, own));
    if (i === -1)
      return value > 0 ? logActions(habitId, m, value, extra, today) : [];
    if (!(value > 0)) return [{ type: "log/removeSet", ...at, index: i }];
    const set = setOf(m, value, extra);
    return [
      {
        type: "log/setDay",
        habitId,
        dateKey: today,
        entry: { ...day, [m.id]: sets.map((s, j) => (j === i ? set : s)) },
      },
    ];
  }
  const gave = Math.min(was.amount, typeof v === "number" ? v : 0);
  return [{ type: "log/add", ...at, amount: value - gave }];
}

/** A sets metric's other fields (weight, …), carried from its latest set. */
export function carriedFields(
  m: Metric,
  logs: HabitLogs,
  today: string,
): SetEntry {
  if (!isSetMetric(m)) return {};
  const last = findLastSet(logs, m.id, today);
  const p = primaryField(m);
  return Object.fromEntries(
    m.setFields
      .filter((f) => f.id !== p.id)
      .map((f) => [f.id, last?.[f.id] ?? 0]),
  );
}

/** The latest count logged for a sets metric's counted field, to suggest. */
export function lastCount(
  m: Metric,
  logs: HabitLogs,
  today: string,
): number | undefined {
  if (!isSetMetric(m)) return undefined;
  return findLastSet(logs, m.id, today)?.[primaryField(m).id];
}

/** What a count is of: the counted field's unit for a sets metric (reps, not
 *  a weighted metric's volume). */
export function countUnit(m: Metric): string {
  if (!isSetMetric(m)) return m.unit;
  const p = primaryField(m);
  return p.unit || p.label.toLowerCase();
}

/** What a slot logged, in words: "12 reps", "2m", "done". */
export function fmtLogged(m: Metric, value: number): string {
  if (isDoneMetric(m)) return "done";
  if (isSetMetric(m)) return `${value} ${countUnit(m)}`;
  return fmtVal(value, m.unit);
}

/** What the metric holds today, e.g. "3 sets · 60 reps". */
export function todaySummary(m: Metric, day: DayLog | undefined): string {
  const v = day?.[m.id];
  if (isSetMetric(m)) return fmtSets(Array.isArray(v) ? v : undefined, m);
  if (isDoneMetric(m)) return v ? "done today" : "not yet today";
  return fmtVal(typeof v === "number" ? v : undefined, m.unit);
}
