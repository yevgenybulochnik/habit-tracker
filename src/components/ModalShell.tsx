import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import styles from "./ModalShell.module.css";

/** How long the close animation runs, in ms. The CSS reads it as --modal-close-ms. */
export const CLOSE_MS = 350;

/**
 * Animate the modal out, then run `then` (if given) and `onClose`. Asking
 * again while it's closing does nothing.
 */
export type RequestClose = (then?: () => void) => void;

type Props = {
  /** Called once the modal has animated out. */
  onClose: () => void;
  width?: number;
  /** The modal's content, given `requestClose` for its buttons. */
  children: (requestClose: RequestClose) => ReactNode;
};

/** A centred dialog over a dimmed backdrop. Clicking the backdrop closes it. */
export default function ModalShell({ onClose, width, children }: Props) {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const requestClose: RequestClose = (then) => {
    if (timerRef.current) return; // already closing
    setClosing(true);
    timerRef.current = setTimeout(() => {
      then?.();
      onCloseRef.current();
    }, CLOSE_MS);
  };

  return (
    <div
      className={`modal-backdrop ${styles.backdrop}${closing ? ` ${styles.backdropClosing}` : ""}`}
      style={{ "--modal-close-ms": `${CLOSE_MS}ms` } as CSSProperties}
      onClick={() => requestClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`modal-content ${styles.content}${closing ? ` ${styles.contentClosing}` : ""}`}
        onClick={(e) => e.stopPropagation()}
        style={{ "--modal-w": `${width || 480}px` } as CSSProperties}
      >
        {children(requestClose)}
      </div>
    </div>
  );
}
