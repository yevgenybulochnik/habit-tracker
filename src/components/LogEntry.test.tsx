import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LogEntry from "./LogEntry";
import { BUILTIN_UNITS } from "../constants";
import { todayK } from "../lib/dates";
import type { Habit, Logs } from "../types";

const habits: Habit[] = [
  { id: "h1", name: "Run", emoji: "🏃", color: "Green", metrics: [{ id: "m1", name: "Minutes", unit: "min" }] },
];

function renderLog(overrides = {}) {
  const props = {
    habits, allLogs: {} as Logs, units: BUILTIN_UNITS,
    onSaveLog: vi.fn(), selectedDate: todayK(), onDateChange: vi.fn(),
    timers: {}, onStopTimer: vi.fn(), theme: "dark" as const, ...overrides,
  };
  render(<LogEntry {...props} />);
  return props;
}

describe("LogEntry", () => {
  it("saves parsed numeric values", async () => {
    const user = userEvent.setup();
    const { onSaveLog } = renderLog();
    await user.type(screen.getByPlaceholderText("0"), "45");
    await user.click(screen.getByRole("button", { name: /Save Log/i }));
    expect(onSaveLog).toHaveBeenCalledWith(todayK(), { h1: { m1: 45 } });
  });

  it("navigates to the previous day", async () => {
    const user = userEvent.setup();
    const { onDateChange } = renderLog();
    await user.click(screen.getByRole("button", { name: "‹" }));
    expect(onDateChange).toHaveBeenCalledTimes(1);
    expect(onDateChange.mock.calls[0][0]).not.toBe(todayK());
  });
});
