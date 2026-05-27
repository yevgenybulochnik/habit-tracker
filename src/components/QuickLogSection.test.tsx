import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuickLogSection from "./QuickLogSection";
import { BUILTIN_UNITS, PALETTES } from "../constants";
import { todayK } from "../lib/dates";
import type { Habit, HabitLogs } from "../types";

const minHabit: Habit = {
  id: "h1",
  name: "Run",
  emoji: "🏃",
  color: "Green",
  metrics: [{ id: "m1", name: "Minutes", unit: "min" }],
};
const setHabit: Habit = {
  id: "h2",
  name: "Lift",
  emoji: "🏋️",
  color: "Blue",
  metrics: [
    { id: "m2", name: "Bench", unit: "reps", mode: "sets", weightUnit: "lbs" },
  ],
};
const doneHabit: Habit = {
  id: "h3",
  name: "Meditate",
  emoji: "🧘",
  color: "Purple",
  intensityMode: "coverage",
  metrics: [{ id: "m3", name: "Completed", unit: "count", mode: "done" }],
};
const pal = PALETTES[0];

function renderQL(habit: Habit, logs: HabitLogs, overrides = {}) {
  const handlers = {
    onQuickLog: vi.fn(),
    onQuickReset: vi.fn(),
    onAddSet: vi.fn(),
    onRemoveSet: vi.fn(),
    onStartTimer: vi.fn(),
    onStopTimer: vi.fn(),
    ...overrides,
  };
  render(
    <QuickLogSection
      habit={habit}
      logs={logs}
      units={BUILTIN_UNITS}
      pal={pal}
      timers={{}}
      habitId={habit.id}
      {...handlers}
    />,
  );
  return handlers;
}

describe("QuickLogSection dense mode", () => {
  it("shows the 'Quick log today' label by default", () => {
    renderQL(minHabit, {});
    expect(screen.getByText(/Quick log today/i)).toBeInTheDocument();
  });
  it("hides the 'Quick log today' label when dense", () => {
    renderQL(minHabit, {}, { dense: true });
    expect(screen.queryByText(/Quick log today/i)).not.toBeInTheDocument();
  });
});

describe("QuickLogSection", () => {
  it("fires onQuickLog with the metric id and amount when a +N button is tapped", async () => {
    const user = userEvent.setup();
    const { onQuickLog } = renderQL(minHabit, {});
    await user.click(screen.getByRole("button", { name: "+15" }));
    expect(onQuickLog).toHaveBeenCalledWith("m1", 15);
  });

  it("fires onQuickReset when the reset button is tapped", async () => {
    const user = userEvent.setup();
    const { onQuickReset } = renderQL(minHabit, { [todayK()]: { m1: 30 } });
    await user.click(screen.getByRole("button", { name: "↺" }));
    expect(onQuickReset).toHaveBeenCalledWith("m1");
  });

  it("fires onAddSet for a sets-mode metric", async () => {
    const user = userEvent.setup();
    const { onAddSet } = renderQL(setHabit, {});
    await user.type(screen.getByPlaceholderText("Weight"), "135");
    await user.type(screen.getByPlaceholderText("Reps"), "5");
    await user.click(screen.getByRole("button", { name: "+ Set" }));
    expect(onAddSet).toHaveBeenCalledWith("m2", { w: 135, r: 5 });
  });

  it("marks the day via a single toggle for a done metric (unmarked → +1)", async () => {
    const user = userEvent.setup();
    const { onQuickLog } = renderQL(doneHabit, {});
    await user.click(screen.getByRole("button", { name: /Mark today/i }));
    expect(onQuickLog).toHaveBeenCalledWith("m3", 1);
  });

  it("clears a marked done metric via the toggle (marked → reset)", async () => {
    const user = userEvent.setup();
    const { onQuickReset } = renderQL(doneHabit, { [todayK()]: { m3: 1 } });
    await user.click(screen.getByRole("button", { name: /Done today/i }));
    expect(onQuickReset).toHaveBeenCalledWith("m3");
  });
});
