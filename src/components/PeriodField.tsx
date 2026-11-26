import { useId, useState } from "react";
import { gapLabel, isEveryDay, MAX_EVERY } from "../lib/periods";
import type { Period } from "../types";
import form from "./HabitFormFields.module.css";
import styles from "./PeriodField.module.css";

type Unit = Period["unit"];

/**
 * The habit form's "How often": every so many days or weeks. The habit's
 * streak holds while its logs are no more than that far apart. A number it
 * can't take (none, or past `MAX_EVERY`) leaves the period as it was, and
 * goes back to the period's on leaving the box.
 */
export default function PeriodField({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const id = useId();
  // The number as typed, so it can be cleared on the way to another.
  const [num, setNum] = useState(String(value.every));

  const typeNum = (text: string) => {
    setNum(text);
    const n = Number(text);
    if (
      text !== "" &&
      Number.isInteger(n) &&
      n >= 1 &&
      n <= MAX_EVERY[value.unit]
    )
      onChange({ every: n, unit: value.unit });
  };
  const pickUnit = (unit: Unit) => {
    const every = Math.min(value.every, MAX_EVERY[unit]);
    setNum(String(every));
    onChange({ every, unit });
  };
  const one = value.every === 1;

  return (
    <div className={form.field}>
      <label className={form.label} htmlFor={id}>
        How often
      </label>
      <div className={styles.row}>
        <span>Every</span>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_EVERY[value.unit]}
          value={num}
          onChange={(e) => typeNum(e.target.value)}
          onBlur={() => setNum(String(value.every))}
          className={styles.num}
        />
        <select
          aria-label="Days or weeks"
          value={value.unit}
          onChange={(e) => pickUnit(e.target.value as Unit)}
          className={styles.unit}
        >
          <option value="day">{one ? "day" : "days"}</option>
          <option value="week">{one ? "week" : "weeks"}</option>
        </select>
      </div>
      <div className={styles.hint}>
        {isEveryDay(value)
          ? "The streak holds while you log every day."
          : `The streak holds while your logs are no more than ${gapLabel(value)} apart. On the calendar, each log is ringed with the days it covers.`}
      </div>
    </div>
  );
}
