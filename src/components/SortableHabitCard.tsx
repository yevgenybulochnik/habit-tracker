import { useState } from "react";
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
  /** Position in the list — drives the staggered entrance delay. */
  index: number;
  /** Receives the drag activator so the card can make its header draggable. */
  children: (drag: DragActivator) => ReactNode;
};

const STAGGER_MS = 100;

/**
 * Wraps one habit card as a sortable item. Owns the @dnd-kit `useSortable` hook
 * and hands a {@link DragActivator} to `children`: the card puts `listeners` on
 * the whole grip+icon+name region (so it can be grabbed anywhere there) while
 * the grip stays the focusable keyboard activator.
 *
 * The `setNodeRef` div is the element dnd-kit transforms AND the element React
 * reorders (it's the keyed child of the list) — keeping those the same node
 * avoids a drop-time flicker. The staggered entrance lives on an inner wrapper
 * so its `translateY` animation can't fight the drag transform on the outer node.
 *
 * The entrance is a one-shot: React reorders by detaching and re-inserting the
 * moved node, which would otherwise restart the CSS `fadeUp` on the displaced
 * card (looking like a remount). We drop the class once it has played, so a
 * later DOM move can't replay it.
 */
export default function SortableHabitCard({ id, index, children }: Props) {
  const [entered, setEntered] = useState(false);
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
      <div
        className={entered ? undefined : "stagger-child"}
        style={
          entered ? undefined : { animationDelay: `${index * STAGGER_MS}ms` }
        }
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget && e.animationName === "fadeUp") {
            setEntered(true);
          }
        }}
      >
        {children({
          setActivatorRef: setActivatorNodeRef,
          attributes: attributes as unknown as HTMLAttributes<HTMLElement>,
          listeners: (listeners ?? {}) as DOMAttributes<HTMLElement>,
          isDragging,
        })}
      </div>
    </div>
  );
}
