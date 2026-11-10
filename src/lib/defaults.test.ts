import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG } from "./defaults";

describe("default config", () => {
  it("defaults to the dark theme", () => {
    expect(DEFAULT_CONFIG.theme).toBe("dark");
  });

  it("defaults the dashboard view to quick", () => {
    expect(DEFAULT_CONFIG.dashView).toBe("quick");
  });
});
