import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { F, THEMES } from "../theme";
import { MONTHS, WK_FULL } from "../lib/defaults";
import { logLevel, logSummary } from "../lib/stats";
import {
  getRecentDays,
  fitCellSize,
  compactHeatLayout,
  compactCalLayout,
} from "../lib/d3layout";
import type { CalendarNav, CalendarView, NavAction } from "../lib/calendarNav";
import { useElementWidth } from "../hooks/useElementWidth";
import styles from "./CalendarPanel.module.css";
import type { AppConfig, Habit, HabitLogs, Palette, Unit } from "../types";

type Props = {
  habit: Habit;
  logs: HabitLogs;
  units: Unit[];
  config: AppConfig;
  /** Today's date key: outlined, and where the cells' ripple starts. */
  today: string;
  pal: Palette;
  /** d3 draws only while expanded: a collapsed card skips the build. */
  expanded: boolean;
  /** Which months and view to show. The card owns it, as quick-log zooms it too. */
  nav: CalendarNav;
  onNav: (action: NavAction) => void;
  /** The day open in the card's editor, outlined in the habit's colour. */
  selectedDate: string | null;
  /** A past day was tapped. */
  onTapDay: (dateKey: string) => void;
};

type Tip = { label: string; date: string };

// Shared easing for every d3 transition in the panel.
const D3E = d3.easeCubicInOut;

/**
 * A habit's heatmap/calendar: the view and month controls, the d3-drawn SVG,
 * its legend and the hover tooltip.
 */
export default function CalendarPanel({
  habit,
  logs,
  units,
  config: cfg,
  today,
  pal,
  expanded,
  nav,
  onNav,
  selectedDate,
  onTapDay,
}: Props) {
  const { view, offset, zoomed } = nav;
  const svgRef = useRef<SVGSVGElement>(null);
  const [wrapRef, cw] = useElementWidth<HTMLDivElement>(400);
  const [tip, setTip] = useState<Tip | null>(null);
  const [svgHeight, setSvgHeight] = useState(120);
  // The d3 handlers are attached once per build, so they read these refs to
  // see the current tap callback, selection and logs.
  const tapRef = useRef(onTapDay);
  tapRef.current = onTapDay;
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const logsRef = useRef(logs); // the build doesn't re-run on logs
  logsRef.current = logs;

  const numM = zoomed ? 1 : cfg.numMonths;
  const days = useMemo(
    () => getRecentDays(numM, offset, today),
    [numM, offset, today],
  );
  const theme = cfg.theme;

  const rangeLabel =
    days.length > 0
      ? numM === 1
        ? `${MONTHS[days[0].getMonth()]} ${days[0].getFullYear()}`
        : `${MONTHS[days[0].getMonth()]} – ${MONTHS[days[days.length - 1].getMonth()]} ${days[days.length - 1].getFullYear()}`
      : "";

  useEffect(() => {
    if (!expanded || !svgRef.current) return; // body not rendered when collapsed/reordering
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
        ? compactHeatLayout(days, cs, cg, lp, tp, mg, today)
        : compactCalLayout(days, cs, cg, lp, tp, mg, today);

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

    const todayCell = layout.find((c) => c.key === today);
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
    const cellStroke = (d: any) =>
      d.key === today ? Tc.accent : Tc.cellStroke;
    const cellStrokeW = (d: any) => (d.key === today ? 1.5 : 1);

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
      // On every cell, not just new ones: a future day becomes tappable when
      // today moves on to it.
      .style("cursor", (d: any) => (d.future ? "default" : "pointer"))
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
      // The day being edited keeps its outline through a rebuild
      const isSel = selectedDateRef.current === d.key;
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
        .attr("stroke", isSel ? sh[4] : cellStroke(d))
        .attr("stroke-width", isSel ? 2.5 : cellStrokeW(d))
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
    const dnAll = dns.merge(dnEn);
    // Today's number is bold. Set on every number so it follows today.
    dnAll.attr("font-weight", (d: any) =>
      d.key === `dn-${today}` ? 700 : 400,
    );
    dnAll.each(function (this: any, d: any) {
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
    // re-run this heavy build (layout + ripple). Cell/day-number fills are
    // recolored by the cheap effect below; the hover tooltip reads logs via
    // logsRef.
  }, [expanded, view, offset, zoomed, cw, days, habit, pal, units, today, cfg]);

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
        const isToday = d.key === today;
        d3.select(this)
          .attr(
            "stroke",
            isSel ? pal.shades[4] : isToday ? Tc.accent : Tc.cellStroke,
          )
          .attr("stroke-width", isSel ? 2.5 : isToday ? 1.5 : 1);
      });
  }, [selectedDate, today, pal, theme]);

  return (
    <div ref={wrapRef}>
      {/* Controls: view toggle + range + nav arrows */}
      <div className={styles.controls}>
        <div className={styles.viewSeg}>
          {(
            [
              { id: "heatmap", label: "Heat" },
              { id: "calendar", label: "Cal" },
            ] as const satisfies { id: CalendarView; label: string }[]
          ).map((v) => {
            const disabled = zoomed && v.id === "heatmap";
            return (
              <button
                key={v.id}
                onClick={() => onNav({ type: "view", view: v.id })}
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
          <button
            onClick={() => onNav({ type: "back", months: cfg.numMonths })}
            className={styles.navBtn}
          >
            ‹
          </button>
          <button
            onClick={() => onNav({ type: "forward", months: cfg.numMonths })}
            disabled={zoomed}
            className={styles.navBtn}
          >
            ›
          </button>
        </div>
      </div>

      {/* SVG */}
      <svg ref={svgRef} width={cw} height={svgHeight} className={styles.svg} />

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

      {/* Tooltip: absolutely positioned against the card, the nearest
          positioned ancestor, so the collapsible body doesn't clip it. */}
      {tip && (
        <div className={styles.tip}>
          <div>{tip.label}</div>
          <div className={styles.tipDate}>{tip.date}</div>
        </div>
      )}
    </div>
  );
}
