import { useState } from "react";
import { C, F } from "../constants";
import { doneMetric } from "../lib/metrics";
import ModalShell from "./ModalShell";
import HabitFormFields from "./HabitFormFields";
import type { IntensityMode, Metric, Unit } from "../types";

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
      <h2
        style={{
          margin: "0 0 20px",
          fontSize: 18,
          fontWeight: 600,
          color: C.text,
          fontFamily: F,
        }}
      >
        New Habit
      </h2>
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
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          onClick={hClose}
          style={{
            padding: "8px 18px",
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: "transparent",
            color: C.muted,
            cursor: "pointer",
            fontSize: 13,
            fontFamily: F,
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (canCreate) {
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
            }
          }}
          style={{
            padding: "8px 18px",
            borderRadius: 6,
            border: "none",
            background: canCreate ? C.accent : C.borderLight,
            color: canCreate ? "#fff" : C.dim,
            cursor: canCreate ? "pointer" : "not-allowed",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: F,
            transition: "all .2s",
          }}
        >
          Create
        </button>
      </div>
    </ModalShell>
  );
}
