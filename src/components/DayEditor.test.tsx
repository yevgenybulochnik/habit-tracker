import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DayEditor from "./DayEditor";
import { BUILTIN_UNITS, PALETTES } from "../constants";
import type { Habit, HabitLogs } from "../types";

const habit: Habit = { id: "h1", name: "Reading", emoji: "📚", color: "Green", metrics: [{ id: "m1", name: "Pages", unit: "count" }] };
const setHabit: Habit = { id: "h2", name: "Bench", emoji: "🏋️", color: "Blue", metrics: [{ id: "m2", name: "Reps", unit: "reps", mode: "sets", weightUnit: "lbs" }] };
const pal = PALETTES[0];

function renderEditor(h: Habit, logs: HabitLogs, onChange = vi.fn(), onClose = vi.fn()) {
  render(<DayEditor habit={h} dateKey="2026-05-20" habitLogs={logs} units={BUILTIN_UNITS} pal={pal} onChange={onChange} onClose={onClose} />);
  return { onChange, onClose };
}

describe("DayEditor", () => {
  it("seeds from the existing value and emits the edited number for that date", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor(habit, { "2026-05-20": { m1: 12 } });
    const input = screen.getByDisplayValue("12");
    await user.clear(input);
    await user.type(input, "20");
    expect(onChange).toHaveBeenLastCalledWith("2026-05-20", { m1: 20 });
  });

  it("quick-add increments the value", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor(habit, {});
    await user.click(screen.getByRole("button", { name: "+5" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-05-20", { m1: 5 });
  });

  it("emits a set for a sets-mode metric", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor(setHabit, {});
    await user.type(screen.getByPlaceholderText("Weight"), "135");
    await user.type(screen.getByPlaceholderText("Reps"), "5");
    await user.click(screen.getByRole("button", { name: "+ Set" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-05-20", { m2: [{ w: 135, r: 5 }] });
  });

  it("emits live changes via onChange as values are edited", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor(habit, {});
    await user.click(screen.getByRole("button", { name: "+5" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-05-20", { m1: 5 });
    await user.type(screen.getByDisplayValue("5"), "1"); // -> "51"
    expect(onChange).toHaveBeenLastCalledWith("2026-05-20", { m1: 51 });
  });

  it("has no Save button", () => {
    renderEditor(habit, {});
    expect(screen.queryByRole("button", { name: /Save/i })).toBeNull();
  });

  it("does not emit onChange on initial mount", () => {
    const { onChange } = renderEditor(habit, { "2026-05-20": { m1: 12 } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes via the × button", async () => {
    const user = userEvent.setup();
    const { onClose } = renderEditor(habit, {});
    await user.click(screen.getByRole("button", { name: "×" }));
    expect(onClose).toHaveBeenCalled();
  });
});
