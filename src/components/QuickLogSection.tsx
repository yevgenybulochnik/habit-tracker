import { useState } from "react";
import type { CSSProperties } from "react";
import {
  getQuickAdd,
  isSetMetric,
  isDoneMetric,
  metricActive,
  findLastSet,
  setUnitLabel,
} from "../lib/metrics";
import { fmtVal, fmtSets } from "../lib/format";
import { logLevel } from "../lib/stats";
import { todayK } from "../lib/dates";
import SetInput from "./SetInput";
import TimerButton from "./TimerButton";
import type {
  Habit,
  HabitLogs,
  Palette,
  SetEntry,
  Timers,
  Unit,
} from "../types";
import styles from "./QuickLogSection.module.css";

type Props = {
  habit: Habit;
  logs: HabitLogs;
  units: Unit[];
  pal: Palette;
  onQuickLog: (metricId: string, amt: number) => void;
  onQuickReset: (metricId: string) => void;
  onAddSet: ((metricId: string, set: SetEntry) => void) | null;
  onRemoveSet: (metricId: string, idx: number) => void;
  timers?: Timers;
  onStartTimer: (metricId: string) => void;
  onStopTimer: (metricId: string) => void;
  habitId: string;
  /** Dense layout (Quick view / collapsed card): drop the "Quick log today" label, trim spacing. */
  dense?: boolean;
};

export default function QuickLogSection({
  habit,
  logs,
  units,
  pal,
  onQuickLog,
  onQuickReset,
  onAddSet,
  onRemoveSet,
  timers,
  onStartTimer,
  onStopTimer,
  habitId,
  dense,
}: Props) {
  const [justTapped, setJustTapped] = useState<string | null>(null);
  const ms = habit.metrics;
  const compact = ms.length === 1;
  const tKey = todayK();
  const todayLog = logs[tKey] || {};
  const hasAny = ms.some((m) => metricActive(m, todayLog));
  const level = logLevel(habit, todayLog, units);
  const priIsMin = ms[0]?.unit === "min";
  // The only metric, when it is a sets metric
  const priSets = compact && isSetMetric(ms[0]) ? ms[0] : null;
  const priIsDone = compact && isDoneMetric(ms[0]);
  const timerKey = (mId: string) => `${habitId}:${mId}`;

  const qAdd = (mId: string, amt: number) => {
    onQuickLog(mId, amt);
    setJustTapped(`${mId}-${amt}`);
    setTimeout(() => setJustTapped(null), 350);
  };

  const summary = (() => {
    if (!hasAny) return null;
    if (priIsDone) return null; // the toggle button shows its own state
    if (compact) {
      if (priSets) return fmtSets(todayLog[priSets.id] as SetEntry[], priSets);
      return fmtVal(
        ms.reduce((s, m) => s + ((todayLog[m.id] as number) || 0), 0),
        ms[0].unit,
      );
    }
    return `${ms.filter((m) => metricActive(m, todayLog)).length}/${ms.length}`;
  })();

  // Per-habit palette → CSS vars used throughout (hover/active/tap states).
  const palVars = {
    "--p1": pal.shades[1],
    "--p2": pal.shades[2],
    "--p3": pal.shades[3],
    "--p4": pal.shades[4],
    "--p1a": `${pal.shades[1]}44`,
  } as CSSProperties;

  // Intensity-bar segment background is per-segment, so it stays inline.
  const barBg = (on: boolean, shade: number) =>
    on ? pal.shades[shade] : "var(--c-bg)";

  return (
    <div
      className={`${styles.wrap}${dense ? ` ${styles.dense}` : ""}`}
      style={palVars}
    >
      {(!dense || hasAny) && (
        <div className={`${styles.header}${dense ? ` ${styles.dense}` : ""}`}>
          {!dense && (
            <span className={styles.headerLabel}>Quick log today</span>
          )}
          {hasAny && <span className={styles.summary}>{summary}</span>}
        </div>
      )}

      {/* Single metric: daily check-off, sets, or normal */}
      {priIsDone ? (
        <button
          onClick={() => (hasAny ? onQuickReset(ms[0].id) : qAdd(ms[0].id, 1))}
          className={`${styles.doneToggle}${hasAny ? ` ${styles.on}` : ""}`}
        >
          <span className={styles.doneIcon}>{hasAny ? "✓" : "○"}</span>
          {hasAny ? "Done today" : "Mark today"}
        </button>
      ) : priSets ? (
        <>
          <div className={styles.setsRow}>
            <span className={styles.setsName}>{priSets.name}</span>
            <span className={styles.setsBadge}>
              SETS · {setUnitLabel(priSets)}
            </span>
          </div>
          <SetInput
            metric={priSets}
            sets={todayLog[priSets.id] as SetEntry[]}
            pal={pal}
            onAddSet={onAddSet!}
            onRemoveSet={onRemoveSet}
            lastSet={findLastSet(logs, priSets.id)}
          />
          <div className={styles.bars}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={styles.barSeg}
                style={{ background: barBg(level >= i, i) }}
              />
            ))}
          </div>
        </>
      ) : compact ? (
        <>
          <div className={styles.qaRow}>
            {getQuickAdd(ms[0].unit, units).map((n) => {
              const isA = justTapped === `${ms[0].id}-${n}`;
              return (
                <button
                  key={n}
                  onClick={() => qAdd(ms[0].id, n)}
                  className={`${styles.qaBtn}${hasAny ? ` ${styles.has}` : ""}${isA ? ` ${styles.tapped}` : ""}`}
                >
                  +{n}
                </button>
              );
            })}
            {hasAny && (
              <button
                onClick={() => onQuickReset(ms[0].id)}
                className={styles.resetBtn}
              >
                ↺
              </button>
            )}
          </div>
          {priIsMin && (
            <TimerButton
              startTime={timers?.[timerKey(ms[0].id)]}
              onStart={() => onStartTimer(ms[0].id)}
              onStop={() => onStopTimer(ms[0].id)}
              pal={pal}
              compact={true}
            />
          )}
          <div className={styles.bars}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={styles.barSeg}
                style={{ background: barBg(level >= i, i) }}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Multi-metric */}
          <div className={styles.metricsCol}>
            {ms.map((m) => {
              const isSets = isSetMetric(m);
              if (isSets) {
                const sets = todayLog[m.id] as SetEntry[] | undefined;
                const hasSets2 = Array.isArray(sets) && sets.length > 0;
                return (
                  <div
                    key={m.id}
                    className={`${styles.metricCard}${hasSets2 ? ` ${styles.active}` : ""}`}
                  >
                    <div className={styles.setsHdr}>
                      <div
                        className={`${styles.checkbox}${hasSets2 ? ` ${styles.on}` : ""}`}
                      >
                        {hasSets2 && (
                          <span className={styles.checkMark}>✓</span>
                        )}
                      </div>
                      <span
                        className={`${styles.metricLabel}${hasSets2 ? ` ${styles.on}` : ""}`}
                      >
                        {m.name}
                      </span>
                      <span className={styles.miniBadge}>SETS</span>
                      {hasSets2 && (
                        <span className={styles.setsSummary}>
                          {fmtSets(sets, m)}
                        </span>
                      )}
                    </div>
                    <SetInput
                      metric={m}
                      sets={sets}
                      pal={pal}
                      onAddSet={onAddSet!}
                      onRemoveSet={onRemoveSet}
                      lastSet={findLastSet(logs, m.id)}
                    />
                  </div>
                );
              }
              const val = (todayLog[m.id] as number) || 0;
              const done = val > 0;
              const isMin = m.unit === "min";
              return (
                <div
                  key={m.id}
                  className={`${styles.metricRow}${done ? ` ${styles.active}` : ""}`}
                >
                  <div
                    className={`${styles.checkbox}${done ? ` ${styles.on}` : ""}`}
                  >
                    {done && <span className={styles.checkMark}>✓</span>}
                  </div>
                  <span
                    className={`${styles.normName}${done ? ` ${styles.on}` : ""}`}
                  >
                    {m.name}
                  </span>
                  {done && (
                    <span className={styles.normVal}>
                      {fmtVal(val, m.unit)}
                    </span>
                  )}
                  <div className={styles.metricActions}>
                    {isMin && (
                      <TimerButton
                        startTime={timers?.[timerKey(m.id)]}
                        onStart={() => onStartTimer(m.id)}
                        onStop={() => onStopTimer(m.id)}
                        pal={pal}
                        compact={false}
                      />
                    )}
                    {getQuickAdd(m.unit, units)
                      .slice(0, 2)
                      .map((n) => {
                        const isA = justTapped === `${m.id}-${n}`;
                        return (
                          <button
                            key={n}
                            onClick={() => qAdd(m.id, n)}
                            className={`${styles.miniQa}${done ? ` ${styles.has}` : ""}${isA ? ` ${styles.tapped}` : ""}`}
                          >
                            +{n}
                          </button>
                        );
                      })}
                    {done && (
                      <button
                        onClick={() => onQuickReset(m.id)}
                        className={styles.miniReset}
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className={`${styles.bars} ${styles.barsTight}`}>
            {ms.map((m) => (
              <div
                key={m.id}
                className={styles.barSeg}
                style={{ background: barBg(metricActive(m, todayLog), 3) }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
