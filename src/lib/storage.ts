import { get, set } from "idb-keyval";
import { STORAGE_KEY } from "./defaults";
import { normalizeState } from "./normalize";
import type { PersistedState } from "../types";

const LEGACY_KEY = "habit-tracker-v2";

/** Where stored data that couldn't be normalized is copied, untouched. */
export const RECOVERY_KEY = "habit-tracker-recovery";

/** Stored data was read but `normalizeState` rejected it. Carries that data. */
export class InvalidDataError extends Error {
  readonly raw: unknown;

  constructor(reason: string, raw: unknown) {
    super(`The saved data isn't in a format this app can read (${reason}).`);
    this.name = "InvalidDataError";
    this.raw = raw;
  }
}

/**
 * Ask the browser to keep our storage durable (exempt from eviction).
 * iOS/WebKit support is partial; this is a best-effort no-op where unsupported.
 */
export async function requestPersistence(): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      /* ignore — persistence is best-effort */
    }
  }
}

/**
 * Stored data in the current format. Data that can't be normalized is copied
 * to the recovery key (best-effort) and reported as an `InvalidDataError`.
 */
async function normalizeStored(raw: unknown): Promise<PersistedState> {
  const result = normalizeState(raw);
  if (result.ok) return result.state;
  try {
    await set(RECOVERY_KEY, raw);
  } catch {
    /* ignore — the error below still carries the data */
  }
  throw new InvalidDataError(result.reason, raw);
}

/**
 * Load persisted state in the current format, migrating the legacy v2 key
 * forward if needed. Rejects with an `InvalidDataError` when there is stored
 * data but it can't be normalized.
 */
export async function loadState(): Promise<PersistedState | null> {
  const v3 = await get<unknown>(STORAGE_KEY);
  if (v3) return normalizeStored(v3);
  const v2 = await get<unknown>(LEGACY_KEY);
  if (v2) {
    const state = await normalizeStored(v2);
    await saveState(state); // migrate forward so future loads hit the v3 key
    return state;
  }
  return null;
}

export async function saveState(s: PersistedState): Promise<void> {
  await set(STORAGE_KEY, s);
}
