import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CalendarPanel from "./CalendarPanel";
import { BUILTIN_UNITS, DEFAULT_CONFIG } from "../lib/defaults";
import { INITIAL_NAV, type CalendarNav } from "../lib/calendarNav";
import { PALETTES } from "../theme";
import type { Habit, HabitLogs } from "../types";

const habit: Habit = {
  id: "h1",
  name: "Reading",
  icon: "book",
  color: "Green",
  metrics: [{ id: "m1", name: "Reps", unit: "reps" }],
  intensityMode: "total",
};
const pal = PALETTES[0];
const today = "2026-05-24";
const ZOOMED: CalendarNav = { offset: 0, zoomed: true, view: "calendar" };

function renderPanel(over: Partial<Parameters<typeof CalendarPanel>[0]> = {}) {
  const props = {
    habit,
    logs: {} as HabitLogs,
    units: BUILTIN_UNITS,
    config: DEFAULT_CONFIG, // 4 months
    today,
    pal,
    expanded: false, // the chrome renders either way; d3 draws only expanded
    nav: INITIAL_NAV,
    onNav: vi.fn(),
    selectedDate: null,
    onTapDay: vi.fn(),
    ...over,
  };
  const { container, rerender } = render(<CalendarPanel {...props} />);
  return {
    ...props,
    container,
    /** Render again with some props changed. */
    rerender: (more: Partial<typeof props>) =>
      rerender(<CalendarPanel {...props} {...more} />),
  };
}

/** A drawn day cell, found through its d3 datum like the E2E helpers do. */
function cell(container: HTMLElement, key: string): SVGRectElement {
  const rect = [...container.querySelectorAll<SVGRectElement>("rect.dc")].find(
    (r) => (r as unknown as { __data__: { key: string } }).__data__.key === key,
  );
  if (!rect) throw new Error(`no cell for ${key}`);
  return rect;
}

beforeEach(() => {
  // The panel measures its width, which jsdom can't do
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

describe("CalendarPanel", () => {
  it("shows the months in range", () => {
    renderPanel();
    expect(screen.getByText("Feb – May 2026")).toBeInTheDocument();
  });

  it("shows earlier months when navigated back", () => {
    renderPanel({ nav: { ...INITIAL_NAV, offset: -4 } });
    expect(screen.getByText("Oct – Jan 2026")).toBeInTheDocument();
  });

  it("shows just this month when zoomed", () => {
    renderPanel({ nav: ZOOMED });
    expect(screen.getByText("May 2026")).toBeInTheDocument();
  });

  it("steps back and forward by the configured number of months", async () => {
    const { onNav } = renderPanel({
      config: { ...DEFAULT_CONFIG, numMonths: 6 },
    });
    await userEvent.click(screen.getByRole("button", { name: "‹" }));
    expect(onNav).toHaveBeenLastCalledWith({ type: "back", months: 6 });
    await userEvent.click(screen.getByRole("button", { name: "›" }));
    expect(onNav).toHaveBeenLastCalledWith({ type: "forward", months: 6 });
  });

  it("switches the view", async () => {
    const { onNav } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Cal" }));
    expect(onNav).toHaveBeenLastCalledWith({ type: "view", view: "calendar" });
  });

  it("can't go forward or show the heatmap while zoomed", () => {
    renderPanel({ nav: ZOOMED });
    expect(screen.getByRole("button", { name: "›" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Heat" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cal" })).toBeEnabled();
  });

  it("draws nothing while collapsed", () => {
    const { container } = renderPanel();
    expect(container.querySelectorAll("rect.dc")).toHaveLength(0);
  });

  describe("expanded", () => {
    it("draws a cell for every day in range", () => {
      const { container } = renderPanel({ expanded: true });
      // Feb–May 2026: 28 + 31 + 30 + 31
      expect(container.querySelectorAll("rect.dc")).toHaveLength(120);
    });

    it("reports a tapped past day, and ignores future ones", () => {
      const { container, onTapDay } = renderPanel({ expanded: true });
      fireEvent.click(cell(container, "2026-05-10"));
      expect(onTapDay).toHaveBeenCalledWith("2026-05-10");

      fireEvent.click(cell(container, "2026-05-30"));
      expect(onTapDay).toHaveBeenCalledOnce();
    });

    it("outlines the selected day in the habit's colour", () => {
      const { container } = renderPanel({
        expanded: true,
        selectedDate: "2026-05-10",
      });
      const rect = cell(container, "2026-05-10");
      expect(rect.getAttribute("stroke")).toBe(pal.shades[4]);
      expect(rect.getAttribute("stroke-width")).toBe("2.5");
    });

    it("shows a tooltip for a logged day on hover", () => {
      const { container } = renderPanel({
        expanded: true,
        logs: { "2026-05-10": { m1: 20 } },
      });
      fireEvent.mouseEnter(cell(container, "2026-05-10"));
      expect(screen.getByText("Sun, May 10, 2026")).toBeInTheDocument();

      fireEvent.mouseLeave(cell(container, "2026-05-10"));
      expect(screen.queryByText("Sun, May 10, 2026")).not.toBeInTheDocument();
    });
  });

  describe("a habit due less often: each log ringed with the days it covers", () => {
    const every2: Habit = { ...habit, period: { every: 2, unit: "day" } };
    const logged = (...days: string[]): HabitLogs =>
      Object.fromEntries(days.map((d) => [d, { m1: 5 }]));
    const ringEls = (container: HTMLElement) => [
      ...container.querySelectorAll<SVGPathElement>("path.ring"),
    ];
    /** Each ring's block (the day of its log) and its place in the block. */
    const rings = (container: HTMLElement) =>
      ringEls(container).map(
        (r) => (r as unknown as { __data__: { key: string } }).__data__.key,
      );

    it("rings each log's days", () => {
      const { container } = renderPanel({
        expanded: true,
        habit: every2,
        logs: logged("2026-05-20", "2026-05-22"),
      });
      // Wed 20–Thu 21 and Fri 22–Sat 23, each down one heatmap column
      expect(rings(container)).toEqual(["2026-05-20#0", "2026-05-22#0"]);
      for (const r of ringEls(container)) {
        expect(r.getAttribute("stroke")).toBe(pal.shades[4]);
        expect(r.getAttribute("fill")).toBe("none");
      }
    });

    it("rings nothing for a habit due every day", () => {
      const { container } = renderPanel({
        expanded: true,
        logs: logged("2026-05-20", "2026-05-22"),
      });
      expect(rings(container)).toEqual([]);
    });

    it("fades the rings in once the cells are in", async () => {
      const { container } = renderPanel({
        expanded: true,
        habit: every2,
        logs: logged("2026-05-24"), // Sun 24, then Mon 25 in the next column
      });
      const [past, toCome] = ringEls(container);
      expect(past.style.opacity).toBe("0");
      await waitFor(() => expect(past.style.opacity).toBe("1"), {
        timeout: 3000,
      });
      expect(toCome.style.opacity).toBe("0.25"); // all still to come
    });

    it("follows a log, and one taken back", async () => {
      const { container, rerender } = renderPanel({
        expanded: true,
        habit: every2,
        logs: logged("2026-05-20"),
      });
      rerender({ logs: logged("2026-05-20", "2026-05-22") });
      expect(rings(container)).toEqual(["2026-05-20#0", "2026-05-22#0"]);
      rerender({ logs: logged("2026-05-22") });
      await waitFor(() => expect(rings(container)).toEqual(["2026-05-22#0"]));
    });

    it("says in the tooltip how far a log carries the streak", () => {
      const { container } = renderPanel({
        expanded: true,
        habit: every2,
        logs: logged("2026-05-20"),
      });
      fireEvent.mouseEnter(cell(container, "2026-05-20"));
      expect(
        screen.getByText("Wed, May 20, 2026 · covers to May 21"),
      ).toBeInTheDocument();
    });

    it("says which log covers a day without one", () => {
      const { container } = renderPanel({
        expanded: true,
        habit: every2,
        logs: logged("2026-05-20"),
      });
      fireEvent.mouseEnter(cell(container, "2026-05-21"));
      expect(
        screen.getByText("Thu, May 21, 2026 · covered by May 20"),
      ).toBeInTheDocument();
      expect(screen.getByText("No entry")).toBeInTheDocument();
    });
  });
});
