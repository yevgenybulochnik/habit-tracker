// Shared domain types for the habit tracker.

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

/** A single thing measured within a habit. */
export type Metric = {
  id: string;
  name: string;
  unit: string;
  /** Present only for sets-mode metrics (a list of sets per day). */
  mode?: "sets";
  /** Weight unit for the default weighted schema, e.g. "lbs" | "kg". */
  weightUnit?: string;
  /** Per-set fields. Absent ⇒ the default weighted [weight, reps] schema. */
  setFields?: SetField[];
  /** Headline value: "volume" (Σ of per-set field products) or the "primary" field's agg. */
  setValue?: "volume" | "primary";
};

export type Habit = {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  color: string;
  metrics: Metric[];
  intensityMode?: IntensityMode;
  thresholds?: number[];
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

export type DashView = "quick" | "calendar";

export type AppConfig = { numMonths: number; monthGap: number; theme?: ThemeName; dashView?: DashView };

/** Running timers keyed by "habitId:metricId" → start timestamp (ms). */
export type Timers = Record<string, number>;

/** The full persisted blob. */
export type PersistedState = {
  habits: Habit[];
  logs: Logs;
  units: Unit[];
  config: AppConfig;
  /** Running timers (absolute start timestamps) so they survive a reload. */
  timers?: Timers;
};
