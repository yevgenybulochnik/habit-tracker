import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { resolvePalette } from "../theme";
import { getUnit } from "../lib/metrics";
import { habitStats } from "../lib/stats";
import { dueLabel, isDone, nextDue } from "../lib/cover";
import { isEveryDay, periodLabel } from "../lib/periods";
import { INITIAL_NAV, navigate } from "../lib/calendarNav";
import { isTiming } from "../lib/state";
import CalendarPanel from "./CalendarPanel";
import QuickLogSection from "./QuickLogSection";
import DayEditor from "./DayEditor";
import { useHabitActions } from "../hooks/useHabitActions";
import { useLongPress } from "../hooks/useLongPress";
import { cardAnchor } from "../anchors";
import type { DragActivator } from "./SortableHabitCard";
import styles from "./HabitCard.module.css";
import HabitIcon from "./HabitIcon";
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
  /** Compact view (not expanded): whether its quick-log shows. App keeps
   *  one card's open at a time; one with a timer running stays open too. */
  logOpen?: boolean;
  /** Compact view: the card was tapped, to show or hide its quick-log. */
  onToggleLog?: () => void;
};

/** The chevron under an open quick-log, pointing down to the calendar. */
const Chevron = () => (
  <svg
    width="20"
    height="10"
    viewBox="0 0 16 10"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 3l5 4 5-4" />
  </svg>
);

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
  logOpen = false,
  onToggleLog,
}: Props) {
  const actions = useHabitActions(habit.id, today);
  // In Compact view a tap on the card shows or hides its quick-log, and it
  // stays open while a timer runs, so the timer stays in sight.
  const tappable = !expanded && !reorderMode;
  const logShown = logOpen || isTiming(habit, timers);
  // Compact view: the calendar, asked for from the chevron under the open
  // quick-log. Shutting the quick-log puts it away (set as the card renders,
  // not in an effect, so it never shows on its own for a frame).
  const [calAsked, setCalAsked] = useState(false);
  const [logWasShown, setLogWasShown] = useState(logShown);
  if (logShown !== logWasShown) {
    setLogWasShown(logShown);
    if (!logShown) setCalAsked(false);
  }
  const chevronShown = tappable && logShown;
  // The calendar shows in Calendar view, or asked for in Compact. In reorder
  // mode the card shows its header only — collapse the heatmap body and
  // quick-log, and reuse the existing expand/collapse animation.
  const effExpanded = (expanded || (calAsked && logShown)) && !reorderMode;
  const bodyId = useId();
  // The calendar's months and view. Kept here, not in CalendarPanel, because
  // quick-log zooms it in too.
  const [nav, dispatchNav] = useReducer(navigate, INITIAL_NAV);
  // Hold-to-edit is inert while reordering.
  const longPress = useLongPress(() => onEdit?.(), { disabled: reorderMode });
  const [dragPressed, setDragPressed] = useState(false); // grip/region pressed → highlight this card
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // drives open/close animation
  const [editorDate, setEditorDate] = useState<string | null>(null); // kept mounted through the close animation
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quicklogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLDivElement>(null);
  // The quick-log is shut while reordering, while a day is being edited, and
  // in Compact view until it's opened.
  const logShut = reorderMode || !!selectedDate || (!expanded && !logShown);

  const closeEditor = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setSelectedDate(null);
    closeTimerRef.current = setTimeout(() => setEditorDate(null), 450); // unmount after it collapses
  };
  // Wraps a quick-log action so that logging today also brings the calendar,
  // if it shows, to this month, with the new entry in view.
  const showingToday =
    <A extends unknown[]>(log: (...args: A) => void) =>
    (...args: A) => {
      if (effExpanded) dispatchNav({ type: "zoomToday" });
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
    // collapsing the card (Compact view, its calendar put away, or reorder
    // mode) closes the editor
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
  // Done for now (logged today, or a log still covers today): a card down to
  // its header is shaded in its colour.
  const done = isDone(habit, logs, units, today);
  // When the next log is due, for a habit due less often than every day
  const due = isEveryDay(habit.period)
    ? null
    : nextDue(habit, logs, units, today);
  const pu = habit.metrics[0]?.unit || "count";
  const sLabel = pu === "min" ? "Hours" : getUnit(pu, units).label || "Total";
  const sVal =
    pu === "min"
      ? stats.totalVal >= 60
        ? `${(stats.totalVal / 60).toFixed(1)}`
        : `${stats.totalVal}m`
      : stats.totalVal;

  // Icon + name + hint, shared between the normal (hold-to-edit) header and the
  // reorder-mode draggable region. The `pressing` state is applied as a class on
  // the drag-region container so CSS drives the icon/name/hint transitions.
  const nameBlock = (
    <>
      <span className={styles.icon}>
        <HabitIcon icon={habit.icon} />
      </span>
      <div>
        {/* A tappable card's name is its button, inside the heading: the
            accordion pattern, so it's reachable by keyboard and the card
            stays a heading. Its click is the card's (below). */}
        <h3 className={styles.name}>
          {tappable ? (
            <button
              type="button"
              aria-expanded={logShown}
              className={styles.nameBtn}
            >
              {habit.name}
            </button>
          ) : (
            habit.name
          )}
        </h3>
        {habit.description && (
          <p className={styles.desc}>{habit.description}</p>
        )}
        {!isEveryDay(habit.period) && (
          <p className={styles.cadence}>
            {periodLabel(habit.period)}
            {due &&
              (due === today ? (
                <>
                  {" · "}
                  <strong className={styles.dueToday}>due today</strong>
                </>
              ) : (
                ` · due ${dueLabel(due, today)}`
              ))}
          </p>
        )}
        <div className={styles.holdHint}>hold to edit...</div>
      </div>
    </>
  );

  const dragging = dragPressed || dragActivator?.isDragging;
  const palVars = { "--p4": pal.shades[4] } as CSSProperties;

  return (
    <div
      id={cardAnchor(habit.id)}
      className={`${styles.card}${effExpanded ? "" : ` ${styles.compact}`}${tappable ? ` ${styles.tappable}` : ""}${dragging ? ` ${styles.dragging}` : ""}`}
      style={palVars}
      data-done={done || undefined}
      onClick={
        tappable
          ? (e) => {
              // Logging in the quick-log, using the calendar or the day's
              // editor, and the chevron aren't taps on the card.
              const inside = [quicklogRef, bodyRef, editorRef, chevronRef];
              if (!inside.some((r) => r.current?.contains(e.target as Node)))
                onToggleLog?.();
            }
          : undefined
      }
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
          (stays mounted so both directions transition; avoids the iOS
          reveal-flash). Shut, it's inert, as the quick-log is. */}
      <div
        ref={bodyRef}
        id={bodyId}
        className={`${styles.body}${effExpanded ? ` ${styles.open}` : ""}`}
        aria-hidden={!effExpanded || undefined}
        {...(effExpanded ? {} : { inert: "" })}
      >
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
        ref={editorRef}
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

      {/* Quick-log for today — stays mounted, so it opens and shuts
          smoothly. Shut, it's inert: no tabbing into what can't be seen.
          (React 18 knows no inert prop, hence the spread.) */}
      <div
        ref={quicklogRef}
        className={`${styles.quicklog}${logShut ? ` ${styles.closed}` : ""}`}
        aria-hidden={logShut || undefined}
        {...(logShut ? { inert: "" } : {})}
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

      {/* Compact view: under the open quick-log, a chevron that shows the
          calendar above it, and turns up to hide it again */}
      <div
        ref={chevronRef}
        className={`${styles.chevronRow}${chevronShown ? ` ${styles.show}` : ""}`}
        aria-hidden={!chevronShown || undefined}
        {...(chevronShown ? {} : { inert: "" })}
      >
        <div className={styles.inner}>
          <button
            type="button"
            aria-controls={bodyId}
            aria-label={effExpanded ? "Hide calendar" : "Show calendar"}
            title={effExpanded ? "Hide calendar" : "Show calendar"}
            onClick={() => setCalAsked((asked) => !asked)}
            className={`${styles.chevron}${effExpanded ? ` ${styles.up}` : ""}`}
          >
            <Chevron />
          </button>
        </div>
      </div>
    </div>
  );
}
