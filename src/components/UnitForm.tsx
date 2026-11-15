import { useId, useState } from "react";
import { NEW_UNIT_FIELDS, buildUnit, type UnitFields } from "../lib/units";
import type { Unit } from "../types";
import styles from "./UnitForm.module.css";

type Props = {
  /** The starting values: an existing unit's when editing. */
  initial?: UnitFields;
  /** Editing an existing unit: its id is shown but can't change. */
  editing?: boolean;
  /** The other units' ids, which this one mustn't reuse. */
  takenIds: readonly string[];
  submitLabel: string;
  onSubmit: (unit: Unit) => void;
  /** Shows a Cancel button when given. */
  onCancel?: () => void;
};

const FIELDS: { key: keyof UnitFields; label: string; placeholder?: string }[] =
  [
    { key: "id", label: "ID", placeholder: "lbs" },
    { key: "label", label: "Label", placeholder: "Pounds" },
    { key: "quickAdd", label: "Quick-add" },
    { key: "thresholds", label: "Thresholds" },
  ];

/**
 * The fields of a unit (id, label, quick-add amounts, thresholds), validated
 * with `buildUnit`. After a successful submit it starts over from `initial`.
 * The surrounding panel and its title belong to the caller.
 */
export default function UnitForm({
  initial = NEW_UNIT_FIELDS,
  editing = false,
  takenIds,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [fields, setFields] = useState(initial);
  const [error, setError] = useState("");
  const idBase = useId();

  const submit = () => {
    const result = buildUnit(fields, takenIds);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSubmit(result.unit);
    setFields(initial);
  };

  return (
    <div>
      <div className={styles.grid}>
        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label htmlFor={`${idBase}-${key}`} className={styles.fieldLbl}>
              {label}
            </label>
            <input
              id={`${idBase}-${key}`}
              value={fields[key]}
              onChange={(e) => {
                setFields((f) => ({ ...f, [key]: e.target.value }));
                setError("");
              }}
              placeholder={editing ? undefined : placeholder}
              disabled={editing && key === "id"}
              className={styles.input}
            />
          </div>
        ))}
      </div>
      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}
      <div className={styles.actions}>
        {onCancel && (
          <button onClick={onCancel} className={styles.cancel}>
            Cancel
          </button>
        )}
        <button onClick={submit} className={styles.submit}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
