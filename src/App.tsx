import { useState, useEffect, useCallback, useRef } from "react";
import { CSS } from "./globalCss";
import { THEME_CSS, THEMES } from "./theme";
import { BUILTIN_UNITS, DEFAULT_CONFIG } from "./lib/defaults";
import { todayK } from "./lib/dates";
import { logActive } from "./lib/stats";
import { loadState, saveState, requestPersistence } from "./lib/storage";
import { setDayLog } from "./lib/logs";
import { reorderById } from "./lib/reorder";
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
import styles from "./App.module.css";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0); // bumped by Retry
  // Saving is allowed only after a load has succeeded, so a failed (or
  // unfinished) load can never write empty state over the real data.
  const loadedRef = useRef(false);
  const [saveFailed, setSaveFailed] = useState(false); // last save threw
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
        loadedRef.current = true;
      } catch (e) {
        console.error("Couldn't load data", e);
        setLoadError(e instanceof Error ? e.message : String(e));
      }
      setLoading(false);
    })();
  }, [loadAttempt]);

  const retryLoad = () => {
    setLoadError(null);
    setLoading(true);
    setLoadAttempt((n) => n + 1);
  };

  const save = useCallback(
    async (h: Habit[], l: Logs, u: Unit[], c: AppConfig) => {
      if (!loadedRef.current) return;
      try {
        await saveState({
          habits: h,
          logs: l,
          units: u,
          config: c,
          timers: timersRef.current,
        });
        setSaveFailed(false);
      } catch (e) {
        console.error("Couldn't save data", e);
        setSaveFailed(true);
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
      <div className={styles.loading}>
        <div className={styles.loadingText}>Loading...</div>
      </div>
    );

  // Stored data couldn't be read. Show this instead of the (empty) dashboard,
  // which would otherwise let the next change save over the real data.
  if (loadError !== null)
    return (
      <div data-theme={theme} className={styles.root}>
        <style>{CSS + THEME_CSS}</style>
        <div role="alert" className={styles.loadError}>
          <h1 className={styles.loadErrorTitle}>Couldn't open your data</h1>
          <p className={styles.loadErrorText}>
            Nothing was changed. Try again, or close and reopen the app.
          </p>
          {loadError && <p className={styles.loadErrorDetail}>{loadError}</p>}
          <button onClick={retryLoad} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      </div>
    );

  // The card list. The sortable wrapper + DnD context stay mounted in both
  // modes so toggling only flips props on the same D3Calendar instance — the
  // card animates its height down to the header (grid-template-rows) instead of
  // remounting. The grip handle is only rendered while reordering.
  const habitList = (
    <div>
      {habits.map((h, i) => (
        <SortableHabitCard key={h.id} id={h.id} index={i}>
          {(drag) => (
            <D3Calendar
              reorderMode={reorder}
              dragActivator={reorder ? drag : undefined}
              expanded={dashView === "calendar"}
              habit={h}
              logs={logs[h.id] || {}}
              units={units}
              onSaveDay={(dateKey, entry) =>
                saveLog(dateKey, { [h.id]: entry })
              }
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
          )}
        </SortableHabitCard>
      ))}
    </div>
  );

  return (
    <div data-theme={theme} className={styles.root}>
      <style>{CSS + THEME_CSS}</style>
      <div className={styles.container}>
        {/* Stays up until a later save succeeds */}
        {saveFailed && (
          <div role="alert" className={styles.saveError}>
            Changes aren't being saved — export a backup from Settings ⚙
          </div>
        )}

        {/* Header */}
        <div className={`stagger-child ${styles.header}`}>
          <div>
            <h1 className={styles.title}>
              <BrandMark />
              Habits
            </h1>
            <p className={styles.subtitle}>
              {habits.length > 0
                ? `${completed}/${habits.length} completed today`
                : "Start tracking"}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              onClick={() => setShowUnits(true)}
              title="Settings"
              className={styles.iconBtn}
            >
              ⚙
            </button>
            <button onClick={() => setShowAdd(true)} className={styles.newBtn}>
              <span className={styles.newBtnPlus}>+</span> New Habit
            </button>
          </div>
        </div>

        {/* Content — single view; Quick (collapsed) ⟷ Calendar (expanded heatmaps) */}
        <div className={styles.content}>
          {habits.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📊</div>
              <div className={styles.emptyTitle}>No habits yet</div>
              <div className={styles.emptyHint}>Click "New Habit" to start</div>
            </div>
          ) : (
            <>
              <div className={styles.controls}>
                {reorder ? (
                  <span key="hint" className={styles.reorderHint}>
                    Drag the ⠿ handles to reorder
                  </span>
                ) : (
                  <div key="views" className={styles.viewSeg}>
                    {(
                      [
                        { id: "quick", label: "Quick" },
                        { id: "calendar", label: "Calendar" },
                      ] as const
                    ).map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setDashView(v.id)}
                        className={`${styles.viewBtn}${dashView === v.id ? ` ${styles.on}` : ""}`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}
                {habits.length > 1 && (
                  <button
                    onClick={() => setReorder((r) => !r)}
                    className={`${styles.reorderBtn}${reorder ? ` ${styles.on}` : ""}`}
                  >
                    {reorder ? "Done" : "⠿ Reorder"}
                  </button>
                )}
              </div>
              <SortableHabits
                ids={habits.map((h) => h.id)}
                onReorder={reorderHabits}
              >
                {habitList}
              </SortableHabits>
            </>
          )}
        </div>

        <div className={`stagger-child ${styles.footer}`}>
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
