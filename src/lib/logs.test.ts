import { describe, it, expect } from "vitest";
import { setDayLog } from "./logs";
import type { Logs } from "../types";

describe("setDayLog", () => {
  it("writes the entry at habitId → dateKey", () => {
    const out = setDayLog({}, "h1", "2026-05-26", { m1: 5 });
    expect(out).toEqual({ h1: { "2026-05-26": { m1: 5 } } });
  });

  it("preserves other habits and other dates", () => {
    const logs: Logs = {
      h1: { "2026-05-01": { m1: 1 } },
      h2: { "2026-05-01": { m1: 9 } },
    };
    const out = setDayLog(logs, "h1", "2026-05-26", { m1: 5 });
    expect(out.h1["2026-05-01"]).toEqual({ m1: 1 });
    expect(out.h2).toBe(logs.h2);
  });

  it("returns a fresh per-habit object reference (so heatmap effects re-run)", () => {
    const logs: Logs = { h1: { "2026-05-01": { m1: 1 } } };
    const out = setDayLog(logs, "h1", "2026-05-26", { m1: 5 });
    expect(out).not.toBe(logs);
    expect(out.h1).not.toBe(logs.h1); // the regression: must not mutate in place
  });
});
