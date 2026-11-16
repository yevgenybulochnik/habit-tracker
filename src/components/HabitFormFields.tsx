import { useState, useEffect } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { PALETTES } from "../theme";
import { EMOJIS } from "./emojis";
import {
  getUnit,
  hasMixedUnits,
  setsPreset,
  setUnitLabel,
} from "../lib/metrics";
import { newId } from "../lib/ids";
import type { SetPreset } from "../lib/metrics";
import type { Group, IntensityMode, Metric, Unit } from "../types";
import UnitForm from "./UnitForm";
import GroupField from "./GroupField";
import styles from "./HabitFormFields.module.css";

type Props = {
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  emoji: string;
  setEmoji: Dispatch<SetStateAction<string>>;
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
  color: string;
  setColor: Dispatch<SetStateAction<string>>;
  metrics: Metric[];
  setMetrics: Dispatch<SetStateAction<Metric[]>>;
  intensityMode: IntensityMode;
  setIntensityMode: Dispatch<SetStateAction<IntensityMode>>;
  units: Unit[];
  onAddUnit: (u: Unit) => void;
  /** The habit's group's id, or "" for none. */
  groupId: string;
  setGroupId: Dispatch<SetStateAction<string>>;
  groups: Group[];
  onAddGroup: (g: Group) => void;
};

export default function HabitFormFields({
  name,
  setName,
  emoji,
  setEmoji,
  description,
  setDescription,
  color,
  setColor,
  metrics,
  setMetrics,
  intensityMode,
  setIntensityMode,
  units,
  onAddUnit,
  groupId,
  setGroupId,
  groups,
  onAddGroup,
}: Props) {
  const [newMN, setNewMN] = useState("");
  const [newMU, setNewMU] = useState("reps");
  const [newMode, setNewMode] = useState<"normal" | "sets">("normal");
  const [newPreset, setNewPreset] = useState<SetPreset>("weighted");
  const [newWU, setNewWU] = useState("lbs");
  const [showCU, setShowCU] = useState(false);

  const addMetric = () => {
    if (newMN.trim()) {
      const m: Metric =
        newMode === "sets"
          ? {
              id: newId("m"),
              name: newMN.trim(),
              mode: "sets",
              ...setsPreset(newPreset, newWU),
            }
          : { id: newId("m"), name: newMN.trim(), unit: newMU };
      setMetrics((p) => [...p, m]);
      setNewMN("");
      setNewMode("normal");
      setNewPreset("weighted");
    }
  };
  const rmMetric = (id: string) =>
    setMetrics((p) => p.filter((m) => m.id !== id));
  const addCU = (u: Unit) => {
    onAddUnit(u);
    setNewMU(u.id); // the new unit is what the next metric will use
    setShowCU(false);
  };

  useEffect(() => {
    if (intensityMode === "total" && hasMixedUnits(metrics))
      setIntensityMode("coverage");
  }, [metrics, intensityMode, setIntensityMode]);

  return (
    <>
      <div className={styles.field}>
        <label className={styles.label}>Icon</label>
        <div className={styles.emojiGrid}>
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`${styles.emojiBtn}${emoji === e ? ` ${styles.sel}` : ""}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Morning Workout, Reading"
          className={styles.input}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Description (optional)</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short note"
          className={styles.input}
        />
      </div>
      <GroupField
        value={groupId}
        onChange={setGroupId}
        groups={groups}
        onAddGroup={onAddGroup}
      />
      <div className={styles.fieldLg}>
        <label className={styles.label}>Color</label>
        <div className={styles.colorRow}>
          {PALETTES.map((c) => (
            <button
              key={c.name}
              onClick={() => setColor(c.name)}
              className={`${styles.swatch}${color === c.name ? ` ${styles.sel}` : ""}`}
              style={{ "--sw": c.shades[3] } as CSSProperties}
            />
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className={styles.field}>
        <label className={styles.label}>What do you measure?</label>
        {metrics.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyText}>
              No metrics — this habit will be a simple daily check-off. Add one
              to track an amount instead.
            </div>
          </div>
        )}
        {metrics.map((m) => (
          <div key={m.id} className={styles.metricRow}>
            <span className={styles.metricName}>{m.name}</span>
            {m.mode === "sets" && (
              <span className={styles.setsBadge}>SETS · {setUnitLabel(m)}</span>
            )}
            <span className={styles.unitBadge}>
              {getUnit(m.unit, units).label}
            </span>
            <button onClick={() => rmMetric(m.id)} className={styles.rmBtn}>
              ×
            </button>
          </div>
        ))}
        <div className={styles.addRow}>
          <input
            value={newMN}
            onChange={(e) => setNewMN(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMetric()}
            placeholder="Metric name (e.g. Bench Press, Squats)"
            className={styles.addInput}
          />
          <select
            aria-label="Unit"
            value={newMU}
            onChange={(e) => {
              if (e.target.value === "__custom__") setShowCU(true);
              else setNewMU(e.target.value);
            }}
            className={styles.unitSelect}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
            <option value="__custom__">+ Custom...</option>
          </select>
          <button onClick={addMetric} className={styles.addBtn}>
            + Add
          </button>
        </div>
        {/* Sets mode toggle + schema preset */}
        <div className={styles.setsWrap}>
          <button
            onClick={() =>
              setNewMode((p) => (p === "sets" ? "normal" : "sets"))
            }
            className={`${styles.toggleBtn}${newMode === "sets" ? ` ${styles.on}` : ""}`}
          >
            {newMode === "sets" ? "◼ Sets mode ON" : "○ Enable sets mode"}
          </button>
          {newMode === "sets" && (
            <div className={styles.presetWrap}>
              <div className={styles.presetGrid}>
                {(
                  [
                    ["weighted", "Weighted"],
                    ["reps", "Reps only"],
                    ["timed", "Timed"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setNewPreset(k)}
                    className={`${styles.presetBtn}${newPreset === k ? ` ${styles.on}` : ""}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {newPreset === "weighted" && (
                <select
                  value={newWU}
                  onChange={(e) => setNewWU(e.target.value)}
                  className={styles.wuSelect}
                >
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>
              )}
              <span className={styles.presetHint}>
                {newPreset === "weighted"
                  ? "Log weight × reps per set"
                  : newPreset === "reps"
                    ? "Log reps per set (bodyweight)"
                    : "Log minutes per set"}
              </span>
            </div>
          )}
        </div>
        {showCU && (
          <div className={styles.cu}>
            <div className={styles.cuTitle}>New Unit</div>
            <UnitForm
              takenIds={units.map((u) => u.id)}
              submitLabel="Add Unit"
              onSubmit={addCU}
              onCancel={() => setShowCU(false)}
            />
          </div>
        )}
        <div
          className={`${styles.hint}${metrics.length === 0 ? ` ${styles.hintAccent}` : ""}`}
        >
          {metrics.length === 0
            ? "Leave empty for a daily check-off, or add a metric to track an amount."
            : metrics.length === 1
              ? "Single metric = simple tracker. Add more for compound habits."
              : `${metrics.length} metrics configured.`}
        </div>
      </div>

      {metrics.length > 1 && (
        <div className={styles.fieldLg}>
          <label className={styles.label}>Intensity based on</label>
          <div className={styles.intensityGrid}>
            {(
              [
                {
                  id: "total",
                  l: "Sum total",
                  d: "Higher combined value = brighter",
                },
                {
                  id: "coverage",
                  l: "Coverage",
                  d: "More metrics completed = brighter",
                },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setIntensityMode(m.id)}
                className={`${styles.intBtn}${intensityMode === m.id ? ` ${styles.on}` : ""}`}
              >
                <div className={styles.intTitle}>{m.l}</div>
                <div className={styles.intDesc}>{m.d}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
