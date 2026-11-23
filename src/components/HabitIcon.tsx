import type { IconId } from "../lib/icons";
import { DRAWINGS } from "./iconDrawings";
import styles from "./HabitIcon.module.css";

/** A habit's or a group's icon, in the text colour: a parent's `color`
 *  tints it. Hidden from a screen reader, so the name beside it is what's
 *  read. */
export default function HabitIcon({
  icon,
  size = 18,
}: {
  icon: IconId;
  size?: number;
}) {
  return (
    <svg
      className={styles.icon}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {DRAWINGS[icon]}
    </svg>
  );
}
