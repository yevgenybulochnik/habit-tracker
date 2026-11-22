import { useState, useEffect, useReducer, useRef } from "react";
import { CSS } from "./globalCss";
import { THEME_CSS, THEMES } from "./theme";
import { BUILTIN_UNITS, DEFAULT_CONFIG } from "./lib/defaults";
import { logActive } from "./lib/stats";
import { groupSections, ungroupedHabits } from "./lib/groups";
import {
  InvalidDataError,
  loadState,
  saveState,
  requestPersistence,
} from "./lib/storage";
import { SCHEMA_VERSION } from "./lib/normalize";
import { reduce, type AppState } from "./lib/state";
import { newId } from "./lib/ids";
import { downloadJson } from "./download";
import { useToday } from "./hooks/useToday";
import { DispatchContext } from "./hooks/useHabitActions";
import SortableHabits from "./components/SortableHabits";
import SortableHabitCard from "./components/SortableHabitCard";
import HabitCard from "./components/HabitCard";
import GroupSections from "./components/GroupSections";
import GroupEditModal from "./components/GroupEditModal";
import NewHabitPage from "./components/NewHabitPage";
import EditHabitModal from "./components/EditHabitModal";
import SettingsModal from "./components/SettingsModal";
import BrandMark from "./components/BrandMark";
import Icon from "./components/Icon";
import type { ClosePage } from "./components/PageShell";
import Routines from "./components/Routines";
import { slide } from "./slide";
import type { Group, Habit, Unit } from "./types";
import styles from "./App.module.css";

/** A page slid over the habits, in their place. */
type Page = { kind: "routines" } | { kind: "newHabit" };

const EMPTY: AppState = {
  habits: [],
  logs: {},
  units: BUILTIN_UNITS,
  config: DEFAULT_CONFIG,
  groups: [],
  routines: [],
  timers: {},
};

export default function App() {
  // The one place the app learns what day it is. Everything below gets it
  // from here, so the whole UI moves to the new day together at midnight.
  const today = useToday();
  // Every change goes through the reducer; the effect below saves the result.
  const [state, dispatch] = useReducer(reduce, EMPTY);
  const {
    habits,
    logs,
    units,
    config: appConfig,
    groups,
    routines,
    timers,
  } = state;
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [showUnits, setShowUnits] = useState(false);
  const [reorder, setReorder] = useState(false); // transient: condense cards + enable drag
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The stored data, when it was read but isn't in a usable format: offered
  // as a download on the error screen.
  const [rawData, setRawData] = useState<unknown>(undefined);
  const [loadAttempt, setLoadAttempt] = useState(0); // bumped by Retry
  const [saveFailed, setSaveFailed] = useState(false); // last save threw
  // The state as last loaded or saved. It stays null until a load succeeds.
  const savedRef = useRef<AppState | null>(null);
  // A page (the Routines page, a form) slides over the habits, which stay
  // mounted underneath (cards keep their state) and get their scroll position
  // back on the way back.
  const [page, setPage] = useState<Page | null>(null);
  const habitsScroll = useRef(0);
  const openPage = (next: Page) => {
    habitsScroll.current = window.scrollY;
    slide(
      "forward",
      () => setPage(next),
      () => window.scrollTo(0, 0),
    );
  };
  const closePage: ClosePage = (then) =>
    slide(
      "back",
      () => {
        then?.();
        setPage(null);
      },
      () => window.scrollTo(0, habitsScroll.current),
    );

  // Keep the page background and iOS status-bar color in sync with the theme
  // (body and the <meta> tag live outside the themed root element).
  const theme = appConfig.theme;
  useEffect(() => {
    const bg = THEMES[theme].bg;
    document.body.style.background = bg;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", bg);
  }, [theme]);

  useEffect(() => {
    // Strict mode runs this twice; only the latest load may set the state.
    let stale = false;
    (async () => {
      try {
        await requestPersistence();
        const p = await loadState();
        if (stale) return;
        // loadState returns complete, current-format state
        if (p) dispatch({ type: "state/load", state: p });
      } catch (e) {
        if (stale) return;
        console.error("Couldn't load data", e);
        if (e instanceof InvalidDataError) setRawData(e.raw);
        setLoadError(e instanceof Error ? e.message : String(e));
      }
      setLoading(false);
    })();
    return () => {
      stale = true;
    };
  }, [loadAttempt]);

  // Save each new state. Saving starts only once a load has succeeded, so a
  // failed (or unfinished) load can never write empty state over the real
  // data. The first state after the load is the loaded data itself.
  const loaded = !loading && loadError === null;
  useEffect(() => {
    if (!loaded || state === savedRef.current) return;
    const first = savedRef.current === null;
    savedRef.current = state;
    if (first) return;
    saveState({ schemaVersion: SCHEMA_VERSION, ...state }).then(
      () => setSaveFailed(false),
      (e) => {
        console.error("Couldn't save data", e);
        setSaveFailed(true);
      },
    );
  }, [loaded, state]);

  const retryLoad = () => {
    setLoadError(null);
    setRawData(undefined);
    setLoading(true);
    setLoadAttempt((n) => n + 1);
  };

  const addUnit = (unit: Unit) => dispatch({ type: "unit/add", unit });
  const addGroup = (group: Group) => dispatch({ type: "group/add", group });

  const dashView = appConfig.dashView; // persisted Quick/Calendar choice
  const editGroup = groups.find((g) => g.id === editGroupId);
  const completed = habits.filter((h) =>
    logActive(h, logs[h.id]?.[today], units),
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
          <div className={styles.loadErrorActions}>
            <button onClick={retryLoad} className={styles.loadErrorBtn}>
              Retry
            </button>
            {rawData !== undefined && (
              <button
                onClick={() =>
                  downloadJson(`habit-tracker-raw-data-${today}.json`, rawData)
                }
                className={styles.loadErrorBtn}
              >
                Download raw data
              </button>
            )}
          </div>
        </div>
      </div>
    );

  // A list of cards: every habit, or with groups the ungrouped ones or one
  // section's. Each list is its own drag context, so a card is reordered
  // within its list. The sortable wrapper + DnD context stay mounted in both
  // modes so toggling only flips props on the same HabitCard instance — the
  // card animates its height down to the header (grid-template-rows) instead of
  // remounting. The grip handle is only rendered while reordering. Cards
  // dispatch their own changes, through useHabitActions.
  const renderList = (list: Habit[]) => (
    <SortableHabits
      ids={list.map((h) => h.id)}
      onReorder={(activeId, overId) =>
        dispatch({ type: "habit/reorder", activeId, overId })
      }
    >
      <div>
        {list.map((h, i) => (
          <SortableHabitCard key={h.id} id={h.id} index={i}>
            {(drag) => (
              <HabitCard
                reorderMode={reorder}
                dragActivator={reorder ? drag : undefined}
                expanded={dashView === "calendar"}
                habit={h}
                logs={logs[h.id] || {}}
                units={units}
                onEdit={() => setEditHabit(h)}
                timers={timers}
                appConfig={appConfig}
                today={today}
              />
            )}
          </SortableHabitCard>
        ))}
      </div>
    </SortableHabits>
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

        <div className={page ? styles.away : undefined}>
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
                onClick={() => openPage({ kind: "routines" })}
                title="Routines"
                className={styles.iconBtn}
              >
                <Icon name="stopwatch" size={18} />
              </button>
              <button
                onClick={() => setShowUnits(true)}
                title="Settings"
                className={styles.iconBtn}
              >
                ⚙
              </button>
              <button
                onClick={() => openPage({ kind: "newHabit" })}
                className={styles.newBtn}
              >
                <span className={styles.newBtnPlus}>+</span>
                <span className={styles.newBtnLabel}>New Habit</span>
              </button>
            </div>
          </div>

          {/* Content — single view; Quick (collapsed) ⟷ Calendar (expanded heatmaps) */}
          <div className={styles.content}>
            {habits.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📊</div>
                <div className={styles.emptyTitle}>No habits yet</div>
                <div className={styles.emptyHint}>
                  Click "New Habit" to start
                </div>
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
                          onClick={() =>
                            dispatch({
                              type: "config/update",
                              changes: { dashView: v.id },
                            })
                          }
                          className={`${styles.viewBtn}${dashView === v.id ? ` ${styles.on}` : ""}`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {(habits.length > 1 || groups.length > 1) && (
                    <button
                      onClick={() => setReorder((r) => !r)}
                      className={`${styles.reorderBtn}${reorder ? ` ${styles.on}` : ""}`}
                    >
                      {reorder ? "Done" : "⠿ Reorder"}
                    </button>
                  )}
                </div>
                <DispatchContext.Provider value={dispatch}>
                  {groups.length > 0 ? (
                    <GroupSections
                      sections={groupSections(habits, groups)}
                      ungrouped={ungroupedHabits(habits, groups)}
                      renderList={renderList}
                      isDone={(h) => logActive(h, logs[h.id]?.[today], units)}
                      onToggle={(id, collapsed) =>
                        dispatch({
                          type: "group/update",
                          id,
                          changes: { collapsed },
                        })
                      }
                      reorder={reorder}
                      onReorderGroups={(activeId, overId) =>
                        dispatch({ type: "group/reorder", activeId, overId })
                      }
                      onEditGroup={setEditGroupId}
                    />
                  ) : (
                    renderList(habits)
                  )}
                </DispatchContext.Provider>
              </>
            )}
          </div>

          <div className={`stagger-child ${styles.footer}`}>
            tap a day to log it · long-press a habit to edit · ‹› to navigate
          </div>
        </div>

        <Routines
          habits={habits}
          logs={logs}
          routines={routines}
          theme={theme}
          today={today}
          dispatch={dispatch}
          open={page?.kind === "routines"}
          onBack={() => closePage()}
        />
        {page?.kind === "newHabit" && (
          <NewHabitPage
            onAdd={(habit) =>
              dispatch({ type: "habit/add", id: newId("h"), habit })
            }
            onClose={closePage}
            units={units}
            onAddUnit={addUnit}
            groups={groups}
            onAddGroup={addGroup}
          />
        )}
      </div>

      {/* Modals */}
      {editHabit && (
        <EditHabitModal
          habit={editHabit}
          onSave={(habit) => dispatch({ type: "habit/update", habit })}
          onDelete={(id) => {
            dispatch({ type: "habit/delete", id });
            setEditHabit(null);
          }}
          onClose={() => setEditHabit(null)}
          units={units}
          onAddUnit={addUnit}
          groups={groups}
          onAddGroup={addGroup}
        />
      )}
      {editGroup && (
        <GroupEditModal
          group={editGroup}
          groups={groups}
          habits={habits}
          onSave={(changes, habitIds) => {
            dispatch({ type: "group/update", id: editGroup.id, changes });
            dispatch({ type: "group/setMembers", id: editGroup.id, habitIds });
          }}
          onDelete={(id) => dispatch({ type: "group/delete", id })}
          onClose={() => setEditGroupId(null)}
        />
      )}
      {showUnits && (
        <SettingsModal
          units={units}
          habits={habits}
          logs={logs}
          groups={groups}
          routines={routines}
          onUpdateUnit={(id, changes) =>
            dispatch({ type: "unit/update", id, changes })
          }
          onDeleteUnit={(id) => dispatch({ type: "unit/delete", id })}
          onAddUnit={addUnit}
          appConfig={appConfig}
          onUpdateConfig={(config) =>
            dispatch({ type: "config/update", changes: config })
          }
          // SettingsModal has already normalized the backup
          onImportState={(imported) =>
            dispatch({ type: "state/import", state: imported })
          }
          onClose={() => setShowUnits(false)}
        />
      )}
    </div>
  );
}
