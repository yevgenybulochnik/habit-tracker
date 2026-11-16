import { useState } from "react";
import { DEFAULT_GROUP_EMOJI } from "../lib/defaults";
import { newId } from "../lib/ids";
import type { Group } from "../types";
import EmojiPicker from "./EmojiPicker";
import { GROUP_EMOJIS } from "./emojis";
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
 * The habit form's group menu: none, each group, or "+ New group…", which
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
  const [emoji, setEmoji] = useState(DEFAULT_GROUP_EMOJI);
  const [name, setName] = useState("");

  const add = () => {
    if (!name.trim()) return;
    const group: Group = {
      id: newId("g"),
      name: name.trim(),
      emoji,
      collapsed: false,
    };
    onAddGroup(group);
    onChange(group.id);
    setAdding(false);
    setName("");
    setEmoji(DEFAULT_GROUP_EMOJI);
  };

  return (
    <div className={form.field}>
      <label className={form.label} htmlFor="habit-group">
        Group
      </label>
      <select
        id="habit-group"
        value={adding ? NEW : value}
        onChange={(e) => {
          if (e.target.value === NEW) setAdding(true);
          else {
            setAdding(false);
            onChange(e.target.value);
          }
        }}
        className={styles.select}
      >
        <option value="">None</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.emoji} {g.name}
          </option>
        ))}
        <option value={NEW}>+ New group…</option>
      </select>
      {adding && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>New Group</div>
          <EmojiPicker
            options={GROUP_EMOJIS}
            value={emoji}
            onChange={setEmoji}
            label="Group emoji"
          />
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
