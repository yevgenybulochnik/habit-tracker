// A new habit's form, on a page slid over the habits.
import { useState } from "react";
import { doneMetric } from "../lib/metrics";
import HabitFormFields from "./HabitFormFields";
import PageShell, { type ClosePage } from "./PageShell";
import type { Group, IntensityMode, Metric, Unit } from "../types";
import actions from "./formActions.module.css";

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
  onClose: ClosePage;
  units: Unit[];
  onAddUnit: (u: Unit) => void;
  groups: Group[];
  onAddGroup: (g: Group) => void;
};

export default function NewHabitPage({
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
    <PageShell title="New Habit" onBack={() => onClose()}>
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
      <div className={actions.footer}>
        <button onClick={() => onClose()} className={actions.cancelBtn}>
          Cancel
        </button>
        <button
          disabled={!canCreate}
          onClick={() =>
            // Added as the page closes, so the habits slide back with it.
            onClose(() =>
              onAdd({
                name: name.trim(),
                emoji,
                description: desc.trim(),
                color,
                metrics: metrics.length === 0 ? [doneMetric()] : metrics,
                intensityMode: intMode,
                ...(groupId && { groupId }),
              }),
            )
          }
          className={actions.primaryBtn}
        >
          Create
        </button>
      </div>
    </PageShell>
  );
}
