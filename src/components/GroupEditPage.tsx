import { useState } from "react";
import HabitIcon from "./HabitIcon";
import IconPicker from "./IconPicker";
import PageShell, { type ClosePage } from "./PageShell";
import type { IconId } from "../lib/icons";
import type { Group, Habit } from "../types";
import actions from "./formActions.module.css";
import form from "./HabitFormFields.module.css";
import styles from "./GroupEditPage.module.css";

type Props = {
  group: Group;
  /** Every group, to name the one a habit is in now. */
  groups: Group[];
  habits: Habit[];
  /** The edited name and icon, and the habits to be in the group. */
  onSave: (
    changes: { name: string; icon: IconId },
    memberIds: string[],
  ) => void;
  onDelete: (id: string) => void;
  onClose: ClosePage;
};

/**
 * Edit a group, on a page slid over the habits, opened by holding its chip or
 * section header: its name and
 * icon (picked from a grid), which habits are in it (checking a habit from another group moves
 * it here), or delete it, leaving its habits in no group. Like the habit
 * editor, nothing changes until Save.
 */
export default function GroupEditPage({
  group,
  groups,
  habits,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [name, setName] = useState(group.name);
  const [icon, setIcon] = useState(group.icon);
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
    <PageShell title="Edit Group" onBack={() => onClose()}>
      <div className={form.field}>
        <div className={form.label}>Icon</div>
        <IconPicker value={icon} onChange={setIcon} label="Group icon" />
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
              <HabitIcon icon={h.icon} />
              <span className={styles.habitName}>{h.name}</span>
              {other && (
                <span
                  className={`${styles.other}${on ? ` ${styles.moving}` : ""}`}
                >
                  {on ? "moves from " : ""}
                  <HabitIcon icon={other.icon} size={13} />
                  {other.name}
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
                // Deleted as the page closes, so the habits slide back
                // without its section.
                onClick={() => onClose(() => onDelete(group.id))}
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

      <div className={actions.footer}>
        <button onClick={() => onClose()} className={actions.cancelBtn}>
          Cancel
        </button>
        <button
          disabled={!name.trim()}
          onClick={() =>
            onClose(() =>
              onSave(
                { name: name.trim(), icon },
                habits.filter((h) => members.has(h.id)).map((h) => h.id),
              ),
            )
          }
          className={actions.primaryBtn}
        >
          Save
        </button>
      </div>
    </PageShell>
  );
}
