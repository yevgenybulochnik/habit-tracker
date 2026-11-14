import { describe, it, expect } from "vitest";
import { BUILTIN_UNITS, DEFAULT_CONFIG } from "./defaults";

describe("built-in units", () => {
  it("are minutes, reps, count and volume", () => {
    expect(BUILTIN_UNITS.map((u) => u.id)).toEqual([
      "min",
      "reps",
      "count",
      "volume",
    ]);
  });

  // Volume is weight × reps summed over a day's sets: 3 × 10 at 135 is 4,050.
  it("grade volume in the thousands", () => {
    const volume = BUILTIN_UNITS.find((u) => u.id === "volume");
    expect(volume).toEqual({
      id: "volume",
      label: "Volume",
      quickAdd: [100, 500, 1000],
      thresholds: [1000, 2500, 5000],
    });
  });
});

describe("default config", () => {
  it("defaults to the dark theme", () => {
    expect(DEFAULT_CONFIG.theme).toBe("dark");
  });

  it("defaults the dashboard view to quick", () => {
    expect(DEFAULT_CONFIG.dashView).toBe("quick");
  });
});
