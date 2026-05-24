import { useState, useEffect } from "react";
import { C, F, resolvePalette, inpS } from "../constants";
import { getUnit, getQuickAdd, isSetMetric, metricActive, findLastWeight } from "../lib/metrics";
import { fmtVal, fmtSets } from "../lib/format";
import { logLevel } from "../lib/stats";
import { dk, todayK } from "../lib/dates";
import SetInput from "./SetInput";
import LiveTimer from "./LiveTimer";
import StaggeredList from "./StaggeredList";
import type { DayLog, Habit, Logs, SetEntry, ThemeName, Timers, Unit } from "../types";

type LocalVal = string | SetEntry[];
type LocalState = Record<string, Record<string, LocalVal>>;

type Props = {
  habits: Habit[];
  allLogs: Logs;
  units: Unit[];
  onSaveLog: (dateKey: string, parsed: Record<string, DayLog>) => void;
  selectedDate: string;
  onDateChange: (dateKey: string) => void;
  timers?: Timers;
  onStopTimer: (habitId: string, metricId: string) => void;
  theme: ThemeName;
};

export default function LogEntry({ habits, allLogs, units, onSaveLog, selectedDate, onDateChange, timers, onStopTimer, theme }: Props) {
  const [local, setLocal] = useState<LocalState>({});
  const [saved, setSaved] = useState(false);
  const [dDir, setDDir] = useState<"left" | "right" | null>(null);
  const [dKey, setDKey] = useState(0);

  useEffect(() => {
    const loc: LocalState = {};
    habits.forEach((h) => {
      const ex = allLogs[h.id]?.[selectedDate] || {};
      const vals: Record<string, LocalVal> = {};
      (h.metrics || []).forEach((m) => {
        if (isSetMetric(m)) vals[m.id] = Array.isArray(ex[m.id]) ? (ex[m.id] as SetEntry[]).map((s) => ({ ...s })) : [];
        else vals[m.id] = (ex[m.id] as number) > 0 ? String(ex[m.id]) : "";
      });
      loc[h.id] = vals;
    });
    setLocal(loc);
    setSaved(false);
  }, [selectedDate, habits, allLogs]);

  const setV = (hId: string, mId: string, val: string) => setLocal((p) => ({ ...p, [hId]: { ...(p[hId] || {}), [mId]: val.replace(/[^0-9]/g, "") } }));
  const qAdd = (hId: string, mId: string, amt: number) => setLocal((p) => { const cur = parseInt((p[hId]?.[mId] as string) || "0", 10) || 0; return { ...p, [hId]: { ...(p[hId] || {}), [mId]: String(cur + amt) } }; });
  const addSet = (hId: string, mId: string, set: SetEntry) => setLocal((p) => { const prev = p[hId] || {}; const cur = Array.isArray(prev[mId]) ? (prev[mId] as SetEntry[]) : []; return { ...p, [hId]: { ...prev, [mId]: [...cur, set] } }; });
  const rmSet = (hId: string, mId: string, idx: number) => setLocal((p) => { const prev = p[hId] || {}; const cur = Array.isArray(prev[mId]) ? [...(prev[mId] as SetEntry[])] : []; cur.splice(idx, 1); return { ...p, [hId]: { ...prev, [mId]: cur } }; });

  const handleSave = () => {
    const parsed: Record<string, DayLog> = {};
    habits.forEach((h) => {
      const entry: DayLog = {};
      (h.metrics || []).forEach((m) => {
        if (isSetMetric(m)) entry[m.id] = Array.isArray(local[h.id]?.[m.id]) ? (local[h.id][m.id] as SetEntry[]) : [];
        else entry[m.id] = parseInt((local[h.id]?.[m.id] as string) || "0", 10) || 0;
      });
      parsed[h.id] = entry;
    });
    onSaveLog(selectedDate, parsed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const navDay = (off: number) => { setDDir(off > 0 ? "left" : "right"); setDKey((k) => k + 1); const d = new Date(selectedDate + "T12:00:00"); d.setDate(d.getDate() + off); onDateChange(dk(d)); };
  const isToday = selectedDate === todayK();
  const dateObj = new Date(selectedDate + "T12:00:00");
  const dispDate = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div>
      <div className="stagger-child" style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: ".08em", fontFamily: F }}>Log Date</div>
          {!isToday && <button onClick={() => { setDDir("right"); setDKey((k) => k + 1); onDateChange(todayK()); }} style={{ padding: "4px 12px", borderRadius: 4, border: `1px solid ${C.accent}`, background: C.accentDim, color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: F, fontWeight: 500 }}>Jump to Today</button>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
          <button onClick={() => navDay(-1)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.muted, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F }}>‹</button>
          <div key={dKey} className={dDir === "left" ? "date-shift-left" : dDir === "right" ? "date-shift-right" : ""} style={{ textAlign: "center", minWidth: 260 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: C.text, fontFamily: F }}>{isToday ? "Today" : dispDate.split(",")[0]}</div>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: F, marginTop: 2 }}>{dispDate}</div>
          </div>
          <button onClick={() => navDay(1)} disabled={isToday} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${isToday ? C.bg : C.border}`, background: C.bg, color: isToday ? C.dim : C.muted, cursor: isToday ? "default" : "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, opacity: isToday ? .4 : 1 }}>›</button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <input type="date" value={selectedDate} max={todayK()} onChange={(e) => { setDDir(null); onDateChange(e.target.value); }} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.muted, fontSize: 12, fontFamily: F, outline: "none", colorScheme: "dark" }} />
        </div>
      </div>
      {habits.length === 0 ? (
        <div className="stagger-child" style={{ background: C.surface, borderRadius: 10, border: `1px dashed ${C.border}`, padding: "50px 20px", textAlign: "center" }}><div style={{ fontSize: 32, marginBottom: 12 }}>✏️</div><div style={{ fontSize: 14, color: C.muted, fontFamily: F }}>Add habits first</div></div>
      ) : (
        <StaggeredList keyProp={selectedDate}>
          {habits.map((h) => {
            const pal2 = resolvePalette(h.color, theme);
            const hL = local[h.id] || {};
            const ms = h.metrics || [];
            const compact = ms.length === 1;
            const localLog: DayLog = {};
            ms.forEach((m) => { if (isSetMetric(m)) localLog[m.id] = hL[m.id] as SetEntry[]; else localLog[m.id] = parseInt((hL[m.id] as string) || "0", 10) || 0; });
            const has = ms.some((m) => metricActive(m, localLog));
            const level = logLevel(h, localLog, units);
            const priUnit = ms[0]?.unit || "count";
            const thr = getUnit(priUnit, units).thresholds;
            const activeTimers = ms.filter((m) => timers?.[`${h.id}:${m.id}`]);
            const priIsSets = ms[0]?.mode === "sets";
            return (
              <div key={h.id} style={{ background: C.surface, borderRadius: 10, border: `1px solid ${has ? pal2.shades[2] : C.border}`, padding: "16px 20px", transition: "all .3s", marginBottom: 10, boxShadow: has ? `0 0 12px ${pal2.shades[1]}44` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: activeTimers.length > 0 ? 8 : 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22, transition: "transform .3s", transform: has ? "scale(1.1)" : "scale(1)" }}>{h.emoji}</span>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F }}>{h.name}</div>
                  </div>
                  {has && <span style={{ fontSize: 12, color: pal2.shades[4], fontFamily: F, fontWeight: 600, animation: "fadeIn .3s ease" }}>
                    {compact ? (priIsSets ? fmtSets(hL[ms[0].id] as SetEntry[], ms[0].weightUnit) : fmtVal(parseInt((hL[ms[0].id] as string) || "0", 10), ms[0].unit)) : `${ms.filter((m) => metricActive(m, localLog)).length}/${ms.length}`}
                  </span>}
                </div>
                {activeTimers.map((m) => <LiveTimer key={m.id} startTime={timers![`${h.id}:${m.id}`]} metricName={m.name} pal={pal2} onStop={() => onStopTimer(h.id, m.id)} />)}

                {/* Single sets metric */}
                {compact && priIsSets ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontFamily: F, fontWeight: 600, color: C.text }}>{ms[0].name}</span>
                      <span style={{ fontSize: 9, color: C.accent, fontFamily: F, padding: "1px 5px", borderRadius: 2, background: C.accentDim, fontWeight: 600 }}>SETS · {ms[0].weightUnit || "lbs"}</span>
                    </div>
                    <SetInput metric={ms[0]} sets={hL[ms[0].id] as SetEntry[]} pal={pal2} onAddSet={(_, set) => addSet(h.id, ms[0].id, set)} onRemoveSet={(_, idx) => rmSet(h.id, ms[0].id, idx)} lastWeight={findLastWeight(allLogs[h.id] || {}, ms[0].id)} />
                    <div style={{ display: "flex", gap: 3, marginTop: 8 }}>{[1, 2, 3, 4].map((i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: level >= i ? pal2.shades[i] : C.bg, transition: "background .4s" }} />)}</div>
                  </>
                ) : compact ? (
                  <>
                    <div style={{ fontSize: 12, fontFamily: F, fontWeight: 600, color: C.text, marginBottom: 6 }}>{ms[0].name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ position: "relative", flex: 1 }}><input type="text" inputMode="numeric" value={(hL[ms[0].id] as string) || ""} onChange={(e) => setV(h.id, ms[0].id, e.target.value)} placeholder="0" style={{ ...inpS, paddingRight: 46, borderColor: has ? pal2.shades[2] : C.border, fontSize: 16, fontWeight: 600, transition: "border-color .3s, box-shadow .3s", boxShadow: has ? `0 0 0 1px ${pal2.shades[1]}44` : "none" }} /><span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.muted, fontFamily: F, pointerEvents: "none" }}>{ms[0].unit}</span></div>
                      <div style={{ display: "flex", gap: 4 }}>{getQuickAdd(ms[0].unit, units).map((n) => (<button key={n} onClick={() => qAdd(h.id, ms[0].id, n)} style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.muted, cursor: "pointer", fontSize: 11, fontFamily: F, fontWeight: 500, transition: "all .2s", minWidth: 40, textAlign: "center" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = pal2.shades[3]; e.currentTarget.style.color = pal2.shades[4]; e.currentTarget.style.transform = "translateY(-1px)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; e.currentTarget.style.transform = "translateY(0)"; }}>+{n}</button>))}</div>
                    </div>
                    <div style={{ display: "flex", gap: 3, marginTop: 10 }}>{[1, 2, 3, 4].map((i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: level >= i ? pal2.shades[i] : C.bg, transition: "background .4s" }} />)}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                      {thr.map((t, i) => <span key={i} style={{ fontSize: 8, color: C.dim, fontFamily: F }}>{i === 0 ? `<${t}` : t}{i < thr.length - 1 ? "" : "+"}  </span>)}
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {ms.map((m) => {
                      if (isSetMetric(m)) {
                        const sets = hL[m.id] as SetEntry[] | undefined;
                        const hasSets = Array.isArray(sets) && sets.length > 0;
                        return (
                          <div key={m.id} style={{ padding: "8px 12px", borderRadius: 6, background: hasSets ? `${pal2.shades[1]}44` : C.bg, border: `1px solid ${hasSets ? pal2.shades[1] : C.border}`, transition: "all .2s" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 12, color: hasSets ? C.text : C.muted, fontFamily: F, fontWeight: 500 }}>{m.name}</span>
                              <span style={{ fontSize: 9, color: C.accent, fontFamily: F, padding: "1px 5px", borderRadius: 2, background: C.accentDim, fontWeight: 600 }}>SETS</span>
                              {hasSets && <span style={{ fontSize: 10, color: pal2.shades[4], fontFamily: F, fontWeight: 600, marginLeft: "auto" }}>{fmtSets(sets, m.weightUnit)}</span>}
                            </div>
                            <SetInput metric={m} sets={sets} pal={pal2} onAddSet={(_, set) => addSet(h.id, m.id, set)} onRemoveSet={(_, idx) => rmSet(h.id, m.id, idx)} lastWeight={findLastWeight(allLogs[h.id] || {}, m.id)} />
                          </div>
                        );
                      }
                      const sv = (hL[m.id] as string) || "";
                      const sr = parseInt(sv, 10) || 0;
                      return (
                        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 6, background: sr > 0 ? `${pal2.shades[1]}44` : C.bg, border: `1px solid ${sr > 0 ? pal2.shades[1] : C.border}`, transition: "all .2s" }}>
                          <span style={{ fontSize: 12, color: sr > 0 ? C.text : C.muted, fontFamily: F, fontWeight: 500, minWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                          <div style={{ position: "relative", flex: 1 }}><input type="text" inputMode="numeric" value={sv} onChange={(e) => setV(h.id, m.id, e.target.value)} placeholder="0" style={{ ...inpS, fontSize: 14, fontWeight: 600, paddingRight: 40 }} /><span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.dim, fontFamily: F, pointerEvents: "none" }}>{m.unit}</span></div>
                          <div style={{ display: "flex", gap: 3 }}>{getQuickAdd(m.unit, units).map((n) => (<button key={n} onClick={() => qAdd(h.id, m.id, n)} style={{ padding: "6px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.bg, color: C.dim, cursor: "pointer", fontSize: 10, fontFamily: F, transition: "all .2s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = pal2.shades[3]; e.currentTarget.style.color = pal2.shades[4]; e.currentTarget.style.transform = "translateY(-1px)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; e.currentTarget.style.transform = "translateY(0)"; }}>+{n}</button>))}</div>
                        </div>
                      );
                    })}
                    <div style={{ display: "flex", gap: 3, marginTop: 4 }}>{ms.map((m) => <div key={m.id} style={{ flex: 1, height: 4, borderRadius: 2, background: metricActive(m, localLog) ? pal2.shades[3] : C.bg, transition: "background .4s" }} />)}</div>
                  </div>
                )}
              </div>
            );
          })}
          <div key="save" style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <div style={{ fontFamily: F, fontSize: 12, color: C.muted }}>{habits.length} habit{habits.length !== 1 ? "s" : ""} · {selectedDate}</div>
            <button onClick={handleSave} className={saved ? "save-pulse" : ""} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: saved ? C.success : C.accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: F, transition: "all .3s", transform: saved ? "scale(1.04)" : "scale(1)" }}>{saved ? "✓ Saved" : "Save Log"}</button>
          </div>
        </StaggeredList>
      )}
    </div>
  );
}
