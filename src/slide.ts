// Moving between pages (the habits ⟷ the routines ⟷ a routine's editor) with
// a sideways slide, like a phone app pushing a screen. It uses a view
// transition: the browser snapshots the page before and after `update` and
// slides one over the other (the keyframes are in globalCss), so the page can
// scroll to where the next one starts without the slide showing it. Without
// view transitions, or with reduced motion, the page just changes.
import { flushSync } from "react-dom";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

let latest = 0;

/** Run `update` (a state change) as a slide forward or back; `then` runs once
 *  the change is on the page (to scroll it, say) and before the slide. */
export function slide(
  direction: "forward" | "back",
  update: () => void,
  then?: () => void,
) {
  const doc = document as ViewTransitionDocument;
  const apply = () => {
    flushSync(update);
    then?.();
  };
  if (
    !doc.startViewTransition ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return apply();
  const root = document.documentElement;
  const mine = ++latest;
  root.dataset.slide = direction;
  doc.startViewTransition(apply).finished.finally(() => {
    if (mine === latest) delete root.dataset.slide;
  });
}
