import { useState, useEffect, useCallback, useRef } from "react";
import { C, F, CSS, BUILTIN_UNITS, DEFAULT_CONFIG } from "./constants";
import { todayK } from "./lib/dates";
import { logActive } from "./lib/stats";
import { loadState, saveState, requestPersistence } from "./lib/storage";
import StaggeredList from "./components/StaggeredList";
import D3Calendar from "./components/D3Calendar";
import LogEntry from "./components/LogEntry";
import AddHabitModal from "./components/AddHabitModal";
import EditHabitModal from "./components/EditHabitModal";
import SettingsModal from "./components/SettingsModal";
import type { AppConfig, Habit, Logs, PersistedState, SetEntry, Timers, Unit } from "./types";
import type { NewHabit } from "./components/AddHabitModal";

export default function App() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Logs>({});
  const [units, setUnits] = useState<Unit[]>(BUILTIN_UNITS);
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [showAdd, setShowAdd] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [showUnits, setShowUnits] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "log">("dashboard");
  const [logDate, setLogDate] = useState(todayK());
  const [slideDir, setSlideDir] = useState<"left" | "right">("left");
  const [transKey, setTransKey] = useState(0);
  const prevTab = useRef<"dashboard" | "log">("dashboard");
  const [timers, setTimers] = useState<Timers>({}); // { "habitId:metricId": startTimestamp }

  useEffect(() => {
    (async () => {
      try {
        await requestPersistence();
        const p = await loadState();
        if (p) {
          setHabits(p.habits || []);
          setLogs(p.logs || {});
          if (p.units) setUnits(p.units);
          if (p.config) setAppConfig((c) => ({ ...c, ...p.config }));
        }
      } catch (e) {
        console.log("Fresh", e);
      }
      setLoading(false);
    })();
  }, []);

  const save = useCallback(async (h: Habit[], l: Logs, u: Unit[], c: AppConfig) => {
    try {
      await saveState({ habits: h, logs: l, units: u, config: c });
    } catch (e) {
      console.error(e);
    }
  }, []);
  const updateConfig = useCallback((c: AppConfig) => { setAppConfig(c); save(habits, logs, units, c); }, [habits, logs, units, save]);

  const addUnit = useCallback((ud: Unit) => { if (units.find((u) => u.id === ud.id)) return; const nu = [...units, ud]; setUnits(nu); save(habits, logs, nu, appConfig); }, [units, habits, logs, appConfig, save]);
  const updateUnit = useCallback((id: string, updates: Partial<Unit>) => { const nu = units.map((u) => (u.id === id ? { ...u, ...updates } : u)); setUnits(nu); save(habits, logs, nu, appConfig); }, [units, habits, logs, appConfig, save]);
  const deleteUnit = useCallback((id: string) => { const nu = units.filter((u) => u.id !== id); setUnits(nu); save(habits, logs, nu, appConfig); }, [units, habits, logs, appConfig, save]);

  const addHabit = useCallback((props: NewHabit) => { const id = `h_${Date.now()}`; const nh = [...habits, { id, ...props }]; const nl = { ...logs, [id]: {} }; setHabits(nh); setLogs(nl); save(nh, nl, units, appConfig); }, [habits, logs, units, appConfig, save]);
  const updateHabit = useCallback((updated: Habit) => { const nh = habits.map((h) => (h.id === updated.id ? updated : h)); setHabits(nh); save(nh, logs, units, appConfig); }, [habits, logs, units, appConfig, save]);
  const deleteHabit = useCallback((id: string) => { const nh = habits.filter((h) => h.id !== id); const nl = { ...logs }; delete nl[id]; setHabits(nh); setLogs(nl); save(nh, nl, units, appConfig); }, [habits, logs, units, appConfig, save]);
  const saveLog = useCallback((dateKey: string, parsed: Record<string, Logs[string][string]>) => { const nl = { ...logs }; Object.entries(parsed).forEach(([hId, entry]) => { if (!nl[hId]) nl[hId] = {}; nl[hId][dateKey] = entry; }); setLogs(nl); save(habits, nl, units, appConfig); }, [logs, habits, units, appConfig, save]);
  const quickLog = useCallback((hId: string, mId: string, amt: number) => { const tk = todayK(); const prev = logs[hId] || {}; const prevDay = prev[tk] || {}; const nl = { ...logs, [hId]: { ...prev, [tk]: { ...prevDay, [mId]: ((prevDay[mId] as number) || 0) + amt } } }; setLogs(nl); save(habits, nl, units, appConfig); }, [logs, habits, units, appConfig, save]);
  const quickReset = useCallback((hId: string, mId: string) => { const tk = todayK(); const prev = logs[hId] || {}; const prevDay = prev[tk] || {}; const nl = { ...logs, [hId]: { ...prev, [tk]: { ...prevDay, [mId]: 0 } } }; setLogs(nl); save(habits, nl, units, appConfig); }, [logs, habits, units, appConfig, save]);
  const quickAddSet = useCallback((hId: string, mId: string, set: SetEntry) => { const tk = todayK(); const prev = logs[hId] || {}; const prevDay = prev[tk] || {}; const curSets = Array.isArray(prevDay[mId]) ? (prevDay[mId] as SetEntry[]) : []; const nl = { ...logs, [hId]: { ...prev, [tk]: { ...prevDay, [mId]: [...curSets, set] } } }; setLogs(nl); save(habits, nl, units, appConfig); }, [logs, habits, units, appConfig, save]);
  const quickRemoveSet = useCallback((hId: string, mId: string, idx: number) => { const tk = todayK(); const prev = logs[hId] || {}; const prevDay = prev[tk] || {}; const curSets = Array.isArray(prevDay[mId]) ? [...(prevDay[mId] as SetEntry[])] : []; curSets.splice(idx, 1); const nl = { ...logs, [hId]: { ...prev, [tk]: { ...prevDay, [mId]: curSets } } }; setLogs(nl); save(habits, nl, units, appConfig); }, [logs, habits, units, appConfig, save]);
  const startTimer = useCallback((hId: string, mId: string) => { setTimers((p) => ({ ...p, [`${hId}:${mId}`]: Date.now() })); }, []);
  const stopTimer = useCallback((hId: string, mId: string) => { const key = `${hId}:${mId}`; const start = timers[key]; if (!start) return; const mins = Math.max(1, Math.round((Date.now() - start) / 60000)); setTimers((p) => { const nt = { ...p }; delete nt[key]; return nt; }); quickLog(hId, mId, mins); }, [timers, quickLog]);

  const replaceAll = useCallback((state: PersistedState) => {
    const nh = state.habits || [];
    const nl = state.logs || {};
    const nu = state.units && state.units.length ? state.units : BUILTIN_UNITS;
    const nc = { ...DEFAULT_CONFIG, ...(state.config || {}) };
    setHabits(nh); setLogs(nl); setUnits(nu); setAppConfig(nc);
    save(nh, nl, nu, nc);
  }, [save]);

  const switchTab = useCallback((t: "dashboard" | "log") => { if (t === tab) return; setSlideDir(t === "log" ? "left" : "right"); setTransKey((k) => k + 1); prevTab.current = tab; setTab(t); }, [tab]);
  const navToLog = useCallback((dateKey: string) => { setLogDate(dateKey); setSlideDir("left"); setTransKey((k) => k + 1); prevTab.current = "dashboard"; setTab("log"); }, []);
  const tKey = todayK();
  const completed = habits.filter((h) => logActive(h, logs[h.id]?.[tKey], units)).length;

  if (loading) return (<div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: C.muted, fontFamily: F, fontSize: 14, animation: "fadeIn .5s ease" }}>Loading...</div></div>);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: F }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
        {/* Header */}
        <div className="stagger-child" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.green4, boxShadow: `0 0 12px ${C.green4}` }} />
              habits<span style={{ color: C.dim, fontWeight: 400 }}>.v2</span>
            </h1>
            <p style={{ margin: "4px 0 0 18px", fontSize: 12, color: C.muted }}>{habits.length > 0 ? `${completed}/${habits.length} completed today` : "Start tracking"}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setShowUnits(true)} title="Settings" style={{ width: 36, height: 36, borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.dim, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.muted; e.currentTarget.style.color = C.text; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>⚙</button>
            <button onClick={() => setShowAdd(true)} style={{ padding: "9px 18px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: "pointer", fontSize: 13, fontFamily: F, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, transition: "all .2s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; e.currentTarget.style.transform = "translateY(-1px)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text; e.currentTarget.style.transform = "translateY(0)"; }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Habit</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 24, background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, padding: 4 }}>
          {([{ id: "dashboard", label: "Dashboard", icon: "◻" }, { id: "log", label: "Log Entry", icon: "✎" }] as const).map((t) => (
            <button key={t.id} onClick={() => switchTab(t.id)} style={{ flex: 1, padding: "10px 16px", borderRadius: 7, border: "none", background: tab === t.id ? C.bg : "transparent", color: tab === t.id ? C.text : C.muted, cursor: "pointer", fontSize: 13, fontFamily: F, fontWeight: tab === t.id ? 600 : 400, transition: "all .35s cubic-bezier(.16,1,.3,1)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,.3)" : "none", transform: tab === t.id ? "scale(1)" : "scale(.98)" }}><span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}</button>))}
        </div>

        {/* Content */}
        <div key={transKey} className={slideDir === "left" ? "panel-slide-left" : "panel-slide-right"} style={{ minHeight: 200 }}>
          {tab === "dashboard" && (habits.length === 0 ? (
            <div style={{ background: C.surface, borderRadius: 10, border: `1px dashed ${C.border}`, padding: "60px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
              <div style={{ fontSize: 16, color: C.muted, marginBottom: 8 }}>No habits yet</div>
              <div style={{ fontSize: 12, color: C.dim }}>Click "New Habit" to start</div>
            </div>
          ) : (
            <StaggeredList keyProp={`d-${transKey}`}>
              {habits.map((h) => (
                <div key={h.id}>
                  <D3Calendar habit={h} logs={logs[h.id] || {}} units={units} onCellClick={navToLog} onEdit={() => setEditHabit(h)} onQuickLog={(mId, amt) => quickLog(h.id, mId, amt)} onQuickReset={(mId) => quickReset(h.id, mId)} onAddSet={(mId, set) => quickAddSet(h.id, mId, set)} onRemoveSet={(mId, idx) => quickRemoveSet(h.id, mId, idx)} timers={timers} onStartTimer={(mId) => startTimer(h.id, mId)} onStopTimer={(mId) => stopTimer(h.id, mId)} habitId={h.id} appConfig={appConfig} />
                </div>
              ))}
            </StaggeredList>))}
          {tab === "log" && <LogEntry habits={habits} allLogs={logs} units={units} onSaveLog={saveLog} selectedDate={logDate} onDateChange={setLogDate} timers={timers} onStopTimer={stopTimer} />}
        </div>

        <div className="stagger-child" style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: C.dim, animationDelay: "500ms" }}>
          metrics + units · heat ↔ cal · ‹› to navigate · long-press to edit
        </div>
      </div>

      {/* Modals */}
      {showAdd && <AddHabitModal onAdd={addHabit} onClose={() => setShowAdd(false)} units={units} onAddUnit={addUnit} />}
      {editHabit && <EditHabitModal habit={editHabit} onSave={updateHabit} onDelete={(id) => { deleteHabit(id); setEditHabit(null); }} onClose={() => setEditHabit(null)} units={units} onAddUnit={addUnit} />}
      {showUnits && <SettingsModal units={units} habits={habits} logs={logs} onUpdateUnit={updateUnit} onDeleteUnit={deleteUnit} onAddUnit={addUnit} appConfig={appConfig} onUpdateConfig={updateConfig} onImportState={replaceAll} onClose={() => setShowUnits(false)} />}
    </div>
  );
}
