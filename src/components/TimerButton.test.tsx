import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TimerButton from "./TimerButton";
import { resolvePalette } from "../theme";

const pal = resolvePalette("Green", "dark");
const props = { onStart: vi.fn(), onStop: vi.fn(), pal };

// Play and stop are drawn: ▶ comes out as an iPhone's emoji.
describe("TimerButton", () => {
  it("draws its play icon beside Timer, and stop beside Stop", () => {
    const { rerender } = render(<TimerButton {...props} compact />);
    const button = screen.getByRole("button", { name: "Timer" });
    expect(button.textContent).toBe("Timer");
    expect(button.querySelector("svg path")).not.toBeNull();
    rerender(<TimerButton {...props} compact startTime={Date.now()} />);
    const stop = screen.getByRole("button", { name: "Stop" });
    expect(stop.querySelector("svg path")).not.toBeNull();
  });

  it("is named by its title when it's only its icon", () => {
    const { rerender } = render(<TimerButton {...props} />);
    expect(
      screen.getByRole("button", { name: "Start timer" }).textContent,
    ).toBe("");
    rerender(<TimerButton {...props} startTime={Date.now()} />);
    // ...and by its clock while it runs
    const stop = screen.getByTitle("Stop and log");
    expect(stop).toHaveAccessibleName("00:00");
    expect(stop.querySelector("svg path")).not.toBeNull();
  });
});
