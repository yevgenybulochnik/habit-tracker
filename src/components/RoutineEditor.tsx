// A routine's editor: its name, rounds and get-ready, and its steps in order,
// dragged into place by their grips. A step is a habit (one of its metrics,
// for a time or, if it's counted, for a count) or a break. A page of the
// Routines view, whose header gives its title and the way back.
import { useState, type CSSProperties } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { newId } from "../lib/ids";
import { reorderById } from "../lib/reorder";
import {
  byCount,
  captureFor,
  DEFAULT_COUNT,
  findStep,
  PREP_CHOICES,
  PREP_SECONDS,
  routineProblems,
  STEP_SECONDS,
  stepChoices,
} from "../lib/routines";
import { countUnit } from "../lib/routineLog";
import {
  fmtCountdown,
  runLength,
  schedule,
  timedSeconds,
} from "../lib/routineRun";
import type { Habit, HabitStep, Routine, RoutineStep } from "../types";
import Icon from "./Icon";
import form from "./modalForm.module.css";
import styles from "./RoutineEditor.module.css";

const CAPTURE_HINT = {
  count: "asks for the count",
  minutes: "logs the minutes",
  check: "checks it off",
} as const;
const COUNT_HINT = "logged at Done";

/** A new routine: blank, to be named and given its steps. */
export const newRoutine = (): Routine => ({
  id: newId("r"),
  name: "",
  rounds: 1,
  prep: PREP_SECONDS,
  steps: [],
});

/** A new habit step, its habit still to be chosen. */
const newHabitStep = (): HabitStep => ({
  kind: "habit",
  id: newId("s"),
  habitId: "",
  metricId: "",
  by: "time",
  seconds: 60,
  count: DEFAULT_COUNT,
});

type Props = {
  routine: Routine;
  isNew: boolean;
  habits: Habit[];
  onCancel: () => void;
  onSave: (r: Routine) => void;
  onDelete: (id: string) => void;
};

export default function RoutineEditor({
  routine,
  isNew,
  habits,
  onCancel,
  onSave,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState(routine);
  const choices = stepChoices(habits);
  const setSteps = (steps: RoutineStep[]) => setDraft((d) => ({ ...d, steps }));
  const change = (i: number, step: RoutineStep) =>
    setSteps(draft.steps.map((s, j) => (j === i ? step : s)));
  const sensors = useStepSensors();
  const problems = routineProblems(draft, habits);
  const timed = timedSeconds(draft);
  const length = !draft.steps.some(byCount)
    ? `${fmtCountdown(runLength(schedule(draft)))} in all`
    : timed
      ? `Counted steps at your own pace, and ${fmtCountdown(timed)} of timed steps`
      : "Counted steps at your own pace";

  return (
    <>
      <label className={styles.lbl}>
        Name
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="e.g. Morning routine"
          className={styles.inp}
        />
      </label>
      <div className={styles.roundsRow}>
        <span className={styles.lblText}>Rounds</span>
        <button
          onClick={() =>
            setDraft({ ...draft, rounds: Math.max(1, draft.rounds - 1) })
          }
          className={styles.smallBtn}
          aria-label="Fewer rounds"
        >
          −
        </button>
        <span className={styles.rounds} aria-label="Rounds">
          {draft.rounds}
        </span>
        <button
          onClick={() => setDraft({ ...draft, rounds: draft.rounds + 1 })}
          className={styles.smallBtn}
          aria-label="More rounds"
        >
          +
        </button>
      </div>
      <div className={styles.roundsRow}>
        <span className={styles.lblText}>Get ready</span>
        <select
          value={draft.prep}
          onChange={(e) => setDraft({ ...draft, prep: Number(e.target.value) })}
          className={`${styles.sel} ${styles.secs}`}
          aria-label="Get ready"
        >
          {PREP_CHOICES.map((d) => (
            <option key={d} value={d}>
              {d ? fmtCountdown(d) : "Off"}
            </option>
          ))}
        </select>
        <span className={styles.capture}>before the first step</span>
      </div>

      <div className={styles.lblText}>Steps</div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (over && active.id !== over.id)
            setSteps(
              reorderById(draft.steps, String(active.id), String(over.id)),
            );
        }}
      >
        <SortableContext
          items={draft.steps.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className={styles.steps} aria-label="Steps">
            {draft.steps.map((s, i) => (
              <StepRow
                key={s.id}
                step={s}
                choices={choices}
                habits={habits}
                onChange={(step) => change(i, step)}
                onRemove={() => setSteps(draft.steps.filter((_, j) => j !== i))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {draft.steps.length === 0 && (
        <p className={styles.noSteps}>
          Add habits and breaks in the order you'll do them.
        </p>
      )}
      <div className={styles.listActions}>
        <button
          onClick={() => setSteps([...draft.steps, newHabitStep()])}
          className={styles.smallBtn}
        >
          + Habit
        </button>
        <button
          onClick={() =>
            setSteps([
              ...draft.steps,
              { kind: "break", id: newId("s"), seconds: 30 },
            ])
          }
          className={styles.smallBtn}
        >
          + Break
        </button>
      </div>
      <p className={styles.hint}>
        {problems.length
          ? `To save it, ${problems.join(" and ")}.`
          : `${length}. The last round skips its closing break.`}
      </p>
      <div className={form.footer}>
        {!isNew && (
          <button
            onClick={() => {
              if (
                confirm(`Delete ${routine.name}? What it logged stays logged.`)
              )
                onDelete(routine.id);
            }}
            className={`${form.cancelBtn} ${styles.deleteBtn}`}
          >
            Delete
          </button>
        )}
        <button onClick={onCancel} className={form.cancelBtn}>
          Cancel
        </button>
        <button
          onClick={() => onSave({ ...draft, name: draft.name.trim() })}
          disabled={problems.length > 0}
          className={form.primaryBtn}
        >
          Save
        </button>
      </div>
    </>
  );
}

/**
 * Drags start from a step's grip only, so its menus still work. Unlike the
 * habit cards (held to pick up, as the whole header is the drag region and
 * has to scroll), the grip takes no part in scrolling (touch-action: none),
 * so a short move picks the step up straight away.
 */
function useStepSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}

function StepRow({
  step,
  choices,
  habits,
  onChange,
  onRemove,
}: {
  step: RoutineStep;
  choices: ReturnType<typeof stepChoices>;
  habits: Habit[];
  onChange: (step: RoutineStep) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });
  const style: CSSProperties = {
    // Translate only: steps differ in height (see SortableHabitCard).
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const found = step.kind === "habit" ? findStep(habits, step) : undefined;
  const chosen =
    step.kind === "habit"
      ? choices.findIndex(
          (x) => x.habitId === step.habitId && x.metricId === step.metricId,
        )
      : -1;
  const time = (
    <select
      value={step.seconds}
      onChange={(e) => onChange({ ...step, seconds: Number(e.target.value) })}
      className={`${styles.sel} ${styles.secs}`}
      aria-label="Time"
    >
      {STEP_SECONDS.map((d) => (
        <option key={d} value={d}>
          {fmtCountdown(d)}
        </option>
      ))}
    </select>
  );
  const remove = (
    <button onClick={onRemove} className={styles.remove} aria-label="Remove">
      ×
    </button>
  );
  const grip = (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Move ${step.kind === "habit" ? (choices[chosen]?.label ?? "habit") : "break"}`}
      className={styles.grip}
    >
      <Icon name="grip" size={18} />
    </button>
  );
  const className = [
    styles.step,
    step.kind === "break" ? styles.break : styles.work,
    isDragging ? styles.dragging : "",
  ].join(" ");

  if (step.kind === "break")
    return (
      <li ref={setNodeRef} style={style} className={className}>
        {grip}
        <div className={styles.stepSub}>
          <span className={styles.breakLabel}>😮‍💨 Break</span>
          {time}
        </div>
        {remove}
      </li>
    );

  const metric = found?.metric;
  const counted = !!metric && captureFor(metric) === "count";
  // A counted step's other way, by its unit: "Reps", "Pages".
  const unit = metric ? countUnit(metric) : "";
  const unitName = unit.charAt(0).toUpperCase() + unit.slice(1) || "Count";
  return (
    <li ref={setNodeRef} style={style} className={className}>
      {grip}
      <select
        value={chosen}
        onChange={(e) => {
          const { habitId, metricId } = choices[Number(e.target.value)];
          const next = { ...step, habitId, metricId };
          const m = findStep(habits, next)?.metric;
          // Only a counted habit can be done for a count.
          onChange({
            ...next,
            by: m && captureFor(m) === "count" ? step.by : "time",
          });
        }}
        className={styles.sel}
        aria-label="Habit"
      >
        {chosen === -1 && (
          <option value={-1} disabled>
            Choose a habit
          </option>
        )}
        {choices.map((x, j) => (
          <option key={`${x.habitId}:${x.metricId}`} value={j}>
            {x.label}
          </option>
        ))}
      </select>
      {remove}
      <div className={styles.stepSub}>
        {counted && (
          <div className={styles.by} role="group" aria-label="Done by">
            {(["time", "count"] as const).map((by) => (
              <button
                key={by}
                onClick={() => onChange({ ...step, by })}
                aria-pressed={step.by === by}
                className={`${styles.byBtn}${step.by === by ? ` ${styles.on}` : ""}`}
              >
                {by === "time" ? "Time" : unitName}
              </button>
            ))}
          </div>
        )}
        {step.by === "count" ? (
          <label className={styles.count}>
            <input
              inputMode="numeric"
              value={step.count || ""}
              placeholder="0"
              onFocus={(e) => e.target.select()}
              onChange={(e) =>
                onChange({
                  ...step,
                  count: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
                })
              }
              className={`${styles.sel} ${styles.countInput}`}
              aria-label="Count"
            />
            {unit}
          </label>
        ) : (
          time
        )}
        {metric && (
          <span className={styles.capture}>
            {step.by === "count"
              ? COUNT_HINT
              : CAPTURE_HINT[captureFor(metric)]}
          </span>
        )}
      </div>
    </li>
  );
}
