import { useEffect, useRef } from "react";
import type { CSSProperties, Ref } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent, Modifier } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSortSensors } from "./SortableHabits";
import { useLongPress } from "../hooks/useLongPress";
import styles from "./GroupBar.module.css";

/** One group's chip: its name and how many of its habits are done today. */
export type GroupChip = {
  id: string;
  label: string;
  emoji: string;
  done: number;
  total: number;
};

type Props = {
  chips: GroupChip[];
  /** The chip of the section in view, or "" for none. */
  active: string;
  onPick: (id: string) => void;
  onTop: () => void;
  barRef?: Ref<HTMLDivElement>;
  /** Reorder mode: chips are dragged sideways to reorder the groups. */
  reorder: boolean;
  onReorder: (activeId: string, overId: string) => void;
  /** Holding a chip (outside reorder mode) edits its group. */
  onEdit: (id: string) => void;
};

/** A chip only slides along the strip. */
const sideways: Modifier = ({ transform }) => ({ ...transform, y: 0 });

/**
 * The bar pinned above the group sections: a scroll-to-top button, then a
 * strip of group chips that scrolls sideways. A chip jumps to its section, and
 * holding it edits its group. In
 * reorder mode a chip is held (touch) or dragged (mouse) sideways to move its
 * group; a quick swipe still scrolls the strip.
 */
export default function GroupBar({
  chips,
  active,
  onPick,
  onTop,
  barRef,
  reorder,
  onReorder,
  onEdit,
}: Props) {
  const stripRef = useRef<HTMLElement>(null);
  const sensors = useSortSensors();

  // Keep the active chip centred in the strip as it changes.
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!strip || !el) return;
    strip.scrollTo?.({
      left: el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [active]);

  return (
    <div ref={barRef} className={styles.bar}>
      <button
        onClick={onTop}
        aria-label="Scroll to top"
        title="Scroll to top"
        className={styles.top}
      >
        ↑
      </button>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[sideways]}
        onDragEnd={({ active, over }: DragEndEvent) => {
          if (over && active.id !== over.id)
            onReorder(String(active.id), String(over.id));
        }}
      >
        <SortableContext
          items={chips.map((c) => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          <nav ref={stripRef} aria-label="Groups" className={styles.strip}>
            {chips.map((c) => (
              <ChipButton
                key={c.id}
                chip={c}
                on={c.id === active}
                reorder={reorder}
                onPick={onPick}
                onEdit={onEdit}
              />
            ))}
          </nav>
        </SortableContext>
      </DndContext>
    </div>
  );
}

type ChipProps = {
  chip: GroupChip;
  on: boolean;
  reorder: boolean;
  onPick: (id: string) => void;
  onEdit: (id: string) => void;
};

function ChipButton({ chip: c, on, reorder, onPick, onEdit }: ChipProps) {
  const longPress = useLongPress(() => onEdit(c.id), { disabled: reorder });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: c.id, disabled: !reorder });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  return (
    <button
      ref={setNodeRef}
      {...(reorder ? { ...attributes, ...listeners } : longPress.handlers)}
      data-chip={c.id}
      aria-current={on ? "true" : undefined}
      onClick={() => onPick(c.id)}
      style={style}
      className={`${styles.chip}${on ? ` ${styles.on}` : ""}${reorder ? ` ${styles.sorting}` : ""}${isDragging ? ` ${styles.dragging}` : ""}${longPress.pressing ? ` ${styles.pressing}` : ""}`}
    >
      {reorder && (
        <span className={styles.grip} aria-hidden>
          ⠿
        </span>
      )}
      <span className={styles.emoji}>{c.emoji}</span>
      {c.label}
      <span
        className={`${styles.count}${c.total > 0 && c.done === c.total ? ` ${styles.full}` : ""}`}
      >
        {c.done}/{c.total}
      </span>
    </button>
  );
}
