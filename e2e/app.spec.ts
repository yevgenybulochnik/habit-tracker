import { test, expect, type Page } from "@playwright/test";

// Create a single-metric habit (default unit "reps") via the UI.
async function createHabit(page: Page, name: string) {
  await page.getByRole("button", { name: /New Habit/i }).click();
  await page.getByPlaceholder(/Morning Workout/i).fill(name);
  await page.getByPlaceholder(/Metric name/i).fill("Reps");
  await page.getByRole("button", { name: /^\+ Add$/ }).click();
  await page.getByRole("button", { name: /^Create$/ }).click();
  await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
}

test("smoke: app shell and PWA assets load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /habits/i, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /New Habit/i })).toBeVisible();

  // Manifest is served
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).display).toBe("standalone");

  // Service worker registers on the built/previewed app
  const swReady = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });
  expect(swReady).toBe(true);
});

test("persistence: a logged habit survives a reload", async ({ page }) => {
  await page.goto("/");
  await createHabit(page, "Pushups");

  // Quick-log +10 reps on the dashboard card
  await page.getByRole("button", { name: "+10" }).first().click();
  await expect(page.getByText("10 reps").first()).toBeVisible();

  await page.reload();
  // Value was persisted to IndexedDB and rehydrates
  await expect(page.getByRole("heading", { name: "Pushups", level: 3 })).toBeVisible();
  await expect(page.getByText("10 reps").first()).toBeVisible();
});

test("renders a calendar svg per habit and switches tabs", async ({ page }) => {
  await page.goto("/");
  await createHabit(page, "Reading");
  // D3Calendar mounted without crashing → an <svg> exists in the card
  await expect(page.locator("svg").first()).toBeVisible();
  await page.getByRole("button", { name: /Log Entry/i }).click();
  await expect(page.getByText(/Log Date/i)).toBeVisible();
});

test("auto-backup: a daily backup downloads on first interaction when due", async ({ page }) => {
  await page.goto("/");
  await createHabit(page, "Stretch"); // first load had no habits, so no auto-backup yet

  // Reload: a habit now exists and no backup was recorded today → auto-export is armed.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Stretch", level: 3 })).toBeVisible();
  // The download fires on the first user gesture (browsers block gesture-less downloads).
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("heading", { name: /habits/i, level: 1 }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("habit-tracker-backup");
});

test("backup: export then import restores a deleted habit", async ({ page }) => {
  await page.goto("/");
  await createHabit(page, "Meditation");

  // Export → capture the downloaded JSON
  await page.getByTitle("Settings").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  await page.getByRole("button", { name: "Done" }).click();

  // Delete the habit via long-press → Edit modal → confirm delete
  const header = page.getByRole("heading", { name: "Meditation", level: 3 });
  await header.dispatchEvent("mousedown");
  await page.waitForTimeout(700); // long-press threshold is 500ms
  await page.getByRole("button", { name: /Delete habit/i }).click();
  await page.getByRole("button", { name: /Delete Habit/i }).click();
  await expect(page.getByRole("heading", { name: "Meditation", level: 3 })).toHaveCount(0);

  // Import the backup → habit reappears
  await page.getByTitle("Settings").click();
  await page.getByLabel(/Import backup file/i).setInputFiles(path!);
  await expect(page.getByRole("heading", { name: "Meditation", level: 3 })).toBeVisible();
});
