import { useState } from "react";
import ModalShell from "./ModalShell";
import EmojiPicker from "./EmojiPicker";
import { GROUP_EMOJIS } from "./emojis";
import type { Group, Habit } from "../types";
import modal from "./modalForm.module.css";
import form from "./HabitFormFields.module.css";
import styles from "./GroupEditModal.module.css";

type Props = {
  group: Group;
  /** Every group, to name the one a habit is in now. */
  groups: Group[];
  habits: Habit[];
  /** The edited name and emoji, and the habits to be in the group. */
  onSave: (
    changes: { name: string; emoji: string },
    memberIds: string[],
  ) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

/**
 * Edit a group, opened by holding its chip or section header: its name and
 * emoji (picked from a grid), which habits are in it (checking a habit from another group moves
 * it here), or delete it, leaving its habits in no group. Like the habit
 * editor, nothing changes until Save.
 */
export default function GroupEditModal({
  group,
  groups,
  habits,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [name, setName] = useState(group.name);
  const [emoji, setEmoji] = useState(group.emoji);
  // An emoji the group has from before the picker stays one to pick
  const emojis = GROUP_EMOJIS.includes(group.emoji)
    ? GROUP_EMOJIS
    : [group.emoji, ...GROUP_EMOJIS];
  const [members, setMembers] = useState(
    () =>
      new Set(habits.filter((h) => h.groupId === group.id).map((h) => h.id)),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = (id: string) =>
    setMembers((m) => {
      const next = new Set(m);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** The group a habit is in now, if it's another one. */
  const otherGroup = (h: Habit) =>
    h.groupId === group.id ? undefined : groups.find((g) => g.id === h.groupId);

  return (
    <ModalShell onClose={onClose}>
      {(requestClose) => (
        <>
          <h2 className={modal.title}>Edit Group</h2>

          <div className={form.field}>
            <div className={form.label}>Icon</div>
            <EmojiPicker
              options={emojis}
              value={emoji}
              onChange={setEmoji}
              label="Group emoji"
            />
          </div>

          <div className={form.field}>
            <label className={form.label} htmlFor="group-name">
              Name
            </label>
            <input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Music"
              aria-label="Group name"
              className={form.input}
            />
          </div>

          <div className={form.fieldLg}>
            <div className={form.label}>Habits</div>
            {habits.map((h) => {
              const other = otherGroup(h);
              const on = members.has(h.id);
              return (
                <label key={h.id} className={styles.habitRow}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(h.id)}
                    className={styles.check}
                  />
                  <span className={styles.habitName}>
                    {h.emoji} {h.name}
                  </span>
                  {other && (
                    <span
                      className={`${styles.other}${on ? ` ${styles.moving}` : ""}`}
                    >
                      {on ? "moves from " : ""}
                      {other.emoji} {other.name}
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <div
            className={`${styles.danger}${confirmDelete ? ` ${styles.dangerActive}` : ""}`}
          >
            {confirmDelete ? (
              <div>
                <div className={styles.delTitle}>Delete "{group.name}"?</div>
                <div className={styles.delDesc}>
                  Its habits stay, in no group. Their logs aren't touched.
                </div>
                <div className={styles.dzRow}>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className={styles.keepBtn}
                  >
                    Keep it
                  </button>
                  <button
                    // Once the modal has animated out, so the section stays
                    // behind it until then
                    onClick={() => requestClose(() => onDelete(group.id))}
                    className={styles.deleteBtn}
                  >
                    Delete Group
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.idle}>
                <span className={styles.hint}>
                  Remove this group, keep its habits
                </span>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className={styles.delTrigger}
                >
                  Delete group
                </button>
              </div>
            )}
          </div>

          <div className={modal.footer}>
            <button onClick={() => requestClose()} className={modal.cancelBtn}>
              Cancel
            </button>
            <button
              disabled={!name.trim()}
              onClick={() => {
                onSave(
                  { name: name.trim(), emoji },
                  habits.filter((h) => members.has(h.id)).map((h) => h.id),
                );
                requestClose();
              }}
              className={modal.primaryBtn}
            >
              Save
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
