// How often a habit is due (its `period`), and what that means for its
// streak and its calendar: a streak holds while its logs are no more than a
// period apart, so each log carries the streak for a period from its day.

import type { Period } from "../types";

/** The most days or weeks the habit form lets a period be. */
export const MAX_EVERY: Record<Period["unit"], number> = { day: 30, week: 8 };

/** A period's length in days; a habit with none is due every day. */
export function periodDays(p: Period | undefined): number {
  if (!p) return 1;
  return p.unit === "week" ? 7 * p.every : p.every;
}

/** How often, as a card says it: "Every day", "Every 2 days", "Every week". */
export function periodLabel(p: Period | undefined): string {
  const { every, unit } = p ?? { every: 1, unit: "day" };
  return every === 1 ? `Every ${unit}` : `Every ${every} ${unit}s`;
}

/** How far apart logs may be: "a day", "2 days", "a week", "3 weeks". */
export function gapLabel(p: Period | undefined): string {
  const { every, unit } = p ?? { every: 1, unit: "day" };
  return every === 1 ? `a ${unit}` : `${every} ${unit}s`;
}
