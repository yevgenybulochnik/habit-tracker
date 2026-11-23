import { useId } from "react";
import { ICON_NAMES, ICON_SECTIONS } from "../lib/icons";
import type { IconId } from "../lib/icons";
import HabitIcon from "./HabitIcon";
import styles from "./IconPicker.module.css";

type Props = {
  value: IconId;
  onChange: (icon: IconId) => void;
  /** The picker's accessible name, e.g. "Group icon". */
  label: string;
};

/** Every icon in a grid to tap one from, in titled sections; the chosen one
 *  is highlighted. */
export default function IconPicker({ value, onChange, label }: Props) {
  const id = useId();
  return (
    <div role="group" aria-label={label} className={styles.picker}>
      {ICON_SECTIONS.map((s, i) => (
        <div
          key={s.title}
          role="group"
          aria-labelledby={`${id}-${i}`}
          className={styles.section}
        >
          <div id={`${id}-${i}`} className={styles.title}>
            {s.title}
          </div>
          <div className={styles.grid}>
            {s.icons.map((icon) => (
              <button
                key={icon}
                type="button"
                aria-label={ICON_NAMES[icon]}
                title={ICON_NAMES[icon]}
                aria-pressed={value === icon}
                onClick={() => onChange(icon)}
                className={`${styles.btn}${value === icon ? ` ${styles.sel}` : ""}`}
              >
                <HabitIcon icon={icon} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
