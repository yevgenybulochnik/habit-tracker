import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoutinesView from "./RoutinesView";
import { setsPreset } from "../lib/metrics";
import type { Habit, Routine } from "../types";

const pushUps: Habit = {
  id: "push",
  name: "Push-ups",
  icon: "flex",
  color: "Orange",
  metrics: [{ id: "r", name: "Reps", mode: "sets", ...setsPreset("reps") }],
  intensityMode: "total",
};
const plank: Habit = {
  id: "plank",
  name: "Plank",
  icon: "meditation",
  color: "Green",
  metrics: [{ id: "m", name: "Time", unit: "min" }],
  intensityMode: "total",
};
const habits = [pushUps, plank];

const morning: Routine = {
  id: "r1",
  name: "Morning",
  rounds: 2,
  prep: 5,
  steps: [
    {
      kind: "habit",
      id: "s1",
      habitId: "push",
      metricId: "r",
      by: "count",
      seconds: 60,
      count: 15,
    },
    { kind: "break", id: "s2", seconds: 30 },
    {
      kind: "habit",
      id: "s3",
      habitId: "plank",
      metricId: "m",
      by: "time",
      seconds: 60,
      count: 10,
    },
  ],
};
const evening: Routine = {
  ...morning,
  id: "r2",
  name: "Evening",
  rounds: 1,
  steps: [morning.steps[2]],
};

function view(over: Partial<Parameters<typeof RoutinesView>[0]> = {}) {
  const props = {
    habits,
    routines: [morning, evening],
    theme: "dark" as const,
    runningId: undefined,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onStart: vi.fn(),
    onOpenRun: vi.fn(),
    onBack: vi.fn(),
  };
  render(<RoutinesView {...props} {...over} />);
  return props;
}

const card = (name: string) =>
  screen.getByRole("button", { name: `Edit ${name}` }).closest("li")!;

describe("RoutinesView", () => {
  it("lists the routines with their rounds, length and habits", () => {
    view();
    expect(screen.getByText("2 routines")).toBeInTheDocument();
    expect(
      within(card("Morning")).getByText("2 rounds · at your pace"),
    ).toBeInTheDocument();
    expect(
      within(card("Morning")).getByText("15 Push-ups → Plank"),
    ).toBeInTheDocument();
    expect(
      within(card("Evening")).getByText("1 round · 1:00"),
    ).toBeInTheDocument();
  });

  it("starts a routine", async () => {
    const { onStart } = view();
    await userEvent.click(
      screen.getByRole("button", { name: "Start Morning" }),
    );
    expect(onStart).toHaveBeenCalledWith(morning);
  });

  it("opens the routine being run, and won't start another meanwhile", async () => {
    const { onOpenRun } = view({ runningId: "r1" });
    await userEvent.click(
      within(card("Morning")).getByRole("button", { name: "Open" }),
    );
    expect(onOpenRun).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Start Evening" }),
    ).toBeDisabled();
  });

  it("won't start a routine with no habits left in it", () => {
    view({ routines: [{ ...morning, steps: [morning.steps[1]] }] });
    expect(
      screen.getByRole("button", { name: "Start Morning" }),
    ).toBeDisabled();
  });

  it("edits a routine on its own page, and saves it", async () => {
    const { onSave } = view();
    await userEvent.click(screen.getByRole("button", { name: "Edit Morning" }));
    expect(
      screen.getByRole("heading", { name: "Edit routine" }),
    ).toBeInTheDocument();
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Early");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({ ...morning, name: "Early" });
    expect(
      screen.getByRole("heading", { name: "Routines" }),
    ).toBeInTheDocument();
  });

  it("makes a new routine", async () => {
    const { onSave } = view();
    await userEvent.click(screen.getByRole("button", { name: /New Routine/ }));
    expect(
      screen.getByRole("heading", { name: "New routine" }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Name"), "Lunch");
    await userEvent.click(screen.getByRole("button", { name: "+ Habit" }));
    await userEvent.click(screen.getByRole("button", { name: /^Habit:/ }));
    await userEvent.click(screen.getByRole("option", { name: "Plank" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: "Lunch", rounds: 1 });
  });

  it("deletes a routine from its editor", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onDelete } = view();
    await userEvent.click(screen.getByRole("button", { name: "Edit Evening" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("r2");
  });

  it("goes back from the editor to the list, and from the list to the habits", async () => {
    const { onBack } = view();
    await userEvent.click(screen.getByRole("button", { name: "Edit Morning" }));
    await userEvent.click(screen.getByTitle("Back to routines"));
    expect(
      screen.getByRole("heading", { name: "Routines" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByTitle("Back to habits"));
    expect(onBack).toHaveBeenCalled();
  });

  it("explains routines when there are none", () => {
    view({ routines: [] });
    expect(screen.getByText("No routines yet")).toBeInTheDocument();
    expect(
      screen.getByText("Habits back to back, with breaks"),
    ).toBeInTheDocument();
  });

  it("asks for a habit before a routine can be made", () => {
    view({ routines: [], habits: [] });
    expect(
      screen.getByText(/Add a habit to use in one first/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New Routine/ })).toBeDisabled();
  });
});
