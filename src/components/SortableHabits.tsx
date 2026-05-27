import type { ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
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
 * drop. A small pointer activation distance lets a tap on the handle through
 * without starting a drag; the keyboard sensor makes reordering accessible.
 */
export default function SortableHabits({ ids, onReorder, children }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
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
