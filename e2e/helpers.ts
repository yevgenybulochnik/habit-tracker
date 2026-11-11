import { expect, type Page } from "@playwright/test";

// Shared flows for driving the app through its UI. Used by the E2E specs (and
// reusable by any screenshot/automation script), so the navigation logic lives
// in one place.

/**
 * Create a single-metric habit via the New Habit modal.
 * Defaults to a "Reps" metric; pass `unit` (e.g. "min") to pick a different unit.
 */
export async function createHabit(
  page: Page,
  name: string,
  { metricName = "Reps", unit }: { metricName?: string; unit?: string } = {},
) {
  await page.getByRole("button", { name: /New Habit/i }).click();
  await page.getByPlaceholder(/Morning Workout/i).fill(name);
  await page.getByPlaceholder(/Metric name/i).fill(metricName);
  if (unit) await page.getByRole("combobox").selectOption(unit);
  await page.getByRole("button", { name: /^\+ Add$/ }).click();
  await page.getByRole("button", { name: /^Create$/ }).click();
  await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
}

export async function openSettings(page: Page) {
  await page.getByTitle("Settings").click();
}

/** Switch the dashboard view via the Quick/Calendar toggle. */
export async function setDashView(page: Page, view: "quick" | "calendar") {
  await page
    .getByRole("button", { name: view === "calendar" ? "Calendar" : "Quick" })
    .click();
}

export async function setTheme(page: Page, theme: "dark" | "light") {
  await openSettings(page);
  await page
    .getByRole("button", { name: theme === "light" ? "Light" : "Dark" })
    .click();
  await page.getByRole("button", { name: "Done" }).click();
}

/** Delete a habit via the long-press → Edit modal → confirm flow. */
export async function deleteHabit(page: Page, name: string) {
  await page
    .getByRole("heading", { name, level: 3 })
    .dispatchEvent("mousedown");
  await page.waitForTimeout(700); // long-press threshold is 500ms
  await page.getByRole("button", { name: /Delete habit/i }).click();
  await page.getByRole("button", { name: /Delete Habit/i }).click();
}

// idb-keyval's default database and object store, where the app keeps its data.
const IDB_NAME = "keyval-store";
const IDB_STORE = "keyval";

/** Write a value straight into the app's IndexedDB store (to seed stored data). */
export async function writeStored(page: Page, key: string, value: unknown) {
  await page.evaluate(
    ({ name, store, key, value }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onupgradeneeded = () => open.result.createObjectStore(store);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction(store, "readwrite");
          tx.objectStore(store).put(value, key);
          tx.onerror = () => reject(tx.error);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
    { name: IDB_NAME, store: IDB_STORE, key, value },
  );
}

/** Read a value straight from the app's IndexedDB store. */
export async function readStored(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    ({ name, store, key }) =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result
            .transaction(store, "readonly")
            .objectStore(store)
            .get(key);
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            open.result.close();
            resolve(req.result);
          };
        };
      }),
    { name: IDB_NAME, store: IDB_STORE, key },
  );
}
