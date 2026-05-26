import { useState } from "react";
import { C, F } from "../constants";
import {
  getQuickAdd,
  isSetMetric,
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
  const ms = habit.metrics || [];
  const compact = ms.length === 1;
  const tKey = todayK();
  const todayLog = logs[tKey] || {};
  const hasAny = ms.some((m) => metricActive(m, todayLog));
  const level = logLevel(habit, todayLog, units);
  const priIsMin = ms[0]?.unit === "min";
  const priIsSets = ms[0]?.mode === "sets";
  const timerKey = (mId: string) => `${habitId}:${mId}`;

  const qAdd = (mId: string, amt: number) => {
    onQuickLog(mId, amt);
    setJustTapped(`${mId}-${amt}`);
    setTimeout(() => setJustTapped(null), 350);
  };

  const summary = (() => {
    if (!hasAny) return null;
    if (compact) {
      if (priIsSets) return fmtSets(todayLog[ms[0].id] as SetEntry[], ms[0]);
      return fmtVal(
        ms.reduce((s, m) => s + ((todayLog[m.id] as number) || 0), 0),
        ms[0].unit,
      );
    }
    return `${ms.filter((m) => metricActive(m, todayLog)).length}/${ms.length}`;
  })();

  return (
    <div
      style={{
        borderTop: `1px solid ${C.border}`,
        marginTop: dense ? 8 : 10,
        paddingTop: dense ? 8 : 10,
      }}
    >
      {(!dense || hasAny) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: dense ? "flex-end" : "space-between",
            marginBottom: 6,
          }}
        >
          {!dense && (
            <span
              style={{
                fontSize: 8,
                color: C.dim,
                fontFamily: F,
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              Quick log today
            </span>
          )}
          {hasAny && (
            <span
              style={{
                fontSize: 11,
                color: pal.shades[4],
                fontFamily: F,
                fontWeight: 700,
                animation: "fadeIn .3s ease",
              }}
            >
              {summary}
            </span>
          )}
        </div>
      )}

      {/* Single metric: sets or normal */}
      {compact && priIsSets ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontFamily: F,
                fontWeight: 600,
                color: C.text,
              }}
            >
              {ms[0].name}
            </span>
            <span
              style={{
                fontSize: 9,
                color: C.accent,
                fontFamily: F,
                padding: "1px 5px",
                borderRadius: 2,
                background: C.accentDim,
                fontWeight: 600,
              }}
            >
              SETS · {setUnitLabel(ms[0])}
            </span>
          </div>
          <SetInput
            metric={ms[0]}
            sets={todayLog[ms[0].id] as SetEntry[]}
            pal={pal}
            onAddSet={onAddSet!}
            onRemoveSet={onRemoveSet}
            lastSet={findLastSet(logs, ms[0].id)}
          />
          <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: level >= i ? pal.shades[i] : C.bg,
                  transition: "background .4s",
                }}
              />
            ))}
          </div>
        </>
      ) : compact ? (
        <>
          <div style={{ display: "flex", gap: 4 }}>
            {getQuickAdd(ms[0].unit, units).map((n) => {
              const isA = justTapped === `${ms[0].id}-${n}`;
              return (
                <button
                  key={n}
                  onClick={() => qAdd(ms[0].id, n)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 6,
                    border: `1px solid ${hasAny ? pal.shades[2] : C.border}`,
                    background: isA ? pal.shades[2] : C.bg,
                    color: isA ? "#fff" : hasAny ? pal.shades[4] : C.muted,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: F,
                    fontWeight: 600,
                    transition: "all .2s cubic-bezier(.22,1,.36,1)",
                    transform: isA ? "scale(.95)" : "scale(1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = pal.shades[3];
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = hasAny
                      ? pal.shades[2]
                      : C.border;
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  +{n}
                </button>
              );
            })}
            {hasAny && (
              <button
                onClick={() => onQuickReset(ms[0].id)}
                style={{
                  width: 34,
                  padding: "8px 0",
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.dim,
                  cursor: "pointer",
                  fontSize: 10,
                  fontFamily: F,
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = C.danger;
                  e.currentTarget.style.borderColor = C.danger;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = C.dim;
                  e.currentTarget.style.borderColor = C.border;
                }}
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
          <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: level >= i ? pal.shades[i] : C.bg,
                  transition: "background .4s",
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Multi-metric */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {ms.map((m) => {
              const isSets = isSetMetric(m);
              if (isSets) {
                const sets = todayLog[m.id] as SetEntry[] | undefined;
                const hasSets2 = Array.isArray(sets) && sets.length > 0;
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: hasSets2 ? `${pal.shades[1]}44` : C.bg,
                      border: `1px solid ${hasSets2 ? pal.shades[1] : C.border}`,
                      transition: "all .2s",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: `2px solid ${hasSets2 ? pal.shades[3] : C.border}`,
                          background: hasSets2 ? pal.shades[3] : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all .2s",
                          flexShrink: 0,
                        }}
                      >
                        {hasSets2 && (
                          <span style={{ fontSize: 8, color: "#fff" }}>✓</span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: F,
                          fontWeight: 500,
                          color: hasSets2 ? C.text : C.muted,
                        }}
                      >
                        {m.name}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          color: C.accent,
                          fontFamily: F,
                          padding: "1px 5px",
                          borderRadius: 2,
                          background: C.accentDim,
                        }}
                      >
                        SETS
                      </span>
                      {hasSets2 && (
                        <span
                          style={{
                            fontSize: 9,
                            color: pal.shades[4],
                            fontFamily: F,
                            fontWeight: 600,
                            marginLeft: "auto",
                          }}
                        >
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 8px",
                    borderRadius: 6,
                    background: done ? `${pal.shades[1]}44` : C.bg,
                    border: `1px solid ${done ? pal.shades[1] : C.border}`,
                    transition: "all .2s",
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      border: `2px solid ${done ? pal.shades[3] : C.border}`,
                      background: done ? pal.shades[3] : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all .2s",
                      flexShrink: 0,
                    }}
                  >
                    {done && (
                      <span style={{ fontSize: 8, color: "#fff" }}>✓</span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: F,
                      fontWeight: 500,
                      color: done ? C.text : C.muted,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.name}
                  </span>
                  {done && (
                    <span
                      style={{
                        fontSize: 10,
                        color: pal.shades[4],
                        fontFamily: F,
                        fontWeight: 600,
                        animation: "fadeIn .3s ease",
                      }}
                    >
                      {fmtVal(val, m.unit)}
                    </span>
                  )}
                  <div style={{ display: "flex", gap: 3 }}>
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
                            style={{
                              padding: "3px 7px",
                              borderRadius: 4,
                              border: `1px solid ${done ? pal.shades[1] : C.border}`,
                              background: isA ? pal.shades[2] : C.bg,
                              color: isA ? "#fff" : C.muted,
                              cursor: "pointer",
                              fontSize: 9,
                              fontFamily: F,
                              transition: "all .15s",
                              transform: isA ? "scale(.9)" : "scale(1)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform =
                                "translateY(-1px)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                          >
                            +{n}
                          </button>
                        );
                      })}
                    {done && (
                      <button
                        onClick={() => onQuickReset(m.id)}
                        style={{
                          padding: "3px 5px",
                          borderRadius: 4,
                          border: "1px solid transparent",
                          background: "transparent",
                          color: C.dim,
                          cursor: "pointer",
                          fontSize: 9,
                          fontFamily: F,
                          transition: "all .15s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = C.danger)
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = C.dim)
                        }
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
            {ms.map((m) => (
              <div
                key={m.id}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: metricActive(m, todayLog) ? pal.shades[3] : C.bg,
                  transition: "background .4s",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
