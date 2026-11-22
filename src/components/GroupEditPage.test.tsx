import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GroupEditPage from "./GroupEditPage";
import { GROUP_EMOJIS } from "./emojis";
import type { Group, Habit } from "../types";

function habit(id: string, groupId?: string): Habit {
  return {
    id,
    name: id,
    emoji: "🎯",
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
  habit("Piano", "g1"),
  habit("Guitar", "g1"),
  habit("Run", "g2"),
  habit("Water"),
];

function renderPage(group = music) {
  const onSave = vi.fn();
  const onDelete = vi.fn();
  // Closing the page runs what it's given as it closes.
  const onClose = vi.fn((then?: () => void) => then?.());
  render(
    <GroupEditPage
      group={group}
      groups={[group, fitness]}
      habits={habits}
      onSave={onSave}
      onDelete={onDelete}
      onClose={onClose}
    />,
  );
  return { onSave, onDelete, onClose };
}

const box = (name: string) =>
  screen.getByRole("checkbox", { name: new RegExp(name) });

const picker = () => screen.getByRole("group", { name: "Group emoji" });
/** The emojis the picker offers, and the one it has chosen. */
const offered = () =>
  within(picker())
    .getAllByRole("button")
    .map((b) => b.textContent);
const picked = () =>
  within(picker())
    .getAllByRole("button", { pressed: true })
    .map((b) => b.textContent);

describe("GroupEditModal", () => {
  it("is a page headed Edit Group, with the way back", async () => {
    const { onClose, onSave } = renderPage();
    expect(
      screen.getByRole("heading", { name: "Edit Group", level: 1 }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByTitle("Back to habits"));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows the group's name and emoji, and its habits checked", () => {
    renderPage();
    expect(screen.getByRole("textbox", { name: "Group name" })).toHaveValue(
      "Music",
    );
    expect(picked()).toEqual(["🎵"]);
    expect(
      screen
        .getAllByRole("checkbox")
        .map((c) => (c as HTMLInputElement).checked),
    ).toEqual([true, true, false, false]);
  });

  it("says which other group a habit is in, and that checking moves it", async () => {
    renderPage();
    expect(box("Run")).toHaveAccessibleName(/Run.*Fitness/);
    expect(box("Water")).not.toHaveAccessibleName(/in /);
    await userEvent.click(box("Run"));
    expect(screen.getByText(/moves from 🏋️ Fitness/)).toBeInTheDocument();
  });

  it("saves the name, emoji and checked habits, then closes", async () => {
    const { onSave, onClose } = renderPage();
    const name = screen.getByRole("textbox", { name: "Group name" });
    await userEvent.clear(name);
    await userEvent.type(name, " Practice ");
    await userEvent.click(within(picker()).getByRole("button", { name: "🏠" }));
    expect(picked()).toEqual(["🏠"]);
    await userEvent.click(box("Piano"));
    await userEvent.click(box("Run"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({ name: "Practice", emoji: "🏠" }, [
      "Guitar",
      "Run",
    ]);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("offers the group emojis to pick from", () => {
    renderPage();
    expect(offered()).toEqual(GROUP_EMOJIS);
  });

  it("keeps offering an emoji the group has that isn't among them", async () => {
    const { onSave } = renderPage({ ...music, emoji: "🗣️" });
    expect(offered()).toEqual(["🗣️", ...GROUP_EMOJIS]);
    expect(picked()).toEqual(["🗣️"]);
    // Still there to go back to after picking another
    await userEvent.click(within(picker()).getByRole("button", { name: "📁" }));
    expect(offered()[0]).toBe("🗣️");
    await userEvent.click(within(picker()).getByRole("button", { name: "🗣️" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave.mock.calls[0][0].emoji).toBe("🗣️");
  });

  it("won't save without a name", async () => {
    renderPage();
    await userEvent.clear(screen.getByRole("textbox", { name: "Group name" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("deletes the group once confirmed, after closing", async () => {
    const { onDelete, onSave } = renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Delete group" }));
    expect(
      screen.getByText(/Its habits stay, in no group/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete Group" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("g1"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the group if the delete isn't confirmed", async () => {
    const { onDelete } = renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Delete group" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(
      screen.getByRole("button", { name: "Delete group" }),
    ).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("changes nothing on Cancel", async () => {
    const { onSave, onDelete, onClose } = renderPage();
    await userEvent.click(box("Water"));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSave).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
