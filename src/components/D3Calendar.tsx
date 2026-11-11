import { useState, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import * as d3 from "d3";
import { F, resolvePalette, THEMES } from "../theme";
import { MONTHS, WK_FULL } from "../lib/defaults";
import { getUnit } from "../lib/metrics";
import { logLevel, logSummary, habitStats } from "../lib/stats";
import { todayK } from "../lib/dates";
import {
  getRecentDays,
  fitCellSize,
  compactHeatLayout,
  compactCalLayout,
} from "../lib/d3layout";
import QuickLogSection from "./QuickLogSection";
import DayEditor from "./DayEditor";
import type { DragActivator } from "./SortableHabitCard";
import styles from "./D3Calendar.module.css";
import type {
  AppConfig,
  DayLog,
  Habit,
  HabitLogs,
  SetEntry,
  Timers,
  Unit,
} from "../types";

type Props = {
  habit: Habit;
  logs: HabitLogs;
  units: Unit[];
  /** Persist an exact day's entry (from the inline day editor opened by tapping a cell). */
  onSaveDay?: (dateKey: string, entry: DayLog) => void;
  onEdit?: () => void;
  onQuickLog?: (metricId: string, amt: number) => void;
  onQuickReset: (metricId: string) => void;
  onAddSet?: ((metricId: string, set: SetEntry) => void) | null;
  onRemoveSet: (metricId: string, idx: number) => void;
  timers?: Timers;
  onStartTimer: (metricId: string) => void;
  onStopTimer: (metricId: string) => void;
  habitId: string;
  appConfig: AppConfig;
  /** When false the calendar body (controls/svg/legend) collapses; only header + quick-log show. */
  expanded?: boolean;
  /** Reorder mode: condense to header only (collapse body + quick-log) and make
   *  the card inert to hold-to-edit / day-tap while it's being dragged. */
  reorderMode?: boolean;
  /** Drag wiring (from the sortable wrapper); present only in reorder mode. */
  dragActivator?: DragActivator;
};

type Tip = { label: string; date: string };

// Shared easing for every d3 transition in the card.
const D3E = d3.easeCubicInOut;

export default function D3Calendar({
  habit,
  logs,
  units,
  onSaveDay,
  onEdit,
  onQuickLog,
  onQuickReset,
  onAddSet,
  onRemoveSet,
  timers,
  onStartTimer,
  onStopTimer,
  habitId,
  appConfig: cfg,
  expanded = true,
  reorderMode = false,
  dragActivator,
}: Props) {
  // In reorder mode the card shows its header only — collapse the heatmap body
  // and quick-log, and reuse the existing expand/collapse animation.
  const effExpanded = expanded && !reorderMode;
  const NUM_MONTHS = cfg.numMonths;
  const svgRef = useRef<SVGSVGElement>(null),
    cRef = useRef<HTMLDivElement>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cw, setCw] = useState(400);
  const [tip, setTip] = useState<Tip | null>(null);
  const [view, setView] = useState<"heatmap" | "calendar">("heatmap");
  const [offset, setOffset] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [dragPressed, setDragPressed] = useState(false); // grip/region pressed → highlight this card
  const [svgHeight, setSvgHeight] = useState(120);
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // drives open/close animation
  const [editorDate, setEditorDate] = useState<string | null>(null); // kept mounted through the close animation
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapRef = useRef<(k: string) => void>(() => {});
  const selectedDateRef = useRef<string | null>(null); // current selection for the (build-once) hover handlers
  selectedDateRef.current = selectedDate;
  const logsRef = useRef(logs); // current logs for the build-once hover tooltip (build no longer re-runs on logs)
  logsRef.current = logs;

  const closeEditor = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setSelectedDate(null);
    closeTimerRef.current = setTimeout(() => setEditorDate(null), 450); // unmount after it collapses
  };
  // Reassigned each render so the d3 click handler always sees current state.
  tapRef.current = (k: string) => {
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

  const startPress = () => {
    if (reorderMode) return; // hold-to-edit is inert while reordering
    setPressing(true);
    longPressRef.current = setTimeout(() => {
      setPressing(false);
      if (onEdit) onEdit();
    }, 500);
  };
  const cancelPress = () => {
    setPressing(false);
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };
  useEffect(
    () => () => {
      if (longPressRef.current) clearTimeout(longPressRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const numM = zoomed ? 1 : NUM_MONTHS;
  const days = useMemo(() => getRecentDays(numM, offset), [numM, offset]);
  const tKey = todayK();
  const theme = cfg.theme;
  // Memoized: the light ramp builds a fresh object, which would otherwise churn
  // the d3 effect (pal is in its deps) on every render.
  const pal = useMemo(
    () => resolvePalette(habit.color, theme),
    [habit.color, theme],
  );
  const stats = useMemo(
    () => habitStats(habit, logs, units),
    [habit, logs, units],
  );
  const pu = habit.metrics[0]?.unit || "count";
  const sLabel = pu === "min" ? "Hours" : getUnit(pu, units).label || "Total";
  const sVal =
    pu === "min"
      ? stats.totalVal >= 60
        ? `${(stats.totalVal / 60).toFixed(1)}`
        : `${stats.totalVal}m`
      : stats.totalVal;

  const navBack = () => {
    if (zoomed) {
      setZoomed(false);
      setView("heatmap");
    } else {
      setOffset((o) => o - NUM_MONTHS);
    }
  };
  const navFwd = () => {
    if (offset === 0 && !zoomed) {
      setZoomed(true);
      setView("calendar");
    } else if (zoomed) {
      /* already at present */
    } else {
      setOffset((o) => {
        const next = o + NUM_MONTHS;
        if (next >= 0) {
          setZoomed(false);
          return 0;
        }
        return next;
      });
    }
  };
  const canFwd = zoomed ? false : offset < 0 || offset === 0;

  const rangeLabel =
    days.length > 0
      ? numM === 1
        ? `${MONTHS[days[0].getMonth()]} ${days[0].getFullYear()}`
        : `${MONTHS[days[0].getMonth()]} – ${MONTHS[days[days.length - 1].getMonth()]} ${days[days.length - 1].getFullYear()}`
      : "";

  useEffect(() => {
    const el = cRef.current;
    if (!el) return;
    // Ignore zero widths: when the panel is hidden (display:none) the width
    // reports 0; keeping the last real width means becoming visible again does
    // not change cw and so doesn't re-run the (expensive) d3 build.
    const obs = new ResizeObserver((e) => {
      for (const en of e) {
        const w = en.contentRect.width;
        if (w > 0) setCw(w);
      }
    });
    obs.observe(el);
    const w0 = el.getBoundingClientRect().width;
    if (w0 > 0) setCw(w0);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!effExpanded || !svgRef.current) return; // body not rendered when collapsed/reordering
    // d3 selection is kept loosely typed: the data-join/animation logic is
    // ported verbatim from the prototype to preserve identical behavior.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const svg: any = d3.select(svgRef.current);
    const svgAvail = cw;
    const cg = zoomed ? 4 : 2,
      lp = zoomed ? 8 : 6,
      tp = zoomed ? 28 : 24,
      mg = zoomed ? 0 : cfg.monthGap;
    const cs = zoomed
      ? Math.min((svgAvail - 2 * lp - 6 * cg) / 7, 36)
      : fitCellSize(days, svgAvail, view, cg, lp, mg);
    // d3 sets SVG presentation attributes, where CSS vars don't resolve — use
    // concrete theme hex here. The empty (level-0) cell is theme-specific.
    const Tc = THEMES[cfg.theme];
    const sh = pal.shades,
      DUR = 700; // pal.shades[0] is the theme's empty cell
    svg.selectAll("*").interrupt();

    const { cells: layout, mLabels } =
      view === "heatmap"
        ? compactHeatLayout(days, cs, cg, lp, tp, mg)
        : compactCalLayout(days, cs, cg, lp, tp, mg);

    const maxX = d3.max(layout, (d) => d.x + d.w) || 300;
    const shiftX = Math.max(0, (svgAvail - maxX) / 2);
    if (shiftX > 0) {
      layout.forEach((c) => {
        c.x += shiftX;
      });
      mLabels.forEach((l) => {
        l.x += shiftX;
      });
    }

    const maxY = d3.max(layout, (d) => d.y + d.h) || 100;
    const svgH = maxY + 8;
    setSvgHeight(svgH);

    const todayCell = layout.find((c) => c.key === tKey);
    const tX = todayCell ? todayCell.x : maxX / 2,
      tY = todayCell ? todayCell.y : maxY / 2;
    const maxDist = Math.sqrt(maxX ** 2 + maxY ** 2) || 1;
    const stag = (d: { x: number; y: number }) => {
      const dist = Math.sqrt((d.x - tX) ** 2 + (d.y - tY) ** 2);
      return (dist / maxDist) * 350;
    };

    const dnFontSz = zoomed ? 13 : Math.max(7, Math.round(cs * 0.7));
    const mlFontSz = zoomed ? 13 : Math.max(8, Math.round(cs * 0.8));
    const wkFontSz = zoomed ? 10 : Math.max(7, Math.round(cs * 0.65));
    const cellR = zoomed ? 6 : Math.max(2, Math.round(cs * 0.2));

    const greyFill = Tc.futureCell;
    const cellFill = (d: any) =>
      d.future ? greyFill : sh[logLevel(habit, logs[d.key], units)];
    const cellOp = (d: any) => (d.future ? 0.35 : 1);
    const cellStroke = (d: any) => (d.key === tKey ? Tc.accent : Tc.cellStroke);
    const cellStrokeW = (d: any) => (d.key === tKey ? 1.5 : 1);

    const cells = svg.selectAll(".dc").data(layout, (d: any) => d.key);
    cells.exit().each(function (this: any, d: any) {
      d3.select(this)
        .transition("ex")
        .delay(stag(d))
        .duration(DUR * 0.3)
        .ease(D3E)
        .style("opacity", 0)
        .attr("width", 0)
        .attr("height", 0)
        .remove();
    });
    const enter = cells
      .enter()
      .append("rect")
      .attr("class", "dc")
      .attr("x", (d: any) => d.x)
      .attr("y", (d: any) => d.y)
      .attr("width", (d: any) => d.w)
      .attr("height", (d: any) => d.h)
      .attr("rx", cellR)
      .attr("ry", cellR)
      .attr("fill", cellFill)
      .attr("stroke", cellStroke)
      .attr("stroke-width", cellStrokeW)
      .style("cursor", (d: any) => (d.future ? "default" : "pointer"))
      .style("opacity", 0);
    enter.each(function (this: any, d: any) {
      d3.select(this)
        .transition("en")
        .delay(stag(d))
        .duration(DUR * 0.6)
        .ease(D3E)
        .style("opacity", cellOp(d));
    });
    const merged = cells.merge(enter);
    merged
      .on("click", (_: any, d: any) => {
        if (!d.future) tapRef.current(d.key);
      })
      .on("mouseenter", (ev: any, d: any) => {
        if (d.future) return;
        const label = logSummary(habit, logsRef.current[d.key]);
        setTip(
          label === "No entry"
            ? null
            : {
                label,
                date: d.date.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
              },
        );
        d3.select(ev.currentTarget)
          .attr("stroke", sh[4])
          .attr("stroke-width", 2);
      })
      .on("mouseleave", (ev: any, d: any) => {
        setTip(null);
        const isSel = selectedDateRef.current === d.key;
        d3.select(ev.currentTarget)
          .attr("stroke", isSel ? sh[4] : cellStroke(d))
          .attr("stroke-width", isSel ? 2.5 : cellStrokeW(d));
      });
    merged.each(function (this: any, d: any) {
      d3.select(this)
        .transition("up")
        .delay(stag(d))
        .duration(DUR * 0.6)
        .ease(D3E)
        .attr("x", d.x)
        .attr("y", d.y)
        .attr("width", d.w)
        .attr("height", d.h)
        .attr("rx", cellR)
        .attr("ry", cellR)
        .attr("fill", cellFill(d))
        .attr("stroke", cellStroke(d))
        .attr("stroke-width", cellStrokeW(d))
        .style("opacity", cellOp(d));
    });

    // Month labels
    svg.selectAll(".ml").interrupt();
    const mls = svg.selectAll(".ml").data(mLabels, (d: any) => d.key);
    mls
      .exit()
      .transition("mle")
      .duration(DUR / 3)
      .ease(D3E)
      .style("opacity", 0)
      .remove();
    const mlEn = mls
      .enter()
      .append("text")
      .attr("class", "ml")
      .attr("x", (d: any) => d.x)
      .attr("y", (d: any) => d.y)
      .attr("fill", Tc.muted)
      .attr("font-size", mlFontSz)
      .attr("font-family", F)
      .attr("font-weight", 600)
      .attr("text-anchor", (d: any) => d.anchor || "start")
      .style("opacity", 0)
      .text((d: any) => d.label);
    mlEn
      .transition("mlen")
      .delay(DUR / 3)
      .duration(DUR / 2)
      .ease(D3E)
      .style("opacity", 1);
    mls
      .merge(mlEn)
      .transition("mlup")
      .delay(DUR * 0.3)
      .duration(DUR / 2)
      .ease(D3E)
      .attr("x", (d: any) => d.x)
      .attr("y", (d: any) => d.y)
      .attr("text-anchor", (d: any) => d.anchor || "start")
      .style("opacity", 1);

    // Day numbers in cal view
    const dayNums =
      view === "calendar"
        ? layout.map((c) => ({
            key: `dn-${c.key}`,
            label: String(c.date.getDate()),
            x: c.x + c.w / 2,
            y: c.y + c.h / 2 + Math.round(dnFontSz * 0.38),
            future: c.future,
            level: logLevel(habit, logs[c.key], units),
            _x: c.x,
            _y: c.y,
          }))
        : [];
    svg.selectAll(".dn").interrupt();
    const dns = svg.selectAll(".dn").data(dayNums, (d: any) => d.key);
    dns.exit().each(function (this: any, d: any) {
      d3.select(this)
        .transition("dne")
        .delay(stag({ x: d._x, y: d._y }))
        .duration(DUR / 3)
        .ease(D3E)
        .style("opacity", 0)
        .remove();
    });
    const dnEn = dns
      .enter()
      .append("text")
      .attr("class", "dn")
      .attr("x", (d: any) => d.x)
      .attr("y", (d: any) => d.y)
      .attr("fill", (d: any) =>
        d.future ? Tc.dim : d.level > 0 ? "#fff" : Tc.muted,
      )
      .attr("font-size", dnFontSz)
      .attr("font-family", F)
      .attr("font-weight", (d: any) => (d.key === `dn-${tKey}` ? 700 : 400))
      .attr("text-anchor", "middle")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .text((d: any) => d.label);
    dnEn.each(function (this: any, d: any) {
      d3.select(this)
        .transition("dnen")
        .delay(DUR * 0.5 + stag({ x: d._x, y: d._y }))
        .duration(DUR / 2)
        .ease(D3E)
        .style("opacity", 1);
    });
    dns.merge(dnEn).each(function (this: any, d: any) {
      d3.select(this)
        .transition("dnup")
        .delay(DUR * 0.3 + stag({ x: d._x, y: d._y }))
        .duration(DUR / 2)
        .ease(D3E)
        .attr("x", d.x)
        .attr("y", d.y)
        .attr("fill", d.future ? Tc.dim : d.level > 0 ? "#fff" : Tc.muted)
        .style("opacity", 1);
    });

    // Weekday headers in cal view — one set per month block
    const wkLabels =
      view === "calendar"
        ? (() => {
            const moGroups: { month: number; year: number; days: Date[] }[] =
              [];
            let pm2 = -1,
              gp: { month: number; year: number; days: Date[] } | null = null;
            for (const day of days) {
              const m = day.getMonth();
              if (m !== pm2) {
                gp = { month: m, year: day.getFullYear(), days: [] };
                moGroups.push(gp);
                pm2 = m;
              }
              gp!.days.push(day);
            }
            const labels: {
              key: string;
              label: string;
              x: number;
              y: number;
            }[] = [];
            let bx2 = lp + shiftX;
            for (const mo of moGroups) {
              const bw = 7 * (cs + cg) - cg;
              WK_FULL.forEach((d, i) => {
                labels.push({
                  key: `wk-${d}-${mo.month}-${mo.year}`,
                  label: zoomed ? d.slice(0, 3) : d[0],
                  x: bx2 + i * (cs + cg) + cs / 2,
                  y: tp - 2,
                });
              });
              bx2 += bw + mg;
            }
            return labels;
          })()
        : [];
    svg.selectAll(".wk").interrupt();
    const wks = svg.selectAll(".wk").data(wkLabels, (d: any) => d.key);
    wks
      .exit()
      .transition("wke")
      .duration(DUR / 3)
      .ease(D3E)
      .style("opacity", 0)
      .remove();
    const wkEn = wks
      .enter()
      .append("text")
      .attr("class", "wk")
      .attr("x", (d: any) => d.x)
      .attr("y", (d: any) => d.y)
      .attr("fill", Tc.dim)
      .attr("font-size", wkFontSz)
      .attr("font-family", F)
      .attr("text-anchor", "middle")
      .style("opacity", 0)
      .text((d: any) => d.label);
    wkEn
      .transition("wken")
      .delay(DUR / 3)
      .duration(DUR / 2)
      .ease(D3E)
      .style("opacity", 1);
    wks
      .merge(wkEn)
      .transition("wkup")
      .delay(DUR * 0.3)
      .duration(DUR / 2)
      .ease(D3E)
      .attr("x", (d: any) => d.x)
      .attr("y", (d: any) => d.y)
      .style("opacity", 1);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    // NOTE: `logs` is intentionally NOT a dependency — a live edit must not
    // re-run this heavy build (layout + ripple), which would also wipe the
    // selection outline. Cell/day-number fills are recolored by the cheap
    // effect below; the hover tooltip reads logs via logsRef.
  }, [
    effExpanded,
    view,
    offset,
    zoomed,
    cw,
    days,
    habit,
    pal,
    units,
    tKey,
    cfg,
  ]);

  // Cheap recolor: update only cell + day-number fills when the logs (or
  // palette/theme) change, without re-running the heavy build. Leaves stroke
  // untouched, so the selected-day outline survives a live edit.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const sh = pal.shades;
    const Tc = THEMES[theme];
    const greyFill = Tc.futureCell;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    d3.select(svg)
      .selectAll<SVGRectElement, any>(".dc")
      .attr("fill", (d: any) =>
        d.future ? greyFill : sh[logLevel(habit, logs[d.key], units)],
      );
    // Day numbers (calendar view); their datum key is `dn-<dateKey>`.
    d3.select(svg)
      .selectAll<SVGTextElement, any>(".dn")
      .attr("fill", (d: any) => {
        const lvl = logLevel(habit, logs[d.key.slice(3)], units);
        return d.future ? Tc.dim : lvl > 0 ? "#fff" : Tc.muted;
      });
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, [logs, habit, pal, units, theme]);

  // Outline the selected day's cell — separate cheap effect (restroke only, no
  // data re-join/ripple). Runs on selection/theme change.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const Tc = THEMES[theme];
    d3.select(svg)
      .selectAll<SVGRectElement, any>(".dc")
      .each(function (this: any, d: any) {
        // eslint-disable-line @typescript-eslint/no-explicit-any
        if (d.future) return;
        const isSel = selectedDate === d.key;
        const isToday = d.key === tKey;
        d3.select(this)
          .attr(
            "stroke",
            isSel ? pal.shades[4] : isToday ? Tc.accent : Tc.cellStroke,
          )
          .attr("stroke-width", isSel ? 2.5 : isToday ? 1.5 : 1);
      });
  }, [selectedDate, tKey, pal, theme]);

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
      ref={cRef}
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
          className={`${reorderMode ? "reorder-drag " : ""}${styles.dragRegion}${reorderMode ? ` ${styles.reorder}` : ""}${dragActivator?.isDragging ? ` ${styles.grabbing}` : ""}${pressing ? ` ${styles.pressing}` : ""}`}
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
              {
                onMouseDown: startPress,
                onMouseUp: cancelPress,
                onMouseLeave: cancelPress,
                onTouchStart: startPress,
                onTouchEnd: cancelPress,
                onTouchCancel: cancelPress,
              })}
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
          {/* Controls: view toggle + range + nav arrows */}
          <div className={styles.controls}>
            <div className={styles.viewSeg}>
              {[
                { id: "heatmap", label: "Heat" },
                { id: "calendar", label: "Cal" },
              ].map((v) => {
                const disabled = zoomed && v.id === "heatmap";
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      if (!disabled) setView(v.id as "heatmap" | "calendar");
                    }}
                    disabled={disabled}
                    className={`${styles.viewBtn}${view === v.id ? ` ${styles.on}` : ""}`}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
            <div className={styles.range}>{rangeLabel}</div>
            <div className={styles.navGroup}>
              <button onClick={navBack} className={styles.navBtn}>
                ‹
              </button>
              <button
                onClick={navFwd}
                disabled={!canFwd}
                className={styles.navBtn}
              >
                ›
              </button>
            </div>
          </div>

          {/* SVG */}
          <svg
            ref={svgRef}
            width={cw}
            height={svgHeight}
            className={styles.svg}
          />

          {/* Legend */}
          <div className={styles.legend}>
            <span className={styles.legendLbl}>Less</span>
            {pal.shades.map((c, i) => (
              <div
                key={i}
                className={styles.legendCell}
                style={{ background: c }}
              />
            ))}
            <span className={styles.legendLbl}>More</span>
          </div>
        </div>
      </div>

      {/* Inline day editor — the card "further expands" when a day is tapped.
          It and the quick-log both stay mounted and cross-swap heights so
          selecting/closing animates smoothly; editorDate lingers through close. */}
      <div
        className={`${styles.editor}${selectedDate ? ` ${styles.open}` : ""}`}
      >
        <div className={styles.inner}>
          {editorDate && onSaveDay && (
            <DayEditor
              key={editorDate}
              habit={habit}
              dateKey={editorDate}
              habitLogs={logs}
              units={units}
              pal={pal}
              onChange={(d, entry) => onSaveDay(d, entry)}
              onClose={closeEditor}
            />
          )}
        </div>
      </div>

      {/* Quick-log for today — stays mounted; collapses while editing a day */}
      {onQuickLog && (
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
              onQuickLog={(mId, amt) => {
                if (expanded && !zoomed) {
                  setZoomed(true);
                  setOffset(0);
                  setView("calendar");
                }
                onQuickLog(mId, amt);
              }}
              onQuickReset={onQuickReset}
              onAddSet={
                onAddSet
                  ? (mId, set) => {
                      if (expanded && !zoomed) {
                        setZoomed(true);
                        setOffset(0);
                        setView("calendar");
                      }
                      onAddSet(mId, set);
                    }
                  : null
              }
              onRemoveSet={onRemoveSet}
              timers={timers}
              onStartTimer={onStartTimer}
              onStopTimer={onStopTimer}
              habitId={habitId}
            />
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tip && (
        <div className={styles.tip}>
          <div>{tip.label}</div>
          <div className={styles.tipDate}>{tip.date}</div>
        </div>
      )}
    </div>
  );
}
