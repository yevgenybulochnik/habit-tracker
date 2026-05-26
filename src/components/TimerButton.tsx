import { useState, useEffect, useRef } from "react";
import { C, F } from "../constants";
import type { Palette } from "../types";

type Props = {
  startTime?: number;
  onStart: () => void;
  onStop: () => void;
  pal: Palette;
  compact?: boolean;
};

export default function TimerButton({
  startTime,
  onStart,
  onStop,
  pal,
  compact,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const running = !!startTime;

  useEffect(() => {
    if (!startTime) {
      setElapsed(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [startTime]);

  const toggle = () => {
    if (running) onStop();
    else onStart();
  };
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  if (compact) {
    return (
      <div
        style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}
      >
        <button
          onClick={toggle}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: `1px solid ${running ? pal.shades[3] : C.border}`,
            background: running ? pal.shades[1] : C.bg,
            color: running ? pal.shades[4] : C.muted,
            cursor: "pointer",
            fontSize: 11,
            fontFamily: F,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all .2s cubic-bezier(.22,1,.36,1)",
          }}
          onMouseEnter={(e) => {
            if (!running) {
              e.currentTarget.style.borderColor = pal.shades[3];
              e.currentTarget.style.color = pal.shades[4];
            }
          }}
          onMouseLeave={(e) => {
            if (!running) {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.color = C.muted;
            }
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>
            {running ? "■" : "▶"}
          </span>
          {running ? "Stop" : "Timer"}
        </button>
        {running && (
          <span
            style={{
              fontSize: 13,
              fontFamily: F,
              fontWeight: 700,
              color: pal.shades[4],
              letterSpacing: ".04em",
              animation: "fadeIn .3s ease",
            }}
          >
            {mm}:{ss}
          </span>
        )}
        {running && (
          <span style={{ fontSize: 9, color: C.dim, fontFamily: F }}>
            ≈ {Math.max(1, Math.round(elapsed / 60))}m
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={toggle}
      title={running ? "Stop and log" : "Start timer"}
      style={{
        padding: "3px 7px",
        borderRadius: 4,
        border: `1px solid ${running ? pal.shades[3] : C.border}`,
        background: running ? pal.shades[1] : C.bg,
        color: running ? pal.shades[4] : C.muted,
        cursor: "pointer",
        fontSize: 9,
        fontFamily: F,
        fontWeight: 600,
        transition: "all .2s",
        display: "flex",
        alignItems: "center",
        gap: 3,
      }}
    >
      <span style={{ fontSize: 8, lineHeight: 1 }}>{running ? "■" : "▶"}</span>
      {running ? `${mm}:${ss}` : ""}
    </button>
  );
}
