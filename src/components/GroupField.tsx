import { useState } from "react";
import { DEFAULT_GROUP_ICON } from "../lib/icons";
import type { IconId } from "../lib/icons";
import { newId } from "../lib/ids";
import type { Group } from "../types";
import IconPicker from "./IconPicker";
import IconSelect from "./IconSelect";
import form from "./HabitFormFields.module.css";
import styles from "./GroupField.module.css";

type Props = {
  /** The chosen group's id, or "" for none. */
  value: string;
  onChange: (groupId: string) => void;
  groups: Group[];
  /** Adds a group made with "+ New group…"; it's then chosen. */
  onAddGroup: (g: Group) => void;
};

/** The menu's value for "+ New group…". */
const NEW = "__new__";

/**
 * The habit form's group menu: none, each group with its icon, or
 * "+ New group…", which
 * opens a small form the way the unit menu's "+ Custom..." does. Like a custom
 * unit, the new group is added as soon as it's made, even if the habit form is
 * then cancelled.
 */
export default function GroupField({
  value,
  onChange,
  groups,
  onAddGroup,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [icon, setIcon] = useState<IconId>(DEFAULT_GROUP_ICON);
  const [name, setName] = useState("");

  const add = () => {
    if (!name.trim()) return;
    const group: Group = {
      id: newId("g"),
      name: name.trim(),
      icon,
      collapsed: false,
    };
    onAddGroup(group);
    onChange(group.id);
    setAdding(false);
    setName("");
    setIcon(DEFAULT_GROUP_ICON);
  };

  return (
    <div className={form.field}>
      <label className={form.label} htmlFor="habit-group">
        Group
      </label>
      <IconSelect
        id="habit-group"
        label="Group"
        value={adding ? NEW : value}
        options={[
          { value: "", label: "None" },
          ...groups.map((g) => ({ value: g.id, label: g.name, icon: g.icon })),
          { value: NEW, label: "+ New group…" },
        ]}
        onChange={(v) => {
          if (v === NEW) setAdding(true);
          else {
            setAdding(false);
            onChange(v);
          }
        }}
      />
      {adding && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>New Group</div>
          <IconPicker value={icon} onChange={setIcon} label="Group icon" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="e.g. Music"
            aria-label="Group name"
            className={styles.name}
            autoFocus
          />
          <div className={styles.actions}>
            <button onClick={() => setAdding(false)} className={styles.cancel}>
              Cancel
            </button>
            <button
              onClick={add}
              disabled={!name.trim()}
              className={styles.submit}
            >
              Add Group
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
