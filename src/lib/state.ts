import { reorderById } from "./reorder";
import type { AppConfig, Habit, Logs, Timers, Unit } from "../types";

/** Everything the app holds and saves. */
export type AppState = {
  habits: Habit[];
  logs: Logs;
  units: Unit[];
  config: AppConfig;
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
  | { type: "habit/reorder"; activeId: string; overId: string };

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
  }
}
