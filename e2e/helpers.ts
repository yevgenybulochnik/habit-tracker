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

/**
 * The value shown above a label in a habit card's stats row, e.g.
 * `cardStat(page, "Streak")` for "3d". Assumes a single habit card.
 */
export function cardStat(page: Page, label: string) {
  return page
    .getByText(label, { exact: true })
    .locator("xpath=preceding-sibling::div[1]");
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

/**
 * How one day is drawn in the calendar: its cell's outline, opacity and
 * cursor, and the weight of its day number (calendar view only). The cells
 * carry no date attribute, so the day is found through the datum d3 bound to
 * each element. Resolves to `null` while that day isn't drawn. Assumes a
 * single habit card.
 */
export function dayCell(page: Page, dateKey: string) {
  return page.locator("svg").evaluateAll((svgs, key) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const find = (selector: string, k: string) =>
      svgs
        .flatMap((svg) => [...svg.querySelectorAll<SVGElement>(selector)])
        .find((el) => (el as any).__data__?.key === k);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const rect = find("rect.dc", key);
    if (!rect) return null;
    return {
      strokeWidth: rect.getAttribute("stroke-width"),
      opacity: rect.style.opacity,
      cursor: rect.style.cursor,
      numberWeight: find("text.dn", `dn-${key}`)?.getAttribute("font-weight"),
    };
  }, dateKey);
}

/**
 * The colour a day's cell is filled with, as the browser computes it
 * (`rgb(r, g, b)`), or `null` while that day isn't drawn. Read it once the
 * calendar has stopped animating. Assumes a single habit card.
 */
export function dayFill(page: Page, dateKey: string) {
  return page.locator("svg").evaluateAll((svgs, key) => {
    const rect = svgs
      .flatMap((svg) => [...svg.querySelectorAll<SVGElement>("rect.dc")])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .find((el) => (el as any).__data__?.key === key);
    return rect ? getComputedStyle(rect).fill : null;
  }, dateKey);
}
