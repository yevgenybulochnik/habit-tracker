import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GroupSections from "./GroupSections";
import { groupSections, ungroupedHabits } from "../lib/groups";
import { sectionAnchor } from "../anchors";
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

const music: Group = {
  id: "g1",
  name: "Music",
  icon: "music",
  collapsed: false,
};
const fitness: Group = {
  id: "g2",
  name: "Fitness",
  icon: "weightlifter",
  collapsed: false,
};
const habits = [
  habit("Water"),
  habit("Piano", "g1"),
  habit("Guitar", "g1"),
  habit("Run", "g2"),
];
const done = new Set(["Piano", "Run"]);

/** Each list of habits as a plain list of names, standing in for the cards. */
const renderList = (hs: Habit[]) => (
  <ul>
    {hs.map((h) => (
      <li key={h.id}>{h.name}</li>
    ))}
  </ul>
);

function renderSections(
  groups = [music, fitness],
  hs = habits,
  { reorder = false } = {},
) {
  const onToggle = vi.fn();
  const onReorderGroups = vi.fn();
  const onEditGroup = vi.fn();
  const utils = render(
    <GroupSections
      sections={groupSections(hs, groups)}
      ungrouped={ungroupedHabits(hs, groups)}
      renderList={renderList}
      isDone={(h) => done.has(h.id)}
      onToggle={onToggle}
      reorder={reorder}
      onReorderGroups={onReorderGroups}
      onEditGroup={onEditGroup}
    />,
  );
  return { ...utils, onToggle, onReorderGroups, onEditGroup };
}

/** What dnd-kit marks as something that can be picked up and moved. */
const draggables = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[aria-roledescription="sortable"]'));

/** A section's header: the button inside the section named `name`. */
const header = (name: string) =>
  within(screen.getByRole("region", { name })).getByRole("button", {
    name: new RegExp(name),
  });

describe("GroupSections", () => {
  it("shows the ungrouped habits, then each group's section, with no bar", () => {
    const { container } = renderSections();
    const text = container.textContent ?? "";
    const at = (s: string) => text.indexOf(s);
    expect(at("Water")).toBe(0);
    expect(at("Music")).toBeGreaterThan(at("Water"));
    expect(at("Piano")).toBeGreaterThan(at("Music"));
    expect(at("Run")).toBeGreaterThan(at("Guitar"));
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("gives each section an id, for the pearl to jump to", () => {
    renderSections();
    expect(screen.getByRole("region", { name: "Fitness" })).toHaveAttribute(
      "id",
      sectionAnchor("g2"),
    );
  });

  it("puts each habit under its group's header", () => {
    renderSections();
    const sections = screen.getAllByRole("region");
    expect(sections.map((s) => s.getAttribute("aria-label"))).toEqual([
      "Music",
      "Fitness",
    ]);
    expect(
      within(sections[0])
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Piano", "Guitar"]);
    expect(
      within(sections[1])
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Run"]);
  });

  it("counts each group's habits done today, on its header", () => {
    renderSections();
    expect(header("Music")).toHaveTextContent("1/2");
    expect(header("Fitness")).toHaveTextContent("1/1");
  });

  it("says when a group has no habits yet", () => {
    renderSections([music, fitness], [habit("Water"), habit("Piano", "g1")]);
    const fitnessSection = screen.getByRole("region", { name: "Fitness" });
    expect(fitnessSection).toHaveTextContent(/No habits in this group yet/);
  });

  it("folds a section shut, or opens it, from its header", async () => {
    const { onToggle } = renderSections([
      music,
      { ...fitness, collapsed: true },
    ]);
    expect(header("Music")).toHaveAttribute("aria-expanded", "true");
    expect(header("Fitness")).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(header("Music"));
    expect(onToggle).toHaveBeenCalledWith("g1", true);
    await userEvent.click(header("Fitness"));
    expect(onToggle).toHaveBeenCalledWith("g2", false);
  });

  describe("reorder mode", () => {
    it("has nothing to drag outside it", () => {
      const { container } = renderSections();
      expect(draggables(container)).toEqual([]);
    });

    it("picks a group up by its section's header", () => {
      const { container } = renderSections([music, fitness], habits, {
        reorder: true,
      });
      expect(draggables(container)).toEqual([
        header("Music"),
        header("Fitness"),
      ]);
    });

    it("shows a grip on each header instead of the fold arrow", () => {
      renderSections([music, fitness], habits, { reorder: true });
      expect(header("Music")).toHaveTextContent("⠿");
      expect(header("Music")).not.toHaveTextContent("▾");
    });
  });

  describe("hold to edit", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const hold = (el: HTMLElement) => {
      fireEvent.mouseDown(el);
      act(() => vi.advanceTimersByTime(500));
      fireEvent.mouseUp(el);
    };

    it("edits a group when its section header is held", () => {
      const { onEditGroup, onToggle } = renderSections();
      hold(header("Music"));
      expect(onEditGroup).toHaveBeenCalledWith("g1");
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("doesn't edit on a short press", () => {
      const { onEditGroup } = renderSections();
      fireEvent.mouseDown(header("Music"));
      act(() => vi.advanceTimersByTime(300));
      fireEvent.mouseUp(header("Music"));
      act(() => vi.advanceTimersByTime(500));
      expect(onEditGroup).not.toHaveBeenCalled();
    });

    it("doesn't edit in reorder mode, where holding picks a group up", () => {
      const { onEditGroup } = renderSections([music, fitness], habits, {
        reorder: true,
      });
      hold(header("Music"));
      expect(onEditGroup).not.toHaveBeenCalled();
    });
  });
});
