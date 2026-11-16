import { useState } from "react";
import { doneMetric } from "../lib/metrics";
import ModalShell from "./ModalShell";
import HabitFormFields from "./HabitFormFields";
import type { Group, IntensityMode, Metric, Unit } from "../types";
import modal from "./modalForm.module.css";

export type NewHabit = {
  name: string;
  emoji: string;
  description: string;
  color: string;
  metrics: Metric[];
  intensityMode: IntensityMode;
  groupId?: string;
};

type Props = {
  onAdd: (h: NewHabit) => void;
  onClose: () => void;
  units: Unit[];
  onAddUnit: (u: Unit) => void;
  groups: Group[];
  onAddGroup: (g: Group) => void;
};

export default function AddHabitModal({
  onAdd,
  onClose,
  units,
  onAddUnit,
  groups,
  onAddGroup,
}: Props) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState("Green");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [intMode, setIntMode] = useState<IntensityMode>("total");
  const [groupId, setGroupId] = useState("");
  // Name is enough — a habit created without a metric defaults to a daily
  // check-off (one "done" metric). In total mode the count unit's thresholds
  // ([1,3,5]) put a marked day at the middle palette shade.
  const canCreate = !!name.trim();
  return (
    <ModalShell onClose={onClose}>
      {(requestClose) => (
        <>
          <h2 className={modal.title}>New Habit</h2>
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
            groupId={groupId}
            setGroupId={setGroupId}
            groups={groups}
            onAddGroup={onAddGroup}
          />
          <div className={modal.footer}>
            <button onClick={() => requestClose()} className={modal.cancelBtn}>
              Cancel
            </button>
            <button
              disabled={!canCreate}
              onClick={() => {
                const noMetrics = metrics.length === 0;
                onAdd({
                  name: name.trim(),
                  emoji,
                  description: desc.trim(),
                  color,
                  metrics: noMetrics ? [doneMetric()] : metrics,
                  intensityMode: intMode,
                  ...(groupId && { groupId }),
                });
                requestClose();
              }}
              className={modal.primaryBtn}
            >
              Create
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
