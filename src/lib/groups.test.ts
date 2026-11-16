import { describe, it, expect } from "vitest";
import { groupSections, setMembers, ungroupedHabits } from "./groups";
import type { Group, Habit } from "../types";

function habit(id: string, groupId?: string): Habit {
  return {
    id,
    name: id,
    emoji: "📚",
    color: "Blue",
    metrics: [],
    intensityMode: "total",
    ...(groupId && { groupId }),
  };
}

function group(id: string): Group {
  return { id, name: id, emoji: "📁", collapsed: false };
}

const ids = (hs: Habit[]) => hs.map((h) => h.id);

describe("groupSections", () => {
  it("lists each group in order with its habits in habit order", () => {
    const habits = [
      habit("piano", "music"),
      habit("run", "fitness"),
      habit("water"),
      habit("guitar", "music"),
    ];
    const sections = groupSections(habits, [group("fitness"), group("music")]);
    expect(sections.map((s) => s.group.id)).toEqual(["fitness", "music"]);
    expect(sections.map((s) => ids(s.habits))).toEqual([
      ["run"],
      ["piano", "guitar"],
    ]);
  });

  it("includes a group with no habits", () => {
    const sections = groupSections([habit("water")], [group("music")]);
    expect(sections).toEqual([{ group: group("music"), habits: [] }]);
  });

  it("is empty when there are no groups", () => {
    expect(groupSections([habit("water")], [])).toEqual([]);
  });
});

describe("ungroupedHabits", () => {
  it("is the habits in no group, in habit order", () => {
    const habits = [habit("water"), habit("piano", "music"), habit("read")];
    expect(ids(ungroupedHabits(habits, [group("music")]))).toEqual([
      "water",
      "read",
    ]);
  });

  it("counts a habit whose group doesn't exist as ungrouped", () => {
    expect(ids(ungroupedHabits([habit("piano", "gone")], []))).toEqual([
      "piano",
    ]);
  });
});

describe("setMembers", () => {
  const habits = [
    habit("piano", "music"),
    habit("guitar", "music"),
    habit("run", "fitness"),
    habit("water"),
  ];

  it("puts the listed habits in the group, moving them from others", () => {
    const out = setMembers(habits, "music", ["piano", "guitar", "run"]);
    expect(out.map((h) => h.groupId)).toEqual([
      "music",
      "music",
      "music",
      undefined,
    ]);
  });

  it("takes habits that aren't listed out of the group", () => {
    const out = setMembers(habits, "music", ["guitar", "water"]);
    expect(out.map((h) => [h.id, h.groupId])).toEqual([
      ["piano", undefined],
      ["guitar", "music"],
      ["run", "fitness"],
      ["water", "music"],
    ]);
    expect(out[0]).not.toHaveProperty("groupId");
  });

  it("empties the group when no habits are listed", () => {
    const out = setMembers(habits, "music", []);
    expect(ungroupedHabits(out, [group("music"), group("fitness")])).toEqual(
      out.filter((h) => h.id !== "run"),
    );
  });

  it("keeps the order and the habits it doesn't change", () => {
    const out = setMembers(habits, "music", ["piano"]);
    expect(ids(out)).toEqual(ids(habits));
    expect(out[0]).toBe(habits[0]);
    expect(out[2]).toBe(habits[2]);
    expect(out[3]).toBe(habits[3]);
  });
});
