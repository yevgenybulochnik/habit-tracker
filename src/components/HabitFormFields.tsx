import { useState, useEffect } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { PALETTES } from "../theme";
import { EMOJIS } from "./emojis";
import { getUnit, setsPreset, setUnitLabel } from "../lib/metrics";
import type { SetPreset } from "../lib/metrics";
import type { IntensityMode, Metric, Unit } from "../types";
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
}: Props) {
  const [newMN, setNewMN] = useState("");
  const [newMU, setNewMU] = useState("reps");
  const [newMode, setNewMode] = useState<"normal" | "sets">("normal");
  const [newPreset, setNewPreset] = useState<SetPreset>("weighted");
  const [newWU, setNewWU] = useState("lbs");
  const [showCU, setShowCU] = useState(false);
  const [cuId, setCuId] = useState("");
  const [cuLbl, setCuLbl] = useState("");
  const [cuQA, setCuQA] = useState("1, 5, 10");
  const [cuThr, setCuThr] = useState("1, 3, 5");

  const addMetric = () => {
    if (newMN.trim()) {
      const m: Metric =
        newMode === "sets"
          ? {
              id: `m_${Date.now()}`,
              name: newMN.trim(),
              mode: "sets",
              ...setsPreset(newPreset, newWU),
            }
          : { id: `m_${Date.now()}`, name: newMN.trim(), unit: newMU };
      setMetrics((p) => [...p, m]);
      setNewMN("");
      setNewMode("normal");
      setNewPreset("weighted");
    }
  };
  const rmMetric = (id: string) =>
    setMetrics((p) => p.filter((m) => m.id !== id));
  const parseNums = (s: string) =>
    s
      .split(",")
      .map((v) => parseInt(v.trim(), 10))
      .filter((v) => !isNaN(v) && v > 0);
  const addCU = () => {
    const id = cuId.trim().toLowerCase().replace(/\s+/g, "_"),
      l2 = cuLbl.trim(),
      qa = parseNums(cuQA),
      thr = parseNums(cuThr);
    if (id && l2 && qa.length >= 1 && thr.length >= 1) {
      onAddUnit({
        id,
        label: l2,
        quickAdd: qa.slice(0, 3),
        thresholds: thr.slice(0, 3),
      });
      setNewMU(id);
      setShowCU(false);
      setCuId("");
      setCuLbl("");
      setCuQA("1, 5, 10");
      setCuThr("1, 3, 5");
    }
  };

  useEffect(() => {
    if (metrics.length > 1 && intensityMode === "total") {
      const u = new Set(metrics.map((m) => m.unit));
      if (u.size > 1) setIntensityMode("coverage");
    }
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
            <div className={styles.cuGrid}>
              <div>
                <div className={styles.cuFieldLbl}>ID</div>
                <input
                  value={cuId}
                  onChange={(e) => setCuId(e.target.value)}
                  placeholder="lbs"
                  className={styles.cuInput}
                />
              </div>
              <div>
                <div className={styles.cuFieldLbl}>Label</div>
                <input
                  value={cuLbl}
                  onChange={(e) => setCuLbl(e.target.value)}
                  placeholder="Pounds"
                  className={styles.cuInput}
                />
              </div>
            </div>
            <div className={`${styles.cuGrid} ${styles.cuGridLast}`}>
              <div>
                <div className={styles.cuFieldLbl}>Quick-add</div>
                <input
                  value={cuQA}
                  onChange={(e) => setCuQA(e.target.value)}
                  className={styles.cuInput}
                />
              </div>
              <div>
                <div className={styles.cuFieldLbl}>Thresholds</div>
                <input
                  value={cuThr}
                  onChange={(e) => setCuThr(e.target.value)}
                  className={styles.cuInput}
                />
              </div>
            </div>
            <div className={styles.cuActions}>
              <button
                onClick={() => setShowCU(false)}
                className={styles.cuCancel}
              >
                Cancel
              </button>
              <button onClick={addCU} className={styles.cuAdd}>
                Add Unit
              </button>
            </div>
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
