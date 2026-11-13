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
    // Always read the clock, never assume one day went by: a timer can fire
    // late, and a resumed app may have skipped several days.
    const check = () => setToday(todayK());
    let timer: ReturnType<typeof setTimeout>;
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
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return today;
}
