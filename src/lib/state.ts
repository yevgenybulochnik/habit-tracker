import { setDayLog } from "./logs";
import { reorderById } from "./reorder";
import type {
  AppConfig,
  DayLog,
  Group,
  Habit,
  Logs,
  PersistedState,
  SetEntry,
  Timers,
  Unit,
} from "../types";

/** Everything the app holds and saves. */
export type AppState = {
  habits: Habit[];
  logs: Logs;
  units: Unit[];
  config: AppConfig;
  groups: Group[];
  timers: Timers;
};

/**
 * Every change to `AppState`. Anything that isn't a function of the state,
 * such as a new id, is worked out by the caller and carried in the action.
 */
export type Action =
  | { type: "habit/add"; id: string; habit: Omit<Habit, "id"> }
  | { type: "habit/update"; habit: Habit }
  | { type: "habit/delete"; id: string }
  | { type: "habit/reorder"; activeId: string; overId: string }
  | { type: "log/setDay"; habitId: string; dateKey: string; entry: DayLog }
  | ({ type: "log/add"; amount: number } & MetricDay)
  | ({ type: "log/reset" } & MetricDay)
  | ({ type: "log/addSet"; set: SetEntry } & MetricDay)
  | ({ type: "log/removeSet"; index: number } & MetricDay)
  | { type: "timer/start"; habitId: string; metricId: string; now: number }
  | ({ type: "timer/stop"; now: number } & MetricDay)
  | { type: "unit/add"; unit: Unit }
  | { type: "unit/update"; id: string; changes: Partial<Unit> }
  | { type: "unit/delete"; id: string }
  | { type: "config/update"; changes: Partial<AppConfig> }
  /** State read from storage, running timers included. */
  | { type: "state/load"; state: PersistedState }
  /** A backup replacing everything; its timers are long stale. */
  | { type: "state/import"; state: PersistedState };

/** One metric of one habit on one day. */
type MetricDay = { habitId: string; metricId: string; dateKey: string };

/**
 * Apply one action, returning new state and leaving the old untouched. It must
 * stay pure: React calls it twice in development to check.
 */
export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "habit/add":
      return {
        ...state,
        habits: [...state.habits, { id: action.id, ...action.habit }],
        logs: { ...state.logs, [action.id]: {} },
      };
    case "habit/update":
      return {
        ...state,
        habits: state.habits.map((h) =>
          h.id === action.habit.id ? action.habit : h,
        ),
      };
    case "habit/delete": {
      const { [action.id]: _, ...logs } = state.logs;
      return {
        ...state,
        habits: state.habits.filter((h) => h.id !== action.id),
        logs,
        timers: Object.fromEntries(
          Object.entries(state.timers).filter(
            ([key]) => !key.startsWith(`${action.id}:`),
          ),
        ),
      };
    }
    case "habit/reorder":
      return {
        ...state,
        habits: reorderById(state.habits, action.activeId, action.overId),
      };

    case "log/setDay":
      return {
        ...state,
        logs: setDayLog(
          state.logs,
          action.habitId,
          action.dateKey,
          action.entry,
        ),
      };
    case "log/add":
      return changeMetric(state, action, (v) => numberOf(v) + action.amount);
    case "log/reset":
      return changeMetric(state, action, () => 0);
    case "log/addSet":
      return changeMetric(state, action, (v) => [...setsOf(v), action.set]);
    case "log/removeSet":
      return changeMetric(state, action, (v) =>
        setsOf(v).filter((_, i) => i !== action.index),
      );

    case "timer/start": {
      const key = timerKey(action.habitId, action.metricId);
      return { ...state, timers: { ...state.timers, [key]: action.now } };
    }
    case "timer/stop": {
      const key = timerKey(action.habitId, action.metricId);
      const start = state.timers[key];
      if (start === undefined) return state;
      const { [key]: _, ...timers } = state.timers;
      const mins = Math.max(1, Math.round((action.now - start) / 60_000));
      return changeMetric(
        { ...state, timers },
        action,
        (v) => numberOf(v) + mins,
      );
    }

    case "unit/add":
      if (state.units.some((u) => u.id === action.unit.id)) return state;
      return { ...state, units: [...state.units, action.unit] };
    case "unit/update":
      return {
        ...state,
        units: state.units.map((u) =>
          u.id === action.id ? { ...u, ...action.changes } : u,
        ),
      };
    case "unit/delete":
      return { ...state, units: state.units.filter((u) => u.id !== action.id) };
    case "config/update":
      return { ...state, config: { ...state.config, ...action.changes } };

    case "state/load":
    case "state/import": {
      const { habits, logs, units, config, groups, timers = {} } = action.state;
      return {
        habits,
        logs,
        units,
        config,
        groups,
        timers: action.type === "state/load" ? timers : {},
      };
    }
  }
}

/** Where a metric's running timer is kept in `Timers`. */
export const timerKey = (habitId: string, metricId: string) =>
  `${habitId}:${metricId}`;

type MetricValue = DayLog[string] | undefined;

const numberOf = (v: MetricValue) => (typeof v === "number" ? v : 0);
const setsOf = (v: MetricValue) => (Array.isArray(v) ? v : []);

/** Replace one metric's value on one day, given its current value. */
function changeMetric(
  state: AppState,
  { habitId, metricId, dateKey }: MetricDay,
  change: (value: MetricValue) => DayLog[string],
): AppState {
  const day = state.logs[habitId]?.[dateKey] ?? {};
  const entry = { ...day, [metricId]: change(day[metricId]) };
  return { ...state, logs: setDayLog(state.logs, habitId, dateKey, entry) };
}
