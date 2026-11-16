import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GroupSections from "./GroupSections";
import { groupSections, ungroupedHabits } from "../lib/groups";
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

const music: Group = { id: "g1", name: "Music", emoji: "🎵", collapsed: false };
const fitness: Group = {
  id: "g2",
  name: "Fitness",
  emoji: "🏋️",
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

const chip = (name: RegExp) =>
  within(screen.getByRole("navigation", { name: "Groups" })).getByRole(
    "button",
    { name },
  );
/** A section's header: the button inside the section named `name`. */
const header = (name: string) =>
  within(screen.getByRole("region", { name })).getByRole("button", {
    name: new RegExp(name),
  });

beforeEach(() => {
  // jsdom doesn't scroll
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GroupSections", () => {
  it("shows the bar, then the ungrouped habits, then each group's section", () => {
    const { container } = renderSections();
    const text = container.textContent ?? "";
    const at = (s: string) => text.indexOf(s);
    expect(at("Water")).toBeGreaterThan(-1);
    // The bar's chips come first, then Water, then the Music section.
    expect(at("Water")).toBeGreaterThan(at("Fitness"));
    expect(at("Piano")).toBeGreaterThan(at("Water"));
    expect(at("Run")).toBeGreaterThan(at("Guitar"));
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

  it("counts each group's habits done today, on its chip and its header", () => {
    renderSections();
    expect(chip(/Music/)).toHaveTextContent("1/2");
    expect(chip(/Fitness/)).toHaveTextContent("1/1");
    expect(header("Music")).toHaveTextContent("1/2");
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

  it("jumps to a group's section from its chip, opening it if shut", async () => {
    const { onToggle } = renderSections([
      music,
      { ...fitness, collapsed: true },
    ]);
    await userEvent.click(chip(/Fitness/));
    expect(onToggle).toHaveBeenCalledWith("g2", false);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(chip(/Fitness/)).toHaveAttribute("aria-current", "true");
  });

  it("doesn't fold an open section when its chip is tapped", async () => {
    const { onToggle } = renderSections();
    await userEvent.click(chip(/Music/));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("scrolls back to the top from the ↑ button", async () => {
    renderSections();
    await userEvent.click(
      screen.getByRole("button", { name: "Scroll to top" }),
    );
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });

  describe("reorder mode", () => {
    it("has nothing to drag outside it", () => {
      const { container } = renderSections();
      expect(draggables(container)).toEqual([]);
    });

    it("picks a group up by its chip or its section's header", () => {
      const { container } = renderSections([music, fitness], habits, {
        reorder: true,
      });
      expect(draggables(container)).toEqual([
        chip(/Music/),
        chip(/Fitness/),
        header("Music"),
        header("Fitness"),
      ]);
    });

    it("shows a grip on each header instead of the fold arrow", () => {
      renderSections([music, fitness], habits, { reorder: true });
      expect(header("Music")).toHaveTextContent("⠿");
      expect(header("Music")).not.toHaveTextContent("▾");
    });

    it("still jumps to a section from its chip", async () => {
      renderSections([music, fitness], habits, { reorder: true });
      await userEvent.click(chip(/Fitness/));
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
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

    it("edits a group when its chip is held", () => {
      const { onEditGroup } = renderSections();
      hold(chip(/Fitness/));
      expect(onEditGroup).toHaveBeenCalledWith("g2");
    });

    it("edits a group when its section header is held", () => {
      const { onEditGroup, onToggle } = renderSections();
      hold(header("Music"));
      expect(onEditGroup).toHaveBeenCalledWith("g1");
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("doesn't edit on a short press", () => {
      const { onEditGroup } = renderSections();
      fireEvent.mouseDown(chip(/Music/));
      act(() => vi.advanceTimersByTime(300));
      fireEvent.mouseUp(chip(/Music/));
      act(() => vi.advanceTimersByTime(500));
      expect(onEditGroup).not.toHaveBeenCalled();
    });

    it("doesn't edit in reorder mode, where holding picks a group up", () => {
      const { onEditGroup } = renderSections([music, fitness], habits, {
        reorder: true,
      });
      hold(chip(/Music/));
      hold(header("Music"));
      expect(onEditGroup).not.toHaveBeenCalled();
    });
  });
});
