import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import {
  isSetMetric,
  isDoneMetric,
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
import styles from "./DayEditor.module.css";

type LocalVal = string | SetEntry[];

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
  const ms = habit.metrics;
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

  // Per-habit palette → CSS vars consumed by the title + done toggle.
  const palVars = {
    "--de-accent": pal.shades[4],
    "--de-a3": pal.shades[3],
    "--de-a2": pal.shades[2],
  } as CSSProperties;

  return (
    <div className={styles.wrap} style={palVars}>
      <div className={styles.head}>
        <span className={styles.title}>
          {isToday ? "Edit today" : `Edit · ${disp}`}
        </span>
        <button onClick={onClose} title="Close" className={styles.close}>
          ×
        </button>
      </div>
      <div className={styles.metrics}>
        {ms.map((m) => {
          if (isSetMetric(m)) {
            return (
              <div key={m.id}>
                <div className={styles.setHead}>
                  {m.name}{" "}
                  <span className={styles.setBadge}>
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
          const nameLabel = <span className={styles.name}>{m.name}</span>;
          if (isDoneMetric(m)) {
            const marked = parseInt((local[m.id] as string) || "0", 10) > 0;
            return (
              <div key={m.id} className={styles.row}>
                {nameLabel}
                <button
                  onClick={() => setV(m.id, marked ? "0" : "1")}
                  className={`${styles.doneBtn}${marked ? ` ${styles.marked}` : ""}`}
                >
                  <span className={styles.doneIcon}>{marked ? "✓" : "○"}</span>
                  {marked ? "Done" : "Mark done"}
                </button>
              </div>
            );
          }
          return (
            <div key={m.id} className={styles.row}>
              {nameLabel}
              <div className={styles.field}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={(local[m.id] as string) || ""}
                  onChange={(e) => setV(m.id, e.target.value)}
                  placeholder="0"
                  className={styles.numInput}
                />
                <span className={styles.unitSuffix}>{m.unit}</span>
              </div>
              <div className={styles.qaRow}>
                {getQuickAdd(m.unit, units).map((n) => (
                  <button
                    key={n}
                    onClick={() => qAdd(m.id, n)}
                    className={styles.qaBtn}
                  >
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
