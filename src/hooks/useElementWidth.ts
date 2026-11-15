import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * The content width of the element given the returned ref, kept current with
 * a ResizeObserver. It's `initial` until the element has a width.
 *
 * Zero widths are ignored: a hidden (display: none) element reports 0, and
 * keeping the last real width means showing it again doesn't change the width
 * and re-run whatever depends on it (such as the d3 build).
 */
export function useElementWidth<T extends Element>(
  initial: number,
): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setWidth(w);
      }
    });
    obs.observe(el);
    const w0 = el.getBoundingClientRect().width;
    if (w0 > 0) setWidth(w0);
    return () => obs.disconnect();
  }, []);

  return [ref, width];
}
