import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoutineRunner from "./RoutineRunner";
import { setsPreset } from "../lib/metrics";
import {
  phaseAt,
  schedule,
  type Ends,
  type Result,
  type Run,
} from "../lib/routineRun";
import type { RoutineEngine } from "../hooks/useRoutineRun";
import type { Habit, HabitStep, Logs, Routine } from "../types";

const TODAY = "2026-11-22";
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

const step = (
  habitId: string,
  metricId: string,
  over: Partial<HabitStep> = {},
): HabitStep => ({
  kind: "habit",
  id: `${habitId}-step`,
  habitId,
  metricId,
  by: "time",
  seconds: 60,
  count: 10,
  ...over,
});
// A minute of push-ups, a 30 s break, a minute of plank: twice.
const timed: Routine = {
  id: "r1",
  name: "Morning",
  rounds: 2,
  prep: 5,
  steps: [
    step("push", "r"),
    { kind: "break", id: "b", seconds: 30 },
    step("plank", "m"),
  ],
};
// The same with the push-ups done for a count of 10.
const counted: Routine = {
  ...timed,
  steps: [step("push", "r", { by: "count" }), ...timed.steps.slice(1)],
};

/** A stand-in for the engine, `seconds` into a run of `routine`. */
function engineAt(
  routine: Routine,
  seconds: number,
  {
    results = {},
    ends = {},
    paused = false,
  }: { results?: Record<string, Result>; ends?: Ends; paused?: boolean } = {},
): RoutineEngine {
  const slots = schedule(routine, ends);
  const phase = phaseAt(slots, seconds, routine.prep);
  const run: Run = {
    routine,
    startedAt: 0,
    pausedMs: 0,
    shiftMs: 0,
    ends,
    results,
    ...(paused && { pausedAt: 0 }),
    finished: phase.kind === "done",
  };
  return {
    run,
    routine,
    slots,
    seconds,
    phase,
    running: !paused && phase.kind !== "done",
    actions: {
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      next: vi.fn(),
      back: vi.fn(),
      done: vi.fn(),
      logCount: vi.fn(),
      skipCount: vi.fn(),
      end: vi.fn(),
    },
  };
}

function show(engine: RoutineEngine, logs: Logs = {}) {
  const onMinimize = vi.fn();
  render(
    <RoutineRunner
      engine={engine}
      habits={habits}
      logs={logs}
      theme="dark"
      today={TODAY}
      onMinimize={onMinimize}
    />,
  );
  return { actions: engine.actions, onMinimize };
}

const centre = () => screen.getByTestId("centre").textContent;
const log = () => screen.getByRole("list", { name: "Log" });
const logged: Result = { status: "logged", amount: 12, text: "12 reps" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RoutineRunner: the timer", () => {
  it("counts down the get-ready", () => {
    show(engineAt(timed, -3));
    expect(centre()).toContain("0:03");
    expect(centre()).toContain("Get ready");
  });

  it("counts down a timed habit, with the time left in the routine", () => {
    show(engineAt(timed, 20));
    expect(centre()).toContain("0:40");
    expect(centre()).toContain("Push-ups");
    expect(screen.getByText("Round 1 of 2 · 4:40 left")).toBeInTheDocument();
  });

  it("names what's next during a break", () => {
    show(engineAt(timed, 70));
    expect(centre()).toContain("Break");
    expect(screen.getByText("up next · Plank")).toBeInTheDocument();
  });

  it("pauses and resumes", async () => {
    const { actions } = show(engineAt(timed, 20));
    await userEvent.click(screen.getByTitle("Pause"));
    expect(actions.pause).toHaveBeenCalled();
  });

  it("offers Resume while paused", async () => {
    const { actions } = show(engineAt(timed, 20, { paused: true }));
    await userEvent.click(screen.getByTitle("Resume"));
    expect(actions.resume).toHaveBeenCalled();
  });

  it("skips, goes back, minimises, and ends once you're sure", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { actions, onMinimize } = show(engineAt(timed, 20));
    await userEvent.click(screen.getByTitle("Skip"));
    await userEvent.click(screen.getByTitle("Back"));
    await userEvent.click(screen.getByTitle(/Minimise/));
    await userEvent.click(screen.getByRole("button", { name: "End" }));
    expect(actions.next).toHaveBeenCalled();
    expect(actions.back).toHaveBeenCalled();
    expect(onMinimize).toHaveBeenCalled();
    expect(confirm).toHaveBeenCalled();
    expect(actions.end).toHaveBeenCalled();
  });

  it("shows a counted step's count and stopwatch, with Done for Pause", async () => {
    const { actions } = show(engineAt(counted, 41.4));
    expect(centre()).toContain("10");
    expect(centre()).toContain("Push-ups");
    expect(centre()).toContain("0:41");
    expect(screen.getByText("Round 1 of 2 · 0:41 in")).toBeInTheDocument();
    expect(screen.queryByTitle("Pause")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTitle("Done"));
    expect(actions.done).toHaveBeenCalled();
  });
});

describe("RoutineRunner: the log", () => {
  it("asks for a counted habit's count as the timer reaches it", async () => {
    const engine = engineAt(timed, 20);
    const { actions } = show(engine);
    const entry = within(log())
      .getByText(/How many push-ups/)
      .closest("li")!;
    await userEvent.click(within(entry).getByRole("button", { name: "+5" }));
    await userEvent.click(within(entry).getByRole("button", { name: "+" }));
    await userEvent.click(
      within(entry).getByRole("button", { name: /^Log 6 reps/ }),
    );
    expect(actions.logCount).toHaveBeenCalledWith(engine.slots[0], 6, {});
  });

  it("suggests the habit's latest count", () => {
    show(engineAt(timed, 20), {
      push: { "2026-11-21": { r: [{ r: 14 }] } },
    });
    expect(within(log()).getByRole("textbox")).toHaveValue("14");
  });

  it("folds a logged count to a line, to change or remove", async () => {
    const engine = engineAt(timed, 100, { results: { "0:0": logged } });
    const { actions } = show(engine);
    await userEvent.click(
      within(log()).getByRole("button", { name: "Change Push-ups R1" }),
    );
    const box = within(log()).getByRole("textbox");
    await userEvent.clear(box);
    await userEvent.type(box, "15");
    await userEvent.click(
      within(log()).getByRole("button", { name: /Change to 15/ }),
    );
    expect(actions.logCount).toHaveBeenCalledWith(engine.slots[0], 15, {});
  });

  it("removes a logged count", async () => {
    const engine = engineAt(timed, 100, { results: { "0:0": logged } });
    const { actions } = show(engine);
    await userEvent.click(
      within(log()).getByRole("button", { name: /Change Push-ups/ }),
    );
    await userEvent.click(
      within(log()).getByRole("button", { name: "Remove" }),
    );
    expect(actions.skipCount).toHaveBeenCalledWith(engine.slots[0]);
  });

  it("shows a habit that logs itself once it has, to take back", async () => {
    const minute: Result = { status: "logged", amount: 1, text: "1m" };
    const engine = engineAt(timed, 160, {
      results: { "0:0": logged, "0:2": minute },
    });
    const { actions } = show(engine);
    const line = within(log()).getByRole("button", { name: "Change Plank R1" });
    expect(line).toHaveTextContent("1m");
    await userEvent.click(line);
    await userEvent.click(
      within(log()).getByRole("button", { name: "Remove" }),
    );
    expect(actions.skipCount).toHaveBeenCalledWith(engine.slots[2]);
  });

  it("logs a habit that logs itself again once it was taken back", async () => {
    const engine = engineAt(timed, 160, {
      results: { "0:0": logged, "0:2": { status: "skipped" } },
    });
    const { actions } = show(engine);
    await userEvent.click(
      within(log()).getByRole("button", { name: "Change Plank R1" }),
    );
    await userEvent.click(
      within(log()).getByRole("button", { name: "Log 1m" }),
    );
    expect(actions.logCount).toHaveBeenCalledWith(engine.slots[2], 1, {});
  });

  it("puts the newest first", () => {
    show(engineAt(timed, 200, { results: { "0:0": logged } }));
    const names = within(log())
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(names[0]).toMatch(/push-ups/i);
    expect(names[0]).toMatch(/R2/);
  });

  it("gives a counted step's time on its line", () => {
    show(
      engineAt(counted, 50, {
        ends: { "0:0": 41 },
        results: { "0:0": { status: "logged", amount: 10, text: "10 reps" } },
      }),
    );
    expect(
      within(log()).getByRole("button", { name: "Change Push-ups R1" }),
    ).toHaveTextContent("10 reps in 0:41");
  });
});

describe("RoutineRunner: the end", () => {
  const all: Record<string, Result> = {
    "0:0": logged,
    "1:0": logged,
    "0:2": { status: "logged", amount: 1, text: "1m" },
    "1:2": { status: "logged", amount: 1, text: "1m" },
  };

  it("says it's done, with the time in all, and Done closes it", async () => {
    const { actions } = show(engineAt(timed, 400, { results: all }));
    expect(centre()).toContain("Done");
    expect(centre()).toContain("5:00");
    expect(screen.getByText("Finished · 5:00 in all")).toBeInTheDocument();
    expect(screen.getByText("all logged")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "End" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(actions.end).toHaveBeenCalled();
  });

  it("asks first when a count is still to be entered", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { "1:0": _, ...missing } = all;
    const { actions } = show(engineAt(timed, 400, { results: missing }));
    expect(screen.getByText("1 to log below")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(confirm).toHaveBeenCalledWith(
      "A habit has no count yet. Finish without logging it?",
    );
    expect(actions.end).not.toHaveBeenCalled();
  });
});
