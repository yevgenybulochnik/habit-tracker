import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IconPicker from "./IconPicker";
import type { IconId } from "../lib/icons";
import { ICON_IDS, ICON_NAMES, ICON_SECTIONS } from "../lib/icons";

function renderPicker(value: IconId = "guitar") {
  const onChange = vi.fn();
  render(<IconPicker value={value} onChange={onChange} label="Group icon" />);
  return { onChange };
}

const picker = () => screen.getByRole("group", { name: "Group icon" });

describe("IconPicker", () => {
  it("offers every icon by name, in order", () => {
    renderPicker();
    expect(
      within(picker())
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(ICON_IDS.map((id) => ICON_NAMES[id]));
  });

  it("groups them in titled sections", () => {
    renderPicker();
    for (const s of ICON_SECTIONS) {
      const section = within(picker()).getByRole("group", { name: s.title });
      expect(within(section).getAllByRole("button")).toHaveLength(
        s.icons.length,
      );
    }
  });

  it("shows the chosen icon as pressed", () => {
    renderPicker("guitar");
    expect(
      within(picker())
        .getAllByRole("button", { pressed: true })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Guitar"]);
  });

  it("chooses an icon when it's tapped", async () => {
    const { onChange } = renderPicker();
    await userEvent.click(screen.getByRole("button", { name: "Kettlebell" }));
    expect(onChange).toHaveBeenCalledWith("kettlebell");
  });
});
