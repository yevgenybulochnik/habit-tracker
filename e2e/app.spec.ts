import { test, expect } from "@playwright/test";
import {
  createHabit,
  openSettings,
  setTheme,
  deleteHabit,
  setDashView,
} from "./helpers";

test("a running timer survives a page reload", async ({ page }) => {
  await page.goto("/");
  // Timers only show for "min"-unit metrics
  await createHabit(page, "Meditate", { metricName: "Minutes", unit: "min" });

  // Start the timer → it shows "Stop"
  await page.getByRole("button", { name: /Timer/ }).click();
  await expect(page.getByRole("button", { name: /Stop/ })).toBeVisible();
  await page.waitForTimeout(300); // let the IndexedDB write flush

  // Reload → the timer is still running (rehydrated from persisted start timestamp)
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Meditate", level: 3 }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Stop/ })).toBeVisible();
});

test("switching to the light theme updates the appearance", async ({
  page,
}) => {
  await page.goto("/");
  await setTheme(page, "light");
  // The root applies data-theme=light; the CSS variable resolves to white.
  await expect(page.locator('div[data-theme="light"]')).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
});

test("smoke: app shell and PWA assets load", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /habits/i, level: 1 }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("heading", { name: "Pushups", level: 3 }),
  ).toBeVisible();
  await expect(page.getByText("10 reps").first()).toBeVisible();
});

test("Quick/Calendar toggle shows the heatmap and is remembered across reloads", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Reading");
  // Default Quick view: no calendar cells drawn (d3 gated off while collapsed)
  await expect(page.locator("svg rect.dc")).toHaveCount(0);
  // Switch to Calendar → cells appear
  await setDashView(page, "calendar");
  await expect(page.locator("svg rect.dc").first()).toBeVisible();
  // Persisted: reload stays in Calendar (cells present without toggling)
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Reading", level: 3 }),
  ).toBeVisible();
  await expect(page.locator("svg rect.dc").first()).toBeVisible();
});

test("tapping a calendar day opens the editor; the entered value persists live", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Reading"); // reps unit
  await setDashView(page, "calendar");
  await expect(page.locator("svg rect.dc").first()).toBeVisible();

  await page.locator("svg rect.dc").nth(20).click(); // an early (past) day
  await expect(page.getByText(/^Edit/)).toBeVisible();
  await page.getByPlaceholder("0").fill("23"); // no Save — edits persist as you type
  await page.waitForTimeout(500); // let the IndexedDB write flush before reload

  // Reload (view persisted = Calendar) and reopen the same day → value is there
  await page.reload();
  await expect(page.locator("svg rect.dc").nth(20)).toBeVisible();
  await page.locator("svg rect.dc").nth(20).click();
  await expect(page.getByPlaceholder("0")).toHaveValue("23");
});

test("selecting a day outlines its cell", async ({ page }) => {
  await page.goto("/");
  await createHabit(page, "Reading");
  await setDashView(page, "calendar");
  const cell = page.locator("svg rect.dc").nth(20);
  await cell.click();
  await page.mouse.move(5, 5); // clear hover so only the selection stroke remains
  await expect(cell).toHaveAttribute("stroke-width", "2.5");
});

test("reordering a habit card persists the new order", async ({ page }) => {
  await page.goto("/");
  await createHabit(page, "Alpha");
  await createHabit(page, "Beta");

  const headings = page.getByRole("heading", { level: 3 });
  await expect(headings).toHaveText(["Alpha", "Beta"]);

  // Handles only exist inside reorder mode — not during normal viewing.
  const handles = page.getByRole("button", { name: "Drag to reorder habit" });
  await expect(handles).toHaveCount(0);

  // Enter reorder mode → grip handles appear (cards condense; the collapse is
  // an overflow-clip animation, which Playwright can't assert as hidden).
  await page.getByRole("button", { name: /Reorder/ }).click();
  await expect(handles).toHaveCount(2);

  // Reorder via the keyboard sensor (also the accessible path): focus Beta's
  // grip, Space to pick up, ArrowUp to move it above Alpha, Space to drop.
  await handles.nth(1).focus();
  // Small waits between keys: dnd-kit measures layout asynchronously on pickup
  // and after each move, so back-to-back presses are dropped.
  await page.keyboard.press("Space"); // pick up Beta
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowUp"); // move above Alpha
  await page.waitForTimeout(150);
  await page.keyboard.press("Space"); // drop

  await expect(headings).toHaveText(["Beta", "Alpha"]);

  // Leave reorder mode → cards expand back, handles gone.
  await page.getByRole("button", { name: /Done/ }).click();
  await expect(handles).toHaveCount(0);
  await page.waitForTimeout(300); // let the IndexedDB write flush

  await page.reload();
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Beta",
    "Alpha",
  ]);
});

test("a habit created without a metric is a daily check-off that persists", async ({
  page,
}) => {
  await page.goto("/");
  // Create with just a name — no metric added.
  await page.getByRole("button", { name: /New Habit/i }).click();
  await page.getByPlaceholder(/Morning Workout/i).fill("Meditate");
  await page.getByRole("button", { name: /^Create$/ }).click();
  await expect(
    page.getByRole("heading", { name: "Meditate", level: 3 }),
  ).toBeVisible();

  // Day-counter card: a single mark button, no quick-add (+N) buttons.
  await expect(page.getByRole("button", { name: "+10" })).toHaveCount(0);
  await page.getByRole("button", { name: /Mark today/i }).click();
  await expect(page.getByRole("button", { name: /Done today/i })).toBeVisible();
  await page.waitForTimeout(300); // let the IndexedDB write flush

  await page.reload();
  await expect(page.getByRole("button", { name: /Done today/i })).toBeVisible();
});

test("backup: export then import restores a deleted habit", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Meditation");

  // Export → capture the downloaded JSON
  await openSettings(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  await page.getByRole("button", { name: "Done" }).click();

  // Delete the habit, then confirm it's gone
  await deleteHabit(page, "Meditation");
  await expect(
    page.getByRole("heading", { name: "Meditation", level: 3 }),
  ).toHaveCount(0);

  // Import the backup → habit reappears
  await openSettings(page);
  await page.getByLabel(/Import backup file/i).setInputFiles(path!);
  await expect(
    page.getByRole("heading", { name: "Meditation", level: 3 }),
  ).toBeVisible();
});
