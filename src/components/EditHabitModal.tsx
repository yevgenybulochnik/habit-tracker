import { useState } from "react";
import type { CSSProperties } from "react";
import { C, F } from "../constants";
import ModalShell from "./ModalShell";
import HabitFormFields from "./HabitFormFields";
import type { Habit, IntensityMode, Metric, Unit } from "../types";

// Shared base for the danger-zone confirm pair (Keep it / Delete Habit).
const dzBtn: CSSProperties = {
  padding: "6px 14px",
  borderRadius: 5,
  cursor: "pointer",
  fontSize: 11,
  fontFamily: F,
};

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
  const [metrics, setMetrics] = useState<Metric[]>([...(habit.metrics || [])]);
  const [intMode, setIntMode] = useState<IntensityMode>(
    habit.intensityMode || "total",
  );
  const [closing, setClosing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hClose = () => {
    setClosing(true);
    setTimeout(onClose, 350);
  };
  const canSave = !!name.trim() && metrics.length > 0;
  const handleDelete = () => {
    if (onDelete) {
      setClosing(true);
      setTimeout(() => onDelete(habit.id), 350);
    }
  };
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
        Edit Habit
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

      {/* Danger zone */}
      <div
        style={{
          marginBottom: 20,
          padding: "14px 16px",
          borderRadius: 8,
          border: `1px solid ${confirmDelete ? C.danger : C.border}`,
          background: confirmDelete ? "rgba(248,81,73,0.06)" : C.bg,
          transition: "all .2s",
        }}
      >
        {confirmDelete ? (
          <div>
            <div
              style={{
                fontSize: 13,
                color: C.danger,
                fontFamily: F,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Delete "{habit.name}"?
            </div>
            <div
              style={{
                fontSize: 11,
                color: C.muted,
                fontFamily: F,
                marginBottom: 12,
              }}
            >
              This will permanently remove the habit and all its logged data.
              This cannot be undone.
            </div>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  ...dzBtn,
                  border: `1px solid ${C.border}`,
                  background: "transparent",
                  color: C.muted,
                }}
              >
                Keep it
              </button>
              <button
                onClick={handleDelete}
                style={{
                  ...dzBtn,
                  border: "none",
                  background: C.danger,
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                Delete Habit
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 11, color: C.dim, fontFamily: F }}>
              Remove this habit and all data
            </span>
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                padding: "5px 12px",
                borderRadius: 5,
                border: `1px solid ${C.border}`,
                background: "transparent",
                color: C.danger,
                cursor: "pointer",
                fontSize: 11,
                fontFamily: F,
                fontWeight: 500,
                transition: "all .15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.danger;
                e.currentTarget.style.background = "rgba(248,81,73,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.background = "transparent";
              }}
            >
              Delete habit
            </button>
          </div>
        )}
      </div>

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
            if (canSave) {
              onSave({
                ...habit,
                name: name.trim(),
                emoji,
                description: desc.trim(),
                color,
                metrics,
                intensityMode: intMode,
              });
              hClose();
            }
          }}
          style={{
            padding: "8px 18px",
            borderRadius: 6,
            border: "none",
            background: canSave ? C.accent : C.borderLight,
            color: canSave ? "#fff" : C.dim,
            cursor: canSave ? "pointer" : "not-allowed",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: F,
            transition: "all .2s",
          }}
        >
          Save
        </button>
      </div>
    </ModalShell>
  );
}
