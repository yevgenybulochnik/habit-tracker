import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HabitCard from "./HabitCard";
import { DispatchContext } from "../hooks/useHabitActions";
import { BUILTIN_UNITS, DEFAULT_CONFIG } from "../lib/defaults";
import { setsPreset } from "../lib/metrics";
import type { Habit, HabitLogs } from "../types";

const repsHabit: Habit = {
  id: "h1",
  name: "Reading",
  emoji: "📚",
  color: "Green",
  metrics: [{ id: "m1", name: "Reps", unit: "reps" }],
  intensityMode: "total",
};
const setsHabit: Habit = {
  id: "h2",
  name: "Lift",
  emoji: "🏋️",
  color: "Blue",
  metrics: [
    { id: "m2", name: "Bench", mode: "sets", ...setsPreset("weighted", "lbs") },
  ],
  intensityMode: "total",
};
const today = "2026-05-24";
const ALL_MONTHS = "Feb – May 2026"; // the default 4 months
const THIS_MONTH = "May 2026"; // zoomed in

function renderCard(habit: Habit, expanded: boolean, logs: HabitLogs = {}) {
  const dispatch = vi.fn();
  render(
    <DispatchContext.Provider value={dispatch}>
      <HabitCard
        habit={habit}
        logs={logs}
        units={BUILTIN_UNITS}
        timers={{}}
        appConfig={DEFAULT_CONFIG}
        today={today}
        expanded={expanded}
      />
    </DispatchContext.Provider>,
  );
  return { dispatch };
}

beforeEach(() => {
  // The calendar measures its width, which jsdom can't do
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup(); // unmount while the ResizeObserver stub is still there
  vi.unstubAllGlobals();
});

describe("HabitCard", () => {
  describe("logging today from quick-log", () => {
    it("zooms the expanded calendar in to this month", async () => {
      const { dispatch } = renderCard(repsHabit, true);
      expect(screen.getByText(ALL_MONTHS)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "+5" }));
      expect(screen.getByText(THIS_MONTH)).toBeInTheDocument();
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "log/add", amount: 5 }),
      );
    });

    it("zooms in when a set is added, too", async () => {
      const { dispatch } = renderCard(setsHabit, true);
      await userEvent.type(screen.getByPlaceholderText("Weight"), "135");
      await userEvent.type(screen.getByPlaceholderText("Reps"), "5");
      await userEvent.click(screen.getByRole("button", { name: "+ Set" }));

      expect(screen.getByText(THIS_MONTH)).toBeInTheDocument();
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "log/addSet", set: { w: 135, r: 5 } }),
      );
    });

    it("leaves the calendar alone in Quick view", async () => {
      const { dispatch } = renderCard(repsHabit, false);
      await userEvent.click(screen.getByRole("button", { name: "+5" }));

      expect(screen.getByText(ALL_MONTHS)).toBeInTheDocument();
      expect(dispatch).toHaveBeenCalledOnce();
    });

    it("leaves the calendar alone when today's value is reset", async () => {
      const { dispatch } = renderCard(repsHabit, true, { [today]: { m1: 5 } });
      await userEvent.click(screen.getByRole("button", { name: "↺" }));

      expect(screen.getByText(ALL_MONTHS)).toBeInTheDocument();
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "log/reset" }),
      );
    });
  });
});
