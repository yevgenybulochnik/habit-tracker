import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UnitForm from "./UnitForm";
import { unitFields } from "../lib/units";
import type { Unit } from "../types";

const km: Unit = {
  id: "km",
  label: "Kilometres",
  quickAdd: [1, 5],
  thresholds: [2, 5, 10],
};

function renderForm(over: Partial<Parameters<typeof UnitForm>[0]> = {}) {
  const props = {
    takenIds: ["reps", "min"],
    submitLabel: "Add Unit",
    onSubmit: vi.fn(),
    ...over,
  };
  render(<UnitForm {...props} />);
  return props;
}

const field = (name: string) => screen.getByLabelText(name);
const submit = (name = "Add Unit") =>
  userEvent.click(screen.getByRole("button", { name }));

describe("UnitForm", () => {
  it("adds a unit from the fields, starting from usable defaults", async () => {
    const { onSubmit } = renderForm();
    await userEvent.type(field("ID"), "Fl Oz");
    await userEvent.type(field("Label"), "Fluid ounces");
    await submit();
    expect(onSubmit).toHaveBeenCalledWith({
      id: "fl_oz",
      label: "Fluid ounces",
      quickAdd: [1, 5, 10],
      thresholds: [1, 3, 5],
    });
  });

  it("starts over after adding, ready for the next unit", async () => {
    renderForm();
    await userEvent.type(field("ID"), "cups");
    await userEvent.type(field("Label"), "Cups");
    await userEvent.clear(field("Quick-add"));
    await userEvent.type(field("Quick-add"), "2");
    await submit();
    expect(field("ID")).toHaveValue("");
    expect(field("Label")).toHaveValue("");
    expect(field("Quick-add")).toHaveValue("1, 5, 10");
  });

  it("says why it can't add, and adds nothing", async () => {
    const { onSubmit } = renderForm();
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an ID.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses an id another unit has", async () => {
    const { onSubmit } = renderForm();
    await userEvent.type(field("ID"), "Reps");
    await userEvent.type(field("Label"), "More reps");
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent(
      'There\'s already a unit with the ID "reps".',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clears the error once a field changes", async () => {
    renderForm();
    await submit();
    await userEvent.type(field("ID"), "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers Cancel only when there's somewhere to go back to", async () => {
    renderForm();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();

    const onCancel = vi.fn();
    renderForm({ onCancel });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  describe("editing", () => {
    it("starts from the unit, with its id fixed", () => {
      renderForm({
        initial: unitFields(km),
        editing: true,
        submitLabel: "Save",
      });
      expect(field("ID")).toHaveValue("km");
      expect(field("ID")).toBeDisabled();
      expect(field("Label")).toHaveValue("Kilometres");
      expect(field("Quick-add")).toHaveValue("1, 5");
      expect(field("Thresholds")).toHaveValue("2, 5, 10");
    });

    it("saves the changes under the same id", async () => {
      const { onSubmit } = renderForm({
        initial: unitFields(km),
        editing: true,
        submitLabel: "Save",
      });
      await userEvent.clear(field("Thresholds"));
      await userEvent.type(field("Thresholds"), "3, 6, 12");
      await submit("Save");
      expect(onSubmit).toHaveBeenCalledWith({ ...km, thresholds: [3, 6, 12] });
    });
  });
});
