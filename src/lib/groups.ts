import type { Group, Habit } from "../types";

/** One group's section: the group and its habits. */
export type GroupSection = { group: Group; habits: Habit[] };

/**
 * Each group, in the groups' order, with its habits in the habits' order. A
 * group with no habits still gets a section. The habit list keeps one order
 * for everything, so reordering within a section is a reorder of the list.
 */
export function groupSections(
  habits: Habit[],
  groups: Group[],
): GroupSection[] {
  return groups.map((group) => ({
    group,
    habits: habits.filter((h) => h.groupId === group.id),
  }));
}

/** The habits in no group, in the habits' order: shown above the sections. */
export function ungroupedHabits(habits: Habit[], groups: Group[]): Habit[] {
  const ids = new Set(groups.map((g) => g.id));
  return habits.filter((h) => h.groupId === undefined || !ids.has(h.groupId));
}

/** `h` in no group. */
function ungrouped(h: Habit): Habit {
  const { groupId: _, ...rest } = h;
  return rest;
}

/**
 * Make `memberIds` the habits of group `groupId`: those habits move into it
 * (from any other group), and the group's other habits leave it for none.
 * Habits it doesn't change are returned as they were, in the same order.
 */
export function setMembers(
  habits: Habit[],
  groupId: string,
  memberIds: string[],
): Habit[] {
  const members = new Set(memberIds);
  return habits.map((h) => {
    if (members.has(h.id)) return h.groupId === groupId ? h : { ...h, groupId };
    return h.groupId === groupId ? ungrouped(h) : h;
  });
}
