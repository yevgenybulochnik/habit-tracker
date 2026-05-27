import type { CSSProperties, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { C } from "../constants";

type Props = {
  id: string;
  /** Receives the drag-handle node so the card can place it (e.g. in its header). */
  children: (handle: ReactNode) => ReactNode;
};

const handleBtn: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 4,
  border: "none",
  background: "transparent",
  color: C.dim,
  cursor: "grab",
  touchAction: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  lineHeight: 1,
  flexShrink: 0,
};

/**
 * Wraps one habit card as a sortable item. Owns the @dnd-kit `useSortable`
 * hook and builds the grip handle (drag listeners live on the handle only, so
 * dragging never collides with the card's long-press-to-edit gesture), then
 * hands the handle node to `children` to render wherever it likes.
 */
export default function SortableHabitCard({ id, children }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Lift the dragged card above its neighbours.
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
    position: "relative",
  };

  const handle = (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      title="Drag to reorder"
      aria-label="Drag to reorder habit"
      style={{ ...handleBtn, cursor: isDragging ? "grabbing" : "grab" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = C.muted)}
      onMouseLeave={(e) => (e.currentTarget.style.color = C.dim)}
    >
      ⠿
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  );
}
