/**
 * A new unique id such as `h_<uuid>`. `crypto.randomUUID` exists only in
 * secure contexts (HTTPS or localhost), so on a plain-HTTP host the id is the
 * same 128 bits of randomness as hex instead.
 */
export function newId(prefix: string): string {
  if (typeof crypto.randomUUID === "function")
    return `${prefix}_${crypto.randomUUID()}`;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${prefix}_${hex.join("")}`;
}
