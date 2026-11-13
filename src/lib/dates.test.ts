import { describe, it, expect } from "vitest";
import { addDays, dk, msUntilMidnight, parseKey, todayK } from "./dates";

describe("dk", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(dk(new Date(2026, 4, 24))).toBe("2026-05-24"); // month is 0-indexed
  });

  it("zero-pads single-digit months and days", () => {
    expect(dk(new Date(2026, 0, 3))).toBe("2026-01-03");
  });
});

describe("parseKey", () => {
  it("returns local midnight on that day", () => {
    const d = parseKey("2026-05-24");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 4, 24]);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });

  it("round-trips with dk", () => {
    expect(dk(parseKey("2026-01-03"))).toBe("2026-01-03");
    expect(dk(parseKey("2024-02-29"))).toBe("2024-02-29");
  });
});

describe("addDays", () => {
  it("moves forward and back within a month", () => {
    expect(addDays("2026-05-24", 1)).toBe("2026-05-25");
    expect(addDays("2026-05-24", -10)).toBe("2026-05-14");
  });

  it("returns the same key for 0", () => {
    expect(addDays("2026-05-24", 0)).toBe("2026-05-24");
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
  });

  it("knows about leap days", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("counts whole days across a year", () => {
    expect(addDays("2026-05-24", -365)).toBe("2025-05-24");
    expect(addDays("2026-05-24", 365)).toBe("2027-05-24");
  });

  // 23- and 25-hour days in zones with DST (US: 8 Mar and 1 Nov 2026)
  it("steps one calendar day over a daylight-saving change", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(addDays("2026-11-02", -1)).toBe("2026-11-01");
  });
});

describe("msUntilMidnight", () => {
  it("is the time left until the next local midnight", () => {
    expect(msUntilMidnight(new Date(2026, 4, 24, 23, 59))).toBe(60_000);
    expect(msUntilMidnight(new Date(2026, 4, 24, 12))).toBe(12 * 3_600_000);
    expect(msUntilMidnight(new Date(2026, 4, 24, 23, 59, 59, 999))).toBe(1);
  });

  it("is a whole day at midnight itself, never 0", () => {
    expect(msUntilMidnight(new Date(2026, 4, 24))).toBe(24 * 3_600_000);
  });

  it("works on the last day of a month and of a year", () => {
    expect(msUntilMidnight(new Date(2026, 4, 31, 23))).toBe(3_600_000);
    expect(msUntilMidnight(new Date(2026, 11, 31, 23))).toBe(3_600_000);
  });
});

describe("todayK", () => {
  it("returns today's key matching dk(new Date())", () => {
    expect(todayK()).toBe(dk(new Date()));
  });
});
