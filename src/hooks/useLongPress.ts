import { useEffect, useMemo, useRef, useState } from "react";

/** Spread onto the element to press. Touch and mouse both count. */
export type LongPressHandlers = {
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
};

type Options = {
  /** How long to hold, in ms. */
  delay?: number;
  /** While true, pressing does nothing. */
  disabled?: boolean;
};

/**
 * Calls `onLongPress` once the element has been held for `delay` ms.
 * `pressing` is true while a hold is under way, for styling.
 */
export function useLongPress(
  onLongPress: () => void,
  { delay = 500, disabled = false }: Options = {},
): { pressing: boolean; handlers: LongPressHandlers } {
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      setPressing(true);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
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
      onTouchStart: start,
      onTouchEnd: cancel,
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
