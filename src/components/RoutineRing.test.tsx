import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RoutineRing from "./RoutineRing";
import { phaseAt, schedule, type Slot } from "../lib/routineRun";
import type { HabitStep, Routine } from "../types";

const timed = (id: string, seconds: number): HabitStep => ({
  kind: "habit",
  id,
  habitId: "h",
  metricId: "m",
  by: "time",
  seconds,
  count: 10,
});
// A minute of a habit, a 30 s break, a minute of another: twice.
const routine: Routine = {
  id: "r",
  name: "Morning",
  rounds: 2,
  prep: 5,
  steps: [
    timed("a", 60),
    { kind: "break", id: "b", seconds: 30 },
    timed("c", 60),
  ],
};

function draw(
  seconds: number,
  { ends = {}, skipped = () => false, r = routine } = {} as {
    ends?: Record<string, number>;
    skipped?: (s: Slot) => boolean;
    r?: Routine;
  },
) {
  const slots = schedule(r, ends);
  const { container } = render(
    <RoutineRing
      slots={slots}
      seconds={seconds}
      phase={phaseAt(slots, seconds, r.prep)}
      colorOf={(step) => (step.kind === "break" ? "grey" : "orange")}
      skipped={skipped}
    >
      <span>1:00</span>
    </RoutineRing>,
  );
  const progress = (selector: string) =>
    Number(container.querySelector(selector)?.getAttribute("data-progress"));
  return {
    segments: () =>
      [...container.querySelectorAll("[data-slot]")].map((g) => ({
        key: g.getAttribute("data-slot"),
        progress: Number(g.getAttribute("data-progress")),
        color: (g as SVGGElement).style.stroke,
      })),
    hand: () => progress("[data-ring=inner]"),
  };
}

describe("RoutineRing", () => {
  it("cuts the outer ring into every slot of the run, in their colours", () => {
    const { segments } = draw(0);
    expect(segments().map((s) => [s.key, s.color])).toEqual([
      ["0:0", "orange"],
      ["0:1", "grey"],
      ["0:2", "orange"],
      ["1:0", "orange"],
      ["1:1", "grey"],
      ["1:2", "orange"],
    ]);
  });

  it("fills each slot as the run goes through it", () => {
    const { segments } = draw(75); // halfway through the first break
    expect(segments().map((s) => s.progress)).toEqual([1, 0.5, 0, 0, 0, 0]);
  });

  it("leaves a habit that was skipped unfilled", () => {
    const { segments } = draw(75, { skipped: (s) => s.key === "0:0" });
    expect(segments()[0].progress).toBe(0);
  });

  it("drains the inner ring through the current slot", () => {
    expect(draw(15).hand()).toBe(0.75);
  });

  it("drains it through the get-ready too", () => {
    expect(draw(-1).hand()).toBeCloseTo(0.2);
  });

  it("lights a counted step under way, and sweeps its stopwatch", () => {
    const counted = {
      ...routine,
      steps: [{ ...timed("a", 60), by: "count" as const }, timed("c", 60)],
    };
    const { segments, hand } = draw(75, { r: counted });
    expect(segments()[0].progress).toBe(1);
    expect(hand()).toBe(0.25); // 75 s: a minute round, and a quarter
  });

  it("closes the inner ring once the run's done", () => {
    expect(draw(500).hand()).toBe(1);
  });

  it("shows what's under way in the middle", () => {
    draw(0);
    expect(screen.getByText("1:00")).toBeInTheDocument();
  });
});
