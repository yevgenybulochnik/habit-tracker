import { useState, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { C, F, EMOJIS, PALETTES, inpS, lbl } from "../constants";
import { getUnit, setsPreset, setUnitLabel } from "../lib/metrics";
import type { SetPreset } from "../lib/metrics";
import type { IntensityMode, Metric, Unit } from "../types";

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
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Icon</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                border: `1.5px solid ${emoji === e ? C.accent : C.border}`,
                background: emoji === e ? C.accentDim : C.bg,
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all .2s",
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Morning Workout, Reading"
          style={inpS}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Description (optional)</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short note"
          style={inpS}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={lbl}>Color</label>
        <div style={{ display: "flex", gap: 8 }}>
          {PALETTES.map((c) => (
            <button
              key={c.name}
              onClick={() => setColor(c.name)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: c.shades[3],
                border: `2px solid ${color === c.name ? "#fff" : "transparent"}`,
                cursor: "pointer",
                transition: "all .25s",
                transform: color === c.name ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>What do you measure?</label>
        {metrics.length === 0 && (
          <div
            style={{
              padding: "16px 12px",
              borderRadius: 6,
              border: `1px dashed ${C.border}`,
              background: C.bg,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 11, color: C.muted, fontFamily: F }}>
              No metrics yet — add at least one to create this habit
            </div>
          </div>
        )}
        {metrics.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
              padding: "8px 12px",
              borderRadius: 6,
              background: C.bg,
              border: `1px solid ${C.border}`,
            }}
          >
            <span
              style={{ flex: 1, fontSize: 13, color: C.text, fontFamily: F }}
            >
              {m.name}
            </span>
            {m.mode === "sets" && (
              <span
                style={{
                  fontSize: 9,
                  color: C.accent,
                  fontFamily: F,
                  padding: "2px 6px",
                  borderRadius: 3,
                  background: C.accentDim,
                  fontWeight: 600,
                }}
              >
                SETS · {setUnitLabel(m)}
              </span>
            )}
            <span
              style={{
                fontSize: 10,
                color: C.dim,
                fontFamily: F,
                padding: "2px 8px",
                borderRadius: 3,
                background: C.surface,
              }}
            >
              {getUnit(m.unit, units).label}
            </span>
            <button
              onClick={() => rmMetric(m.id)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                border: "none",
                background: "transparent",
                color: C.dim,
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.danger)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.dim)}
            >
              ×
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input
            value={newMN}
            onChange={(e) => setNewMN(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMetric()}
            placeholder="Metric name (e.g. Bench Press, Squats)"
            style={{ ...inpS, fontSize: 13, flex: 1 }}
          />
          <select
            value={newMU}
            onChange={(e) => {
              if (e.target.value === "__custom__") setShowCU(true);
              else setNewMU(e.target.value);
            }}
            style={{ ...inpS, width: 100, fontSize: 12, cursor: "pointer" }}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
            <option value="__custom__">+ Custom...</option>
          </select>
          <button
            onClick={addMetric}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: C.bg,
              color: C.muted,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: F,
              whiteSpace: "nowrap",
            }}
          >
            + Add
          </button>
        </div>
        {/* Sets mode toggle + schema preset */}
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() =>
              setNewMode((p) => (p === "sets" ? "normal" : "sets"))
            }
            style={{
              padding: "5px 12px",
              borderRadius: 5,
              fontSize: 10,
              fontFamily: F,
              fontWeight: 600,
              cursor: "pointer",
              border: `1px solid ${newMode === "sets" ? C.accent : C.border}`,
              background: newMode === "sets" ? C.accentDim : "transparent",
              color: newMode === "sets" ? C.accent : C.muted,
              transition: "all .2s",
            }}
          >
            {newMode === "sets" ? "◼ Sets mode ON" : "○ Enable sets mode"}
          </button>
          {newMode === "sets" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: 4 }}>
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
                    style={{
                      padding: "5px 10px",
                      borderRadius: 5,
                      fontSize: 10,
                      fontFamily: F,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: `1px solid ${newPreset === k ? C.accent : C.border}`,
                      background: newPreset === k ? C.accentDim : "transparent",
                      color: newPreset === k ? C.accent : C.muted,
                      transition: "all .2s",
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {newPreset === "weighted" && (
                <select
                  value={newWU}
                  onChange={(e) => setNewWU(e.target.value)}
                  style={{
                    ...inpS,
                    width: 70,
                    fontSize: 11,
                    padding: "5px 8px",
                    cursor: "pointer",
                  }}
                >
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>
              )}
              <span style={{ fontSize: 9, color: C.dim, fontFamily: F }}>
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
          <div
            style={{
              marginTop: 10,
              padding: "14px 16px",
              borderRadius: 8,
              border: `1px solid ${C.accent}`,
              background: C.accentDim,
              animation: "fadeIn .3s ease",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: C.accent,
                fontFamily: F,
                fontWeight: 600,
                marginBottom: 10,
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              New Unit
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: C.muted,
                    fontFamily: F,
                    marginBottom: 4,
                  }}
                >
                  ID
                </div>
                <input
                  value={cuId}
                  onChange={(e) => setCuId(e.target.value)}
                  placeholder="lbs"
                  style={{ ...inpS, fontSize: 12 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: C.muted,
                    fontFamily: F,
                    marginBottom: 4,
                  }}
                >
                  Label
                </div>
                <input
                  value={cuLbl}
                  onChange={(e) => setCuLbl(e.target.value)}
                  placeholder="Pounds"
                  style={{ ...inpS, fontSize: 12 }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: C.muted,
                    fontFamily: F,
                    marginBottom: 4,
                  }}
                >
                  Quick-add
                </div>
                <input
                  value={cuQA}
                  onChange={(e) => setCuQA(e.target.value)}
                  style={{ ...inpS, fontSize: 12 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: C.muted,
                    fontFamily: F,
                    marginBottom: 4,
                  }}
                >
                  Thresholds
                </div>
                <input
                  value={cuThr}
                  onChange={(e) => setCuThr(e.target.value)}
                  style={{ ...inpS, fontSize: 12 }}
                />
              </div>
            </div>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => setShowCU(false)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 5,
                  border: `1px solid ${C.border}`,
                  background: "transparent",
                  color: C.muted,
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: F,
                }}
              >
                Cancel
              </button>
              <button
                onClick={addCU}
                style={{
                  padding: "6px 14px",
                  borderRadius: 5,
                  border: "none",
                  background: C.accent,
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: F,
                }}
              >
                Add Unit
              </button>
            </div>
          </div>
        )}
        <div
          style={{
            fontSize: 10,
            color: metrics.length === 0 ? C.accent : C.dim,
            fontFamily: F,
            marginTop: 6,
          }}
        >
          {metrics.length === 0
            ? "Add a metric name and unit, then click + Add"
            : metrics.length === 1
              ? "Single metric = simple tracker. Add more for compound habits."
              : `${metrics.length} metrics configured.`}
        </div>
      </div>

      {metrics.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Intensity based on</label>
          <div style={{ display: "flex", gap: 6 }}>
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
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: `1.5px solid ${intensityMode === m.id ? C.accent : C.border}`,
                  background: intensityMode === m.id ? C.accentDim : C.bg,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all .2s",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: intensityMode === m.id ? C.text : C.muted,
                    fontFamily: F,
                  }}
                >
                  {m.l}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: C.dim,
                    fontFamily: F,
                    marginTop: 2,
                  }}
                >
                  {m.d}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
