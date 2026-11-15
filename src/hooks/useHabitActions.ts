import { createContext, useContext, useMemo, type Dispatch } from "react";
import type { Action } from "../lib/state";
import type { DayLog, SetEntry } from "../types";

/** App's reducer dispatch, for the components that change state. */
export const DispatchContext = createContext<Dispatch<Action> | null>(null);

/** The changes a habit card makes to its habit's logs and timers. */
export type HabitActions = {
  /** Write an exact entry for any day (the day editor). */
  saveDay: (dateKey: string, entry: DayLog) => void;
  /** The rest change today's entry. */
  add: (metricId: string, amount: number) => void;
  reset: (metricId: string) => void;
  addSet: (metricId: string, set: SetEntry) => void;
  removeSet: (metricId: string, index: number) => void;
  startTimer: (metricId: string) => void;
  stopTimer: (metricId: string) => void;
};

/**
 * One habit's actions, dispatched to App's reducer. `today` comes from App,
 * like everywhere else; the clock is read only for a timer's timestamp.
 */
export function useHabitActions(habitId: string, today: string): HabitActions {
  const dispatch = useContext(DispatchContext);
  if (!dispatch)
    throw new Error("useHabitActions needs a DispatchContext provider");
  return useMemo(() => {
    const onToday = (metricId: string) => ({
      habitId,
      metricId,
      dateKey: today,
    });
    return {
      saveDay: (dateKey, entry) =>
        dispatch({ type: "log/setDay", habitId, dateKey, entry }),
      add: (metricId, amount) =>
        dispatch({ type: "log/add", ...onToday(metricId), amount }),
      reset: (metricId) =>
        dispatch({ type: "log/reset", ...onToday(metricId) }),
      addSet: (metricId, set) =>
        dispatch({ type: "log/addSet", ...onToday(metricId), set }),
      removeSet: (metricId, index) =>
        dispatch({ type: "log/removeSet", ...onToday(metricId), index }),
      startTimer: (metricId) =>
        dispatch({ type: "timer/start", habitId, metricId, now: Date.now() }),
      stopTimer: (metricId) =>
        dispatch({
          type: "timer/stop",
          ...onToday(metricId),
          now: Date.now(),
        }),
    };
  }, [dispatch, habitId, today]);
}
