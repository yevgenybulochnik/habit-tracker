// A routine being run. Its position is derived from timestamps (and from when
// each counted step was done), never from a ticking count, so a run survives a
// reload or the phone sleeping. Everything takes the time (`now`, ms) from the
// caller.
import { byCount } from "./routines";
import type { Routine, RoutineStep, SetEntry } from "../types";

/** One step as it falls in a run: its round, and when it starts and ends
 *  (seconds from the start of the first slot). */
export type Slot = {
  /** "round:stepIndex" */
  key: string;
  step: RoutineStep;
  stepIndex: number;
  round: number;
  start: number;
  /** Infinity for a counted step not yet done. */
  end: number;
  /** Its end isn't known yet: a counted step not yet done, or anything after
   *  one (whose start is Infinity too). */
  open: boolean;
};

/** When each counted step was done, by slot key, in seconds into the run. */
export type Ends = Record<string, number>;

/** Every slot of a run, in order, counted steps ending when `ends` says they
 *  were done. The last round's closing breaks are dropped: nothing follows. */
export function schedule(r: Routine, ends: Ends = {}): Slot[] {
  const slots: Slot[] = [];
  let t = 0;
  for (let round = 0; round < r.rounds; round++) {
    r.steps.forEach((step, stepIndex) => {
      const key = `${round}:${stepIndex}`;
      const done = ends[key];
      const end = !byCount(step)
        ? t + step.seconds
        : t !== Infinity && done !== undefined
          ? Math.max(t, done)
          : Infinity;
      slots.push({
        key,
        step,
        stepIndex,
        round,
        start: t,
        end,
        open: end === Infinity,
      });
      t = end;
    });
  }
  while (slots.length && slots[slots.length - 1].step.kind === "break")
    slots.pop();
  return slots;
}

/** The seconds of a routine's timed steps and breaks (its counted steps take
 *  as long as they take). */
export const timedSeconds = (r: Routine) =>
  schedule(r)
    .filter((s) => !byCount(s.step))
    .reduce((t, s) => t + s.step.seconds, 0);

/** When the last slot ends: Infinity while a counted step isn't done. */
export const runLength = (slots: Slot[]) =>
  slots.length ? slots[slots.length - 1].end : 0;

/** Where a run is: counting down to the first slot, in a slot, or over. */
export type Phase =
  | {
      kind: "prep";
      slot: Slot;
      remaining: number;
      /** 0 → 1 through the get-ready. */
      progress: number;
    }
  | {
      kind: "slot";
      index: number;
      slot: Slot;
      elapsed: number;
      /** Infinity in an open step. */
      remaining: number;
      /** 0 → 1 through the slot; 0 throughout an open step. */
      progress: number;
    }
  | { kind: "done" };

/** Where the run is `seconds` in, given its get-ready's length. */
export function phaseAt(slots: Slot[], seconds: number, prep = 0): Phase {
  if (!slots.length) return { kind: "done" };
  if (seconds < 0)
    return {
      kind: "prep",
      slot: slots[0],
      remaining: -seconds,
      progress: prep > 0 ? Math.max(0, 1 + seconds / prep) : 1,
    };
  const index = slots.findIndex((s) => seconds < s.end);
  if (index === -1) return { kind: "done" };
  const slot = slots[index];
  const elapsed = seconds - slot.start;
  const len = slot.end - slot.start;
  return {
    kind: "slot",
    index,
    slot,
    elapsed,
    remaining: len - elapsed,
    progress: elapsed / len,
  };
}

/** How far through a slot the run is, 0 → 1: none for an open step, as its
 *  end isn't known. */
export const slotProgress = (s: Slot, seconds: number) =>
  seconds <= s.start
    ? 0
    : Math.min(1, Math.max(0, (seconds - s.start) / (s.end - s.start)));

/** What a habit slot logged (with its set, for a sets metric, so it can be
 *  changed later), or that it was let go. */
export type Logged = {
  status: "logged";
  amount: number;
  text: string;
  set?: SetEntry;
};
export type Result = Logged | { status: "skipped" };

/** A run in progress. Its position is derived from the clock: see
 *  `runSeconds`. */
export type Run = {
  /** The routine as it was when the run started: changing it doesn't change
   *  the run. */
  routine: Routine;
  /** When the first slot starts (ms): the get-ready after Start. */
  startedAt: number;
  /** Set while paused. */
  pausedAt?: number;
  /** Time spent in earlier pauses. */
  pausedMs: number;
  /** Time skipped forward (or, negative, gone back). */
  shiftMs: number;
  /** When each counted step was done (or skipped). */
  ends: Ends;
  /** Each habit slot's outcome, by slot key. */
  results: Record<string, Result>;
  /** The last slot ended (and the end was cued). */
  finished?: boolean;
};

export const startRun = (routine: Routine, now: number): Run => ({
  routine,
  startedAt: now + routine.prep * 1000,
  pausedMs: 0,
  shiftMs: 0,
  ends: {},
  results: {},
});

/** Seconds since the first slot started (negative while getting ready). */
export const runSeconds = (run: Run, now: number) =>
  ((run.pausedAt ?? now) - run.startedAt - run.pausedMs + run.shiftMs) / 1000;

export const pauseRun = (run: Run, now: number): Run =>
  run.pausedAt !== undefined ? run : { ...run, pausedAt: now };

export function resumeRun(run: Run, now: number): Run {
  if (run.pausedAt === undefined) return run;
  const { pausedAt, ...rest } = run;
  return { ...rest, pausedMs: run.pausedMs + now - pausedAt };
}

/** Move the run to `seconds` in. */
const seek = (run: Run, seconds: number, now: number): Run => ({
  ...run,
  shiftMs: run.shiftMs + (seconds - runSeconds(run, now)) * 1000,
});

/** The counted step under way is done: it ends now. Anything else ends by the
 *  clock, so the run is returned as it is. */
export function finishCount(run: Run, slots: Slot[], now: number): Run {
  const secs = runSeconds(run, now);
  const p = phaseAt(slots, secs);
  if (p.kind !== "slot" || !p.slot.open) return run;
  return { ...run, ends: { ...run.ends, [p.slot.key]: secs } };
}

/** Jump to the next slot. A habit cut short logs nothing, unless it was
 *  logged already; a counted step ends where it stands. */
export function skipForward(run: Run, slots: Slot[], now: number): Run {
  const p = phaseAt(slots, runSeconds(run, now));
  if (p.kind === "done") return run;
  if (p.kind === "prep") return seek(run, 0, now);
  const results: Run["results"] =
    p.slot.step.kind === "habit" && !run.results[p.slot.key]
      ? { ...run.results, [p.slot.key]: { status: "skipped" } }
      : run.results;
  if (p.slot.open) return finishCount({ ...run, results }, slots, now);
  return seek({ ...run, results }, p.slot.end, now);
}

/** Restart the slot, or go back to the one before when only just into it
 *  (from the end, into the last). */
export function skipBack(run: Run, slots: Slot[], now: number): Run {
  const p = phaseAt(slots, runSeconds(run, now));
  if (p.kind === "prep") return run;
  const target =
    p.kind === "done"
      ? slots[slots.length - 1]
      : p.elapsed > 3 || p.index === 0
        ? p.slot
        : slots[p.index - 1];
  // Doing a skipped slot again can log it after all.
  const { [target.key]: was, ...others } = run.results;
  const results = was?.status === "skipped" ? others : run.results;
  // A counted step gone back to (or before) is open again.
  const from = slots.indexOf(target);
  const ends = Object.fromEntries(
    Object.entries(run.ends).filter(
      ([k]) => slots.findIndex((s) => s.key === k) < from,
    ),
  );
  return seek({ ...run, results, ends, finished: false }, target.start, now);
}

/**
 * The habit slots in the log, the newest first. One that `asks` for a count
 * joins as the timer reaches it, to enter the count early; the others join
 * once they've ended and logged themselves. A step done for a count joins
 * once it's done.
 */
export const logSlots = (
  slots: Slot[],
  seconds: number,
  asks: (s: Slot) => boolean,
): Slot[] =>
  slots
    .filter(
      (s) =>
        s.step.kind === "habit" &&
        !s.open &&
        (asks(s) ? s.start <= seconds : s.end <= seconds),
    )
    .reverse();

// ---- Drawing ----------------------------------------------------------------

/** "1:05": a countdown's time, a second shown until it's all gone. */
export function fmtCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A stopwatch's time: whole seconds gone. */
export const fmtElapsed = (seconds: number) =>
  fmtCountdown(Math.floor(seconds));

/**
 * Steps as [from, to] fractions of the turn, by their time; or, once there's a
 * counted step (whose time isn't known), a share each, a break half one.
 */
function shares(steps: RoutineStep[]): [number, number][] {
  const counted = steps.some(byCount);
  const size = (s: RoutineStep) =>
    !counted ? s.seconds : s.kind === "break" ? 0.5 : 1;
  const total = steps.reduce((t, s) => t + size(s), 0) || 1;
  let t = 0;
  return steps.map((s) => {
    const from = t / total;
    t += size(s);
    return [from, t / total];
  });
}

/** Each step of one round as [from, to] fractions of the turn, breaks and
 *  all: a routine's shape, for its card. */
export const roundArcs = (r: Routine) => shares(r.steps);

/** Each slot's share of the ring as [from, to] fractions of the turn. */
export const arcs = (slots: Slot[]) => shares(slots.map((s) => s.step));
