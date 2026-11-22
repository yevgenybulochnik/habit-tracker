import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
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
const minHabit: Habit = {
  id: "h3",
  name: "Walk",
  emoji: "🚶",
  color: "Green",
  metrics: [{ id: "m3", name: "Minutes", unit: "min" }],
  intensityMode: "total",
};
const today = "2026-05-24";
const ALL_MONTHS = "Feb – May 2026"; // the default 4 months
const THIS_MONTH = "May 2026"; // zoomed in

function renderCard(
  habit: Habit,
  expanded: boolean,
  logs: HabitLogs = {},
  props: Partial<ComponentProps<typeof HabitCard>> = {},
) {
  const dispatch = vi.fn();
  const view = render(
    <DispatchContext.Provider value={dispatch}>
      <HabitCard
        habit={habit}
        logs={logs}
        units={BUILTIN_UNITS}
        timers={{}}
        appConfig={DEFAULT_CONFIG}
        today={today}
        expanded={expanded}
        {...props}
      />
    </DispatchContext.Provider>,
  );
  return { dispatch, container: view.container };
}

const quickAdd = () => screen.queryByRole("button", { name: "+5" });

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

    it("leaves the calendar alone in Compact view", async () => {
      const { dispatch } = renderCard(repsHabit, false, {}, { logOpen: true });
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

  describe("in Compact view", () => {
    it("keeps its quick-log shut until it's opened", () => {
      renderCard(repsHabit, false);
      expect(quickAdd()).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reading" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      // Its name is still the card's heading
      expect(
        screen.getByRole("heading", { name: "Reading", level: 3 }),
      ).toBeInTheDocument();
    });

    it("asks for its quick-log when tapped, anywhere on the card", async () => {
      const onToggleLog = vi.fn();
      renderCard(repsHabit, false, {}, { onToggleLog });
      await userEvent.click(screen.getByRole("button", { name: "Reading" }));
      await userEvent.click(screen.getByText("Streak"));
      expect(onToggleLog).toHaveBeenCalledTimes(2);
    });

    it("shows its quick-log while open, and logging there keeps it open", async () => {
      const onToggleLog = vi.fn();
      const { dispatch } = renderCard(
        repsHabit,
        false,
        {},
        { logOpen: true, onToggleLog },
      );
      expect(screen.getByRole("button", { name: "Reading" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await userEvent.click(quickAdd()!);
      expect(dispatch).toHaveBeenCalledOnce();
      expect(onToggleLog).not.toHaveBeenCalled();
    });

    it("stays open while its timer runs, though not the one opened", () => {
      renderCard(minHabit, false, {}, { timers: { "h3:m3": Date.now() } });
      expect(screen.getByRole("button", { name: /Stop/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Walk" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    it("shuts while reordering, even with its timer running", () => {
      renderCard(
        minHabit,
        false,
        {},
        { timers: { "h3:m3": Date.now() }, reorderMode: true },
      );
      expect(
        screen.queryByRole("button", { name: /Stop/ }),
      ).not.toBeInTheDocument();
    });

    it("isn't opened by a tap while reordering", async () => {
      const onToggleLog = vi.fn();
      renderCard(
        repsHabit,
        false,
        {},
        { logOpen: true, onToggleLog, reorderMode: true },
      );
      expect(quickAdd()).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Reading" }),
      ).not.toBeInTheDocument();
      await userEvent.click(screen.getByText("Streak"));
      expect(onToggleLog).not.toHaveBeenCalled();
    });
  });

  describe("done today", () => {
    it("is marked, to be shaded in its colour, once today is logged", () => {
      const { container } = renderCard(repsHabit, false, {
        [today]: { m1: 5 },
      });
      expect(container.firstChild).toHaveAttribute("data-done");
    });

    it("isn't marked before today is logged, whatever came before", () => {
      const { container } = renderCard(repsHabit, false, {
        "2026-05-23": { m1: 5 },
      });
      expect(container.firstChild).not.toHaveAttribute("data-done");
    });
  });

  describe("in Calendar view", () => {
    it("always shows its quick-log, and a tap on the card does nothing", async () => {
      const onToggleLog = vi.fn();
      renderCard(repsHabit, true, {}, { onToggleLog });
      expect(quickAdd()).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Reading" }),
      ).not.toBeInTheDocument();
      await userEvent.click(screen.getByText("Streak"));
      expect(onToggleLog).not.toHaveBeenCalled();
    });
  });
});
