import { useState } from "react";
import { doneMetric } from "../lib/metrics";
import ModalShell from "./ModalShell";
import HabitFormFields from "./HabitFormFields";
import type { IntensityMode, Metric, Unit } from "../types";
import modal from "./modalForm.module.css";

export type NewHabit = {
  name: string;
  emoji: string;
  description: string;
  color: string;
  metrics: Metric[];
  intensityMode: IntensityMode;
};

type Props = {
  onAdd: (h: NewHabit) => void;
  onClose: () => void;
  units: Unit[];
  onAddUnit: (u: Unit) => void;
};

export default function AddHabitModal({
  onAdd,
  onClose,
  units,
  onAddUnit,
}: Props) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState("Green");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [intMode, setIntMode] = useState<IntensityMode>("total");
  const [closing, setClosing] = useState(false);
  const hClose = () => {
    setClosing(true);
    setTimeout(onClose, 350);
  };
  // Name is enough — a habit created without a metric defaults to a daily
  // check-off (one "done" metric). In total mode the count unit's thresholds
  // ([1,3,5]) put a marked day at the middle palette shade.
  const canCreate = !!name.trim();
  return (
    <ModalShell onClose={hClose} closing={closing}>
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
      />
      <div className={modal.footer}>
        <button onClick={hClose} className={modal.cancelBtn}>
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
            });
            hClose();
          }}
          className={modal.primaryBtn}
        >
          Create
        </button>
      </div>
    </ModalShell>
  );
}
