import { describe, it, expect } from "vitest";
import {
  INITIAL_NAV,
  navigate,
  type CalendarNav,
  type NavAction,
} from "./calendarNav";

/** Run the reducer on `nav` frozen, proving it doesn't mutate its input. */
function run(nav: CalendarNav, action: NavAction): CalendarNav {
  return navigate(Object.freeze(nav), action);
}

const at = (offset: number, view: CalendarNav["view"] = "heatmap") => ({
  offset,
  zoomed: false,
  view,
});
const ZOOMED: CalendarNav = { offset: 0, zoomed: true, view: "calendar" };

describe("navigate", () => {
  it("starts on the heatmap of the latest months", () => {
    expect(INITIAL_NAV).toEqual({ offset: 0, zoomed: false, view: "heatmap" });
  });

  describe("back", () => {
    it("steps back by the number of months shown, keeping the view", () => {
      expect(run(at(0, "calendar"), { type: "back", months: 6 })).toEqual(
        at(-6, "calendar"),
      );
      expect(run(at(-6), { type: "back", months: 6 })).toEqual(at(-12));
    });

    it("zooms out to the heatmap while zoomed", () => {
      expect(run(ZOOMED, { type: "back", months: 6 })).toEqual(at(0));
    });
  });

  describe("forward", () => {
    it("zooms in to this month's calendar at offset 0", () => {
      expect(run(at(0), { type: "forward", months: 6 })).toEqual(ZOOMED);
    });

    it("steps forward by the number of months shown", () => {
      expect(run(at(-12), { type: "forward", months: 6 })).toEqual(at(-6));
    });

    it("stops at offset 0 rather than zooming in", () => {
      expect(run(at(-6), { type: "forward", months: 6 })).toEqual(at(0));
    });

    it("clamps to 0 from an offset that isn't a whole step", () => {
      // e.g. after the number of months shown was changed in Settings
      expect(run(at(-4), { type: "forward", months: 6 })).toEqual(at(0));
    });

    it("does nothing while zoomed", () => {
      expect(run(ZOOMED, { type: "forward", months: 6 })).toBe(ZOOMED);
    });
  });

  describe("view", () => {
    it("switches between heatmap and calendar", () => {
      expect(run(at(-6), { type: "view", view: "calendar" })).toEqual(
        at(-6, "calendar"),
      );
      expect(
        run(at(-6, "calendar"), { type: "view", view: "heatmap" }),
      ).toEqual(at(-6));
    });

    it("keeps the calendar while zoomed", () => {
      expect(run(ZOOMED, { type: "view", view: "heatmap" })).toBe(ZOOMED);
    });

    it("returns the same state when the view doesn't change", () => {
      const nav = at(0);
      expect(run(nav, { type: "view", view: "heatmap" })).toBe(nav);
    });
  });

  describe("zoomToday", () => {
    it("jumps to this month's calendar from anywhere", () => {
      expect(run(at(-12), { type: "zoomToday" })).toEqual(ZOOMED);
      expect(run(at(0, "calendar"), { type: "zoomToday" })).toEqual(ZOOMED);
    });

    it("does nothing while already zoomed", () => {
      expect(run(ZOOMED, { type: "zoomToday" })).toBe(ZOOMED);
    });
  });
});
