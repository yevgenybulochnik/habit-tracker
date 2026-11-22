// Runs a routine. It holds the run in progress (kept in localStorage, so it
// survives a reload), ticks every frame while the run is going to cue each
// change and log each habit that logs itself (minutes, a check-off) as it
// ends, and gives the runner its controls. Counts are logged when they're
// entered, at any point in the run, and can be changed or taken back after; a
// step done for a count logs its count at Done.
// App mounts it for as long as it's open, so a run goes on while minimised.
import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { cue, unlockAudio } from "../cues";
import { RUN_KEY } from "../lib/defaults";
import { normalizeRun } from "../lib/normalize";
import { captureFor, findStep } from "../lib/routines";
import {
  carriedFields,
  logActions,
  loggedResult,
  loggedValue,
  relogActions,
} from "../lib/routineLog";
import {
  finishCount,
  pauseRun,
  phaseAt,
  resumeRun,
  runSeconds,
  schedule,
  skipBack,
  skipForward,
  startRun,
  type Result,
  type Run,
  type Slot,
} from "../lib/routineRun";
import type { Action } from "../lib/state";
import type { Habit, Logs, Routine, SetEntry } from "../types";
import { useWakeLock } from "./useWakeLock";

function loadRun(): Run | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    return raw ? normalizeRun(JSON.parse(raw)) : null;
  } catch {
    return null; // unreadable: there's no run to pick up
  }
}

function saveRun(run: Run | null) {
  try {
    if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run));
    else localStorage.removeItem(RUN_KEY);
  } catch {
    // Storage full or blocked: the run lasts until a reload.
  }
}

type Deps = {
  habits: Habit[];
  logs: Logs;
  today: string;
  dispatch: Dispatch<Action>;
};

export function useRoutineRun({ habits, logs, today, dispatch }: Deps) {
  const [run, setRunState] = useState<Run | null>(loadRun);
  // The latest run, for the tick and the actions to read between renders.
  const runRef = useRef(run);
  const setRun = (next: Run | null) => {
    runRef.current = next;
    saveRun(next);
    setRunState(next);
  };
  const updateRun = (change: (r: Run) => Run) => {
    if (runRef.current) setRun(change(runRef.current));
  };

  const routine = run?.routine;
  const ends = run?.ends;
  const slots = useMemo(
    () => (routine ? schedule(routine, ends) : []),
    [routine, ends],
  );
  const [now, setNow] = useState(() => Date.now());

  // The tick reads the latest of these without restarting the frame loop.
  const latest = useRef({ habits, today, dispatch, slots });
  latest.current = { habits, today, dispatch, slots };
  const lastPhase = useRef<string | null>(null);
  const lastTick = useRef<string | null>(null);

  const running = !!run && run.pausedAt === undefined && !run.finished;
  useWakeLock(!!run && !run.finished);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = () => {
      const t = Date.now();
      tick(t);
      setNow(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // `tick` reads everything it needs through refs.
  }, [running]);

  function tick(t: number) {
    const run = runRef.current;
    if (!run || run.pausedAt !== undefined || run.finished) return;
    const { slots, habits, today, dispatch } = latest.current;
    const secs = runSeconds(run, t);
    const phase = phaseAt(slots, secs, run.routine.prep);

    // Log each ended habit slot that logs itself. Its result is recorded in
    // the same pass, so it can't be logged twice.
    let results: Record<string, Result> | null = null;
    for (const s of slots) {
      if (s.end > secs || s.step.kind !== "habit" || run.results[s.key])
        continue;
      const found = findStep(habits, s.step);
      results ??= { ...run.results };
      if (!found) {
        results[s.key] = { status: "skipped" }; // its habit was deleted
        continue;
      }
      const capture = captureFor(found.metric);
      if (capture === "count") continue; // waits for its count
      const value = loggedValue(found.metric, capture, s.step.seconds);
      for (const a of logActions(
        found.habit.id,
        found.metric,
        value,
        {},
        today,
      ))
        dispatch(a);
      results[s.key] = loggedResult(found.metric, value, {});
    }

    const key = phase.kind === "slot" ? String(phase.index) : phase.kind;
    const changed = lastPhase.current !== null && lastPhase.current !== key;
    lastPhase.current = key;
    if (phase.kind === "done") {
      if (changed) cue.done();
      setRun({ ...run, results: results ?? run.results, finished: true });
      return;
    }
    if (changed && phase.kind === "slot")
      (phase.slot.step.kind === "habit" ? cue.habit : cue.break)();
    const left = Math.ceil(phase.remaining);
    if (left >= 1 && left <= 3 && lastTick.current !== `${key}:${left}`) {
      lastTick.current = `${key}:${left}`;
      cue.tick();
    }
    if (results) setRun({ ...run, results });
  }

  const record = (slot: Slot, result: Result) =>
    updateRun((r) => ({ ...r, results: { ...r.results, [slot.key]: result } }));

  const actions = {
    start(routine: Routine) {
      unlockAudio();
      // From the get-ready, so the first step is cued even without one.
      lastPhase.current = "prep";
      setRun(startRun(routine, Date.now()));
    },
    pause: () => updateRun((r) => pauseRun(r, Date.now())),
    resume() {
      unlockAudio();
      updateRun((r) => resumeRun(r, Date.now()));
    },
    next: () => updateRun((r) => skipForward(r, slots, Date.now())),
    back: () => updateRun((r) => skipBack(r, slots, Date.now())),
    /** The counted step under way is done: it ends, and logs its count
     *  (unless it was logged already, before going back into it). */
    done() {
      const r = runRef.current;
      if (!r) return;
      const now = Date.now();
      const p = phaseAt(slots, runSeconds(r, now), r.routine.prep);
      if (p.kind !== "slot" || !p.slot.open || p.slot.step.kind !== "habit")
        return;
      const { step, key } = p.slot;
      let results = r.results;
      if (!results[key]) {
        const found = findStep(habits, step);
        if (found) {
          const { habit, metric } = found;
          const extra = carriedFields(metric, logs[habit.id] ?? {}, today);
          for (const a of logActions(
            habit.id,
            metric,
            step.count,
            extra,
            today,
          ))
            dispatch(a);
          results = {
            ...results,
            [key]: loggedResult(metric, step.count, extra),
          };
        } else results = { ...results, [key]: { status: "skipped" } };
      }
      setRun({ ...finishCount(r, slots, now), results });
    },
    /** Log the count entered for a habit slot, or change what it logged. */
    logCount(slot: Slot, count: number, extra: SetEntry) {
      if (slot.step.kind !== "habit" || !(count > 0)) return;
      const found = findStep(habits, slot.step);
      if (!found) return;
      const { habit, metric } = found;
      const was = runRef.current?.results[slot.key];
      const changes =
        was?.status === "logged"
          ? relogActions(
              habit.id,
              metric,
              was,
              count,
              extra,
              logs[habit.id]?.[today],
              today,
            )
          : logActions(habit.id, metric, count, extra, today);
      for (const a of changes) dispatch(a);
      record(slot, loggedResult(metric, count, extra));
    },
    /** Log nothing for a habit slot, taking back what it logged if it did. */
    skipCount(slot: Slot) {
      const was = runRef.current?.results[slot.key];
      const found =
        slot.step.kind === "habit" ? findStep(habits, slot.step) : undefined;
      if (was?.status === "logged" && found)
        for (const a of relogActions(
          found.habit.id,
          found.metric,
          was,
          0,
          {},
          logs[found.habit.id]?.[today],
          today,
        ))
          dispatch(a);
      record(slot, { status: "skipped" });
    },
    /** Close the run; what it logged stays logged. */
    end: () => setRun(null),
  };

  // Drawn from the clock while running; a paused run is frozen at pausedAt.
  const seconds = run ? runSeconds(run, running ? now : Date.now()) : 0;
  const phase = phaseAt(slots, seconds, routine?.prep);
  return { run, routine, slots, seconds, phase, running, actions };
}

export type RoutineEngine = ReturnType<typeof useRoutineRun>;
