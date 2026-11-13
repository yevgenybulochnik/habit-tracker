import { useEffect, useState } from "react";
import { msUntilMidnight, todayK } from "../lib/dates";

/**
 * Today's date key, kept current while the app stays open: it changes when
 * midnight passes, and when the app comes back to the foreground on a later
 * day. An iOS home-screen app resumes from the background instead of
 * reloading, and its timers don't run while it's there.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayK);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let frame = 0;

    // Always read the clock, never assume one day went by: a timer can fire
    // late, and a resumed app may have skipped several days.
    //
    // The day changes on the next animation frame, not right away. When a
    // page wakes up (from the background, or a closed laptop lid), timers and
    // frames that came due meanwhile all run at once, in no fixed order.
    // d3 re-syncs its animation clock on a frame it already asked for; a
    // re-render before that would start the calendar's animations against a
    // stale clock, and they would then wait as long as the page was away.
    const check = () => {
      if (frame) return; // one is already on its way
      frame = requestAnimationFrame(() => {
        frame = 0;
        setToday(todayK());
      });
    };
    const arm = () => {
      timer = setTimeout(() => {
        check();
        arm();
      }, msUntilMidnight(new Date()));
    };
    arm();
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return today;
}
