import { BUILTIN_UNITS, DEFAULT_CONFIG } from "./defaults";
import { isSetMetric, weightedFields } from "./metrics";
import type {
  AppConfig,
  Habit,
  Logs,
  Metric,
  PersistedState,
  SetField,
  Timers,
  Unit,
} from "../types";

/**
 * The format `normalizeState` produces. Bump it when a migration is added.
 *
 * - 1: every default filled in, and the version stamped.
 * - 2: weighted sets are measured in the `volume` unit instead of `reps`.
 */
export const SCHEMA_VERSION = 2;

export type NormalizeResult =
  | { ok: true; state: PersistedState }
  | { ok: false; reason: string };

type Obj = Record<string, unknown>;

/** Thrown inside this module to reject the data; never escapes it. */
class Rejected extends Error {}

function reject(reason: string): never {
  throw new Rejected(reason);
}

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `v` as an object with a string id, or reject naming where it was found. */
function withId(v: unknown, path: string): Obj & { id: string } {
  if (!isObj(v)) reject(`${path} is not an object`);
  if (typeof v.id !== "string") reject(`${path} has no id`);
  return v as Obj & { id: string };
}

/** `v` as a list (empty when absent), or reject naming where it was found. */
function list(v: unknown, path: string): unknown[] {
  if (v == null) return [];
  if (!Array.isArray(v)) reject(`${path} is not a list`);
  return v;
}

function numberList(v: unknown, path: string): number[] {
  if (!Array.isArray(v) || !v.every((n) => typeof n === "number"))
    reject(`${path} is not a list of numbers`);
  return v;
}

function normalizeMetric(raw: unknown, path: string): Metric {
  const m = withId(raw, path);
  if (m.mode !== "sets") return { ...m } as Metric;
  const fields = list(m.setFields, `${path}.setFields`).map((f, i) =>
    withId(f, `${path}.setFields[${i}]`),
  ) as SetField[];
  const weightUnit =
    typeof m.weightUnit === "string" ? m.weightUnit : undefined;
  return {
    ...m,
    // A sets metric from before schemas existed is weight × reps.
    setFields: fields.length ? fields : weightedFields(weightUnit),
    setValue: m.setValue === "primary" ? "primary" : "volume",
  } as Metric;
}

/**
 * Migration to version 2. A weighted metric's value is its volume (weight ×
 * reps), but it used to carry the `reps` unit, so the heatmap graded volume on
 * the reps thresholds. Reps that are reps (a single-field schema, a plain
 * metric) and weighted metrics given some other unit stay as they are.
 */
function weightedToVolume(m: Metric): Metric {
  const isWeighted =
    isSetMetric(m) && m.setValue === "volume" && m.setFields.length > 1;
  return isWeighted && m.unit === "reps" ? { ...m, unit: "volume" } : m;
}

function normalizeHabit(raw: unknown, path: string, version: number): Habit {
  const h = withId(raw, path);
  const metrics = list(h.metrics, `${path}.metrics`).map((m, i) =>
    normalizeMetric(m, `${path}.metrics[${i}]`),
  );
  return {
    ...h,
    metrics: version < 2 ? metrics.map(weightedToVolume) : metrics,
    intensityMode: h.intensityMode === "coverage" ? "coverage" : "total",
  } as Habit;
}

function normalizeLogs(raw: unknown): Logs {
  if (raw == null) return {};
  if (!isObj(raw)) reject("logs is not an object");
  for (const [habitId, days] of Object.entries(raw))
    if (!isObj(days)) reject(`logs.${habitId} is not an object`);
  return raw as Logs;
}

/** Stored units in their own order, then any built-in unit they lack. */
function normalizeUnits(raw: unknown): Unit[] {
  const stored = list(raw, "units").map((u, i) => {
    const unit = withId(u, `units[${i}]`);
    numberList(unit.quickAdd, `units[${i}].quickAdd`);
    numberList(unit.thresholds, `units[${i}].thresholds`);
    return unit as unknown as Unit;
  });
  const missing = BUILTIN_UNITS.filter(
    (b) => !stored.some((u) => u.id === b.id),
  );
  return [...stored, ...missing];
}

/** Each setting as stored when it is usable, otherwise its default. */
function normalizeConfig(raw: unknown): AppConfig {
  if (raw == null) return { ...DEFAULT_CONFIG };
  if (!isObj(raw)) reject("config is not an object");
  const { numMonths, monthGap, theme, dashView } = raw;
  const isCount = (v: unknown, min: number): v is number =>
    typeof v === "number" && Number.isFinite(v) && v >= min;
  return {
    numMonths: isCount(numMonths, 1) ? numMonths : DEFAULT_CONFIG.numMonths,
    monthGap: isCount(monthGap, 0) ? monthGap : DEFAULT_CONFIG.monthGap,
    theme: theme === "dark" || theme === "light" ? theme : DEFAULT_CONFIG.theme,
    dashView:
      dashView === "quick" || dashView === "calendar"
        ? dashView
        : DEFAULT_CONFIG.dashView,
  };
}

function normalizeTimers(raw: unknown): Timers {
  if (!isObj(raw)) reject("timers is not an object");
  const timers: Timers = {};
  for (const [key, start] of Object.entries(raw))
    if (typeof start === "number" && Number.isFinite(start))
      timers[key] = start;
  return timers;
}

function normalize(raw: unknown): PersistedState {
  if (!isObj(raw)) reject("not an object");
  const version = raw.schemaVersion ?? 0; // absent: from before versioning
  if (typeof version !== "number") reject("schemaVersion is not a number");
  if (version > SCHEMA_VERSION)
    reject(`schema version ${version} is newer than this app understands`);
  if (raw.habits == null) reject("habits is missing");
  if (!Array.isArray(raw.habits)) reject("habits is not a list");
  return {
    schemaVersion: SCHEMA_VERSION,
    habits: raw.habits.map((h, i) =>
      normalizeHabit(h, `habits[${i}]`, version),
    ),
    logs: normalizeLogs(raw.logs),
    units: normalizeUnits(raw.units),
    config: normalizeConfig(raw.config),
    ...(raw.timers != null && { timers: normalizeTimers(raw.timers) }),
  };
}

/**
 * Turn any stored or imported data into a complete, current-format state, so
 * the rest of the app never has to fill in defaults for older data.
 *
 * Absent pieces get their defaults: a habit's `metrics` and `intensityMode`, a
 * sets metric's `setFields` and `setValue`, the config's settings, and the
 * built-in units. Data from an older `schemaVersion` is migrated (see
 * `SCHEMA_VERSION`). Data whose structure can't be read is rejected with a reason:
 * a container of the wrong type, a habit, metric, set field or unit without an
 * id, a unit without its number lists, or a `schemaVersion` newer than this
 * code. Other values (names, colours, logged amounts) are kept as stored.
 *
 * Running it on its own output changes nothing.
 */
export function normalizeState(raw: unknown): NormalizeResult {
  try {
    return { ok: true, state: normalize(raw) };
  } catch (e) {
    if (e instanceof Rejected) return { ok: false, reason: e.message };
    throw e;
  }
}
