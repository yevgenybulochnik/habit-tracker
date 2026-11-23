// A minimised run: a button in the corner with the current step's icon in a
// small ring and its time left (a counted step's stopwatch), tapped to bring
// the runner back.
import type { CSSProperties, ReactNode } from "react";
import { fmtCountdown, fmtElapsed } from "../lib/routineRun";
import type { RoutineEngine } from "../hooks/useRoutineRun";
import type { Habit, ThemeName } from "../types";
import { findStep } from "../lib/routines";
import { colorOf } from "./routineColors";
import HabitIcon from "./HabitIcon";
import Icon from "./Icon";
import styles from "./RoutinePill.module.css";

type Props = {
  engine: RoutineEngine;
  habits: Habit[];
  theme: ThemeName;
  onOpen: () => void;
};

export default function RoutinePill({ engine, habits, theme, onOpen }: Props) {
  const { phase } = engine;
  const r = 15;
  const c = 2 * Math.PI * r;
  let progress = 1;
  let color = "var(--c-success)";
  let icon: ReactNode = <Icon name="party" size={16} />;
  let label = "Done";
  if (phase.kind !== "done") {
    const step = phase.slot.step;
    const found = step.kind === "habit" ? findStep(habits, step) : undefined;
    color =
      phase.kind === "prep" ? "var(--c-muted)" : colorOf(step, habits, theme);
    icon =
      step.kind === "break" ? (
        <Icon name="hourglass" size={16} />
      ) : found ? (
        <HabitIcon icon={found.habit.icon} size={16} />
      ) : (
        <Icon name="unknown" size={16} />
      );
    const counting = phase.kind === "slot" && phase.slot.open;
    progress = counting ? (phase.elapsed % 60) / 60 : phase.progress;
    label = counting
      ? fmtElapsed(phase.elapsed)
      : fmtCountdown(phase.remaining);
  }
  return (
    <button
      onClick={onOpen}
      className={styles.pill}
      title="Back to the routine"
      style={{ "--pill-c": color } as CSSProperties}
    >
      <span className={styles.dial}>
        <svg viewBox="0 0 36 36" className={styles.pillRing} aria-hidden="true">
          <circle cx="18" cy="18" r={r} className={styles.pillTrack} />
          <circle
            cx="18"
            cy="18"
            r={r}
            strokeDasharray={`${c * progress} ${c}`}
            transform="rotate(-90 18 18)"
            className={styles.pillFill}
          />
        </svg>
        <span className={styles.pillIcon}>{icon}</span>
      </span>
      <span className={styles.pillTime}>
        {engine.run?.pausedAt !== undefined ? "Paused " : ""}
        {label}
      </span>
    </button>
  );
}
