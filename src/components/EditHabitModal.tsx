import { useState } from "react";
import ModalShell from "./ModalShell";
import HabitFormFields from "./HabitFormFields";
import type { Habit, IntensityMode, Metric, Unit } from "../types";
import modal from "./modalForm.module.css";
import styles from "./EditHabitModal.module.css";

type Props = {
  habit: Habit;
  onSave: (h: Habit) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  units: Unit[];
  onAddUnit: (u: Unit) => void;
};

export default function EditHabitModal({
  habit,
  onSave,
  onDelete,
  onClose,
  units,
  onAddUnit,
}: Props) {
  const [name, setName] = useState(habit.name);
  const [emoji, setEmoji] = useState(habit.emoji);
  const [desc, setDesc] = useState(habit.description || "");
  const [color, setColor] = useState(habit.color);
  const [metrics, setMetrics] = useState<Metric[]>([...habit.metrics]);
  const [intMode, setIntMode] = useState<IntensityMode>(habit.intensityMode);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canSave = !!name.trim() && metrics.length > 0;
  return (
    <ModalShell onClose={onClose}>
      {(requestClose) => (
        <>
          <h2 className={modal.title}>Edit Habit</h2>
          <HabitFormFields
            name={name}
            setName={setName}
            emoji={emoji}
            setEmoji={setEmoji}
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
          />

          {/* Danger zone */}
          <div
            className={`${styles.danger}${confirmDelete ? ` ${styles.dangerActive}` : ""}`}
          >
            {confirmDelete ? (
              <div>
                <div className={styles.delTitle}>Delete "{habit.name}"?</div>
                <div className={styles.delDesc}>
                  This will permanently remove the habit and all its logged
                  data. This cannot be undone.
                </div>
                <div className={styles.dzRow}>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className={styles.keepBtn}
                  >
                    Keep it
                  </button>
                  <button
                    // Delete once the modal has animated out, so the card
                    // stays behind it until then
                    onClick={() => requestClose(() => onDelete(habit.id))}
                    className={styles.deleteBtn}
                  >
                    Delete Habit
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.idle}>
                <span className={styles.hint}>
                  Remove this habit and all data
                </span>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className={styles.delTrigger}
                >
                  Delete habit
                </button>
              </div>
            )}
          </div>

          <div className={modal.footer}>
            <button onClick={() => requestClose()} className={modal.cancelBtn}>
              Cancel
            </button>
            <button
              disabled={!canSave}
              onClick={() => {
                onSave({
                  ...habit,
                  name: name.trim(),
                  emoji,
                  description: desc.trim(),
                  color,
                  metrics,
                  intensityMode: intMode,
                });
                requestClose();
              }}
              className={modal.primaryBtn}
            >
              Save
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
