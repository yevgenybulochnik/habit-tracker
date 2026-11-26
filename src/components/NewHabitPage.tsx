// A new habit's form, on a page slid over the habits.
import { useState } from "react";
import { doneMetric } from "../lib/metrics";
import { DEFAULT_HABIT_ICON } from "../lib/icons";
import { EVERY_DAY, isEveryDay } from "../lib/periods";
import type { IconId } from "../lib/icons";
import HabitFormFields from "./HabitFormFields";
import PageShell, { type ClosePage } from "./PageShell";
import type { Group, IntensityMode, Metric, Period, Unit } from "../types";
import actions from "./formActions.module.css";

export type NewHabit = {
  name: string;
  icon: IconId;
  description: string;
  color: string;
  metrics: Metric[];
  intensityMode: IntensityMode;
  groupId?: string;
  period?: Period;
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
  const [icon, setIcon] = useState<IconId>(DEFAULT_HABIT_ICON);
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState("Green");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [intMode, setIntMode] = useState<IntensityMode>("total");
  const [groupId, setGroupId] = useState("");
  const [period, setPeriod] = useState(EVERY_DAY);
  // Name is enough — a habit created without a metric defaults to a daily
  // check-off (one "done" metric). In total mode the count unit's thresholds
  // ([1,3,5]) put a marked day at the middle palette shade.
  const canCreate = !!name.trim();
  return (
    <PageShell title="New Habit" onBack={() => onClose()}>
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
                icon,
                description: desc.trim(),
                color,
                metrics: metrics.length === 0 ? [doneMetric()] : metrics,
                intensityMode: intMode,
                ...(groupId && { groupId }),
                ...(!isEveryDay(period) && { period }),
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
