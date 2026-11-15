import type { Unit } from "../types";

/** A unit as typed into a form: the number lists are comma-separated text. */
export type UnitFields = {
  id: string;
  label: string;
  quickAdd: string;
  thresholds: string;
};

/** What a new-unit form starts with. */
export const NEW_UNIT_FIELDS: UnitFields = {
  id: "",
  label: "",
  quickAdd: "1, 5, 10",
  thresholds: "1, 3, 5",
};

/** The positive whole numbers in a comma-separated list, e.g. "1, 5, x" → [1, 5]. */
export function parseNumList(s: string): number[] {
  return s
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => !isNaN(v) && v > 0);
}

/** A unit id as stored: trimmed, lowercase, words joined by "_". */
export function normalizeUnitId(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

/** An existing unit as form fields, for editing it. */
export function unitFields(u: Unit): UnitFields {
  return {
    id: u.id,
    label: u.label,
    quickAdd: u.quickAdd.join(", "),
    thresholds: u.thresholds.join(", "),
  };
}

export type BuildUnitResult =
  | { ok: true; unit: Unit }
  | { ok: false; error: string };

/**
 * The unit a form's fields describe, or why they don't describe one.
 * `takenIds` are the other units' ids, which it mustn't reuse. Up to three
 * quick-add amounts and three thresholds are kept.
 */
export function buildUnit(
  fields: UnitFields,
  takenIds: readonly string[],
): BuildUnitResult {
  const id = normalizeUnitId(fields.id);
  const label = fields.label.trim();
  const quickAdd = parseNumList(fields.quickAdd).slice(0, 3);
  const thresholds = parseNumList(fields.thresholds).slice(0, 3);
  if (!id) return { ok: false, error: "Enter an ID." };
  if (takenIds.includes(id))
    return { ok: false, error: `There's already a unit with the ID "${id}".` };
  if (!label) return { ok: false, error: "Enter a label." };
  if (!quickAdd.length)
    return { ok: false, error: "Enter at least one quick-add amount." };
  if (!thresholds.length)
    return { ok: false, error: "Enter at least one threshold." };
  return { ok: true, unit: { id, label, quickAdd, thresholds } };
}
