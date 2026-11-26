// Shared domain types for the habit tracker.

import type { IconId } from "./lib/icons";

/** How a per-set field rolls up across a day's sets. */
export type SetAgg = "sum" | "max" | "last" | "avg";

/** One measured field within a sets-mode metric (e.g. weight, reps, minutes). */
export type SetField = {
  id: string; // key under which the value is stored in a SetEntry
  label: string; // display name, e.g. "Weight", "Reps", "Minutes"
  unit?: string; // optional unit shown beside the value, e.g. "lbs", "min"
  agg: SetAgg; // how the field aggregates across the day's sets
  primary?: boolean; // when setValue is "primary", this field is the headline number
};

/** One logged set: fieldId → value. Legacy weighted sets are { w, r }. */
export type SetEntry = Record<string, number>;

/** Intensity colouring strategy when a habit has multiple metrics. */
export type IntensityMode = "total" | "coverage";

type MetricBase = {
  id: string;
  name: string;
  unit: string;
};

/** A metric stored as one number per day: a plain amount, or with mode
 *  "done" a binary daily check-off (stored as 0/1). */
export type ValueMetric = MetricBase & { mode?: "done" };

/** A metric stored as a list of sets per day. */
export type SetsMetric = MetricBase & {
  mode: "sets";
  /** Weight unit the weighted schema was created with, e.g. "lbs" | "kg". */
  weightUnit?: string;
  /** Per-set fields, e.g. [weight, reps]. */
  setFields: SetField[];
  /** Headline value: "volume" (Σ of per-set field products) or the "primary" field's agg. */
  setValue: "volume" | "primary";
};

/** A single thing measured within a habit. */
export type Metric = ValueMetric | SetsMetric;

export type Habit = {
  id: string;
  name: string;
  icon: IconId;
  description?: string;
  color: string;
  metrics: Metric[];
  intensityMode: IntensityMode;
  thresholds?: number[];
  /** The group the habit is in; absent when it's in none. */
  groupId?: string;
  /** How often it's due; absent when it's every day. */
  period?: Period;
};

/**
 * How often a habit is due: every `every` days or weeks. Its streak holds
 * while its logs are no more than that far apart.
 */
export type Period = { every: number; unit: "day" | "week" };

/** A named set of habits, shown as a section. A habit is in at most one. */
export type Group = {
  id: string;
  name: string;
  icon: IconId;
  /** Its section is folded shut. */
  collapsed: boolean;
};

/**
 * A routine's step for a habit: one of its metrics, done for a time (an
 * interval of `seconds`) or for a count (`count` of it, as long as that
 * takes). Both are kept, so switching between them loses neither.
 */
export type HabitStep = {
  kind: "habit";
  id: string;
  habitId: string;
  metricId: string;
  by: "time" | "count";
  seconds: number;
  count: number;
};
/** A timed break between a routine's habits. */
export type BreakStep = { kind: "break"; id: string; seconds: number };
export type RoutineStep = HabitStep | BreakStep;
/** Habits done one after another, with breaks between, for some rounds. */
export type Routine = {
  id: string;
  name: string;
  /** At least 1. */
  rounds: number;
  /** Seconds to get ready between Start and the first step; 0 for none. */
  prep: number;
  steps: RoutineStep[];
};

/** A named color palette (5 shades from empty → max intensity). */
export type Palette = { name: string; shades: string[] };

/** A configurable measurement unit with quick-add buttons + intensity thresholds. */
export type Unit = {
  id: string;
  label: string;
  quickAdd: number[];
  thresholds: number[];
};

/** A single day's entry for one habit: metricId → numeric value | sets. */
export type DayLog = Record<string, number | SetEntry[]>;

/** One habit's logs keyed by date (YYYY-MM-DD). */
export type HabitLogs = Record<string, DayLog>;

/** All logs: habitId → dateKey → DayLog. */
export type Logs = Record<string, HabitLogs>;

export type ThemeName = "dark" | "light";

/** The dashboard's view: each card down to its header, its quick-log a tap
 *  away (compact), or each with its calendar (calendar). */
export type DashView = "compact" | "calendar";

export type AppConfig = {
  numMonths: number;
  monthGap: number;
  theme: ThemeName;
  dashView: DashView;
};

/** Running timers keyed by "habitId:metricId" → start timestamp (ms). */
export type Timers = Record<string, number>;

/** The full persisted blob, complete and in the current format. Stored or
 *  imported data becomes one by passing through `normalizeState`. */
export type PersistedState = {
  /** Format version, written by `normalizeState`. */
  schemaVersion: number;
  habits: Habit[];
  logs: Logs;
  units: Unit[];
  config: AppConfig;
  /** In display order. */
  groups: Group[];
  /** In display order. */
  routines: Routine[];
  /** Running timers (absolute start timestamps) so they survive a reload. */
  timers?: Timers;
};
