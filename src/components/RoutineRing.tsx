// A routine's timer: an outer ring cut into every slot of the whole run, each
// in its habit's colour (breaks grey) and filling as the run goes through it,
// and a thick inner ring that drains through the current slot. A step done
// for a count has no time to fill by: its segment lights up while it's under
// way, and the inner ring sweeps round once a minute, like a stopwatch's hand.
import type { ReactNode } from "react";
import { arcs, slotProgress, type Phase, type Slot } from "../lib/routineRun";
import type { RoutineStep } from "../types";
import styles from "./RoutineRing.module.css";

type Props = {
  slots: Slot[];
  seconds: number;
  phase: Phase;
  colorOf: (step: RoutineStep) => string;
  /** A habit cut short: drawn unfilled. */
  skipped: (slot: Slot) => boolean;
  /** What's under way, in the middle. */
  children: ReactNode;
};

const SIZE = 300;
const MID = SIZE / 2;
const TAU = Math.PI * 2;
const OUTER = { r: MID - 13, width: 14 };
const INNER = { r: OUTER.r - 28, width: 26 };
/** The gap between slots, as a share of the turn. */
const GAP = 0.006;

export default function RoutineRing({
  slots,
  seconds,
  phase,
  colorOf,
  skipped,
  children,
}: Props) {
  const c = TAU * OUTER.r;
  const gap = slots.length > 1 ? GAP : 0;
  const current = phase.kind === "slot" ? phase.slot : undefined;
  const hand =
    phase.kind === "done"
      ? 1
      : phase.kind === "slot" && phase.slot.open
        ? (phase.elapsed % 60) / 60
        : 1 - phase.progress;
  const innerColor =
    phase.kind === "done" ? "var(--c-success)" : colorOf(phase.slot.step);
  return (
    <div className={styles.wrap}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={styles.svg}
        aria-hidden="true"
      >
        {arcs(slots).map(([from, to], i) => {
          const slot = slots[i];
          const len = Math.max(0, (to - from - gap) * c);
          const progress = skipped(slot)
            ? 0
            : slot === current && slot.open
              ? 1
              : slotProgress(slot, seconds);
          const color = colorOf(slot.step);
          const rotate = `rotate(${from * 360 - 90} ${MID} ${MID})`;
          const isCurrent = slot === current;
          return (
            <g
              key={slot.key}
              data-slot={slot.key}
              data-progress={progress}
              style={{ stroke: color, color }}
            >
              <circle
                cx={MID}
                cy={MID}
                r={OUTER.r}
                strokeWidth={OUTER.width}
                strokeDasharray={`${len} ${c}`}
                transform={rotate}
                className={`${styles.track} ${styles.butt}`}
              />
              {progress > 0 && (
                <circle
                  cx={MID}
                  cy={MID}
                  r={OUTER.r}
                  strokeWidth={OUTER.width}
                  strokeDasharray={`${len * progress} ${c}`}
                  transform={rotate}
                  className={`${styles.fill} ${styles.butt}${isCurrent ? ` ${styles.current}` : ""}${isCurrent && slot.open ? ` ${styles.underWay}` : ""}`}
                />
              )}
            </g>
          );
        })}
        <Ring {...INNER} color={innerColor} progress={hand} />
      </svg>
      <div className={styles.centre}>{children}</div>
    </div>
  );
}

/** The inner ring, filled from 12 o'clock clockwise to `progress`. */
function Ring({
  r,
  width,
  color,
  progress,
}: {
  r: number;
  width: number;
  color: string;
  progress: number;
}) {
  const c = TAU * r;
  return (
    <g
      data-ring="inner"
      data-progress={progress}
      style={{ stroke: color, color }}
    >
      <circle
        cx={MID}
        cy={MID}
        r={r}
        strokeWidth={width}
        className={styles.track}
      />
      {progress > 0 && (
        <circle
          cx={MID}
          cy={MID}
          r={r}
          strokeWidth={width}
          strokeDasharray={`${c * progress} ${c}`}
          transform={`rotate(-90 ${MID} ${MID})`}
          className={`${styles.fill} ${styles.current}`}
        />
      )}
    </g>
  );
}
