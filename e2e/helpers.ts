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
  await page.getByRole("button", { name: view === "calendar" ? "Calendar" : "Quick" }).click();
}

export async function setTheme(page: Page, theme: "dark" | "light") {
  await openSettings(page);
  await page.getByRole("button", { name: theme === "light" ? "Light" : "Dark" }).click();
  await page.getByRole("button", { name: "Done" }).click();
}

/** Delete a habit via the long-press → Edit modal → confirm flow. */
export async function deleteHabit(page: Page, name: string) {
  await page.getByRole("heading", { name, level: 3 }).dispatchEvent("mousedown");
  await page.waitForTimeout(700); // long-press threshold is 500ms
  await page.getByRole("button", { name: /Delete habit/i }).click();
  await page.getByRole("button", { name: /Delete Habit/i }).click();
}
