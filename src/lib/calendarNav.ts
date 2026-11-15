/** How a habit card's calendar draws its days. */
export type CalendarView = "heatmap" | "calendar";

/**
 * Where a habit card's calendar is looking. `offset` is how many months back
 * the range ends (0 = it ends this month, never positive). `zoomed` shows only
 * this month, larger, as a calendar; it's only ever reached at offset 0.
 */
export type CalendarNav = {
  offset: number;
  zoomed: boolean;
  view: CalendarView;
};

/**
 * `months` is how many months the unzoomed range shows (a config setting), so
 * the reducer doesn't need to know it.
 */
export type NavAction =
  | { type: "back"; months: number }
  | { type: "forward"; months: number }
  | { type: "view"; view: CalendarView }
  /** Show this month's calendar, e.g. after logging today. */
  | { type: "zoomToday" };

export const INITIAL_NAV: CalendarNav = {
  offset: 0,
  zoomed: false,
  view: "heatmap",
};

const ZOOMED: CalendarNav = { offset: 0, zoomed: true, view: "calendar" };

/** Apply one navigation step, returning the same object when nothing changes. */
export function navigate(nav: CalendarNav, action: NavAction): CalendarNav {
  switch (action.type) {
    case "back":
      if (nav.zoomed) return { ...nav, zoomed: false, view: "heatmap" };
      return { ...nav, offset: nav.offset - action.months };
    case "forward":
      if (nav.zoomed) return nav;
      if (nav.offset === 0) return ZOOMED;
      return { ...nav, offset: Math.min(0, nav.offset + action.months) };
    case "view":
      // Zoomed in, the single month is always a calendar.
      if (nav.view === action.view || nav.zoomed) return nav;
      return { ...nav, view: action.view };
    case "zoomToday":
      return nav.zoomed ? nav : ZOOMED;
  }
}
