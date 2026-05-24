import { describe, it, expect } from "vitest";
import { dk, todayK } from "./dates";

describe("dk", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(dk(new Date(2026, 4, 24))).toBe("2026-05-24"); // month is 0-indexed
  });

  it("zero-pads single-digit months and days", () => {
    expect(dk(new Date(2026, 0, 3))).toBe("2026-01-03");
  });
});

describe("todayK", () => {
  it("returns today's key matching dk(new Date())", () => {
    expect(todayK()).toBe(dk(new Date()));
  });
});
