import { useEffect, useMemo, useRef, useState } from "react";

/** The parts of a touch event the hook reads. */
type TouchLike = {
  touches: ArrayLike<{ clientX: number; clientY: number }>;
  preventDefault: () => void;
};

/** Spread onto the element to press. Touch and mouse both count. */
export type LongPressHandlers = {
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (e: TouchLike) => void;
  onTouchMove: (e: TouchLike) => void;
  onTouchEnd: (e: TouchLike) => void;
  onTouchCancel: () => void;
};

/** How far a finger may drift during a hold before it's a swipe, in px. */
const SLOP = 10;

type Options = {
  /** How long to hold, in ms. */
  delay?: number;
  /** While true, pressing does nothing. */
  disabled?: boolean;
};

/**
 * Calls `onLongPress` once the element has been held for `delay` ms.
 * `pressing` is true while a hold is under way, for styling.
 *
 * A finger that moves more than `SLOP` px is scrolling or swiping, so the hold
 * is cancelled. Lifting the finger after a hold has fired doesn't tap: what
 * the hold opened (an editor) is now under it, and the tap would land there.
 */
export function useLongPress(
  onLongPress: () => void,
  { delay = 500, disabled = false }: Options = {},
): { pressing: boolean; handlers: LongPressHandlers } {
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Where the finger came down, while a touch hold may still fire.
  const originRef = useRef<{ x: number; y: number } | null>(null);
  // The hold fired during the current press.
  const firedRef = useRef(false);
  // The latest callback, so a re-render mid-hold doesn't call a stale one.
  const callbackRef = useRef(onLongPress);
  callbackRef.current = onLongPress;

  const handlers = useMemo(() => {
    const clear = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    const start = () => {
      if (disabled) return;
      clear(); // a touch can be followed by an emulated mousedown
      firedRef.current = false;
      setPressing(true);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firedRef.current = true;
        setPressing(false);
        callbackRef.current();
      }, delay);
    };
    const cancel = () => {
      clear();
      setPressing(false);
    };
    return {
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel,
      onTouchStart: (e: TouchLike) => {
        const t = e.touches[0];
        originRef.current = t ? { x: t.clientX, y: t.clientY } : null;
        start();
      },
      onTouchMove: (e: TouchLike) => {
        const o = originRef.current;
        const t = e.touches[0];
        if (o && t && Math.hypot(t.clientX - o.x, t.clientY - o.y) > SLOP) {
          originRef.current = null;
          cancel();
        }
      },
      onTouchEnd: (e: TouchLike) => {
        if (firedRef.current) {
          firedRef.current = false;
          e.preventDefault(); // no click on what the hold opened
        }
        cancel();
      },
      onTouchCancel: cancel,
    };
  }, [delay, disabled]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { pressing, handlers };
}
