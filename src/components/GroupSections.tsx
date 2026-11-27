import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import HabitIcon from "./HabitIcon";
import SortableHabits from "./SortableHabits";
import { useLongPress } from "../hooks/useLongPress";
import { sectionAnchor } from "../anchors";
import type { GroupSection } from "../lib/groups";
import type { Group, Habit } from "../types";
import styles from "./GroupSections.module.css";

type Props = {
  sections: GroupSection[];
  /** Shown above the sections. */
  ungrouped: Habit[];
  /** Draws one list of habit cards: the ungrouped ones, or a section's. */
  renderList: (habits: Habit[]) => ReactNode;
  isDone: (h: Habit) => boolean;
  onToggle: (groupId: string, collapsed: boolean) => void;
  /** Reorder mode: groups are dragged by their sections' headers. */
  reorder: boolean;
  onReorderGroups: (activeId: string, overId: string) => void;
  /** Holding a section's header (outside reorder mode) edits its group. */
  onEditGroup: (id: string) => void;
};

/**
 * The dashboard once there are groups: the habits in no group, then one
 * collapsible section per group, which the pearl jumps to (each has an id,
 * `sectionAnchor`).
 *
 * Holding a section's header edits the group, the way holding a card's header
 * edits a habit. In reorder mode a group is dragged by its section's header
 * instead, and a card within its own list (`renderList` makes each list its
 * own context).
 */
export default function GroupSections({
  sections,
  ungrouped,
  renderList,
  isDone,
  onToggle,
  reorder,
  onReorderGroups,
  onEditGroup,
}: Props) {
  const doneOf = (hs: Habit[]) => hs.filter(isDone).length;

  return (
    <div className={reorder ? styles.reordering : undefined}>
      {ungrouped.length > 0 && renderList(ungrouped)}
      <SortableHabits
        ids={sections.map((s) => s.group.id)}
        onReorder={onReorderGroups}
      >
        {sections.map(({ group, habits }) => (
          <Section
            key={group.id}
            group={group}
            done={doneOf(habits)}
            total={habits.length}
            onToggle={() => onToggle(group.id, !group.collapsed)}
            onEdit={() => onEditGroup(group.id)}
            reorder={reorder}
          >
            {habits.length > 0 ? (
              renderList(habits)
            ) : (
              <div className={styles.empty}>No habits in this group yet</div>
            )}
          </Section>
        ))}
      </SortableHabits>
    </div>
  );
}

type SectionProps = {
  group: Group;
  done: number;
  total: number;
  onToggle: () => void;
  onEdit: () => void;
  reorder: boolean;
  children: ReactNode;
};

/**
 * One group's section: a header that folds it (or, held, edits the group),
 * over its cards. In reorder mode the header is what picks the section up.
 */
function Section({
  group,
  done,
  total,
  onToggle,
  onEdit,
  reorder,
  children,
}: SectionProps) {
  const longPress = useLongPress(onEdit, { disabled: reorder });
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id, disabled: !reorder });
  const name = group.name || "Untitled";

  return (
    <section
      ref={setNodeRef}
      id={sectionAnchor(group.id)}
      aria-label={name}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${styles.section}${isDragging ? ` ${styles.dragging}` : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        {...(reorder ? { ...attributes, ...listeners } : longPress.handlers)}
        aria-expanded={!group.collapsed}
        onClick={onToggle}
        className={`${styles.head}${reorder ? ` reorder-drag ${styles.sorting}` : ""}${longPress.pressing ? ` ${styles.pressing}` : ""}`}
      >
        {reorder ? (
          <span className={styles.grip} aria-hidden>
            ⠿
          </span>
        ) : (
          <span
            className={`${styles.chev}${group.collapsed ? ` ${styles.chevShut}` : ""}`}
            aria-hidden
          >
            ▾
          </span>
        )}
        <HabitIcon icon={group.icon} size={16} />
        <span className={styles.name}>{name}</span>
        <span className={styles.count}>
          {done}/{total}
        </span>
      </button>
      <div
        className={`${styles.body}${group.collapsed ? ` ${styles.shut}` : ""}`}
      >
        <div className={styles.inner}>{children}</div>
      </div>
    </section>
  );
}
