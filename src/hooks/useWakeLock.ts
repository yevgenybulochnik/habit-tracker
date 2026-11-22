// Keeps the screen on through a routine: iOS suspends the page when the screen
// locks.
import { useEffect } from "react";

/** Hold a screen wake lock while `on`, taking it again when the page returns. */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = () =>
      navigator.wakeLock.request("screen").then(
        (l) => {
          if (stopped) void l.release();
          else lock = l;
        },
        () => {},
      );
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [on]);
}
