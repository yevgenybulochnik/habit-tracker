import { describe, it, expect } from "vitest";
import { jumps } from "./jumps";
import type { Group, Habit } from "../types";

function habit(id: string, groupId?: string): Habit {
  return {
    id,
    name: id,
    icon: "book",
    color: "Blue",
    metrics: [],
    intensityMode: "total",
    ...(groupId && { groupId }),
  };
}

function group(id: string, collapsed = false): Group {
  return { id, name: id, icon: "folder", collapsed };
}

/** Done: the habits named here. */
const doneOf =
  (...ids: string[]) =>
  (h: Habit) =>
    ids.includes(h.id);

/** Each jump, as a short tag. */
const tags = (js: ReturnType<typeof jumps>) =>
  js.map((j) =>
    j.kind === "top"
      ? "top"
      : j.kind === "group"
        ? `${j.group.id} ${j.done}/${j.total}`
        : `${j.habit.id}${j.done ? " ✓" : ""}`,
  );

describe("jumps", () => {
  it("with no groups, is the top and then each habit, saying which are done", () => {
    const habits = [habit("water"), habit("run"), habit("read")];
    expect(tags(jumps(habits, [], doneOf("run")))).toEqual([
      "top",
      "water",
      "run ✓",
      "read",
    ]);
  });

  it("with groups, is the top and then each group, with how many of its habits are done", () => {
    const habits = [
      habit("piano", "music"),
      habit("run", "fitness"),
      habit("guitar", "music"),
    ];
    const groups = [group("fitness"), group("music")];
    expect(tags(jumps(habits, groups, doneOf("piano", "run")))).toEqual([
      "top",
      "fitness 1/1",
      "music 1/2",
    ]);
  });

  it("leaves the habits in no group to the top, where they are", () => {
    const habits = [habit("water"), habit("run", "fitness")];
    expect(tags(jumps(habits, [group("fitness")], doneOf()))).toEqual([
      "top",
      "fitness 0/1",
    ]);
  });

  it("lists a group with no habits yet, and a folded one", () => {
    const groups = [group("empty"), group("shut", true)];
    const js = jumps([habit("run", "shut")], groups, doneOf());
    expect(tags(js)).toEqual(["top", "empty 0/0", "shut 0/1"]);
    expect(js[2]).toMatchObject({ kind: "group", group: { collapsed: true } });
  });

  it("is only the top with nothing to jump to", () => {
    expect(tags(jumps([], [], doneOf()))).toEqual(["top"]);
  });
});
