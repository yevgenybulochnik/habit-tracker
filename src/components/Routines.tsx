// The routines, over the habits: the Routines page while it's open (the
// header's stopwatch), and a run over everything, full screen or minimised to
// a button (its ring and time) so the habit cards can be watched filling in as
// it logs. It holds the run, so it's mounted for as long as the app is.
import { useState, type Dispatch } from "react";
import { useRoutineRun } from "../hooks/useRoutineRun";
import type { Action } from "../lib/state";
import type { Habit, Logs, Routine, ThemeName } from "../types";
import RoutinePill from "./RoutinePill";
import RoutineRunner from "./RoutineRunner";
import RoutinesView from "./RoutinesView";

type Props = {
  habits: Habit[];
  logs: Logs;
  routines: Routine[];
  theme: ThemeName;
  today: string;
  dispatch: Dispatch<Action>;
  /** The Routines page is up, in place of the habits. */
  open: boolean;
  onBack: () => void;
};

export default function Routines({
  habits,
  logs,
  routines,
  theme,
  today,
  dispatch,
  open,
  onBack,
}: Props) {
  const engine = useRoutineRun({ habits, logs, today, dispatch });
  const [minimized, setMinimized] = useState(false);
  const running = engine.routine;

  return (
    <>
      {open && (
        <RoutinesView
          habits={habits}
          routines={routines}
          theme={theme}
          runningId={running?.id}
          onSave={(routine) =>
            dispatch({
              type: routines.some((r) => r.id === routine.id)
                ? "routine/update"
                : "routine/add",
              routine,
            })
          }
          onDelete={(id) => dispatch({ type: "routine/delete", id })}
          onStart={(routine) => {
            engine.actions.start(routine);
            setMinimized(false);
          }}
          onOpenRun={() => setMinimized(false)}
          onBack={onBack}
        />
      )}
      {running && minimized && (
        <RoutinePill
          engine={engine}
          habits={habits}
          theme={theme}
          onOpen={() => setMinimized(false)}
        />
      )}
      {running && !minimized && (
        <RoutineRunner
          engine={engine}
          habits={habits}
          logs={logs}
          theme={theme}
          today={today}
          onMinimize={() => setMinimized(true)}
        />
      )}
    </>
  );
}
