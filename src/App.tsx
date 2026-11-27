import { useState, useEffect, useReducer, useRef } from "react";
import { CSS } from "./globalCss";
import { THEME_CSS, THEMES } from "./theme";
import { BUILTIN_UNITS, DEFAULT_CONFIG } from "./lib/defaults";
import { isDone } from "./lib/cover";
import { groupSections, ungroupedHabits } from "./lib/groups";
import { jumps, type Jump } from "./lib/jumps";
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
import GroupEditPage from "./components/GroupEditPage";
import NewHabitPage from "./components/NewHabitPage";
import EditHabitPage from "./components/EditHabitPage";
import SettingsPage from "./components/SettingsPage";
import BrandMark from "./components/BrandMark";
import Icon from "./components/Icon";
import Pearl from "./components/Pearl";
import type { ClosePage } from "./components/PageShell";
import Routines from "./components/Routines";
import { slide } from "./slide";
import { cardAnchor, sectionAnchor } from "./anchors";
import type { DashView, Group, Habit, Unit } from "./types";
import styles from "./App.module.css";

/** A page slid over the habits, in their place. */
type Page =
  | { kind: "routines" }
  | { kind: "newHabit" }
  | { kind: "editHabit"; habit: Habit }
  | { kind: "editGroup"; id: string }
  | { kind: "settings" };

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
  const [reorder, setReorder] = useState(false); // transient: condense cards + enable drag
  // The habit whose quick-log is open in Compact view: one at a time, so
  // opening one shuts the last.
  const [openLog, setOpenLog] = useState<string | null>(null);
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

  const dashView = appConfig.dashView; // persisted Compact/Calendar choice
  const editGroup =
    page?.kind === "editGroup"
      ? groups.find((g) => g.id === page.id)
      : undefined;
  // The habits make way for a page, unless it's a group that's gone.
  const away = !!page && (page.kind !== "editGroup" || !!editGroup);
  // Done for now: logged today, or a log still covers today.
  const done = (h: Habit) => isDone(h, logs[h.id] ?? {}, units, today);
  const completed = habits.filter(done).length;
  const canReorder = habits.length > 1 || groups.length > 1;

  const setView = (view: DashView) => {
    setOpenLog(null);
    dispatch({ type: "config/update", changes: { dashView: view } });
  };
  const toggleReorder = () => {
    setOpenLog(null);
    setReorder((r) => !r);
  };
  // The pearl's jumps: to the top, to a group's section (unfolding it), or
  // with no groups to a habit's card, its quick-log opened in Compact view.
  const jumpTo = (j: Jump) => {
    if (j.kind === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (j.kind === "group") {
      if (j.group.collapsed)
        dispatch({
          type: "group/update",
          id: j.group.id,
          changes: { collapsed: false },
        });
      document
        .getElementById(sectionAnchor(j.group.id))
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (dashView === "compact") setOpenLog(j.habit.id);
    document
      .getElementById(cardAnchor(j.habit.id))
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

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
                logOpen={openLog === h.id}
                onToggleLog={() =>
                  setOpenLog((open) => (open === h.id ? null : h.id))
                }
                habit={h}
                logs={logs[h.id] || {}}
                units={units}
                onEdit={() => openPage({ kind: "editHabit", habit: h })}
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
            Changes aren't being saved — export a backup from Settings
          </div>
        )}

        <div className={away ? styles.away : undefined}>
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
          </div>

          {/* Content — single view; Compact (headers) ⟷ Calendar (expanded heatmaps) */}
          <div className={styles.content}>
            {habits.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>
                  <Icon name="chart" size={40} />
                </div>
                <div className={styles.emptyTitle}>No habits yet</div>
                <div className={styles.emptyHint}>
                  Tap the button in the corner, then New habit
                </div>
              </div>
            ) : (
              <>
                <DispatchContext.Provider value={dispatch}>
                  {groups.length > 0 ? (
                    <GroupSections
                      sections={groupSections(habits, groups)}
                      ungrouped={ungroupedHabits(habits, groups)}
                      renderList={renderList}
                      isDone={done}
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
                      onEditGroup={(id) => openPage({ kind: "editGroup", id })}
                    />
                  ) : (
                    renderList(habits)
                  )}
                </DispatchContext.Provider>
              </>
            )}
          </div>

          <div className={`stagger-child ${styles.footer}`}>
            {dashView === "compact"
              ? "tap a habit to log it · long-press a habit to edit"
              : "tap a day to log it · long-press a habit to edit · ‹› to navigate"}
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
        {editGroup && (
          <GroupEditPage
            group={editGroup}
            groups={groups}
            habits={habits}
            onSave={(changes, habitIds) => {
              dispatch({ type: "group/update", id: editGroup.id, changes });
              dispatch({
                type: "group/setMembers",
                id: editGroup.id,
                habitIds,
              });
            }}
            onDelete={(id) => dispatch({ type: "group/delete", id })}
            onClose={closePage}
          />
        )}
        {page?.kind === "settings" && (
          <SettingsPage
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
            // SettingsPage has already normalized the backup
            onImportState={(imported) =>
              dispatch({ type: "state/import", state: imported })
            }
            onClose={closePage}
          />
        )}
        {page?.kind === "editHabit" && (
          <EditHabitPage
            habit={page.habit}
            onSave={(habit) => dispatch({ type: "habit/update", habit })}
            onDelete={(id) => dispatch({ type: "habit/delete", id })}
            onClose={closePage}
            units={units}
            onAddUnit={addUnit}
            groups={groups}
            onAddGroup={addGroup}
          />
        )}
      </div>

      {/* The way to everything else, in the corner */}
      {!away && (
        <Pearl
          done={completed}
          total={habits.length}
          jumps={jumps(habits, groups, done)}
          onJump={jumpTo}
          view={dashView}
          onView={setView}
          canReorder={canReorder}
          reordering={reorder}
          onReorder={toggleReorder}
          onNewHabit={() => openPage({ kind: "newHabit" })}
          onRoutines={() => openPage({ kind: "routines" })}
          onSettings={() => openPage({ kind: "settings" })}
          onPage={false}
          onBack={() => closePage()}
          theme={theme}
        />
      )}
    </div>
  );
}
