import { get, set } from "idb-keyval";
import { STORAGE_KEY } from "../constants";
import type { PersistedState } from "../types";

const LEGACY_KEY = "habit-tracker-v2";

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

/** Load persisted state, migrating the legacy v2 key forward if needed. */
export async function loadState(): Promise<PersistedState | null> {
  const v3 = await get<PersistedState>(STORAGE_KEY);
  if (v3) return v3;
  const v2 = await get<PersistedState>(LEGACY_KEY);
  if (v2) {
    await saveState(v2); // migrate forward so future loads hit the v3 key
    return v2;
  }
  return null;
}

export async function saveState(s: PersistedState): Promise<void> {
  await set(STORAGE_KEY, s);
}
