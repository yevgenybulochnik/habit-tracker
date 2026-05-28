import type { CSSProperties, ReactNode } from "react";
import styles from "./ModalShell.module.css";

type Props = {
  onClose: () => void;
  closing?: boolean;
  children: ReactNode;
  width?: number;
};

export default function ModalShell({
  onClose,
  closing,
  children,
  width,
}: Props) {
  return (
    <div
      className={`modal-backdrop ${styles.backdrop}${closing ? ` ${styles.backdropClosing}` : ""}`}
      onClick={onClose}
    >
      <div
        className={`modal-content ${styles.content}${closing ? ` ${styles.contentClosing}` : ""}`}
        onClick={(e) => e.stopPropagation()}
        style={{ "--modal-w": `${width || 480}px` } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
