import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties } from "react";
import {
  C,
  F,
  CSS,
  THEME_CSS,
  THEMES,
  BUILTIN_UNITS,
  DEFAULT_CONFIG,
} from "./constants";
import { todayK } from "./lib/dates";
import { logActive } from "./lib/stats";
import { loadState, saveState, requestPersistence } from "./lib/storage";
import { setDayLog } from "./lib/logs";
import { reorderById } from "./lib/reorder";
import StaggeredList from "./components/StaggeredList";
import SortableHabits from "./components/SortableHabits";
import SortableHabitCard from "./components/SortableHabitCard";
import D3Calendar from "./components/D3Calendar";
import AddHabitModal from "./components/AddHabitModal";
import EditHabitModal from "./components/EditHabitModal";
import SettingsModal from "./components/SettingsModal";
import BrandMark from "./components/BrandMark";
import type {
  AppConfig,
  DashView,
  Habit,
  Logs,
  PersistedState,
  SetEntry,
  Timers,
  Unit,
} from "./types";
import type { NewHabit } from "./components/AddHabitModal";

// Header action buttons (static; hover handlers stay inline at the call sites).
const iconBtn: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.dim,
  cursor: "pointer",
  fontSize: 15,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all .2s",
};
const newHabitBtn: CSSProperties = {
  padding: "9px 18px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text,
  cursor: "pointer",
  fontSize: 13,
  fontFamily: F,
  fontWeight: 500,
  display: "flex",
  alignItems: "center",
  gap: 8,
  transition: "all .2s",
};

export default function App() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Logs>({});
  const [units, setUnits] = useState<Unit[]>(BUILTIN_UNITS);
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [showAdd, setShowAdd] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [showUnits, setShowUnits] = useState(false);
  const [reorder, setReorder] = useState(false); // transient: condense cards + enable drag
  const [loading, setLoading] = useState(true);
  const [timers, setTimers] = useState<Timers>({}); // { "habitId:metricId": startTimestamp }
  // Mirror timers in a ref so save() always serializes the latest value without
  // every mutator having to thread it through (timers change only on start/stop).
  const timersRef = useRef<Timers>({});
  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  // Keep the page background and iOS status-bar color in sync with the theme
  // (body and the <meta> tag live outside the themed root element).
  const theme = appConfig.theme === "light" ? "light" : "dark";
  useEffect(() => {
    const bg = THEMES[theme].bg;
    document.body.style.background = bg;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", bg);
  }, [theme]);

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
          if (p.timers) {
            setTimers(p.timers);
            timersRef.current = p.timers;
          }
        }
      } catch (e) {
        console.log("Fresh", e);
      }
      setLoading(false);
    })();
  }, []);

  const save = useCallback(
    async (h: Habit[], l: Logs, u: Unit[], c: AppConfig) => {
      try {
        await saveState({
          habits: h,
          logs: l,
          units: u,
          config: c,
          timers: timersRef.current,
        });
      } catch (e) {
        console.error(e);
      }
    },
    [],
  );
  const updateConfig = useCallback(
    (c: AppConfig) => {
      setAppConfig(c);
      save(habits, logs, units, c);
    },
    [habits, logs, units, save],
  );

  const addUnit = useCallback(
    (ud: Unit) => {
      if (units.find((u) => u.id === ud.id)) return;
      const nu = [...units, ud];
      setUnits(nu);
      save(habits, logs, nu, appConfig);
    },
    [units, habits, logs, appConfig, save],
  );
  const updateUnit = useCallback(
    (id: string, updates: Partial<Unit>) => {
      const nu = units.map((u) => (u.id === id ? { ...u, ...updates } : u));
      setUnits(nu);
      save(habits, logs, nu, appConfig);
    },
    [units, habits, logs, appConfig, save],
  );
  const deleteUnit = useCallback(
    (id: string) => {
      const nu = units.filter((u) => u.id !== id);
      setUnits(nu);
      save(habits, logs, nu, appConfig);
    },
    [units, habits, logs, appConfig, save],
  );

  const addHabit = useCallback(
    (props: NewHabit) => {
      const id = `h_${Date.now()}`;
      const nh = [...habits, { id, ...props }];
      const nl = { ...logs, [id]: {} };
      setHabits(nh);
      setLogs(nl);
      save(nh, nl, units, appConfig);
    },
    [habits, logs, units, appConfig, save],
  );
  const updateHabit = useCallback(
    (updated: Habit) => {
      const nh = habits.map((h) => (h.id === updated.id ? updated : h));
      setHabits(nh);
      save(nh, logs, units, appConfig);
    },
    [habits, logs, units, appConfig, save],
  );
  const deleteHabit = useCallback(
    (id: string) => {
      const nh = habits.filter((h) => h.id !== id);
      const nl = { ...logs };
      delete nl[id];
      setHabits(nh);
      setLogs(nl);
      save(nh, nl, units, appConfig);
    },
    [habits, logs, units, appConfig, save],
  );
  const reorderHabits = useCallback(
    (activeId: string, overId: string) => {
      const nh = reorderById(habits, activeId, overId);
      setHabits(nh);
      save(nh, logs, units, appConfig);
    },
    [habits, logs, units, appConfig, save],
  );
  const saveLog = useCallback(
    (dateKey: string, parsed: Record<string, Logs[string][string]>) => {
      let nl = logs;
      Object.entries(parsed).forEach(([hId, entry]) => {
        nl = setDayLog(nl, hId, dateKey, entry);
      });
      setLogs(nl);
      save(habits, nl, units, appConfig);
    },
    [logs, habits, units, appConfig, save],
  );
  const quickLog = useCallback(
    (hId: string, mId: string, amt: number) => {
      const tk = todayK();
      const prev = logs[hId] || {};
      const prevDay = prev[tk] || {};
      const nl = {
        ...logs,
        [hId]: {
          ...prev,
          [tk]: { ...prevDay, [mId]: ((prevDay[mId] as number) || 0) + amt },
        },
      };
      setLogs(nl);
      save(habits, nl, units, appConfig);
    },
    [logs, habits, units, appConfig, save],
  );
  const quickReset = useCallback(
    (hId: string, mId: string) => {
      const tk = todayK();
      const prev = logs[hId] || {};
      const prevDay = prev[tk] || {};
      const nl = {
        ...logs,
        [hId]: { ...prev, [tk]: { ...prevDay, [mId]: 0 } },
      };
      setLogs(nl);
      save(habits, nl, units, appConfig);
    },
    [logs, habits, units, appConfig, save],
  );
  const quickAddSet = useCallback(
    (hId: string, mId: string, set: SetEntry) => {
      const tk = todayK();
      const prev = logs[hId] || {};
      const prevDay = prev[tk] || {};
      const curSets = Array.isArray(prevDay[mId])
        ? (prevDay[mId] as SetEntry[])
        : [];
      const nl = {
        ...logs,
        [hId]: { ...prev, [tk]: { ...prevDay, [mId]: [...curSets, set] } },
      };
      setLogs(nl);
      save(habits, nl, units, appConfig);
    },
    [logs, habits, units, appConfig, save],
  );
  const quickRemoveSet = useCallback(
    (hId: string, mId: string, idx: number) => {
      const tk = todayK();
      const prev = logs[hId] || {};
      const prevDay = prev[tk] || {};
      const curSets = Array.isArray(prevDay[mId])
        ? [...(prevDay[mId] as SetEntry[])]
        : [];
      curSets.splice(idx, 1);
      const nl = {
        ...logs,
        [hId]: { ...prev, [tk]: { ...prevDay, [mId]: curSets } },
      };
      setLogs(nl);
      save(habits, nl, units, appConfig);
    },
    [logs, habits, units, appConfig, save],
  );
  const startTimer = useCallback(
    (hId: string, mId: string) => {
      const nt = { ...timersRef.current, [`${hId}:${mId}`]: Date.now() };
      timersRef.current = nt;
      setTimers(nt);
      save(habits, logs, units, appConfig); // persist so the timer survives a reload
    },
    [habits, logs, units, appConfig, save],
  );
  const stopTimer = useCallback(
    (hId: string, mId: string) => {
      const key = `${hId}:${mId}`;
      const start = timersRef.current[key];
      if (!start) return;
      const mins = Math.max(1, Math.round((Date.now() - start) / 60000));
      const nt = { ...timersRef.current };
      delete nt[key];
      timersRef.current = nt;
      setTimers(nt);
      quickLog(hId, mId, mins); // logs the minutes and persists (incl. the cleared timer)
    },
    [quickLog],
  );

  const replaceAll = useCallback(
    (state: PersistedState) => {
      const nh = state.habits || [];
      const nl = state.logs || {};
      const nu =
        state.units && state.units.length ? state.units : BUILTIN_UNITS;
      const nc = { ...DEFAULT_CONFIG, ...(state.config || {}) };
      timersRef.current = {};
      setTimers({}); // don't resurrect stale timers from a backup
      setHabits(nh);
      setLogs(nl);
      setUnits(nu);
      setAppConfig(nc);
      save(nh, nl, nu, nc);
    },
    [save],
  );

  const dashView = appConfig.dashView ?? "quick"; // persisted Quick/Calendar choice
  const setDashView = (v: DashView) =>
    updateConfig({ ...appConfig, dashView: v });
  const tKey = todayK();
  const completed = habits.filter((h) =>
    logActive(h, logs[h.id]?.[tKey], units),
  ).length;

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: C.muted,
            fontFamily: F,
            fontSize: 14,
            animation: "fadeIn .5s ease",
          }}
        >
          Loading...
        </div>
      </div>
    );

  // The card list. In reorder mode each card condenses (reorderMode) and gets a
  // drag handle; otherwise it renders normally with no dnd machinery at all.
  const habitList = (
    <StaggeredList keyProp="dashboard">
      {habits.map((h) => {
        const card = (handle?: React.ReactNode) => (
          <D3Calendar
            reorderMode={reorder}
            dragHandle={handle}
            expanded={dashView === "calendar"}
            habit={h}
            logs={logs[h.id] || {}}
            units={units}
            onSaveDay={(dateKey, entry) => saveLog(dateKey, { [h.id]: entry })}
            onEdit={() => setEditHabit(h)}
            onQuickLog={(mId, amt) => quickLog(h.id, mId, amt)}
            onQuickReset={(mId) => quickReset(h.id, mId)}
            onAddSet={(mId, set) => quickAddSet(h.id, mId, set)}
            onRemoveSet={(mId, idx) => quickRemoveSet(h.id, mId, idx)}
            timers={timers}
            onStartTimer={(mId) => startTimer(h.id, mId)}
            onStopTimer={(mId) => stopTimer(h.id, mId)}
            habitId={h.id}
            appConfig={appConfig}
          />
        );
        return reorder ? (
          <SortableHabitCard key={h.id} id={h.id}>
            {(handle) => card(handle)}
          </SortableHabitCard>
        ) : (
          <div key={h.id}>{card()}</div>
        );
      })}
    </StaggeredList>
  );

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: F,
      }}
    >
      <style>{CSS + THEME_CSS}</style>
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding:
            "calc(32px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left))",
        }}
      >
        {/* Header */}
        <div
          className="stagger-child"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "-.02em",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <BrandMark />
              Habits
            </h1>
            <p style={{ margin: "4px 0 0 28px", fontSize: 12, color: C.muted }}>
              {habits.length > 0
                ? `${completed}/${habits.length} completed today`
                : "Start tracking"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setShowUnits(true)}
              title="Settings"
              style={iconBtn}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.muted;
                e.currentTarget.style.color = C.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.color = C.dim;
              }}
            >
              ⚙
            </button>
            <button
              onClick={() => setShowAdd(true)}
              style={newHabitBtn}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.accent;
                e.currentTarget.style.color = C.accent;
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.color = C.text;
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Habit
            </button>
          </div>
        </div>

        {/* Content — single view; Quick (collapsed) ⟷ Calendar (expanded heatmaps) */}
        <div style={{ minHeight: 200 }}>
          {habits.length === 0 ? (
            <div
              style={{
                background: C.surface,
                borderRadius: 10,
                border: `1px dashed ${C.border}`,
                padding: "60px 20px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
              <div style={{ fontSize: 16, color: C.muted, marginBottom: 8 }}>
                No habits yet
              </div>
              <div style={{ fontSize: 12, color: C.dim }}>
                Click "New Habit" to start
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {reorder ? (
                  <span style={{ fontSize: 12, color: C.muted, fontFamily: F }}>
                    Drag the ⠿ handles to reorder
                  </span>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      background: C.surface,
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      padding: 3,
                      gap: 2,
                    }}
                  >
                    {(
                      [
                        { id: "quick", label: "Quick" },
                        { id: "calendar", label: "Calendar" },
                      ] as const
                    ).map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setDashView(v.id)}
                        style={{
                          padding: "6px 16px",
                          borderRadius: 6,
                          border: "none",
                          background: dashView === v.id ? C.bg : "transparent",
                          color: dashView === v.id ? C.text : C.muted,
                          fontWeight: dashView === v.id ? 600 : 400,
                          fontSize: 12,
                          fontFamily: F,
                          cursor: "pointer",
                          transition: "all .2s",
                        }}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}
                {habits.length > 1 && (
                  <button
                    onClick={() => setReorder((r) => !r)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      border: `1px solid ${reorder ? C.accent : C.border}`,
                      background: reorder ? C.accentDim : C.surface,
                      color: reorder ? C.accent : C.muted,
                      cursor: "pointer",
                      fontSize: 12,
                      fontFamily: F,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      transition: "all .2s",
                    }}
                  >
                    {reorder ? "Done" : "⠿ Reorder"}
                  </button>
                )}
              </div>
              {reorder ? (
                <SortableHabits
                  ids={habits.map((h) => h.id)}
                  onReorder={reorderHabits}
                >
                  {habitList}
                </SortableHabits>
              ) : (
                habitList
              )}
            </>
          )}
        </div>

        <div
          className="stagger-child"
          style={{
            textAlign: "center",
            marginTop: 32,
            fontSize: 11,
            color: C.dim,
            animationDelay: "500ms",
          }}
        >
          tap a day to log it · long-press a habit to edit · ‹› to navigate
        </div>
      </div>

      {/* Modals */}
      {showAdd && (
        <AddHabitModal
          onAdd={addHabit}
          onClose={() => setShowAdd(false)}
          units={units}
          onAddUnit={addUnit}
        />
      )}
      {editHabit && (
        <EditHabitModal
          habit={editHabit}
          onSave={updateHabit}
          onDelete={(id) => {
            deleteHabit(id);
            setEditHabit(null);
          }}
          onClose={() => setEditHabit(null)}
          units={units}
          onAddUnit={addUnit}
        />
      )}
      {showUnits && (
        <SettingsModal
          units={units}
          habits={habits}
          logs={logs}
          onUpdateUnit={updateUnit}
          onDeleteUnit={deleteUnit}
          onAddUnit={addUnit}
          appConfig={appConfig}
          onUpdateConfig={updateConfig}
          onImportState={replaceAll}
          onClose={() => setShowUnits(false)}
        />
      )}
    </div>
  );
}
