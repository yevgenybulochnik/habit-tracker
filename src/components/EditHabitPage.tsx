// A habit's form, on a page slid over the habits: opened by holding its card.
import { useState } from "react";
import { EVERY_DAY, isEveryDay } from "../lib/periods";
import HabitFormFields from "./HabitFormFields";
import PageShell, { type ClosePage } from "./PageShell";
import type { Group, Habit, IntensityMode, Metric, Unit } from "../types";
import actions from "./formActions.module.css";
import styles from "./EditHabitPage.module.css";

type Props = {
  habit: Habit;
  onSave: (h: Habit) => void;
  onDelete: (id: string) => void;
  onClose: ClosePage;
  units: Unit[];
  onAddUnit: (u: Unit) => void;
  groups: Group[];
  onAddGroup: (g: Group) => void;
};

export default function EditHabitPage({
  habit,
  onSave,
  onDelete,
  onClose,
  units,
  onAddUnit,
  groups,
  onAddGroup,
}: Props) {
  const [name, setName] = useState(habit.name);
  const [icon, setIcon] = useState(habit.icon);
  const [desc, setDesc] = useState(habit.description || "");
  const [color, setColor] = useState(habit.color);
  const [metrics, setMetrics] = useState<Metric[]>([...habit.metrics]);
  const [intMode, setIntMode] = useState<IntensityMode>(habit.intensityMode);
  const [groupId, setGroupId] = useState(habit.groupId ?? "");
  const [period, setPeriod] = useState(habit.period ?? EVERY_DAY);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canSave = !!name.trim() && metrics.length > 0;
  return (
    <PageShell title="Edit Habit" onBack={() => onClose()}>
      <HabitFormFields
        name={name}
        setName={setName}
        icon={icon}
        setIcon={setIcon}
        description={desc}
        setDescription={setDesc}
        color={color}
        setColor={setColor}
        metrics={metrics}
        setMetrics={setMetrics}
        intensityMode={intMode}
        setIntensityMode={setIntMode}
        units={units}
        onAddUnit={onAddUnit}
        groupId={groupId}
        setGroupId={setGroupId}
        groups={groups}
        onAddGroup={onAddGroup}
        period={period}
        setPeriod={setPeriod}
      />

      {/* Danger zone */}
      <div
        className={`${styles.danger}${confirmDelete ? ` ${styles.dangerActive}` : ""}`}
      >
        {confirmDelete ? (
          <div>
            <div className={styles.delTitle}>Delete "{habit.name}"?</div>
            <div className={styles.delDesc}>
              This will permanently remove the habit and all its logged data.
              This cannot be undone.
            </div>
            <div className={styles.dzRow}>
              <button
                onClick={() => setConfirmDelete(false)}
                className={styles.keepBtn}
              >
                Keep it
              </button>
              <button
                // Deleted as the page closes, so the habits slide back
                // without it.
                onClick={() => onClose(() => onDelete(habit.id))}
                className={styles.deleteBtn}
              >
                Delete Habit
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.idle}>
            <span className={styles.hint}>Remove this habit and all data</span>
            <button
              onClick={() => setConfirmDelete(true)}
              className={styles.delTrigger}
            >
              Delete habit
            </button>
          </div>
        )}
      </div>

      <div className={actions.footer}>
        <button onClick={() => onClose()} className={actions.cancelBtn}>
          Cancel
        </button>
        <button
          disabled={!canSave}
          onClick={() => {
            const { groupId: _g, period: _p, ...rest } = habit;
            onClose(() =>
              onSave({
                ...rest,
                name: name.trim(),
                icon,
                description: desc.trim(),
                color,
                metrics,
                intensityMode: intMode,
                ...(groupId && { groupId }),
                ...(!isEveryDay(period) && { period }),
              }),
            );
          }}
          className={actions.primaryBtn}
        >
          Save
        </button>
      </div>
    </PageShell>
  );
}
