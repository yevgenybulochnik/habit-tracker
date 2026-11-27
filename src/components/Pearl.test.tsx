import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import Pearl from "./Pearl";
import type { Jump } from "../lib/jumps";
import type { Group, Habit } from "../types";

const habit = (id: string, name: string): Habit => ({
  id,
  name,
  icon: "book",
  color: "Blue",
  metrics: [],
  intensityMode: "total",
});
const group = (id: string, name: string): Group => ({
  id,
  name,
  icon: "folder",
  collapsed: false,
});

const fitness: Jump = {
  kind: "group",
  group: group("g1", "Fitness"),
  done: 1,
  total: 3,
};
const music: Jump = {
  kind: "group",
  group: group("g2", "Music"),
  done: 2,
  total: 2,
};
const TOP: Jump = { kind: "top" };

function renderPearl(props: Partial<ComponentProps<typeof Pearl>> = {}) {
  const handlers = {
    onJump: vi.fn(),
    onView: vi.fn(),
    onReorder: vi.fn(),
    onNewHabit: vi.fn(),
    onRoutines: vi.fn(),
    onSettings: vi.fn(),
    onBack: vi.fn(),
  };
  render(
    <Pearl
      done={7}
      total={17}
      jumps={[TOP, fitness, music]}
      view="compact"
      canReorder
      reordering={false}
      onPage={false}
      theme="dark"
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

const pearl = (name: string) => screen.getByRole("button", { name });
const panel = () => screen.queryByRole("group", { name: "Menu" });
const inPanel = () => within(panel()!);
const openMenu = () => userEvent.click(pearl("Menu"));

describe("Pearl", () => {
  it("shows today's progress, its menu shut", () => {
    renderPearl();
    expect(pearl("Menu")).toHaveAttribute("aria-expanded", "false");
    expect(pearl("Menu")).toHaveTextContent("7/17");
    expect(panel()).not.toBeInTheDocument();
  });

  it("shows no count with no habits", () => {
    renderPearl({ done: 0, total: 0, jumps: [TOP] });
    expect(pearl("Menu").textContent).toBe("");
  });

  it("opens out into its menu, and is then what shuts it", async () => {
    renderPearl();
    await openMenu();
    expect(panel()).toBeInTheDocument();
    expect(pearl("Close menu")).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(pearl("Close menu"));
    expect(pearl("Menu")).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
  });

  it("switches the habits' view, and stays open", async () => {
    const { onView } = renderPearl();
    await openMenu();
    const compact = inPanel().getByRole("button", { name: "Compact" });
    expect(compact).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(inPanel().getByRole("button", { name: "Calendar" }));
    expect(onView).toHaveBeenCalledWith("calendar");
    expect(panel()).toBeInTheDocument();
  });

  it("jumps to the top or a group, saying how each group is doing, and shuts", async () => {
    const { onJump } = renderPearl();
    await openMenu();
    expect(inPanel().getByRole("button", { name: "Top" })).toBeInTheDocument();
    expect(
      inPanel().getByRole("button", { name: "Music, 2 of 2 done" }),
    ).toBeInTheDocument();

    await userEvent.click(
      inPanel().getByRole("button", { name: "Fitness, 1 of 3 done" }),
    );
    expect(onJump).toHaveBeenCalledWith(fitness);
    expect(pearl("Menu")).toHaveAttribute("aria-expanded", "false");
  });

  it("with no groups, jumps to a habit, saying which are done", async () => {
    const run = habit("h1", "Run");
    const read = habit("h2", "Read");
    const { onJump } = renderPearl({
      jumps: [
        TOP,
        { kind: "habit", habit: run, done: true },
        { kind: "habit", habit: read, done: false },
      ],
    });
    await openMenu();
    expect(
      inPanel().getByRole("button", { name: "Run, done" }),
    ).toBeInTheDocument();
    await userEvent.click(inPanel().getByRole("button", { name: "Read" }));
    expect(onJump).toHaveBeenCalledWith({
      kind: "habit",
      habit: read,
      done: false,
    });
  });

  it("has nowhere to jump to with only the top", async () => {
    renderPearl({ jumps: [TOP] });
    await openMenu();
    expect(
      inPanel().queryByRole("button", { name: "Top" }),
    ).not.toBeInTheDocument();
  });

  it("opens a page from its actions, going at once", async () => {
    const { onNewHabit, onRoutines, onSettings } = renderPearl();
    for (const [name, handler] of [
      ["New habit", onNewHabit],
      ["Routines", onRoutines],
      ["Settings", onSettings],
    ] as const) {
      await openMenu();
      await userEvent.click(inPanel().getByRole("button", { name }));
      expect(handler).toHaveBeenCalledOnce();
      expect(panel()).not.toBeInTheDocument();
    }
  });

  it("starts reordering from its menu, when there's something to reorder", async () => {
    const { onReorder } = renderPearl();
    await openMenu();
    await userEvent.click(inPanel().getByRole("button", { name: "Reorder" }));
    expect(onReorder).toHaveBeenCalledOnce();
    expect(pearl("Menu")).toHaveAttribute("aria-expanded", "false");
  });

  it("offers no Reorder with nothing to reorder", async () => {
    renderPearl({ canReorder: false });
    await openMenu();
    expect(
      inPanel().queryByRole("button", { name: "Reorder" }),
    ).not.toBeInTheDocument();
  });

  it("while reordering, is Done, with how to reorder above it", async () => {
    const { onReorder } = renderPearl({ reordering: true });
    expect(screen.getByText(/Drag the/)).toHaveTextContent(
      "Drag the handles · when done",
    );
    await userEvent.click(pearl("Done"));
    expect(onReorder).toHaveBeenCalledOnce();
    expect(panel()).not.toBeInTheDocument();
  });

  it("on a page, is the way back", async () => {
    const { onBack } = renderPearl({ onPage: true });
    await userEvent.click(pearl("Back"));
    expect(onBack).toHaveBeenCalledOnce();
    expect(panel()).not.toBeInTheDocument();
  });

  it("shuts on Escape, back to the pearl", async () => {
    renderPearl();
    await openMenu();
    await userEvent.keyboard("{Escape}");
    expect(pearl("Menu")).toHaveAttribute("aria-expanded", "false");
    expect(pearl("Menu")).toHaveFocus();
  });

  it("shuts when a page comes up", async () => {
    const props = {
      done: 7,
      total: 17,
      jumps: [TOP],
      view: "compact" as const,
      canReorder: true,
      reordering: false,
      theme: "dark" as const,
      onJump: vi.fn(),
      onView: vi.fn(),
      onReorder: vi.fn(),
      onNewHabit: vi.fn(),
      onRoutines: vi.fn(),
      onSettings: vi.fn(),
      onBack: vi.fn(),
    };
    const { rerender } = render(<Pearl {...props} onPage={false} />);
    await openMenu();
    rerender(<Pearl {...props} onPage />);
    expect(panel()).not.toBeInTheDocument();
    rerender(<Pearl {...props} onPage={false} />);
    expect(pearl("Menu")).toHaveAttribute("aria-expanded", "false");
  });
});
