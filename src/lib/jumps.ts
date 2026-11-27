import { groupSections } from "./groups";
import type { Group, Habit } from "../types";

/** A place in the habits the pearl's panel jumps to. */
export type Jump =
  | { kind: "top" }
  | { kind: "group"; group: Group; done: number; total: number }
  | { kind: "habit"; habit: Habit; done: boolean };

/**
 * Where the pearl's panel can take you: the top of the page, then each group
 * with how many of its habits are done (the habits in no group being at the
 * top), or with no groups each habit and whether it's done.
 */
export function jumps(
  habits: Habit[],
  groups: Group[],
  isDone: (h: Habit) => boolean,
): Jump[] {
  const top: Jump = { kind: "top" };
  if (groups.length === 0)
    return [
      top,
      ...habits.map(
        (habit): Jump => ({
          kind: "habit",
          habit,
          done: isDone(habit),
        }),
      ),
    ];
  return [
    top,
    ...groupSections(habits, groups).map(
      ({ group, habits: hs }): Jump => ({
        kind: "group",
        group,
        done: hs.filter(isDone).length,
        total: hs.length,
      }),
    ),
  ];
}
