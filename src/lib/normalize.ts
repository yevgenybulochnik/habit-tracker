import { BUILTIN_UNITS, DEFAULT_CONFIG, DEFAULT_GROUP_EMOJI } from "./defaults";
import { hasMixedUnits, isSetMetric, weightedFields } from "./metrics";
import { DEFAULT_COUNT, fitRoutine, PREP_SECONDS } from "./routines";
import type { Result, Run } from "./routineRun";
import type {
  AppConfig,
  Group,
  Habit,
  Logs,
  Metric,
  PersistedState,
  Routine,
  RoutineStep,
  SetField,
  Timers,
  Unit,
} from "../types";

/**
 * The format `normalizeState` produces. Bump it when a migration is added.
 *
 * - 1: every default filled in, and the version stamped.
 * - 2: weighted sets are measured in the `volume` unit instead of `reps`.
 * - 3: habits can be in groups (`groups`, a habit's `groupId`). Nothing is
 *   migrated; the bump makes an older app refuse the data rather than drop
 *   the groups the next time it saves.
 * - 4: routines (`routines`). Nothing is migrated; the bump is for the same
 *   reason as 3's.
 */
export const SCHEMA_VERSION = 4;

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
 *
 * A habit that summed such a metric with one in real reps now has two units,
 * so `normalizeHabit` moves it to coverage mode.
 */
function weightedToVolume(m: Metric): Metric {
  const isWeighted =
    isSetMetric(m) && m.setValue === "volume" && m.setFields.length > 1;
  return isWeighted && m.unit === "reps" ? { ...m, unit: "volume" } : m;
}

function normalizeHabit(
  raw: unknown,
  path: string,
  version: number,
  groupIds: Set<string>,
): Habit {
  const { groupId, ...h } = withId(raw, path);
  const stored = list(h.metrics, `${path}.metrics`).map((m, i) =>
    normalizeMetric(m, `${path}.metrics[${i}]`),
  );
  const metrics = version < 2 ? stored.map(weightedToVolume) : stored;
  const moved = metrics.some((m, i) => m !== stored[i]);
  return {
    ...h,
    metrics,
    // A habit the migration left with mixed units gets the mode the habit
    // form would give it: the form only allows "total" within one unit.
    intensityMode:
      h.intensityMode === "coverage" || (moved && hasMixedUnits(metrics))
        ? "coverage"
        : "total",
    // Only a group that exists; otherwise the habit is in none.
    ...(typeof groupId === "string" && groupIds.has(groupId) && { groupId }),
  } as Habit;
}

/** Groups in their stored order, each open unless stored shut. */
function normalizeGroups(raw: unknown): Group[] {
  return list(raw, "groups").map((g, i) => {
    const group = withId(g, `groups[${i}]`);
    return {
      ...group,
      name: typeof group.name === "string" ? group.name : "",
      emoji:
        typeof group.emoji === "string" ? group.emoji : DEFAULT_GROUP_EMOJI,
      collapsed: group.collapsed === true,
    };
  });
}

/** `v` when it's a number above `min` (or at it, with `orEqual`), else `fallback`. */
function numberAbove(
  v: unknown,
  min: number,
  fallback: number,
  orEqual = false,
) {
  return typeof v === "number" &&
    Number.isFinite(v) &&
    (v > min || (orEqual && v === min))
    ? v
    : fallback;
}

function normalizeStep(raw: unknown, path: string): RoutineStep {
  const s = withId(raw, path);
  if (s.kind === "break")
    return { kind: "break", id: s.id, seconds: numberAbove(s.seconds, 0, 30) };
  if (s.kind !== "habit") reject(`${path} is neither a habit nor a break`);
  return {
    kind: "habit",
    id: s.id,
    // Not a string: no habit has it, so `fitRoutine` drops the step.
    habitId: typeof s.habitId === "string" ? s.habitId : "",
    metricId: typeof s.metricId === "string" ? s.metricId : "",
    by: s.by === "count" ? "count" : "time",
    seconds: numberAbove(s.seconds, 0, 60),
    count: numberAbove(s.count, 0, DEFAULT_COUNT),
  };
}

/** Routines in their stored order, each with what it lacks filled in and only
 *  the steps that still stand (see `fitRoutine`). */
function normalizeRoutines(raw: unknown, habits: Habit[]): Routine[] {
  return list(raw, "routines").map((r, i) =>
    fitRoutine(normalizeRoutine(r, `routines[${i}]`), habits),
  );
}

/** A routine with what it lacks filled in, its steps as they are. */
function normalizeRoutine(raw: unknown, path: string): Routine {
  const routine = withId(raw, path);
  const steps = list(routine.steps, `${path}.steps`).map((s, j) =>
    normalizeStep(s, `${path}.steps[${j}]`),
  );
  const rounds = numberAbove(routine.rounds, 0, 1);
  return {
    id: routine.id,
    name: typeof routine.name === "string" ? routine.name : "",
    rounds: Number.isInteger(rounds) ? rounds : 1,
    prep: numberAbove(routine.prep, 0, PREP_SECONDS, true),
    steps,
  };
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
  const groups = normalizeGroups(raw.groups);
  const groupIds = new Set(groups.map((g) => g.id));
  const habits = raw.habits.map((h, i) =>
    normalizeHabit(h, `habits[${i}]`, version, groupIds),
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    habits,
    logs: normalizeLogs(raw.logs),
    units: normalizeUnits(raw.units),
    config: normalizeConfig(raw.config),
    groups,
    routines: normalizeRoutines(raw.routines, habits),
    ...(raw.timers != null && { timers: normalizeTimers(raw.timers) }),
  };
}

/**
 * Turn any stored or imported data into a complete, current-format state, so
 * the rest of the app never has to fill in defaults for older data.
 *
 * Absent pieces get their defaults: a habit's `metrics` and `intensityMode`, a
 * sets metric's `setFields` and `setValue`, the config's settings, the
 * built-in units, the groups (none) with a group's name, emoji and
 * `collapsed`, and the routines (none) with a routine's name, rounds and
 * get-ready and a step's timing. A habit's `groupId` is dropped unless that
 * group exists, and a routine's step unless its habit and metric do (see
 * `fitRoutine`). Data from an older `schemaVersion` is migrated (see
 * `SCHEMA_VERSION`). Data whose structure can't be read is rejected with a
 * reason: a container of the wrong type, a habit, metric, set field, unit,
 * group, routine or step without an id, a step that's neither a habit nor a
 * break, a unit without its number lists, or a `schemaVersion` newer than this
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

const isNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Only the entries of `raw` that `read` makes something of. */
function entriesOf<T>(raw: unknown, read: (v: unknown) => T | undefined) {
  const out: Record<string, T> = {};
  if (isObj(raw))
    for (const [k, v] of Object.entries(raw)) {
      const t = read(v);
      if (t !== undefined) out[k] = t;
    }
  return out;
}

function readResult(v: unknown): Result | undefined {
  if (!isObj(v)) return undefined;
  if (v.status === "skipped") return { status: "skipped" };
  if (
    v.status !== "logged" ||
    !isNumber(v.amount) ||
    typeof v.text !== "string"
  )
    return undefined;
  const set = isObj(v.set)
    ? entriesOf(v.set, (n) => (isNumber(n) ? n : undefined))
    : undefined;
  return {
    status: "logged",
    amount: v.amount,
    text: v.text,
    ...(set && { set }),
  };
}

/**
 * A run in progress as stored (see `Run`), or null when it can't be read.
 * Losing a run loses no logs, so this gives up rather than rejecting: a run
 * without its routine or start, or that isn't an object. Its routine is kept
 * as it was, even if some of its habits are gone; the ends and results it
 * can't read are dropped.
 */
export function normalizeRun(raw: unknown): Run | null {
  if (!isObj(raw) || !isNumber(raw.startedAt)) return null;
  let routine: Routine;
  try {
    routine = normalizeRoutine(raw.routine, "run.routine");
  } catch (e) {
    if (e instanceof Rejected) return null;
    throw e;
  }
  return {
    routine,
    startedAt: raw.startedAt,
    ...(isNumber(raw.pausedAt) && { pausedAt: raw.pausedAt }),
    pausedMs: isNumber(raw.pausedMs) ? raw.pausedMs : 0,
    shiftMs: isNumber(raw.shiftMs) ? raw.shiftMs : 0,
    ends: entriesOf(raw.ends, (v) => (isNumber(v) ? v : undefined)),
    results: entriesOf(raw.results, readResult),
    finished: raw.finished === true,
  };
}
