// The Routines page, slid over the habits from the header's stopwatch. It
// lists the routines (each with a ring of one round, coloured by habit) to
// start or edit, and has the editor as a page of its own.
import { Fragment, useState } from "react";
import { byCount, findStep, stepName } from "../lib/routines";
import {
  fmtCountdown,
  roundArcs,
  runLength,
  schedule,
} from "../lib/routineRun";
import { slide } from "../slide";
import type { Habit, Routine, ThemeName } from "../types";
import HabitIcon from "./HabitIcon";
import Icon from "./Icon";
import PageShell, { PageHeader } from "./PageShell";
import RoutineEditor, { newRoutine } from "./RoutineEditor";
import { colorOf } from "./routineColors";
import styles from "./RoutinesView.module.css";

type Props = {
  habits: Habit[];
  routines: Routine[];
  theme: ThemeName;
  /** The routine being run, if one is. */
  runningId: string | undefined;
  /** Save a new or changed routine. */
  onSave: (r: Routine) => void;
  onDelete: (id: string) => void;
  onStart: (r: Routine) => void;
  /** Bring the run back up. */
  onOpenRun: () => void;
  onBack: () => void;
};

export default function RoutinesView({
  habits,
  routines,
  theme,
  runningId,
  onSave,
  onDelete,
  onStart,
  onOpenRun,
  onBack,
}: Props) {
  const [editing, setEditing] = useState<Routine | null>(null);
  const isNew = !!editing && !routines.some((r) => r.id === editing.id);
  const toTop = () => window.scrollTo(0, 0);
  const edit = (r: Routine) => slide("forward", () => setEditing(r), toTop);
  const doneEditing = () => slide("back", () => setEditing(null), toTop);

  if (editing)
    return (
      <PageShell
        title={isNew ? "New routine" : "Edit routine"}
        subtitle="Each step logs to its habit"
        onBack={doneEditing}
      >
        <RoutineEditor
          routine={editing}
          isNew={isNew}
          habits={habits}
          theme={theme}
          onCancel={doneEditing}
          onSave={(r) => {
            onSave(r);
            doneEditing();
          }}
          onDelete={(id) => {
            onDelete(id);
            doneEditing();
          }}
        />
      </PageShell>
    );

  return (
    <div>
      <PageHeader
        title="Routines"
        subtitle={
          routines.length
            ? `${routines.length} routine${routines.length === 1 ? "" : "s"}`
            : "Habits back to back, with breaks"
        }
        onBack={onBack}
      >
        <button
          onClick={() => edit(newRoutine())}
          disabled={!habits.length}
          className={styles.newBtn}
        >
          <span className={styles.newBtnPlus}>+</span> New Routine
        </button>
      </PageHeader>

      {routines.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <Icon name="stopwatch" size={40} />
          </div>
          <div className={styles.emptyTitle}>No routines yet</div>
          <div className={styles.emptyHint}>
            A routine runs your habits one after another, with breaks between,
            and logs each one as you go.
            {!habits.length && " Add a habit to use in one first."}
          </div>
        </div>
      ) : (
        <>
          <ul className={styles.list}>
            {routines.map((r) => (
              <RoutineCard
                key={r.id}
                routine={r}
                habits={habits}
                theme={theme}
                running={runningId === r.id}
                otherRunning={!!runningId && runningId !== r.id}
                onEdit={() => edit(r)}
                onStart={() => onStart(r)}
                onOpenRun={onOpenRun}
              />
            ))}
          </ul>
          <div className={styles.footer}>tap a routine to edit it</div>
        </>
      )}
    </div>
  );
}

function RoutineCard({
  routine,
  habits,
  theme,
  running,
  otherRunning,
  onEdit,
  onStart,
  onOpenRun,
}: {
  routine: Routine;
  habits: Habit[];
  theme: ThemeName;
  running: boolean;
  otherRunning: boolean;
  onEdit: () => void;
  onStart: () => void;
  onOpenRun: () => void;
}) {
  const names = routine.steps.flatMap((s) => {
    if (s.kind !== "habit") return [];
    const f = findStep(habits, s);
    if (!f) return [];
    const name = stepName(f.habit, f.metric);
    return [
      {
        id: s.id,
        icon: f.habit.icon,
        text: s.by === "count" ? `${s.count} ${name}` : name,
      },
    ];
  });
  const r = 19;
  const c = 2 * Math.PI * r;
  // Each step's arc, a sliver short at its end so neighbours stay apart.
  const gap = routine.steps.length > 1 ? 2.5 : 0;

  return (
    <li className={styles.card}>
      <button
        onClick={onEdit}
        aria-label={`Edit ${routine.name}`}
        className={styles.cardMain}
      >
        <svg viewBox="0 0 48 48" className={styles.ring} aria-hidden="true">
          {roundArcs(routine).map(([from, to], i) => {
            const step = routine.steps[i];
            return (
              <circle
                key={step.id}
                cx="24"
                cy="24"
                r={r}
                className={styles.ringArc}
                style={{
                  stroke:
                    step.kind === "habit"
                      ? colorOf(step, habits, theme)
                      : "var(--c-borderLight)",
                }}
                strokeDasharray={`${Math.max(0.5, (to - from) * c - gap)} ${c}`}
                strokeDashoffset={-from * c}
                transform="rotate(-90 24 24)"
              />
            );
          })}
          <text x="24" y="28.5" textAnchor="middle" className={styles.ringText}>
            ×{routine.rounds}
          </text>
        </svg>
        <span className={styles.cardText}>
          <span className={styles.cardName}>{routine.name}</span>
          <span className={styles.cardMeta}>
            {routine.rounds} round{routine.rounds === 1 ? "" : "s"} ·{" "}
            {routine.steps.some(byCount)
              ? "at your pace"
              : fmtCountdown(runLength(schedule(routine)))}
          </span>
          <span className={styles.cardSteps}>
            {names.map((n, i) => (
              <Fragment key={n.id}>
                {i > 0 && " → "}
                <span className={styles.stepIcon}>
                  <HabitIcon icon={n.icon} size={11} />
                </span>
                {n.text}
              </Fragment>
            ))}
          </span>
        </span>
      </button>
      {running ? (
        <button onClick={onOpenRun} className={styles.openBtn}>
          Open
        </button>
      ) : (
        <button
          onClick={onStart}
          disabled={!names.length || otherRunning}
          aria-label={`Start ${routine.name}`}
          title={otherRunning ? "Another routine is running" : "Start"}
          className={styles.startBtn}
        >
          <Icon name="play" size={16} />
        </button>
      )}
    </li>
  );
}
