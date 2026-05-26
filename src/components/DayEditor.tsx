import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { C, F, inpS } from "../constants";
import {
  isSetMetric,
  getQuickAdd,
  findLastSet,
  setUnitLabel,
} from "../lib/metrics";
import { todayK } from "../lib/dates";
import SetInput from "./SetInput";
import type {
  DayLog,
  Habit,
  HabitLogs,
  Palette,
  SetEntry,
  Unit,
} from "../types";

type LocalVal = string | SetEntry[];

// Static quick-add (+N) preset button used in the per-metric row.
const qaBtn: CSSProperties = {
  padding: "6px 8px",
  borderRadius: 4,
  border: `1px solid ${C.border}`,
  background: C.bg,
  color: C.muted,
  cursor: "pointer",
  fontSize: 10,
  fontFamily: F,
};

type Props = {
  habit: Habit;
  dateKey: string;
  habitLogs: HabitLogs; // this habit's logs (dateKey → DayLog)
  units: Unit[];
  pal: Palette;
  onClose: () => void;
  /** Live-persist each edit (typing / quick-add / set add) so the heatmap cell
   *  recolors immediately; there is no explicit Save — the × just closes. */
  onChange: (dateKey: string, entry: DayLog) => void;
};

// Inline editor for one habit on one date — shown inside the card when a
// calendar day is tapped. Recovers exact-value entry + back-dating.
export default function DayEditor({
  habit,
  dateKey,
  habitLogs,
  units,
  pal,
  onClose,
  onChange,
}: Props) {
  const ms = habit.metrics || [];
  const dayLog = habitLogs[dateKey] || {};
  const [local, setLocal] = useState<Record<string, LocalVal>>(() => {
    const v: Record<string, LocalVal> = {};
    ms.forEach((m) => {
      if (isSetMetric(m))
        v[m.id] = Array.isArray(dayLog[m.id])
          ? (dayLog[m.id] as SetEntry[]).map((s) => ({ ...s }))
          : [];
      else v[m.id] = (dayLog[m.id] as number) > 0 ? String(dayLog[m.id]) : "";
    });
    return v;
  });

  const setV = (mId: string, val: string) =>
    setLocal((p) => ({ ...p, [mId]: val.replace(/[^0-9]/g, "") }));
  const qAdd = (mId: string, amt: number) =>
    setLocal((p) => ({
      ...p,
      [mId]: String((parseInt((p[mId] as string) || "0", 10) || 0) + amt),
    }));
  const addSet = (mId: string, set: SetEntry) =>
    setLocal((p) => ({
      ...p,
      [mId]: [...(Array.isArray(p[mId]) ? (p[mId] as SetEntry[]) : []), set],
    }));
  const rmSet = (mId: string, idx: number) =>
    setLocal((p) => {
      const c = Array.isArray(p[mId]) ? [...(p[mId] as SetEntry[])] : [];
      c.splice(idx, 1);
      return { ...p, [mId]: c };
    });
  const buildEntry = (): DayLog => {
    const entry: DayLog = {};
    ms.forEach((m) => {
      if (isSetMetric(m))
        entry[m.id] = Array.isArray(local[m.id])
          ? (local[m.id] as SetEntry[])
          : [];
      else entry[m.id] = parseInt((local[m.id] as string) || "0", 10) || 0;
    });
    return entry;
  };

  // Live-persist edits so the calendar cell recolors as you type / tap presets.
  // Skip the initial mount: the editor seeds from the stored value, so emitting
  // on mount would be a redundant write (and re-trigger the heatmap effect).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    onChange?.(dateKey, buildEntry());
  }, [local]); // eslint-disable-line react-hooks/exhaustive-deps

  const isToday = dateKey === todayK();
  const disp = new Date(dateKey + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      style={{
        borderTop: `1px solid ${C.border}`,
        marginTop: 10,
        paddingTop: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: pal.shades[4],
            fontFamily: F,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".06em",
          }}
        >
          {isToday ? "Edit today" : `Edit · ${disp}`}
        </span>
        <button
          onClick={onClose}
          title="Close"
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
          onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.dim)}
        >
          ×
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ms.map((m) => {
          if (isSetMetric(m)) {
            return (
              <div key={m.id}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.text,
                    fontFamily: F,
                    marginBottom: 4,
                  }}
                >
                  {m.name}{" "}
                  <span style={{ fontSize: 9, color: C.accent }}>
                    SETS · {setUnitLabel(m)}
                  </span>
                </div>
                <SetInput
                  metric={m}
                  sets={local[m.id] as SetEntry[]}
                  pal={pal}
                  onAddSet={(_, set) => addSet(m.id, set)}
                  onRemoveSet={(_, idx) => rmSet(m.id, idx)}
                  lastSet={findLastSet(habitLogs, m.id)}
                />
              </div>
            );
          }
          return (
            <div
              key={m.id}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: C.muted,
                  fontFamily: F,
                  minWidth: 70,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.name}
              </span>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={(local[m.id] as string) || ""}
                  onChange={(e) => setV(m.id, e.target.value)}
                  placeholder="0"
                  style={{ ...inpS, fontWeight: 600, paddingRight: 40 }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 10,
                    color: C.dim,
                    fontFamily: F,
                    pointerEvents: "none",
                  }}
                >
                  {m.unit}
                </span>
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                {getQuickAdd(m.unit, units).map((n) => (
                  <button key={n} onClick={() => qAdd(m.id, n)} style={qaBtn}>
                    +{n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
