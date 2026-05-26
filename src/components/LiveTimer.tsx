import { useState, useEffect, useRef } from "react";
import { C, F } from "../constants";
import type { Palette } from "../types";

type Props = {
  startTime: number;
  metricName: string;
  pal: Palette;
  onStop: () => void;
};

export default function LiveTimer({
  startTime,
  metricName,
  pal,
  onStop,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [startTime]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const mins = Math.max(1, Math.round(elapsed / 60));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 6,
        background: pal.shades[1],
        border: `1px solid ${pal.shades[2]}`,
        marginBottom: 8,
        animation: "fadeIn .3s ease",
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: pal.shades[4],
          animation: "pulseGlow 1.5s ease infinite",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 10,
          color: pal.shades[4],
          fontFamily: F,
          fontWeight: 600,
        }}
      >
        {metricName}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "#fff",
          fontFamily: F,
          fontWeight: 700,
          letterSpacing: ".04em",
        }}
      >
        {mm}:{ss}
      </span>
      <span style={{ fontSize: 9, color: C.muted, fontFamily: F }}>
        {"≈"} {mins}m
      </span>
      <button
        onClick={onStop}
        style={{
          marginLeft: "auto",
          padding: "3px 10px",
          borderRadius: 4,
          border: `1px solid ${pal.shades[3]}`,
          background: pal.shades[2],
          color: "#fff",
          cursor: "pointer",
          fontSize: 9,
          fontFamily: F,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 4,
          transition: "all .15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = pal.shades[3];
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = pal.shades[2];
        }}
      >
        <span style={{ fontSize: 8 }}>{"■"}</span>Stop
      </button>
    </div>
  );
}
