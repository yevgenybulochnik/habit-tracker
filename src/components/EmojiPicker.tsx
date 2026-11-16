import styles from "./EmojiPicker.module.css";

type Props = {
  options: readonly string[];
  value: string;
  onChange: (emoji: string) => void;
  /** The picker's accessible name, e.g. "Group emoji". */
  label: string;
};

/** A grid of emoji buttons to tap one from; the chosen one is highlighted. */
export default function EmojiPicker({
  options,
  value,
  onChange,
  label,
}: Props) {
  return (
    <div role="group" aria-label={label} className={styles.grid}>
      {options.map((e) => (
        <button
          key={e}
          aria-pressed={value === e}
          onClick={() => onChange(e)}
          className={`${styles.btn}${value === e ? ` ${styles.sel}` : ""}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
