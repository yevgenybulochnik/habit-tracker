/** Format a Date as a local YYYY-MM-DD key. */
export function dk(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse a YYYY-MM-DD key as local midnight on that day. */
export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The key `n` days after `key` (before it, when `n` is negative). */
export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dk(d);
}

/** Milliseconds from `now` until the next local midnight (never 0). */
export function msUntilMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

/**
 * Today's date key. This is the only place lib reads the clock to find the
 * date: every other function takes `today` as a parameter. The UI gets it
 * from the `useToday` hook, which keeps it current past midnight.
 */
export function todayK(): string {
  return dk(new Date());
}
