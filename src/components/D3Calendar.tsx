import { useState, useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { C, F, MONTHS, WK_FULL, PALETTES, THEMES, DEFAULT_CONFIG, D3E } from "../constants";
import { getUnit } from "../lib/metrics";
import { logLevel, logSummary, habitStats } from "../lib/stats";
import { todayK } from "../lib/dates";
import {
  getRecentDays, fitCellSize, compactHeatLayout, compactCalLayout,
} from "../lib/d3layout";
import QuickLogSection from "./QuickLogSection";
import type { AppConfig, Habit, HabitLogs, SetEntry, Timers, Unit } from "../types";

type Props = {
  habit: Habit;
  logs: HabitLogs;
  units: Unit[];
  onCellClick: (dateKey: string) => void;
  onEdit?: () => void;
  onQuickLog?: (metricId: string, amt: number) => void;
  onQuickReset: (metricId: string) => void;
  onAddSet?: ((metricId: string, set: SetEntry) => void) | null;
  onRemoveSet: (metricId: string, idx: number) => void;
  timers?: Timers;
  onStartTimer: (metricId: string) => void;
  onStopTimer: (metricId: string) => void;
  habitId: string;
  appConfig?: AppConfig;
};

type Tip = { label: string; date: string };

export default function D3Calendar({ habit, logs, units, onCellClick, onEdit, onQuickLog, onQuickReset, onAddSet, onRemoveSet, timers, onStartTimer, onStopTimer, habitId, appConfig }: Props) {
  const cfg = appConfig || DEFAULT_CONFIG;
  const NUM_MONTHS = cfg.numMonths || 4;
  const svgRef = useRef<SVGSVGElement>(null), cRef = useRef<HTMLDivElement>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cw, setCw] = useState(400);
  const [tip, setTip] = useState<Tip | null>(null);
  const [view, setView] = useState<"heatmap" | "calendar">("heatmap");
  const [offset, setOffset] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [svgHeight, setSvgHeight] = useState(120);

  const startPress = () => { setPressing(true); longPressRef.current = setTimeout(() => { setPressing(false); if (onEdit) onEdit(); }, 500); };
  const cancelPress = () => { setPressing(false); if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } };
  useEffect(() => () => { if (longPressRef.current) clearTimeout(longPressRef.current); }, []);

  const numM = zoomed ? 1 : NUM_MONTHS;
  const days = useMemo(() => getRecentDays(numM, offset), [numM, offset]);
  const tKey = todayK();
  const pal = PALETTES.find((p) => p.name === habit.color) || PALETTES[0];
  const stats = useMemo(() => habitStats(habit, logs, units), [habit, logs, units]);
  const pu = (habit.metrics || [])[0]?.unit || "count";
  const sLabel = pu === "min" ? "Hours" : getUnit(pu, units).label || "Total";
  const sVal = pu === "min" ? (stats.totalVal >= 60 ? `${(stats.totalVal / 60).toFixed(1)}` : `${stats.totalVal}m`) : stats.totalVal;

  const navBack = () => { if (zoomed) { setZoomed(false); setView("heatmap"); } else { setOffset((o) => o - NUM_MONTHS); } };
  const navFwd = () => { if (offset === 0 && !zoomed) { setZoomed(true); setView("calendar"); } else if (zoomed) { /* already at present */ } else { setOffset((o) => { const next = o + NUM_MONTHS; if (next >= 0) { setZoomed(false); return 0; } return next; }); } };
  const canFwd = zoomed ? false : (offset < 0 || offset === 0);

  const rangeLabel = days.length > 0 ? (numM === 1 ? `${MONTHS[days[0].getMonth()]} ${days[0].getFullYear()}` : `${MONTHS[days[0].getMonth()]} – ${MONTHS[days[days.length - 1].getMonth()]} ${days[days.length - 1].getFullYear()}`) : "";

  useEffect(() => {
    const el = cRef.current;
    if (!el) return;
    const obs = new ResizeObserver((e) => { for (const en of e) setCw(en.contentRect.width); });
    obs.observe(el);
    setCw(el.getBoundingClientRect().width);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    // d3 selection is kept loosely typed: the data-join/animation logic is
    // ported verbatim from the prototype to preserve identical behavior.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const svg: any = d3.select(svgRef.current);
    const svgAvail = cw;
    const cg = zoomed ? 4 : 2, lp = zoomed ? 8 : 6, tp = zoomed ? 28 : 24, mg = zoomed ? 0 : (cfg.monthGap != null ? cfg.monthGap : 5);
    const cs = zoomed
      ? Math.min((svgAvail - 2 * lp - 6 * cg) / 7, 36)
      : fitCellSize(days, svgAvail, view, cg, lp, mg);
    // d3 sets SVG presentation attributes, where CSS vars don't resolve — use
    // concrete theme hex here. The empty (level-0) cell is theme-specific.
    const Tc = THEMES[cfg.theme === "light" ? "light" : "dark"];
    const sh = [Tc.emptyCell, ...pal.shades.slice(1)], DUR = 700;
    svg.selectAll("*").interrupt();

    const { cells: layout, mLabels } = view === "heatmap"
      ? compactHeatLayout(days, cs, cg, lp, tp, mg)
      : compactCalLayout(days, cs, cg, lp, tp, mg);

    const maxX = d3.max(layout, (d) => d.x + d.w) || 300;
    const shiftX = Math.max(0, (svgAvail - maxX) / 2);
    if (shiftX > 0) {
      layout.forEach((c) => { c.x += shiftX; });
      mLabels.forEach((l) => { l.x += shiftX; });
    }

    const maxY = d3.max(layout, (d) => d.y + d.h) || 100;
    const svgH = maxY + 8;
    setSvgHeight(svgH);

    const todayCell = layout.find((c) => c.key === tKey);
    const tX = todayCell ? todayCell.x : maxX / 2, tY = todayCell ? todayCell.y : maxY / 2;
    const maxDist = Math.sqrt(maxX ** 2 + maxY ** 2) || 1;
    const stag = (d: { x: number; y: number }) => { const dist = Math.sqrt((d.x - tX) ** 2 + (d.y - tY) ** 2); return (dist / maxDist) * 350; };

    const dnFontSz = zoomed ? 13 : Math.max(7, Math.round(cs * 0.7));
    const mlFontSz = zoomed ? 13 : Math.max(8, Math.round(cs * 0.8));
    const wkFontSz = zoomed ? 10 : Math.max(7, Math.round(cs * 0.65));
    const cellR = zoomed ? 6 : Math.max(2, Math.round(cs * 0.2));

    const greyFill = Tc.futureCell;
    const cellFill = (d: any) => d.future ? greyFill : sh[logLevel(habit, logs[d.key], units)];
    const cellOp = (d: any) => d.future ? 0.35 : 1;
    const cellStroke = (d: any) => d.key === tKey ? Tc.accent : Tc.cellStroke;
    const cellStrokeW = (d: any) => d.key === tKey ? 1.5 : 1;

    const cells = svg.selectAll(".dc").data(layout, (d: any) => d.key);
    cells.exit().each(function (this: any, d: any) { d3.select(this).transition("ex").delay(stag(d)).duration(DUR * .3).ease(D3E).style("opacity", 0).attr("width", 0).attr("height", 0).remove(); });
    const enter = cells.enter().append("rect").attr("class", "dc")
      .attr("x", (d: any) => d.x).attr("y", (d: any) => d.y).attr("width", (d: any) => d.w).attr("height", (d: any) => d.h)
      .attr("rx", cellR).attr("ry", cellR)
      .attr("fill", cellFill).attr("stroke", cellStroke).attr("stroke-width", cellStrokeW)
      .style("cursor", (d: any) => d.future ? "default" : "pointer").style("opacity", 0);
    enter.each(function (this: any, d: any) { d3.select(this).transition("en").delay(stag(d)).duration(DUR * .6).ease(D3E).style("opacity", cellOp(d)); });
    const merged = cells.merge(enter);
    merged.on("click", (_: any, d: any) => { if (!d.future && onCellClick) onCellClick(d.key); })
      .on("mouseenter", (ev: any, d: any) => { if (d.future) return; setTip({ label: logSummary(habit, logs[d.key]), date: d.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) }); d3.select(ev.currentTarget).attr("stroke", sh[4]).attr("stroke-width", 2); })
      .on("mouseleave", (ev: any, d: any) => { setTip(null); d3.select(ev.currentTarget).attr("stroke", cellStroke(d)).attr("stroke-width", cellStrokeW(d)); });
    merged.each(function (this: any, d: any) {
      d3.select(this).transition("up").delay(stag(d)).duration(DUR * .6).ease(D3E)
        .attr("x", d.x).attr("y", d.y).attr("width", d.w).attr("height", d.h).attr("rx", cellR).attr("ry", cellR)
        .attr("fill", cellFill(d)).attr("stroke", cellStroke(d)).attr("stroke-width", cellStrokeW(d)).style("opacity", cellOp(d));
    });

    // Month labels
    svg.selectAll(".ml").interrupt();
    const mls = svg.selectAll(".ml").data(mLabels, (d: any) => d.key);
    mls.exit().transition("mle").duration(DUR / 3).ease(D3E).style("opacity", 0).remove();
    const mlEn = mls.enter().append("text").attr("class", "ml").attr("x", (d: any) => d.x).attr("y", (d: any) => d.y)
      .attr("fill", Tc.muted).attr("font-size", mlFontSz).attr("font-family", F).attr("font-weight", 600)
      .attr("text-anchor", (d: any) => d.anchor || "start").style("opacity", 0).text((d: any) => d.label);
    mlEn.transition("mlen").delay(DUR / 3).duration(DUR / 2).ease(D3E).style("opacity", 1);
    mls.merge(mlEn).transition("mlup").delay(DUR * .3).duration(DUR / 2).ease(D3E)
      .attr("x", (d: any) => d.x).attr("y", (d: any) => d.y).attr("text-anchor", (d: any) => d.anchor || "start").style("opacity", 1);

    // Day numbers in cal view
    const dayNums = view === "calendar" ? layout.map((c) => ({
      key: `dn-${c.key}`, label: String(c.date.getDate()), x: c.x + c.w / 2, y: c.y + c.h / 2 + Math.round(dnFontSz * 0.38),
      future: c.future, level: logLevel(habit, logs[c.key], units), _x: c.x, _y: c.y,
    })) : [];
    svg.selectAll(".dn").interrupt();
    const dns = svg.selectAll(".dn").data(dayNums, (d: any) => d.key);
    dns.exit().each(function (this: any, d: any) { d3.select(this).transition("dne").delay(stag({ x: d._x, y: d._y })).duration(DUR / 3).ease(D3E).style("opacity", 0).remove(); });
    const dnEn = dns.enter().append("text").attr("class", "dn").attr("x", (d: any) => d.x).attr("y", (d: any) => d.y)
      .attr("fill", (d: any) => d.future ? Tc.dim : d.level > 0 ? "#fff" : Tc.muted)
      .attr("font-size", dnFontSz).attr("font-family", F).attr("font-weight", (d: any) => d.key === `dn-${tKey}` ? 700 : 400)
      .attr("text-anchor", "middle").style("pointer-events", "none").style("opacity", 0).text((d: any) => d.label);
    dnEn.each(function (this: any, d: any) { d3.select(this).transition("dnen").delay(DUR * .5 + stag({ x: d._x, y: d._y })).duration(DUR / 2).ease(D3E).style("opacity", 1); });
    dns.merge(dnEn).each(function (this: any, d: any) {
      d3.select(this).transition("dnup").delay(DUR * .3 + stag({ x: d._x, y: d._y })).duration(DUR / 2).ease(D3E)
        .attr("x", d.x).attr("y", d.y).attr("fill", d.future ? Tc.dim : d.level > 0 ? "#fff" : Tc.muted).style("opacity", 1);
    });

    // Weekday headers in cal view — one set per month block
    const wkLabels = view === "calendar" ? (() => {
      const moGroups: { month: number; year: number; days: Date[] }[] = [];
      let pm2 = -1, gp: { month: number; year: number; days: Date[] } | null = null;
      for (const day of days) { const m = day.getMonth(); if (m !== pm2) { gp = { month: m, year: day.getFullYear(), days: [] }; moGroups.push(gp); pm2 = m; } gp!.days.push(day); }
      const labels: { key: string; label: string; x: number; y: number }[] = [];
      let bx2 = lp + shiftX;
      for (const mo of moGroups) {
        const bw = 7 * (cs + cg) - cg;
        WK_FULL.forEach((d, i) => { labels.push({ key: `wk-${d}-${mo.month}-${mo.year}`, label: zoomed ? d.slice(0, 3) : d[0], x: bx2 + i * (cs + cg) + cs / 2, y: tp - 2 }); });
        bx2 += bw + mg;
      }
      return labels;
    })() : [];
    svg.selectAll(".wk").interrupt();
    const wks = svg.selectAll(".wk").data(wkLabels, (d: any) => d.key);
    wks.exit().transition("wke").duration(DUR / 3).ease(D3E).style("opacity", 0).remove();
    const wkEn = wks.enter().append("text").attr("class", "wk").attr("x", (d: any) => d.x).attr("y", (d: any) => d.y)
      .attr("fill", Tc.dim).attr("font-size", wkFontSz).attr("font-family", F).attr("text-anchor", "middle")
      .style("opacity", 0).text((d: any) => d.label);
    wkEn.transition("wken").delay(DUR / 3).duration(DUR / 2).ease(D3E).style("opacity", 1);
    wks.merge(wkEn).transition("wkup").delay(DUR * .3).duration(DUR / 2).ease(D3E)
      .attr("x", (d: any) => d.x).attr("y", (d: any) => d.y).style("opacity", 1);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, [view, offset, zoomed, cw, days, logs, habit, pal, units, tKey, onCellClick, cfg]);

  return (
    <div ref={cRef} style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 16px", marginBottom: 16, transition: "border-color .3s", position: "relative" }}>
      {/* Header: name + stats */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "default", userSelect: "none", WebkitUserSelect: "none" }}
          onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}
          onTouchStart={startPress} onTouchEnd={cancelPress} onTouchCancel={cancelPress}>
          <span style={{ fontSize: 18, transition: "transform .2s", transform: pressing ? "scale(0.9)" : "scale(1)" }}>{habit.emoji}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: pressing ? C.accent : C.text, fontFamily: F, transition: "color .2s" }}>{habit.name}</h3>
            {habit.description && <p style={{ margin: "1px 0 0", fontSize: 10, color: C.muted, fontFamily: F }}>{habit.description}</p>}
            <div style={{ fontSize: 8, color: C.dim, fontFamily: F, marginTop: 1, opacity: pressing ? 1 : 0, transition: "opacity .2s" }}>hold to edit...</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, textAlign: "right" }}>
          {[{ l: "Days", v: stats.totalDays }, { l: sLabel, v: sVal }, { l: "Streak", v: `${stats.curStreak}d` }].map((s) => (
            <div key={s.l}><div style={{ fontSize: 14, fontWeight: 700, color: pal.shades[4], fontFamily: F }}>{s.v}</div><div style={{ fontSize: 8, color: C.muted, fontFamily: F, letterSpacing: ".04em", textTransform: "uppercase" }}>{s.l}</div></div>))}
        </div>
      </div>

      {/* Controls: view toggle + range + nav arrows */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 6 }}>
        <div style={{ display: "flex", background: C.bg, borderRadius: 5, border: `1px solid ${C.border}`, padding: 2, gap: 2 }}>
          {[{ id: "heatmap", label: "Heat" }, { id: "calendar", label: "Cal" }].map((v) => { const disabled = zoomed && v.id === "heatmap"; return (<button key={v.id} onClick={() => { if (!disabled) setView(v.id as "heatmap" | "calendar"); }} disabled={disabled} style={{ padding: "3px 10px", borderRadius: 3, border: "none", background: view === v.id ? C.surface : "transparent", color: disabled ? C.dim : view === v.id ? C.text : C.dim, cursor: disabled ? "default" : "pointer", fontSize: 9, fontFamily: F, fontWeight: view === v.id ? 600 : 400, transition: "all .2s", boxShadow: view === v.id ? "0 1px 2px rgba(0,0,0,.3)" : "none", opacity: disabled ? 0.35 : 1 }}>{v.label}</button>); })}
        </div>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: F, fontWeight: 500 }}>{rangeLabel}</div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={navBack} style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid ${C.border}`, background: C.bg, color: C.muted, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, transition: "all .15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}>‹</button>
          <button onClick={navFwd} disabled={!canFwd} style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid ${canFwd ? C.border : C.bg}`, background: C.bg, color: canFwd ? C.muted : C.dim, cursor: canFwd ? "pointer" : "default", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, opacity: canFwd ? 1 : .35, transition: "all .15s" }} onMouseEnter={(e) => { if (canFwd) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; } }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = canFwd ? C.border : C.bg; e.currentTarget.style.color = canFwd ? C.muted : C.dim; }}>›</button>
        </div>
      </div>

      {/* SVG */}
      <svg ref={svgRef} width={cw} height={svgHeight} style={{ display: "block", transition: "height .5s cubic-bezier(.22,1,.36,1)" }} />

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, marginTop: 8 }}>
        <span style={{ fontSize: 9, color: C.muted, fontFamily: F }}>Less</span>
        {[THEMES[cfg.theme === "light" ? "light" : "dark"].emptyCell, ...pal.shades.slice(1)].map((c, i) => <div key={i} style={{ width: 11, height: 11, borderRadius: 2, background: c }} />)}
        <span style={{ fontSize: 9, color: C.muted, fontFamily: F }}>More</span>
      </div>

      {/* Quick-log for today */}
      {onQuickLog && <QuickLogSection habit={habit} logs={logs} units={units} pal={pal} onQuickLog={(mId, amt) => { if (!zoomed) { setZoomed(true); setOffset(0); setView("calendar"); } onQuickLog(mId, amt); }} onQuickReset={onQuickReset} onAddSet={onAddSet ? (mId, set) => { if (!zoomed) { setZoomed(true); setOffset(0); setView("calendar"); } onAddSet(mId, set); } : null} onRemoveSet={onRemoveSet} timers={timers} onStartTimer={onStartTimer} onStopTimer={onStopTimer} habitId={habitId} />}

      {/* Tooltip */}
      {tip && (
        <div style={{ position: "absolute", top: 8, right: 16, pointerEvents: "none", background: C.surfaceLight, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "5px 9px", fontSize: 10, color: C.text, fontFamily: F, boxShadow: "0 4px 12px rgba(0,0,0,.4)", zIndex: 10, maxWidth: 260 }}>
          <div>{tip.label}</div><div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{tip.date}</div>
        </div>
      )}
    </div>
  );
}
