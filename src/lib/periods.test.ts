import { describe, it, expect } from "vitest";
import { gapLabel, MAX_EVERY, periodDays, periodLabel } from "./periods";

describe("periodDays", () => {
  it("is a day for a habit due every day", () => {
    expect(periodDays(undefined)).toBe(1);
  });

  it("is the period's length in days", () => {
    expect(periodDays({ every: 2, unit: "day" })).toBe(2);
    expect(periodDays({ every: 1, unit: "week" })).toBe(7);
    expect(periodDays({ every: 3, unit: "week" })).toBe(21);
  });
});

describe("periodLabel", () => {
  it("says how often, for the card", () => {
    expect(periodLabel(undefined)).toBe("Every day");
    expect(periodLabel({ every: 2, unit: "day" })).toBe("Every 2 days");
    expect(periodLabel({ every: 1, unit: "week" })).toBe("Every week");
    expect(periodLabel({ every: 3, unit: "week" })).toBe("Every 3 weeks");
  });
});

describe("gapLabel", () => {
  it("says how far apart logs may be", () => {
    expect(gapLabel(undefined)).toBe("a day");
    expect(gapLabel({ every: 2, unit: "day" })).toBe("2 days");
    expect(gapLabel({ every: 1, unit: "week" })).toBe("a week");
    expect(gapLabel({ every: 3, unit: "week" })).toBe("3 weeks");
  });
});

describe("MAX_EVERY", () => {
  it("lets a habit be due up to a month of days or two of weeks", () => {
    expect(MAX_EVERY).toEqual({ day: 30, week: 8 });
  });
});
