import { describe, it, expect, vi } from "vitest";
import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DayEditor from "./DayEditor";
import { BUILTIN_UNITS } from "../lib/defaults";
import { setsPreset } from "../lib/metrics";
import { PALETTES } from "../theme";
import type { Habit, HabitLogs } from "../types";

const habit: Habit = {
  id: "h1",
  name: "Reading",
  icon: "book",
  color: "Green",
  metrics: [{ id: "m1", name: "Pages", unit: "count" }],
  intensityMode: "total",
};
const setHabit: Habit = {
  id: "h2",
  name: "Bench",
  icon: "weightlifter",
  color: "Blue",
  metrics: [
    { id: "m2", name: "Reps", mode: "sets", ...setsPreset("weighted", "lbs") },
  ],
  intensityMode: "total",
};
const pal = PALETTES[0];

// Rendered in StrictMode, as in development: it runs effects twice on mount,
// which is where an effect-driven write would sneak in.
function renderEditor(
  h: Habit,
  logs: HabitLogs,
  onChange = vi.fn(),
  onClose = vi.fn(),
  today = "2026-05-24",
) {
  render(
    <StrictMode>
      <DayEditor
        habit={h}
        dateKey="2026-05-20"
        habitLogs={logs}
        units={BUILTIN_UNITS}
        pal={pal}
        today={today}
        onChange={onChange}
        onClose={onClose}
      />
    </StrictMode>,
  );
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
    expect(onChange).toHaveBeenLastCalledWith("2026-05-20", {
      m2: [{ w: 135, r: 5 }],
    });
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

  it("writes nothing on mount", () => {
    const { onChange } = renderEditor(habit, { "2026-05-20": { m1: 12 } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("writes each edit exactly once", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor(habit, {});
    await user.click(screen.getByRole("button", { name: "+5" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    await user.type(screen.getByDisplayValue("5"), "12"); // -> "51", "512"
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange.mock.calls.map(([, entry]) => entry.m1)).toEqual([
      5, 51, 512,
    ]);
  });

  it("writes nothing for a keystroke the field rejects", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor(habit, { "2026-05-20": { m1: 12 } });
    await user.type(screen.getByDisplayValue("12"), "x");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("writes once when a set is removed", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor(setHabit, {
      "2026-05-20": {
        m2: [
          { w: 135, r: 5 },
          { w: 145, r: 3 },
        ],
      },
    });
    await user.click(screen.getAllByRole("button", { name: "×" })[1]); // first set's ×
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("2026-05-20", {
      m2: [{ w: 145, r: 3 }],
    });
  });

  it("closes via the × button", async () => {
    const user = userEvent.setup();
    const { onClose } = renderEditor(habit, {});
    await user.click(screen.getByRole("button", { name: "×" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("DayEditor and today", () => {
  it("is titled with the date when editing another day", () => {
    renderEditor(habit, {});
    expect(screen.getByText("Edit · Wed, May 20, 2026")).toBeInTheDocument();
  });

  it("is titled 'Edit today' when the date is the given today", () => {
    renderEditor(habit, {}, vi.fn(), vi.fn(), "2026-05-20");
    expect(screen.getByText("Edit today")).toBeInTheDocument();
  });

  it("carries the weight over from the last set before today", () => {
    renderEditor(setHabit, { "2026-05-22": { m2: [{ w: 135, r: 5 }] } });
    expect(screen.getByPlaceholderText("Weight")).toHaveValue("135");
  });
});
