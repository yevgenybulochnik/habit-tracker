/** Format a Date as a local YYYY-MM-DD key. */
export function dk(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today's date key. */
export function todayK(): string {
  return dk(new Date());
}
