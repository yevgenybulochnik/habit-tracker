import { useState, useEffect, useMemo, useReducer, useRef } from "react";
import type { CSSProperties } from "react";
import { resolvePalette } from "../theme";
import { getUnit } from "../lib/metrics";
import { habitStats } from "../lib/stats";
import { INITIAL_NAV, navigate } from "../lib/calendarNav";
import CalendarPanel from "./CalendarPanel";
import QuickLogSection from "./QuickLogSection";
import DayEditor from "./DayEditor";
import { useHabitActions } from "../hooks/useHabitActions";
import { useLongPress } from "../hooks/useLongPress";
import type { DragActivator } from "./SortableHabitCard";
import styles from "./HabitCard.module.css";
import type { AppConfig, Habit, HabitLogs, Timers, Unit } from "../types";

// Changes to the habit's logs and timers go through useHabitActions.
type Props = {
  habit: Habit;
  logs: HabitLogs;
  units: Unit[];
  onEdit?: () => void;
  timers: Timers;
  appConfig: AppConfig;
  /** Today's date key: outlined in the calendar, and the day quick-log writes to. */
  today: string;
  /** When false the calendar body (controls/svg/legend) collapses; only header + quick-log show. */
  expanded?: boolean;
  /** Reorder mode: condense to header only (collapse body + quick-log) and make
   *  the card inert to hold-to-edit / day-tap while it's being dragged. */
  reorderMode?: boolean;
  /** Drag wiring (from the sortable wrapper); present only in reorder mode. */
  dragActivator?: DragActivator;
};

export default function HabitCard({
  habit,
  logs,
  units,
  onEdit,
  timers,
  appConfig: cfg,
  today,
  expanded = true,
  reorderMode = false,
  dragActivator,
}: Props) {
  const actions = useHabitActions(habit.id, today);
  // In reorder mode the card shows its header only — collapse the heatmap body
  // and quick-log, and reuse the existing expand/collapse animation.
  const effExpanded = expanded && !reorderMode;
  // The calendar's months and view. Kept here, not in CalendarPanel, because
  // quick-log zooms it in too.
  const [nav, dispatchNav] = useReducer(navigate, INITIAL_NAV);
  // Hold-to-edit is inert while reordering.
  const longPress = useLongPress(() => onEdit?.(), { disabled: reorderMode });
  const [dragPressed, setDragPressed] = useState(false); // grip/region pressed → highlight this card
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // drives open/close animation
  const [editorDate, setEditorDate] = useState<string | null>(null); // kept mounted through the close animation
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeEditor = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setSelectedDate(null);
    closeTimerRef.current = setTimeout(() => setEditorDate(null), 450); // unmount after it collapses
  };
  // Wraps a quick-log action so that logging today also brings the expanded
  // calendar to this month, with the new entry in view.
  const showingToday =
    <A extends unknown[]>(log: (...args: A) => void) =>
    (...args: A) => {
      if (expanded) dispatchNav({ type: "zoomToday" });
      log(...args);
    };
  const tapDay = (k: string) => {
    if (reorderMode) return; // day-tap is inert while reordering
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (selectedDate === k) closeEditor();
    else {
      setEditorDate(k);
      setSelectedDate(k);
    }
  };
  // Drop the pressed highlight when leaving reorder mode.
  useEffect(() => {
    if (!reorderMode) setDragPressed(false);
  }, [reorderMode]);

  useEffect(() => {
    // collapsing the card (Quick view or reorder mode) closes the editor
    if (!effExpanded) {
      setSelectedDate(null);
      setEditorDate(null);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    }
  }, [effExpanded]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const theme = cfg.theme;
  // Memoized: the light ramp builds a fresh object, which would otherwise churn
  // the d3 effect (pal is in its deps) on every render.
  const pal = useMemo(
    () => resolvePalette(habit.color, theme),
    [habit.color, theme],
  );
  const stats = useMemo(
    () => habitStats(habit, logs, units, today),
    [habit, logs, units, today],
  );
  const pu = habit.metrics[0]?.unit || "count";
  const sLabel = pu === "min" ? "Hours" : getUnit(pu, units).label || "Total";
  const sVal =
    pu === "min"
      ? stats.totalVal >= 60
        ? `${(stats.totalVal / 60).toFixed(1)}`
        : `${stats.totalVal}m`
      : stats.totalVal;

  // Emoji + name + hint, shared between the normal (hold-to-edit) header and the
  // reorder-mode draggable region. The `pressing` state is applied as a class on
  // the drag-region container so CSS drives the emoji/name/hint transitions.
  const nameBlock = (
    <>
      <span className={styles.emoji}>{habit.emoji}</span>
      <div>
        <h3 className={styles.name}>{habit.name}</h3>
        {habit.description && (
          <p className={styles.desc}>{habit.description}</p>
        )}
        <div className={styles.holdHint}>hold to edit...</div>
      </div>
    </>
  );

  const dragging = dragPressed || dragActivator?.isDragging;
  const palVars = { "--p4": pal.shades[4] } as CSSProperties;

  return (
    <div
      className={`${styles.card}${effExpanded ? "" : ` ${styles.compact}`}${dragging ? ` ${styles.dragging}` : ""}`}
      style={palVars}
    >
      {/* Header: name + stats */}
      <div
        className={`${styles.header}${effExpanded ? "" : ` ${styles.compact}`}`}
      >
        {/* One stable container in both modes so the icon+name never remount.
            Long-press handlers stay attached (they no-op while reordering); the
            drag listeners are present only in reorder mode. The grip lives in an
            animated-width wrapper, so toggling slides the name rather than
            jumping it. The grip stays the focusable keyboard activator so the
            heading isn't pruned from the a11y tree. */}
        <div
          // The whole grip+icon+name region is the single drag activator:
          // listeners AND the activator ref live on the same element (dnd-kit's
          // intended pattern — a split ref/listeners made the first drag flaky).
          // role is stripped so the inner <h3> stays a real heading.
          // .reorder-drag sets touch-action:none on this region + descendants
          // (iOS won't inherit it) so a touch-drag from the icon/name isn't
          // hijacked by page scroll.
          className={`${reorderMode ? "reorder-drag " : ""}${styles.dragRegion}${reorderMode ? ` ${styles.reorder}` : ""}${dragActivator?.isDragging ? ` ${styles.grabbing}` : ""}${longPress.pressing ? ` ${styles.pressing}` : ""}`}
          ref={
            reorderMode && dragActivator
              ? dragActivator.setActivatorRef
              : undefined
          }
          {...(reorderMode && dragActivator
            ? {
                ...dragActivator.attributes,
                role: undefined,
                "aria-label": "Drag to reorder habit",
                ...dragActivator.listeners,
              }
            : // Long-press (hold-to-edit) only outside reorder mode, so it can't
              // clobber the Touch/Mouse sensor activators (onTouchStart/onMouseDown).
              longPress.handlers)}
          // Highlight the pressed card; capture phase so it never shadows the
          // sensor activator. Pointer events fire alongside touch on iOS.
          onPointerDownCapture={() => {
            if (reorderMode) setDragPressed(true);
          }}
          onPointerUp={() => setDragPressed(false)}
          onPointerCancel={() => setDragPressed(false)}
          onPointerLeave={() => setDragPressed(false)}
          title={reorderMode ? "Drag to reorder" : undefined}
        >
          <div
            className={`${styles.gripWrap}${reorderMode ? ` ${styles.show}` : ""}`}
          >
            <span className={styles.grip} aria-hidden="true">
              ⠿
            </span>
          </div>
          {nameBlock}
        </div>
        <div className={styles.stats}>
          {[
            { l: "Days", v: stats.totalDays },
            { l: sLabel, v: sVal },
            { l: "Streak", v: `${stats.curStreak}d` },
          ].map((s) => (
            <div key={s.l}>
              <div className={styles.statVal}>{s.v}</div>
              <div className={styles.statLbl}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar body animates open/closed via grid-template-rows 0fr↔1fr
          (stays mounted so both directions transition; avoids the iOS reveal-flash). */}
      <div className={`${styles.body}${effExpanded ? ` ${styles.open}` : ""}`}>
        <div className={styles.inner}>
          <CalendarPanel
            habit={habit}
            logs={logs}
            units={units}
            config={cfg}
            today={today}
            pal={pal}
            expanded={effExpanded}
            nav={nav}
            onNav={dispatchNav}
            selectedDate={selectedDate}
            onTapDay={tapDay}
          />
        </div>
      </div>

      {/* Inline day editor — the card "further expands" when a day is tapped.
          It and the quick-log both stay mounted and cross-swap heights so
          selecting/closing animates smoothly; editorDate lingers through close. */}
      <div
        className={`${styles.editor}${selectedDate ? ` ${styles.open}` : ""}`}
      >
        <div className={styles.inner}>
          {editorDate && (
            <DayEditor
              key={editorDate}
              habit={habit}
              dateKey={editorDate}
              habitLogs={logs}
              units={units}
              pal={pal}
              today={today}
              onChange={actions.saveDay}
              onClose={closeEditor}
            />
          )}
        </div>
      </div>

      {/* Quick-log for today — stays mounted; collapses while editing a day */}
      <div
        className={`${styles.quicklog}${reorderMode || selectedDate ? ` ${styles.closed}` : ""}`}
      >
        <div className={styles.inner}>
          <QuickLogSection
            dense={!effExpanded}
            habit={habit}
            logs={logs}
            units={units}
            pal={pal}
            onQuickLog={showingToday(actions.add)}
            onQuickReset={actions.reset}
            onAddSet={showingToday(actions.addSet)}
            onRemoveSet={actions.removeSet}
            timers={timers}
            onStartTimer={actions.startTimer}
            onStopTimer={actions.stopTimer}
            today={today}
          />
        </div>
      </div>
    </div>
  );
}
