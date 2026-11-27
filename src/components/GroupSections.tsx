import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, MutableRefObject, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import GroupBar from "./GroupBar";
import HabitIcon from "./HabitIcon";
import SortableHabits from "./SortableHabits";
import { useLongPress } from "../hooks/useLongPress";
import { sectionAnchor } from "../anchors";
import type { GroupSection } from "../lib/groups";
import type { Group, Habit } from "../types";
import styles from "./GroupSections.module.css";

type Props = {
  sections: GroupSection[];
  /** Shown between the bar and the sections. */
  ungrouped: Habit[];
  /** Draws one list of habit cards: the ungrouped ones, or a section's. */
  renderList: (habits: Habit[]) => ReactNode;
  isDone: (h: Habit) => boolean;
  onToggle: (groupId: string, collapsed: boolean) => void;
  /** Reorder mode: groups are dragged by their chips or section headers. */
  reorder: boolean;
  onReorderGroups: (activeId: string, overId: string) => void;
  /** Holding a chip or section header (outside reorder mode) edits its group. */
  onEditGroup: (id: string) => void;
};

/**
 * The dashboard once there are groups: the group bar, the habits in no group,
 * then one collapsible section per group. A chip jumps to its section, and
 * the chip of the section under the bar is highlighted as the page scrolls.
 *
 * Holding a chip or a section's header edits the group, the way holding a
 * card's header edits a habit. In reorder mode a group is dragged by its chip
 * or its section's header instead, and
 * a card within its own list (`renderList` makes each list its own context).
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
  const barRef = useRef<HTMLDivElement>(null);
  const sectionEls = useRef<Record<string, HTMLElement | null>>({});
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  // A tapped chip stays active until the page is scrolled by hand: near the
  // end of the page its section can't reach the bar, so the scroll position
  // can't tell.
  const picked = useRef<string | null>(null);
  const [active, setActive] = useState("");
  const [barH, setBarH] = useState(52);

  useLayoutEffect(() => {
    if (barRef.current) setBarH(barRef.current.offsetHeight);
  }, []);

  // The active chip is the last section whose header has gone under the bar,
  // or none while the ungrouped habits are in view.
  const order = sections.map((s) => s.group.id).join();
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (picked.current) return;
        const barBottom = barRef.current?.getBoundingClientRect().bottom ?? 0;
        let current = "";
        for (const { group } of sectionsRef.current) {
          const top = sectionEls.current[group.id]?.getBoundingClientRect().top;
          if (top !== undefined && top <= barBottom + 1) current = group.id;
        }
        setActive(current);
      });
    };
    const release = () => (picked.current = null);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("wheel", release, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("wheel", release);
      cancelAnimationFrame(raf);
    };
  }, [order]);

  const pick = (id: string) => {
    picked.current = id;
    setActive(id);
    if (sections.find((s) => s.group.id === id)?.group.collapsed)
      onToggle(id, false);
    sectionEls.current[id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const toTop = () => {
    picked.current = null;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const doneOf = (hs: Habit[]) => hs.filter(isDone).length;

  return (
    <div
      style={{ "--bar-h": `${barH}px` } as CSSProperties}
      className={reorder ? styles.reordering : undefined}
    >
      <GroupBar
        chips={sections.map(({ group, habits }) => ({
          id: group.id,
          label: group.name || "Untitled",
          icon: group.icon,
          done: doneOf(habits),
          total: habits.length,
        }))}
        active={active}
        onPick={pick}
        onTop={toTop}
        barRef={barRef}
        reorder={reorder}
        onReorder={onReorderGroups}
        onEdit={onEditGroup}
      />
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
            els={sectionEls}
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
  /** Where the section registers its element, for the scroll tracking. */
  els: MutableRefObject<Record<string, HTMLElement | null>>;
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
  els,
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
  const ref = useCallback(
    (el: HTMLElement | null) => {
      setNodeRef(el);
      els.current[group.id] = el;
    },
    [setNodeRef, els, group.id],
  );
  const name = group.name || "Untitled";

  return (
    <section
      ref={ref}
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
