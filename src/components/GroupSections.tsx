import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import GroupBar from "./GroupBar";
import type { GroupSection } from "../lib/groups";
import type { Habit } from "../types";
import styles from "./GroupSections.module.css";

type Props = {
  sections: GroupSection[];
  /** Shown between the bar and the sections. */
  ungrouped: Habit[];
  /** Draws one list of habit cards: the ungrouped ones, or a section's. */
  renderList: (habits: Habit[]) => ReactNode;
  isDone: (h: Habit) => boolean;
  onToggle: (groupId: string, collapsed: boolean) => void;
};

/**
 * The dashboard once there are groups: the group bar, the habits in no group,
 * then one collapsible section per group. A chip jumps to its section, and
 * the chip of the section under the bar is highlighted as the page scrolls.
 */
export default function GroupSections({
  sections,
  ungrouped,
  renderList,
  isDone,
  onToggle,
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
    <div style={{ "--bar-h": `${barH}px` } as CSSProperties}>
      <GroupBar
        chips={sections.map(({ group, habits }) => ({
          id: group.id,
          label: group.name || "Untitled",
          emoji: group.emoji,
          done: doneOf(habits),
          total: habits.length,
        }))}
        active={active}
        onPick={pick}
        onTop={toTop}
        barRef={barRef}
      />
      {ungrouped.length > 0 && renderList(ungrouped)}
      {sections.map(({ group, habits }) => {
        const name = group.name || "Untitled";
        return (
          <section
            key={group.id}
            ref={(el) => {
              sectionEls.current[group.id] = el;
            }}
            aria-label={name}
            className={styles.section}
          >
            <button
              aria-expanded={!group.collapsed}
              onClick={() => onToggle(group.id, !group.collapsed)}
              className={styles.head}
            >
              <span
                className={`${styles.chev}${group.collapsed ? ` ${styles.chevShut}` : ""}`}
                aria-hidden
              >
                ▾
              </span>
              <span>{group.emoji}</span>
              <span className={styles.name}>{name}</span>
              <span className={styles.count}>
                {doneOf(habits)}/{habits.length}
              </span>
            </button>
            <div
              className={`${styles.body}${group.collapsed ? ` ${styles.shut}` : ""}`}
            >
              <div className={styles.inner}>
                {habits.length > 0 ? (
                  renderList(habits)
                ) : (
                  <div className={styles.empty}>
                    No habits in this group yet
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
