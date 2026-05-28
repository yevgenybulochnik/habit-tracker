import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { Palette } from "../types";
import styles from "./TimerButton.module.css";

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

  // Per-habit palette → CSS vars used by :hover and the .running modifier.
  const palVars = {
    "--tb-a1": pal.shades[1],
    "--tb-a3": pal.shades[3],
    "--tb-a4": pal.shades[4],
  } as CSSProperties;

  if (compact) {
    return (
      <div className={styles.wrap} style={palVars}>
        <button
          onClick={toggle}
          className={`${styles.btn} ${styles.compact}${running ? ` ${styles.running}` : ""}`}
        >
          <span className={styles.icon}>{running ? "■" : "▶"}</span>
          {running ? "Stop" : "Timer"}
        </button>
        {running && (
          <span className={styles.time}>
            {mm}:{ss}
          </span>
        )}
        {running && (
          <span className={styles.approx}>
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
      style={palVars}
      className={`${styles.btn} ${styles.inline}${running ? ` ${styles.running}` : ""}`}
    >
      <span className={styles.icon}>{running ? "■" : "▶"}</span>
      {running ? `${mm}:${ss}` : ""}
    </button>
  );
}
