import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IconSelect from "./IconSelect";
import type { SelectOption } from "./IconSelect";

const OPTIONS: SelectOption[] = [
  { value: "push", label: "Push-ups", icon: "push-up", color: "#e3b341" },
  { value: "crunch", label: "Crunches", icon: "crunch", color: "#f85149" },
  { value: "read", label: "Reading", icon: "book" },
  { value: "none", label: "None" },
];

/** An IconSelect that keeps what's chosen, as its parents do. */
function Harness({
  initial = "crunch",
  onChange = () => {},
}: {
  initial?: string;
  onChange?: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <IconSelect
        label="Habit"
        value={value}
        options={OPTIONS}
        placeholder="Choose a habit"
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
      <button>Elsewhere</button>
    </>
  );
}

const field = () => screen.getByRole("button", { name: /^Habit:/ });
const list = () => screen.queryByRole("listbox", { name: "Habit" });
const optionNames = () =>
  within(list()!)
    .getAllByRole("option")
    .map((o) => o.textContent);

describe("IconSelect", () => {
  it("shows what's chosen, with its list shut", () => {
    render(<Harness />);
    expect(field()).toHaveAccessibleName("Habit: Crunches");
    expect(field()).toHaveAttribute("aria-expanded", "false");
    expect(field()).toHaveAttribute("aria-haspopup", "listbox");
    expect(list()).toBeNull();
  });

  it("shows the placeholder when nothing is chosen", () => {
    render(<Harness initial="gone" />);
    expect(field()).toHaveAccessibleName("Habit: Choose a habit");
  });

  it("opens its list under it on a tap, the chosen one selected and focused", async () => {
    render(<Harness />);
    await userEvent.click(field());
    expect(field()).toHaveAttribute("aria-expanded", "true");
    expect(field()).toHaveAttribute("aria-controls", list()!.id);
    expect(optionNames()).toEqual(["Push-ups", "Crunches", "Reading", "None"]);
    const selected = within(list()!).getByRole("option", { selected: true });
    expect(selected).toHaveTextContent("Crunches");
    expect(selected).toHaveFocus();
  });

  it("draws each option's icon, in its colour when it has one", async () => {
    render(<Harness />);
    await userEvent.click(field());
    const [push, , read, none] = within(list()!).getAllByRole("option");
    expect(push.querySelector("svg")).not.toBeNull();
    expect(
      (push.firstElementChild as HTMLElement).style.getPropertyValue("--ic"),
    ).toBe("#e3b341");
    expect(read.querySelector("svg")).not.toBeNull();
    expect(
      (read.firstElementChild as HTMLElement).style.getPropertyValue("--ic"),
    ).toBe("");
    expect(none.querySelector("svg")).toBeNull();
    // ...and the field the chosen one's
    expect(field().querySelector("svg path")).not.toBeNull();
  });

  it("chooses an option on a tap, shuts, and gives the field back its focus", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(field());
    await userEvent.click(screen.getByRole("option", { name: "Reading" }));
    expect(onChange).toHaveBeenCalledWith("read");
    expect(list()).toBeNull();
    expect(field()).toHaveAccessibleName("Habit: Reading");
    expect(field()).toHaveFocus();
  });

  it("changes nothing when the chosen one is tapped again", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(field());
    await userEvent.click(screen.getByRole("option", { name: "Crunches" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(list()).toBeNull();
  });

  it("shuts on a second tap of the field", async () => {
    render(<Harness />);
    await userEvent.click(field());
    await userEvent.click(field());
    expect(list()).toBeNull();
  });

  it("shuts on a tap anywhere else, choosing nothing", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(field());
    await userEvent.click(document.body);
    expect(list()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is one at a time: opening another shuts the first", async () => {
    render(
      <>
        <IconSelect
          label="A"
          value="push"
          options={OPTIONS}
          onChange={() => {}}
        />
        <IconSelect
          label="B"
          value="push"
          options={OPTIONS}
          onChange={() => {}}
        />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: /^A:/ }));
    await userEvent.click(screen.getByRole("button", { name: /^B:/ }));
    expect(screen.queryByRole("listbox", { name: "A" })).toBeNull();
    expect(screen.getByRole("listbox", { name: "B" })).toBeInTheDocument();
  });

  describe("from the keyboard", () => {
    it("opens with the down or up arrow", async () => {
      render(<Harness />);
      field().focus();
      await userEvent.keyboard("{ArrowDown}");
      expect(screen.getByRole("option", { name: "Crunches" })).toHaveFocus();
      await userEvent.keyboard("{Escape}");
      await userEvent.keyboard("{ArrowUp}");
      expect(list()).not.toBeNull();
    });

    it("opens with Enter or Space, as a button does", async () => {
      render(<Harness />);
      field().focus();
      await userEvent.keyboard("{Enter}");
      expect(list()).not.toBeNull();
    });

    it("moves through the options with the arrows, Home and End, and no further", async () => {
      render(<Harness />);
      await userEvent.click(field());
      const opt = (name: string) => screen.getByRole("option", { name });
      await userEvent.keyboard("{ArrowDown}");
      expect(opt("Reading")).toHaveFocus();
      await userEvent.keyboard("{End}{ArrowDown}");
      expect(opt("None")).toHaveFocus();
      await userEvent.keyboard("{Home}{ArrowUp}");
      expect(opt("Push-ups")).toHaveFocus();
    });

    it("chooses with Enter or Space", async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      await userEvent.click(field());
      await userEvent.keyboard("{ArrowUp}{Enter}");
      expect(onChange).toHaveBeenLastCalledWith("push");
      expect(field()).toHaveFocus();
      // Down opens it on Push-ups, then two more to Reading
      await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}[Space]");
      expect(onChange).toHaveBeenLastCalledWith("read");
    });

    it("shuts with Escape, back on the field, choosing nothing", async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      await userEvent.click(field());
      await userEvent.keyboard("{ArrowDown}{Escape}");
      expect(list()).toBeNull();
      expect(field()).toHaveFocus();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("shuts on Tab, which goes on to what follows the field", async () => {
      render(<Harness />);
      await userEvent.click(field());
      await userEvent.tab();
      expect(list()).toBeNull();
      expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
    });

    it("shuts on Shift+Tab, back on the field", async () => {
      render(<Harness />);
      await userEvent.click(field());
      await userEvent.tab({ shift: true });
      expect(list()).toBeNull();
      expect(field()).toHaveFocus();
    });
  });
});
