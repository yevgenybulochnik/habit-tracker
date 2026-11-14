import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { get, set, clear } from "idb-keyval";
import {
  loadState,
  saveState,
  requestPersistence,
  InvalidDataError,
  RECOVERY_KEY,
} from "./storage";
import { BUILTIN_UNITS, DEFAULT_CONFIG, STORAGE_KEY } from "./defaults";
import { SCHEMA_VERSION } from "./normalize";
import type { PersistedState } from "../types";

// Current-format state: loading it changes nothing.
const sample: PersistedState = {
  schemaVersion: SCHEMA_VERSION,
  habits: [
    {
      id: "h1",
      name: "Run",
      emoji: "🏃",
      color: "Green",
      metrics: [{ id: "m1", name: "Min", unit: "min" }],
      intensityMode: "total",
    },
  ],
  logs: { h1: { "2026-05-24": { m1: 30 } } },
  units: BUILTIN_UNITS,
  config: DEFAULT_CONFIG,
};

// The same state as an older version stored it: no schema version, intensity
// mode, units or theme.
const old = {
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
  config: { numMonths: 4, monthGap: 5 },
};

/** The error a failed `loadState` rejects with. */
async function loadError(): Promise<unknown> {
  return loadState().then(
    () => {
      throw new Error("loaded");
    },
    (e: unknown) => e,
  );
}

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

  it("brings older data up to the current format", async () => {
    await set(STORAGE_KEY, old);
    expect(await loadState()).toEqual(sample);
  });
});

describe("v2 → v3 migration", () => {
  it("loads from the legacy v2 key and migrates it to v3", async () => {
    await set("habit-tracker-v2", old);
    expect(await loadState()).toEqual(sample);
    // migrated forward, in the current format, so later loads hit the v3 key
    expect(await get(STORAGE_KEY)).toEqual(sample);
  });

  it("prefers v3 over v2 when both exist", async () => {
    const v3 = { ...sample, config: { ...DEFAULT_CONFIG, numMonths: 6 } };
    await set("habit-tracker-v2", sample);
    await set(STORAGE_KEY, v3);
    expect(await loadState()).toEqual(v3);
  });
});

describe("data that can't be normalized", () => {
  const unreadable = { habits: "none", logs: { h1: {} } };

  it("rejects with the reason and the raw data", async () => {
    await set(STORAGE_KEY, unreadable);
    const e = await loadError();
    expect(e).toBeInstanceOf(InvalidDataError);
    expect((e as InvalidDataError).message).toMatch(/habits is not a list/);
    expect((e as InvalidDataError).raw).toEqual(unreadable);
  });

  it("copies the raw data to the recovery key and leaves it in place", async () => {
    await set(STORAGE_KEY, unreadable);
    await loadError();
    expect(await get(RECOVERY_KEY)).toEqual(unreadable);
    expect(await get(STORAGE_KEY)).toEqual(unreadable);
  });

  it("does not migrate unreadable legacy data", async () => {
    await set("habit-tracker-v2", unreadable);
    expect(await loadError()).toBeInstanceOf(InvalidDataError);
    expect(await get(RECOVERY_KEY)).toEqual(unreadable);
    expect(await get(STORAGE_KEY)).toBeUndefined();
  });

  it("leaves the recovery key alone when the data is readable", async () => {
    await saveState(sample);
    await loadState();
    expect(await get(RECOVERY_KEY)).toBeUndefined();
  });
});

describe("requestPersistence", () => {
  it("resolves without throwing when the API is unavailable", async () => {
    await expect(requestPersistence()).resolves.toBeUndefined();
  });
});
