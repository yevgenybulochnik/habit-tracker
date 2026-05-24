import type { ReactNode } from "react";
import { C } from "../constants";

type Props = {
  onClose: () => void;
  closing?: boolean;
  children: ReactNode;
  width?: number;
};

export default function ModalShell({ onClose, closing, children, width }: Props) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)", boxSizing: "border-box", padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)", opacity: closing ? 0 : undefined, transition: closing ? "opacity .35s ease" : undefined }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, width: width || 480, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto", transform: closing ? "scale(.95) translateY(8px)" : undefined, opacity: closing ? 0 : undefined, transition: closing ? "all .35s ease" : undefined }}
      >
        {children}
      </div>
    </div>
  );
}
