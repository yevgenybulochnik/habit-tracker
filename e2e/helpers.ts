import { expect, type Page } from "@playwright/test";

// Shared flows for driving the app through its UI. Used by the E2E specs (and
// reusable by any screenshot/automation script), so the navigation logic lives
// in one place.

/** The pearl's menu, open. */
export function pearlMenu(page: Page) {
  return page.getByRole("group", { name: "Menu", exact: true });
}

/** Open the pearl's menu, then pick `name` in it. */
export async function fromPearl(page: Page, name: string) {
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await pearlMenu(page).getByRole("button", { name, exact: true }).click();
}

/**
 * Create a single-metric habit via the New Habit page.
 * Defaults to a "Reps" metric; pass `unit` (e.g. "min") to pick a different unit,
 * `group` to put it in the group with that name, made if it doesn't exist,
 * and `every` for how often it's due (every day otherwise).
 */
export async function createHabit(
  page: Page,
  name: string,
  {
    metricName = "Reps",
    unit,
    group,
    every,
  }: {
    metricName?: string;
    unit?: string;
    group?: string;
    every?: { n: number; unit: "day" | "week" };
  } = {},
) {
  await fromPearl(page, "New habit");
  await page.getByPlaceholder(/Morning Workout/i).fill(name);
  if (group) await chooseGroup(page, group);
  await page.getByPlaceholder(/Metric name/i).fill(metricName);
  if (unit)
    await page.getByRole("combobox", { name: "Unit" }).selectOption(unit);
  await page.getByRole("button", { name: /^\+ Add$/ }).click();
  if (every) await setHowOften(page, every.n, every.unit);
  await page.getByRole("button", { name: /^Create$/ }).click();
  await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
  await slideDone(page);
}

/**
 * Wait for a page's slide (a view transition) to finish. While it runs, a
 * touch or a click lands on the page as a whole, not on what's under it.
 */
export async function slideDone(page: Page) {
  await page.waitForFunction(() => !document.documentElement.dataset.slide);
}

/**
 * Open a habit's quick-log by tapping its card: Compact view, the default,
 * shows each card shut until it's tapped, and one open at a time.
 */
export async function openQuickLog(page: Page, name: string) {
  const card = page.getByRole("button", { name, exact: true });
  await card.click();
  await expect(card).toHaveAttribute("aria-expanded", "true");
}

/** In an open habit form, set how often the habit is due. */
export async function setHowOften(page: Page, n: number, unit: "day" | "week") {
  await page
    .getByRole("combobox", { name: "Days or weeks" })
    .selectOption(unit);
  await page.getByRole("spinbutton", { name: "How often" }).fill(String(n));
}

/**
 * The rings round what each log covers, once they've faded in: each one's
 * block (the day of its log) and its place in it, `${day}#${n}`, in order.
 * Assumes a single habit card.
 */
export function rings(page: Page) {
  return page.locator("path.ring").evaluateAll((els) =>
    els
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .map((el) => ({ key: (el as any).__data__?.key, o: el.style.opacity }))
      .filter((r) => r.o !== "0")
      .map((r) => r.key),
  );
}

/** In an open habit form, choose the group named `name`, making it if new. */
async function chooseGroup(page: Page, name: string) {
  await page.getByRole("button", { name: /^Group:/ }).click();
  const option = page.getByRole("option", { name, exact: true });
  if (await option.count()) {
    await option.click();
  } else {
    await page.getByRole("option", { name: "+ New group…" }).click();
    await page.getByRole("textbox", { name: "Group name" }).fill(name);
    await page.getByRole("button", { name: "Add Group" }).click();
  }
}

/** The group bar's chip for the group named `name`. */
export function groupChip(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Groups" })
    .getByRole("button", { name: new RegExp(name) });
}

/** The names of the group sections, top to bottom. */
export function sectionNames(page: Page) {
  return page
    .getByRole("region")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
}

export async function openSettings(page: Page) {
  await fromPearl(page, "Settings");
}

/** Switch the dashboard view from the pearl's menu, then shut it. */
export async function setDashView(page: Page, view: "compact" | "calendar") {
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await pearlMenu(page)
    .getByRole("button", {
      name: view === "calendar" ? "Calendar" : "Compact",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Close menu" }).click();
}

export async function setTheme(page: Page, theme: "dark" | "light") {
  await openSettings(page);
  await page
    .getByRole("button", { name: theme === "light" ? "Light" : "Dark" })
    .click();
  await page.getByRole("button", { name: "Done" }).click();
}

/** Delete a habit via the long-press → Edit Habit page → confirm flow. */
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
