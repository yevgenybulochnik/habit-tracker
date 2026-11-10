import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { get, set, clear } from "idb-keyval";
import { loadState, saveState, requestPersistence } from "./storage";
import { STORAGE_KEY } from "./defaults";
import type { PersistedState } from "../types";

const sample: PersistedState = {
  habits: [
    {
      id: "h1",
      name: "Run",
      emoji: "🏃",
      color: "Green",
      metrics: [{ id: "m1", name: "Min", unit: "min" }],
    },
  ],
  logs: { h1: { "2026-05-24": { m1: 30 } } },
  units: [
    {
      id: "min",
      label: "Minutes",
      quickAdd: [15, 30, 60],
      thresholds: [15, 30, 60],
    },
  ],
  config: { numMonths: 4, monthGap: 5 },
};

beforeEach(async () => {
  await clear();
});

describe("saveState / loadState", () => {
  it("round-trips persisted state", async () => {
    await saveState(sample);
    expect(await loadState()).toEqual(sample);
  });

  it("returns null when nothing is stored", async () => {
    expect(await loadState()).toBeNull();
  });

  it("round-trips running timers so they survive a reload", async () => {
    const withTimers = { ...sample, timers: { "h1:m1": 1_716_500_000_000 } };
    await saveState(withTimers);
    expect((await loadState())?.timers).toEqual({ "h1:m1": 1_716_500_000_000 });
  });
});

describe("v2 → v3 migration", () => {
  it("loads from the legacy v2 key and migrates it to v3", async () => {
    await set("habit-tracker-v2", sample);
    expect(await loadState()).toEqual(sample);
    // migrated forward so subsequent loads hit the v3 key
    expect(await get(STORAGE_KEY)).toEqual(sample);
  });

  it("prefers v3 over v2 when both exist", async () => {
    const v3 = { ...sample, config: { numMonths: 6, monthGap: 0 } };
    await set("habit-tracker-v2", sample);
    await set(STORAGE_KEY, v3);
    expect(await loadState()).toEqual(v3);
  });
});

describe("requestPersistence", () => {
  it("resolves without throwing when the API is unavailable", async () => {
    await expect(requestPersistence()).resolves.toBeUndefined();
  });
});
