import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, FocusEvent, KeyboardEvent } from "react";
import type { IconId } from "../lib/icons";
import HabitIcon from "./HabitIcon";
import Icon from "./Icon";
import styles from "./IconSelect.module.css";

export type SelectOption = {
  value: string;
  label: string;
  icon?: IconId;
  /** The icon's colour; the text colour without one. */
  color?: string;
};

type Props = {
  /** Its accessible name, e.g. "Habit"; the field reads "Habit: Reading". */
  label: string;
  /** The chosen option's value; the placeholder shows if it's none of them. */
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** The field's id, for a `<label htmlFor>`. */
  id?: string;
  /** Smaller, for a field in a row of other controls. */
  compact?: boolean;
};

/**
 * A dropdown that shows icons: a field that opens its list in place under it
 * (the listbox pattern), a dropdown's own menu being text only. A tap on an
 * option chooses it; a tap anywhere else, Escape or Tab shuts it.
 */
export default function IconSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Choose…",
  id,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value);
  const shown = current?.label ?? placeholder;

  // Into the list as it opens, at the chosen option (or the first).
  useEffect(() => {
    if (!open) return;
    const list = listRef.current!;
    (
      list.querySelector<HTMLElement>('[aria-selected="true"]') ??
      list.querySelector<HTMLElement>('[role="option"]')
    )?.focus();
  }, [open]);

  // A tap anywhere else shuts it (focus alone wouldn't: on an iPhone, a tap
  // on what can't take focus leaves it where it is).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const shut = () => {
    fieldRef.current?.focus();
    setOpen(false);
  };
  const choose = (v: string) => {
    shut();
    if (v !== value) onChange(v);
  };

  const onFieldKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === "Escape" && open) setOpen(false);
  };
  const onListKey = (e: KeyboardEvent) => {
    const opts = [
      ...listRef.current!.querySelectorAll<HTMLElement>('[role="option"]'),
    ];
    const i = opts.indexOf(document.activeElement as HTMLElement);
    const go = (j: number) => {
      e.preventDefault();
      opts[Math.max(0, Math.min(opts.length - 1, j))].focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(opts.length - 1);
    else if ((e.key === "Enter" || e.key === " ") && i >= 0) {
      e.preventDefault();
      choose(options[i].value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      shut();
    } else if (e.key === "Tab" && e.shiftKey) {
      // Back to the field. Tab goes on from the option to what follows the
      // list, and the list shuts as focus leaves it (onBlur).
      e.preventDefault();
      shut();
    }
  };
  // Focus moving out of it (a tap elsewhere is the pointerdown's).
  const onBlur = (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && !rootRef.current?.contains(to)) setOpen(false);
  };

  return (
    <div ref={rootRef} className={styles.root} onBlur={onBlur}>
      <button
        ref={fieldRef}
        id={id}
        type="button"
        className={`${styles.field}${compact ? ` ${styles.compact}` : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${shown}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onFieldKey}
      >
        <Mark option={current} />
        <span
          className={`${styles.name}${current ? "" : ` ${styles.placeholder}`}`}
        >
          {shown}
        </span>
        <span className={styles.chev}>
          <Icon name="down" size={16} />
        </span>
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className={styles.list}
          onKeyDown={onListKey}
        >
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              tabIndex={-1}
              aria-selected={o.value === value}
              className={styles.option}
              onClick={() => choose(o.value)}
            >
              <Mark option={o} />
              <span className={styles.name}>{o.label}</span>
              {o.value === value && (
                <span className={styles.tick}>
                  <Icon name="check" size={16} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** An option's icon, in its colour; an empty space of the same width when it
 *  has none, so the names line up. */
function Mark({ option }: { option?: SelectOption }) {
  return (
    <span
      className={styles.mark}
      style={
        option?.color ? ({ "--ic": option.color } as CSSProperties) : undefined
      }
    >
      {option?.icon && <HabitIcon icon={option.icon} />}
    </span>
  );
}
