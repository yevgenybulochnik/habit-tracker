import type { DayLog, Logs } from "../types";

/**
 * Immutably write one habit's day entry into the logs tree, returning a new
 * `Logs` with fresh references all the way down to the touched habit. Callers
 * (e.g. the calendar day editor) rely on the per-habit object changing identity
 * so downstream effects keyed on it re-run; mutating in place would not re-color
 * the heatmap cell.
 */
export function setDayLog(logs: Logs, habitId: string, dateKey: string, entry: DayLog): Logs {
  return { ...logs, [habitId]: { ...(logs[habitId] || {}), [dateKey]: entry } };
}
