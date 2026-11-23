// The full-screen runner: the ring with what's under way in the middle (a
// countdown, or a counted step's count and stopwatch), the controls under it
// (Done in Pause's place while a counted step is under way), then the log: a
// section for each habit as the run reaches it, to enter its count or change
// what it logged. At the end the ring says so and Done takes the controls'
// place; the log stays, to finish entering or changing counts.
import { useState, type CSSProperties } from "react";
import { isSetMetric, primaryField } from "../lib/metrics";
import { byCount, captureFor, findStep, stepName } from "../lib/routines";
import {
  carriedFields,
  countUnit,
  fmtLogged,
  lastCount,
  loggedValue,
  todaySummary,
} from "../lib/routineLog";
import {
  fmtCountdown,
  fmtElapsed,
  logSlots,
  runLength,
  type Slot,
} from "../lib/routineRun";
import type { RoutineEngine } from "../hooks/useRoutineRun";
import type { Habit, Logs, Metric, SetEntry, ThemeName } from "../types";
import HabitIcon from "./HabitIcon";
import Icon, { type IconName } from "./Icon";
import RoutineRing from "./RoutineRing";
import { colorOf, stepColor } from "./routineColors";
import styles from "./RoutineRunner.module.css";

type Props = {
  engine: RoutineEngine;
  habits: Habit[];
  logs: Logs;
  theme: ThemeName;
  today: string;
  onMinimize: () => void;
};

export default function RoutineRunner({
  engine,
  habits,
  logs,
  theme,
  today,
  onMinimize,
}: Props) {
  const { routine, run, slots, seconds, phase, running, actions } = engine;
  if (!routine || !run) return null;

  const stepOf = (slot: Slot) =>
    slot.step.kind === "habit" ? findStep(habits, slot.step) : undefined;
  // Habits that ask for a count, and those ended whose count hasn't been
  // entered (or let go) yet.
  const asks = (s: Slot) => {
    const found = stepOf(s);
    return !!found && captureFor(found.metric) === "count";
  };
  const pending = slots.filter(
    (s) => asks(s) && s.end <= seconds && !run.results[s.key],
  );
  const paused = run.pausedAt !== undefined;
  const done = phase.kind === "done";
  const round = done ? routine.rounds : phase.slot.round + 1;
  const slot = done ? undefined : phase.slot;
  const found = slot && stepOf(slot);
  const next =
    phase.kind === "slot" ? slots[phase.index + 1] : done ? undefined : slot;
  const nextFound = next && stepOf(next);
  // A counted step under way is ended by Done, in Pause's place: nothing's
  // counting down to pause.
  const countUnderWay = phase.kind === "slot" && phase.slot.open && !paused;

  // The ring's picture: a habit's icon in its colour, or the run's own.
  const glyph = (
    found: { habit: Habit; metric: Metric } | undefined,
    otherwise: IconName,
    dim = false,
  ) => (
    <span
      className={`${styles.glyph}${dim ? ` ${styles.dim}` : ""}`}
      style={
        found
          ? ({ "--glyph-c": stepColor(found, theme) } as CSSProperties)
          : undefined
      }
    >
      {found ? (
        <HabitIcon icon={found.habit.icon} />
      ) : (
        <Icon name={otherwise} />
      )}
    </span>
  );

  const centre = (() => {
    if (phase.kind === "done" || !slot)
      return (
        <>
          {glyph(undefined, "party")}
          <span className={styles.clock}>{fmtElapsed(runLength(slots))}</span>
          <span className={styles.label}>Done</span>
        </>
      );
    if (phase.kind === "prep")
      return (
        <>
          {glyph(found, "stopwatch")}
          <span className={styles.clock}>{fmtCountdown(phase.remaining)}</span>
          <span className={styles.label}>Get ready</span>
        </>
      );
    if (slot.step.kind === "break")
      return (
        <>
          {glyph(nextFound, "hourglass", true)}
          <span className={styles.clock}>{fmtCountdown(phase.remaining)}</span>
          <span className={styles.label}>Break</span>
        </>
      );
    const name = found ? stepName(found.habit, found.metric) : "Habit gone";
    return (
      <>
        {glyph(found, "unknown")}
        <span className={styles.clock}>
          {slot.open ? slot.step.count : fmtCountdown(phase.remaining)}
        </span>
        <span className={styles.label}>{name}</span>
        {slot.open && (
          <span className={styles.stopwatch}>{fmtElapsed(phase.elapsed)}</span>
        )}
      </>
    );
  })();

  const status = (() => {
    if (done)
      return pending.length ? `${pending.length} to log below` : "all logged";
    if (phase.kind === "slot" && phase.slot.step.kind === "habit" && found)
      return `today · ${todaySummary(found.metric, logs[found.habit.id]?.[today])}`;
    if (nextFound)
      return `up next · ${stepName(nextFound.habit, nextFound.metric)}`;
    return next ? "up next · break" : "last one";
  })();

  const finish = () => {
    const left = pending.length;
    if (
      !left ||
      confirm(
        `${left === 1 ? "A habit has" : `${left} habits have`} no count yet. Finish without logging ${left === 1 ? "it" : "them"}?`,
      )
    )
      actions.end();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.top}>
        <button
          onClick={onMinimize}
          className={styles.iconBtn}
          title="Minimise: see your habits"
        >
          <Icon name="down" />
        </button>
        <div className={styles.titleBox}>
          <div className={styles.title}>{routine.name}</div>
          <div className={styles.sub}>
            {done
              ? `Finished · ${fmtElapsed(runLength(slots))} in all`
              : `Round ${round} of ${routine.rounds} · ${
                  routine.steps.some(byCount)
                    ? `${fmtElapsed(Math.max(0, seconds))} in`
                    : `${fmtCountdown(runLength(slots) - Math.max(0, seconds))} left`
                }`}
          </div>
        </div>
        {!done && (
          <button
            onClick={() => {
              if (confirm("End this routine? What's logged stays logged."))
                actions.end();
            }}
            className={styles.endBtn}
          >
            End
          </button>
        )}
      </div>

      <div className={styles.stage}>
        <RoutineRing
          slots={slots}
          seconds={seconds}
          phase={phase}
          colorOf={(step) => colorOf(step, habits, theme)}
          skipped={(s) => run.results[s.key]?.status === "skipped"}
        >
          <div className={styles.centreParts} data-testid="centre">
            {centre}
          </div>
        </RoutineRing>
        <div className={styles.controls}>
          <button onClick={actions.back} className={styles.ctl} title="Back">
            <Icon name="back" />
          </button>
          {done ? (
            <button
              onClick={finish}
              className={`${styles.ctl} ${styles.play} ${styles.finish} ${styles.close}`}
            >
              <Icon name="check" size={26} />
              Done
            </button>
          ) : countUnderWay ? (
            <button
              onClick={actions.done}
              className={`${styles.ctl} ${styles.play} ${styles.finish}`}
              title="Done"
            >
              <Icon name="check" size={30} />
            </button>
          ) : (
            <button
              onClick={running ? actions.pause : actions.resume}
              className={`${styles.ctl} ${styles.play}`}
              title={paused ? "Resume" : "Pause"}
            >
              <Icon name={paused ? "play" : "pause"} size={28} />
            </button>
          )}
          {done ? (
            // Holds Skip's place, so Done stays in the middle.
            <span className={`${styles.ctl} ${styles.spacer}`} aria-hidden />
          ) : (
            <button onClick={actions.next} className={styles.ctl} title="Skip">
              <Icon name="skip" />
            </button>
          )}
        </div>
        <RoundDots
          rounds={routine.rounds}
          current={done ? routine.rounds : round - 1}
        />
        <div className={styles.status}>{status}</div>
      </div>

      <ol className={styles.log} aria-label="Log">
        {logSlots(slots, seconds, asks).map((s) => (
          <LogSection
            key={s.key}
            slot={s}
            engine={engine}
            habits={habits}
            logs={logs}
            today={today}
            theme={theme}
          />
        ))}
      </ol>
    </div>
  );
}

function RoundDots({ rounds, current }: { rounds: number; current: number }) {
  if (rounds < 2) return null;
  return (
    <div className={styles.dots}>
      {Array.from({ length: rounds }, (_, i) => (
        <span
          key={i}
          className={`${styles.dot}${i < current ? ` ${styles.past}` : ""}${i === current ? ` ${styles.now}` : ""}`}
        />
      ))}
    </div>
  );
}

type SectionProps = {
  slot: Slot;
  engine: RoutineEngine;
  habits: Habit[];
  logs: Logs;
  today: string;
  theme: ThemeName;
};

/**
 * A habit's section of the log. One that asks for a count shows its entry
 * until it has one (or is let go); the rest, and those, a line with what was
 * logged, tapped to change it.
 */
function LogSection(props: SectionProps) {
  const { slot, engine, habits, theme } = props;
  const [editing, setEditing] = useState(false);
  const result = engine.run?.results[slot.key];
  const found =
    slot.step.kind === "habit" ? findStep(habits, slot.step) : undefined;
  if (!found) return null;
  const counts = captureFor(found.metric) === "count";
  if (counts && (!result || editing))
    return (
      <li>
        <CountEntry {...props} onDone={() => setEditing(false)} />
      </li>
    );
  const name = stepName(found.habit, found.metric);
  const round =
    engine.routine && engine.routine.rounds > 1 ? ` R${slot.round + 1}` : "";
  const color = { "--entry-c": stepColor(found, theme) } as CSSProperties;
  if (editing)
    return (
      <li>
        <LoggedEntry
          {...props}
          title={name}
          round={round}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  return (
    <li>
      <button
        onClick={() => setEditing(true)}
        aria-label={`Change ${name}${round}`}
        className={styles.logRow}
        style={color}
      >
        <span className={styles.logIcon}>
          <HabitIcon icon={found.habit.icon} />
        </span>
        <span className={styles.logName}>
          {name}
          <span className={styles.entryRound}>{round}</span>
        </span>
        {result?.status === "logged" ? (
          <span className={styles.logVal}>
            {result.text}
            {byCount(slot.step) && (
              <span className={styles.logTime}>
                {" "}
                in {fmtElapsed(slot.end - slot.start)}
              </span>
            )}
          </span>
        ) : (
          <span className={styles.logNone}>not logged</span>
        )}
        <span className={styles.logEdit}>Change</span>
      </button>
    </li>
  );
}

/** A habit that logs itself, opened from its line: take back what it logged,
 *  or log it again. */
function LoggedEntry({
  slot,
  engine,
  habits,
  theme,
  title,
  round,
  onDone,
}: SectionProps & { title: string; round: string; onDone: () => void }) {
  const found =
    slot.step.kind === "habit" ? findStep(habits, slot.step) : undefined;
  if (!found || slot.step.kind !== "habit") return null;
  const { metric } = found;
  const logged = engine.run?.results[slot.key]?.status === "logged";
  const value = loggedValue(metric, captureFor(metric), slot.step.seconds);
  const then = (act: () => void) => () => {
    act();
    onDone();
  };
  return (
    <div
      className={`${styles.entry} ${styles.entrySimple}`}
      style={{ "--entry-c": stepColor(found, theme) } as CSSProperties}
    >
      <span className={styles.entryHead}>
        <span className={styles.entryTitle}>
          <HabitIcon icon={found.habit.icon} size={16} />
          {title}
          <span className={styles.entryRound}>{round}</span>
        </span>
      </span>
      <div className={styles.entryActions}>
        <button onClick={onDone} className={styles.skipBtn}>
          Cancel
        </button>
        {logged ? (
          <button
            onClick={then(() => engine.actions.skipCount(slot))}
            className={styles.logBtn}
          >
            Remove
          </button>
        ) : (
          <button
            onClick={then(() => engine.actions.logCount(slot, value, {}))}
            className={styles.logBtn}
          >
            Log {fmtLogged(metric, value)}
          </button>
        )}
      </div>
    </div>
  );
}

/** How many of a habit were done, entered or changed; it logs to the habit. */
function CountEntry({
  slot,
  engine,
  habits,
  logs,
  today,
  theme,
  onDone,
}: SectionProps & {
  /** After it logs, takes back, or is left as it was. */
  onDone: () => void;
}) {
  const found =
    slot.step.kind === "habit" ? findStep(habits, slot.step) : undefined;
  const habitLogs = found ? (logs[found.habit.id] ?? {}) : {};
  const result = engine.run?.results[slot.key];
  const logged = result?.status === "logged" ? result : undefined;
  // Suggest what it logged, else its count in an earlier round, else the
  // habit's latest set.
  const earlier = engine.slots
    .filter((s) => s.stepIndex === slot.stepIndex && s.round < slot.round)
    .map((s) => engine.run?.results[s.key])
    .reverse()
    .find((r) => r?.status === "logged");
  const suggested =
    logged?.amount ??
    (earlier?.status === "logged" ? earlier.amount : undefined) ??
    (found ? lastCount(found.metric, habitLogs, today) : undefined);
  const [count, setCount] = useState(suggested ?? 0);
  const sets = found && isSetMetric(found.metric) ? found.metric : undefined;
  const extraFields = sets
    ? sets.setFields.filter((f) => f.id !== primaryField(sets).id)
    : [];
  const [extra, setExtra] = useState<SetEntry>(() =>
    logged?.set
      ? Object.fromEntries(extraFields.map((f) => [f.id, logged.set![f.id]]))
      : found
        ? carriedFields(found.metric, habitLogs, today)
        : {},
  );
  if (!found) return null;
  const { habit, metric } = found;
  const unit = countUnit(metric);
  const unchanged =
    !!logged &&
    count === logged.amount &&
    extraFields.every((f) => (extra[f.id] ?? 0) === (logged.set?.[f.id] ?? 0));
  const name = stepName(habit, metric);
  const bump = (n: number) => setCount((c) => Math.max(0, c + n));
  const underWay = slot.end > engine.seconds;
  const then = (act: () => void) => () => {
    act();
    onDone();
  };

  return (
    <div
      className={styles.entry}
      style={{ "--entry-c": stepColor(found, theme) } as CSSProperties}
    >
      <div className={styles.entryHead}>
        <span className={styles.entryTitle}>
          <HabitIcon icon={habit.icon} size={16} />
          How many {name.toLowerCase()}?
          {engine.routine && engine.routine.rounds > 1 && (
            <span className={styles.entryRound}> R{slot.round + 1}</span>
          )}
        </span>
        {logged ? (
          <span className={styles.entryDone}>logged</span>
        ) : result?.status === "skipped" ? (
          <span className={styles.entryMore}>not logged</span>
        ) : (
          underWay && <span className={styles.entryNow}>now</span>
        )}
      </div>
      <div className={styles.entryRow}>
        <button onClick={() => bump(-5)} className={styles.stepBtn}>
          −5
        </button>
        <button onClick={() => bump(-1)} className={styles.stepBtn}>
          −
        </button>
        <input
          inputMode="numeric"
          value={count || ""}
          placeholder="0"
          onFocus={(e) => e.target.select()}
          onChange={(e) =>
            setCount(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)
          }
          className={styles.countInput}
          aria-label={`${name} ${unit}`}
        />
        <button onClick={() => bump(1)} className={styles.stepBtn}>
          +
        </button>
        <button onClick={() => bump(5)} className={styles.stepBtn}>
          +5
        </button>
      </div>
      {extraFields.length > 0 && (
        <div className={styles.extraRow}>
          {extraFields.map((f) => (
            <label key={f.id} className={styles.extra}>
              {f.label}
              <input
                inputMode="numeric"
                value={extra[f.id] || ""}
                onChange={(e) =>
                  setExtra((x) => ({
                    ...x,
                    [f.id]:
                      parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
                  }))
                }
                className={styles.extraInput}
              />
              {f.unit}
            </label>
          ))}
        </div>
      )}
      <div className={styles.entryActions}>
        {result?.status === "skipped" ? (
          <button onClick={onDone} className={styles.skipBtn}>
            Cancel
          </button>
        ) : (
          <button
            onClick={then(() => engine.actions.skipCount(slot))}
            className={styles.skipBtn}
          >
            {logged ? "Remove" : "Don't log"}
          </button>
        )}
        {unchanged ? (
          <button onClick={onDone} className={styles.logBtn}>
            Done
          </button>
        ) : (
          <button
            onClick={then(() => engine.actions.logCount(slot, count, extra))}
            disabled={!(count > 0)}
            className={styles.logBtn}
          >
            {logged ? "Change to" : "Log"} {count || ""} {unit}
          </button>
        )}
      </div>
    </div>
  );
}
