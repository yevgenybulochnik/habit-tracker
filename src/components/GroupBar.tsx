import { useEffect, useRef } from "react";
import type { Ref } from "react";
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
};

/**
 * The bar pinned above the group sections: a scroll-to-top button, then a
 * strip of group chips that scrolls sideways. A chip jumps to its section.
 */
export default function GroupBar({
  chips,
  active,
  onPick,
  onTop,
  barRef,
}: Props) {
  const stripRef = useRef<HTMLElement>(null);

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
      <nav ref={stripRef} aria-label="Groups" className={styles.strip}>
        {chips.map((c) => (
          <button
            key={c.id}
            data-chip={c.id}
            aria-current={c.id === active ? "true" : undefined}
            onClick={() => onPick(c.id)}
            className={`${styles.chip}${c.id === active ? ` ${styles.on}` : ""}`}
          >
            <span className={styles.emoji}>{c.emoji}</span>
            {c.label}
            <span
              className={`${styles.count}${c.total > 0 && c.done === c.total ? ` ${styles.full}` : ""}`}
            >
              {c.done}/{c.total}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
