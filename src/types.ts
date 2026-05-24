// Shared domain types for the habit tracker.

/** One logged set in a "sets"-mode metric: weight × reps. */
export type SetEntry = { w: number; r: number };

/** Intensity colouring strategy when a habit has multiple metrics. */
export type IntensityMode = "total" | "coverage";

/** A single thing measured within a habit. */
export type Metric = {
  id: string;
  name: string;
  unit: string;
  /** Present only for sets-mode metrics (weight × reps). */
  mode?: "sets";
  /** Weight unit for sets mode, e.g. "lbs" | "kg". */
  weightUnit?: string;
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

export type AppConfig = { numMonths: number; monthGap: number; autoBackup?: boolean };

/** Running timers keyed by "habitId:metricId" → start timestamp (ms). */
export type Timers = Record<string, number>;

/** The full persisted blob. */
export type PersistedState = {
  habits: Habit[];
  logs: Logs;
  units: Unit[];
  config: AppConfig;
};
