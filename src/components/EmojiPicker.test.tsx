import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmojiPicker from "./EmojiPicker";

function renderPicker(value = "🎵") {
  const onChange = vi.fn();
  render(
    <EmojiPicker
      options={["📁", "🎵", "🏋️"]}
      value={value}
      onChange={onChange}
      label="Group emoji"
    />,
  );
  return { onChange };
}

const picker = () => screen.getByRole("group", { name: "Group emoji" });

describe("EmojiPicker", () => {
  it("offers each option as a button, in order", () => {
    renderPicker();
    expect(
      within(picker())
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["📁", "🎵", "🏋️"]);
  });

  it("shows the chosen emoji as pressed", () => {
    renderPicker("🎵");
    expect(
      within(picker())
        .getAllByRole("button", { pressed: true })
        .map((b) => b.textContent),
    ).toEqual(["🎵"]);
  });

  it("presses none when the value isn't an option", () => {
    renderPicker("🗣️");
    expect(
      within(picker()).queryAllByRole("button", { pressed: true }),
    ).toEqual([]);
  });

  it("chooses an emoji when it's tapped", async () => {
    const { onChange } = renderPicker();
    await userEvent.click(screen.getByRole("button", { name: "🏋️" }));
    expect(onChange).toHaveBeenCalledWith("🏋️");
  });
});
