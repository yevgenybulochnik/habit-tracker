import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Routines from "./Routines";
import type { Action } from "../lib/state";
import type { Habit, Routine } from "../types";

const plank: Habit = {
  id: "plank",
  name: "Plank",
  emoji: "🧘",
  color: "Green",
  metrics: [{ id: "m", name: "Time", unit: "min" }],
  intensityMode: "total",
};
const morning: Routine = {
  id: "r1",
  name: "Morning",
  rounds: 1,
  prep: 5,
  steps: [
    {
      kind: "habit",
      id: "s1",
      habitId: "plank",
      metricId: "m",
      by: "time",
      seconds: 60,
      count: 10,
    },
  ],
};

function show(open = true) {
  const dispatch = vi.fn<(a: Action) => void>();
  const onBack = vi.fn();
  render(
    <Routines
      habits={[plank]}
      logs={{}}
      routines={[morning]}
      theme="dark"
      today="2026-11-22"
      dispatch={dispatch}
      open={open}
      onBack={onBack}
    />,
  );
  return { dispatch, onBack };
}

beforeEach(() => {
  localStorage.clear();
});

describe("Routines", () => {
  it("shows nothing while closed with no run", () => {
    show(false);
    expect(screen.queryByRole("heading", { name: "Routines" })).toBeNull();
  });

  it("runs a routine over the page, minimised to a button and back", async () => {
    show();
    await userEvent.click(
      screen.getByRole("button", { name: "Start Morning" }),
    );
    expect(screen.getByText("Get ready")).toBeInTheDocument();
    await userEvent.click(screen.getByTitle(/Minimise/));
    expect(screen.queryByText("Get ready")).toBeNull();
    const pill = screen.getByTitle("Back to the routine");
    expect(pill).toHaveTextContent(/0:0\d/);
    await userEvent.click(pill);
    expect(screen.getByText("Get ready")).toBeInTheDocument();
  });

  it("keeps the run up while the page is closed", async () => {
    show();
    await userEvent.click(
      screen.getByRole("button", { name: "Start Morning" }),
    );
    await userEvent.click(screen.getByTitle(/Minimise/));
    // A run in localStorage is picked up by the next mount.
    expect(localStorage.length).toBe(1);
  });

  it("adds a new routine and updates one that exists", async () => {
    const { dispatch } = show();
    await userEvent.click(screen.getByRole("button", { name: "Edit Morning" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(dispatch).toHaveBeenCalledWith({
      type: "routine/update",
      routine: morning,
    });

    await userEvent.click(screen.getByRole("button", { name: /New Routine/ }));
    await userEvent.type(screen.getByLabelText("Name"), "Lunch");
    await userEvent.click(screen.getByRole("button", { name: "+ Habit" }));
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Habit" }),
      "🧘 Plank",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(dispatch.mock.lastCall![0]).toMatchObject({
      type: "routine/add",
      routine: { name: "Lunch" },
    });
  });

  it("deletes a routine", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { dispatch } = show();
    await userEvent.click(screen.getByRole("button", { name: "Edit Morning" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "routine/delete", id: "r1" });
  });

  it("goes back to the habits", async () => {
    const { onBack } = show();
    await userEvent.click(screen.getByTitle("Back to habits"));
    expect(onBack).toHaveBeenCalled();
  });
});
