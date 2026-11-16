import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GroupEditModal from "./GroupEditModal";
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

function renderModal() {
  const onSave = vi.fn();
  const onDelete = vi.fn();
  const onClose = vi.fn();
  render(
    <GroupEditModal
      group={music}
      groups={[music, fitness]}
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

describe("GroupEditModal", () => {
  it("shows the group's name and emoji, and its habits checked", () => {
    renderModal();
    expect(screen.getByRole("textbox", { name: "Group name" })).toHaveValue(
      "Music",
    );
    expect(screen.getByRole("textbox", { name: "Group emoji" })).toHaveValue(
      "🎵",
    );
    expect(
      screen
        .getAllByRole("checkbox")
        .map((c) => (c as HTMLInputElement).checked),
    ).toEqual([true, true, false, false]);
  });

  it("says which other group a habit is in, and that checking moves it", async () => {
    renderModal();
    expect(box("Run")).toHaveAccessibleName(/Run.*Fitness/);
    expect(box("Water")).not.toHaveAccessibleName(/in /);
    await userEvent.click(box("Run"));
    expect(screen.getByText(/moves from 🏋️ Fitness/)).toBeInTheDocument();
  });

  it("saves the name, emoji and checked habits, then closes", async () => {
    const { onSave, onClose } = renderModal();
    const name = screen.getByRole("textbox", { name: "Group name" });
    await userEvent.clear(name);
    await userEvent.type(name, " Practice ");
    await userEvent.click(box("Piano"));
    await userEvent.click(box("Run"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({ name: "Practice", emoji: "🎵" }, [
      "Guitar",
      "Run",
    ]);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("gives an emptied emoji the default one", async () => {
    const { onSave } = renderModal();
    await userEvent.clear(screen.getByRole("textbox", { name: "Group emoji" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave.mock.calls[0][0].emoji).toBe("📁");
  });

  it("won't save without a name", async () => {
    renderModal();
    await userEvent.clear(screen.getByRole("textbox", { name: "Group name" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("deletes the group once confirmed, after closing", async () => {
    const { onDelete, onSave } = renderModal();
    await userEvent.click(screen.getByRole("button", { name: "Delete group" }));
    expect(
      screen.getByText(/Its habits stay, in no group/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete Group" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("g1"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the group if the delete isn't confirmed", async () => {
    const { onDelete } = renderModal();
    await userEvent.click(screen.getByRole("button", { name: "Delete group" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(
      screen.getByRole("button", { name: "Delete group" }),
    ).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("changes nothing on Cancel", async () => {
    const { onSave, onDelete, onClose } = renderModal();
    await userEvent.click(box("Water"));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSave).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
