// What each log covers. A streak holds while a habit's logs are no more than
// its period apart, so a log carries the streak for a period from its day:
// that's its block, which the calendar outlines. From the last log follow
// when the next is due and whether the habit is done for now.

import type { Habit, HabitLogs, Unit } from "../types";
import { addDays, daysBetween, parseKey } from "./dates";
import { MONTHS, WK_FULL } from "./defaults";
import { periodDays } from "./periods";
import { logActive } from "./stats";

/** The days a log covers, from its own (`start`) to `end`, both date keys. */
export type CoverBlock = { start: string; end: string };

/** How many days ago, within `days` back from `today`, the habit was last
 *  logged; null when it wasn't. */
function lastLogAgo(
  h: Habit,
  logs: HabitLogs,
  u: Unit[],
  today: string,
  days: number,
): number | null {
  for (let i = 0; i <= days; i++)
    if (logActive(h, logs[addDays(today, -i)], u)) return i;
  return null;
}

/**
 * The day the next log is due by for the streak to hold: a period after the
 * last log. Null when no streak is running (no log within a period of
 * `today`).
 */
export function nextDue(
  h: Habit,
  logs: HabitLogs,
  u: Unit[],
  today: string,
): string | null {
  const gap = periodDays(h.period);
  const ago = lastLogAgo(h, logs, u, today, gap);
  return ago === null ? null : addDays(today, gap - ago);
}

/**
 * Done for now: a log still covers today, so nothing's due yet. For a habit
 * due every day, that's logged today.
 */
export function isDone(
  h: Habit,
  logs: HabitLogs,
  u: Unit[],
  today: string,
): boolean {
  return lastLogAgo(h, logs, u, today, periodDays(h.period) - 1) !== null;
}

/** When a day is, said from `today`: "today", "tomorrow", a weekday in the
 *  coming week ("Sat"), or else a date ("Jun 7"). */
export function dueLabel(day: string, today: string): string {
  const n = daysBetween(today, day);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  const d = parseKey(day);
  if (n > 1 && n < 7) return WK_FULL[(d.getDay() + 6) % 7];
  return fmtDay(d);
}

const fmtDay = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

/**
 * Each logged day's block: it runs for a period from the log, or up to the
 * day before the next log if that comes sooner, so blocks never overlap.
 * The streak holds exactly while they touch; a day in no block is where it
 * broke. The last block may run past today. Day key → the block it's in.
 */
export function coverBlocks(
  h: Habit,
  logs: HabitLogs,
  u: Unit[],
): Map<string, CoverBlock> {
  const gap = periodDays(h.period);
  const logged = Object.keys(logs)
    .filter((k) => logActive(h, logs[k], u))
    .sort();
  const out = new Map<string, CoverBlock>();
  logged.forEach((start, i) => {
    let end = addDays(start, gap - 1);
    const next = logged[i + 1];
    if (next && next <= end) end = addDays(next, -1);
    const block = { start, end };
    for (let k = start; k <= end; k = addDays(k, 1)) out.set(k, block);
  });
  return out;
}

/** A day's note on its block, for the calendar's tooltip: how far its log
 *  carries the streak, or which log covers it. */
export function blockNote(block: CoverBlock, key: string): string | null {
  if (key !== block.start) return `covered by ${fmtDay(parseKey(block.start))}`;
  if (block.end === block.start) return null;
  return `covers to ${fmtDay(parseKey(block.end))}`;
}
