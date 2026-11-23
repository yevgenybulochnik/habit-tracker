import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoutineEditor, { newRoutine } from "./RoutineEditor";
import { setsPreset } from "../lib/metrics";
import { resolvePalette } from "../theme";
import type { Habit, Routine } from "../types";

const pushUps: Habit = {
  id: "push",
  name: "Push-ups",
  icon: "flex",
  color: "Orange",
  metrics: [{ id: "r", name: "Reps", mode: "sets", ...setsPreset("reps") }],
  intensityMode: "total",
};
const reading: Habit = {
  id: "read",
  name: "Reading",
  icon: "book",
  color: "Purple",
  metrics: [{ id: "p", name: "Pages", unit: "pages" }],
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
const habits = [pushUps, reading, plank];

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
      by: "time",
      seconds: 60,
      count: 10,
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

function edit(routine: Routine = newRoutine(), isNew = true) {
  const onSave = vi.fn();
  const onDelete = vi.fn();
  const onCancel = vi.fn();
  render(
    <RoutineEditor
      routine={routine}
      isNew={isNew}
      habits={habits}
      theme="dark"
      onSave={onSave}
      onDelete={onDelete}
      onCancel={onCancel}
    />,
  );
  return { onSave, onDelete, onCancel };
}

const save = () => screen.getByRole("button", { name: "Save" });
const steps = () => within(screen.getByRole("list", { name: "Steps" }));
const habitMenus = () => screen.getAllByRole("button", { name: /^Habit:/ });
/** Choose the habit named `name` from a step's menu. */
async function chooseHabit(menu: HTMLElement, name: string) {
  await userEvent.click(menu);
  await userEvent.click(screen.getByRole("option", { name }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RoutineEditor", () => {
  it("can't save a new routine until it's named and has a habit", async () => {
    edit();
    expect(save()).toBeDisabled();
    expect(
      screen.getByText("To save it, give it a name and add a habit."),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Name"), "Evening");
    expect(screen.getByText("To save it, add a habit.")).toBeInTheDocument();
  });

  it("adds a habit step waiting for its habit to be chosen", async () => {
    edit();
    await userEvent.type(screen.getByLabelText("Name"), "Evening");
    await userEvent.click(screen.getByRole("button", { name: "+ Habit" }));
    expect(habitMenus()[0]).toHaveAccessibleName("Habit: Choose a habit");
    expect(
      screen.getByText("To save it, choose each step's habit."),
    ).toBeInTheDocument();
    await chooseHabit(habitMenus()[0], "Reading");
    expect(save()).toBeEnabled();
  });

  it("lists each habit in a step's menu with its icon, in its colour", async () => {
    edit(morning, false);
    expect(habitMenus()[0]).toHaveAccessibleName("Habit: Push-ups");
    expect(habitMenus()[0].querySelector("svg path")).not.toBeNull();
    await userEvent.click(habitMenus()[0]);
    const options = within(
      screen.getByRole("listbox", { name: "Habit" }),
    ).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Push-ups",
      "Reading",
      "Plank",
    ]);
    expect(
      screen.getByRole("option", { name: "Push-ups", selected: true }),
    ).toBeInTheDocument();
    const shade = (o: HTMLElement) =>
      (o.firstElementChild as HTMLElement).style.getPropertyValue("--ic");
    expect(options.map(shade)).toEqual(
      ["Orange", "Purple", "Green"].map(
        (c) => resolvePalette(c, "dark").shades[4],
      ),
    );
    for (const o of options) expect(o.querySelector("svg path")).not.toBeNull();
  });

  it("saves what was made, its name trimmed", async () => {
    const { onSave } = edit();
    await userEvent.type(screen.getByLabelText("Name"), "  Evening ");
    await userEvent.click(screen.getByRole("button", { name: "+ Habit" }));
    await chooseHabit(habitMenus()[0], "Reading");
    await userEvent.click(screen.getByRole("button", { name: "+ Break" }));
    await userEvent.click(screen.getByRole("button", { name: "More rounds" }));
    await userEvent.selectOptions(screen.getByLabelText("Get ready"), "0:10");
    await userEvent.click(save());
    const saved: Routine = onSave.mock.calls[0][0];
    expect(saved).toMatchObject({ name: "Evening", rounds: 2, prep: 10 });
    expect(saved.steps).toMatchObject([
      {
        kind: "habit",
        habitId: "read",
        metricId: "p",
        by: "time",
        seconds: 60,
      },
      { kind: "break", seconds: 30 },
    ]);
  });

  it("does a counted habit for its time or for a count in its own unit", async () => {
    const { onSave } = edit(morning, false);
    const push = steps().getAllByRole("listitem")[0];
    const by = within(push).getByRole("group", { name: "Done by" });
    expect(
      within(by)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Time", "Reps"]);
    await userEvent.click(within(by).getByRole("button", { name: "Reps" }));
    const count = within(push).getByRole("textbox", { name: "Count" });
    await userEvent.clear(count);
    await userEvent.type(count, "15");
    expect(within(push).getByText("logged at Done")).toBeInTheDocument();
    await userEvent.click(save());
    expect(onSave.mock.calls[0][0].steps[0]).toMatchObject({
      by: "count",
      count: 15,
    });
  });

  it("shows a break as one, with its icon drawn", () => {
    edit(morning, false);
    const pause = steps().getAllByRole("listitem")[1];
    const label = within(pause).getByText("Break");
    expect(label.textContent).toBe("Break");
    expect(label.parentElement!.querySelector("svg path")).not.toBeNull();
  });

  it("gives only a counted habit the choice", () => {
    edit(morning, false);
    // Push-ups count; the plank logs minutes.
    expect(screen.getAllByRole("group", { name: "Done by" })).toHaveLength(1);
    expect(screen.getByText("logs the minutes")).toBeInTheDocument();
  });

  it("times a counted step given a habit that doesn't count", async () => {
    const counted = {
      ...morning,
      steps: [{ ...morning.steps[0], by: "count" as const }],
    };
    const { onSave } = edit(counted, false);
    await chooseHabit(habitMenus()[0], "Plank");
    await userEvent.click(save());
    expect(onSave.mock.calls[0][0].steps[0]).toMatchObject({
      habitId: "plank",
      by: "time",
    });
  });

  it("needs each counted step's count", async () => {
    edit(morning, false);
    const push = steps().getAllByRole("listitem")[0];
    await userEvent.click(within(push).getByRole("button", { name: "Reps" }));
    await userEvent.clear(within(push).getByRole("textbox", { name: "Count" }));
    expect(
      screen.getByText("To save it, give each counted step its count."),
    ).toBeInTheDocument();
  });

  it("changes a step's time, and removes a step", async () => {
    const { onSave } = edit(morning, false);
    const [push, pause] = steps().getAllByRole("listitem");
    await userEvent.selectOptions(
      within(push).getByRole("combobox", { name: "Time" }),
      "0:45",
    );
    await userEvent.click(
      within(pause).getByRole("button", { name: "Remove" }),
    );
    await userEvent.click(save());
    const saved: Routine = onSave.mock.calls[0][0];
    expect(saved.steps.map((s) => s.seconds)).toEqual([45, 60]);
  });

  it("keeps at least one round", async () => {
    edit({ ...morning, rounds: 1 }, false);
    await userEvent.click(screen.getByRole("button", { name: "Fewer rounds" }));
    expect(screen.getByLabelText("Rounds")).toHaveTextContent("1");
  });

  it("says how long it takes", () => {
    edit(morning, false);
    expect(
      screen.getByText("5:00 in all. The last round skips its closing break."),
    ).toBeInTheDocument();
  });

  it("says when its counted steps take as long as they take", async () => {
    edit(morning, false);
    const push = steps().getAllByRole("listitem")[0];
    await userEvent.click(within(push).getByRole("button", { name: "Reps" }));
    expect(
      screen.getByText(
        "Counted steps at your own pace, and 3:00 of timed steps. The last round skips its closing break.",
      ),
    ).toBeInTheDocument();
  });

  it("deletes a routine once you're sure, but not a new one", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onDelete } = edit(morning, false);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(confirm).toHaveBeenCalledWith(
      "Delete Morning? What it logged stays logged.",
    );
    expect(onDelete).toHaveBeenCalledWith("r1");
  });

  it("has no Delete for a new routine, and cancels", async () => {
    const { onCancel } = edit();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
