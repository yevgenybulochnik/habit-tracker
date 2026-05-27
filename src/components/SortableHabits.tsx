import type { ReactNode } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

type Props = {
  /** Habit ids in their current display order. */
  ids: string[];
  /** Called with (activeId, overId) when a drag ends on a different card. */
  onReorder: (activeId: string, overId: string) => void;
  children: ReactNode;
};

/**
 * DnD container for the habit list. Keeps the @dnd-kit surface out of App and
 * D3Calendar: it only knows the ordered ids and emits (activeId, overId) on
 * drop. Uses the dedicated Mouse + Touch sensors (more reliable on iOS than the
 * combined Pointer sensor) plus Keyboard for accessibility. A small activation
 * distance means a tap doesn't start a drag.
 */
export default function SortableHabits({ ids, onReorder, children }: Props) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Touch: press-and-hold to pick up. A delay (rather than a distance) avoids
    // the scroll-vs-drag ambiguity on iOS — with a distance constraint the
    // pre-activation move can start a native scroll that then runs alongside
    // the drag. tolerance cancels the hold if the finger pans away first.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
