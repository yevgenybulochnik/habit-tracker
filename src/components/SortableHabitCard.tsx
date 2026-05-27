import type {
  CSSProperties,
  ReactNode,
  HTMLAttributes,
  DOMAttributes,
} from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** What the card needs to wire up dragging in its header. */
export type DragActivator = {
  /** Ref for the focusable activator (the grip — keyboard + focus target). */
  setActivatorRef: (el: HTMLElement | null) => void;
  /** ARIA/role/tabIndex for the grip activator. */
  attributes: HTMLAttributes<HTMLElement>;
  /** Pointer/keyboard drag handlers — attach to the whole grab region. */
  listeners: DOMAttributes<HTMLElement>;
  isDragging: boolean;
};

type Props = {
  id: string;
  /** Receives the drag activator so the card can make its header draggable. */
  children: (drag: DragActivator) => ReactNode;
};

/**
 * Wraps one habit card as a sortable item. Owns the @dnd-kit `useSortable` hook
 * and hands a {@link DragActivator} to `children`: the card puts `listeners` on
 * the whole grip+icon+name region (so it can be grabbed anywhere there) while
 * the grip stays the focusable keyboard activator.
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
    // Translate only — cards vary in height, and CSS.Transform would add a
    // scaleX/scaleY (derived from neighbouring sizes) that visibly stretches or
    // squishes a card as it passes one of a different size.
    transform: CSS.Translate.toString(transform),
    transition,
    // Lift the dragged card above its neighbours.
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.9 : 1,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        setActivatorRef: setActivatorNodeRef,
        attributes: attributes as unknown as HTMLAttributes<HTMLElement>,
        listeners: (listeners ?? {}) as DOMAttributes<HTMLElement>,
        isDragging,
      })}
    </div>
  );
}
