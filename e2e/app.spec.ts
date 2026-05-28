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

test("the selected day's outline survives a live edit, and the cell recolors", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Reading"); // reps unit
  await setDashView(page, "calendar");
  const cell = page.locator("svg rect.dc").nth(20);
  await cell.click(); // open the editor for that past day
  await page.mouse.move(5, 5); // clear hover
  await expect(cell).toHaveAttribute("stroke-width", "2.5");
  const emptyFill = await cell.getAttribute("fill");

  // Live-edit the day; the cell must recolor AND keep its selection outline.
  await page.getByPlaceholder("0").fill("23");
  await page.waitForTimeout(400); // let the live write + recolor settle
  await page.mouse.move(6, 6); // clear hover again
  await expect(cell).toHaveAttribute("stroke-width", "2.5"); // outline preserved
  await expect(cell).not.toHaveAttribute("fill", emptyFill ?? ""); // recolored
});

test("reordering a habit card persists the new order", async ({ page }) => {
  await page.goto("/");
  await createHabit(page, "Alpha");
  await createHabit(page, "Beta");

  const headings = page.getByRole("heading", { level: 3 });
  await expect(headings).toHaveText(["Alpha", "Beta"]);

  // Handles only exist inside reorder mode — not during normal viewing.
  const handles = page.locator('[aria-label="Drag to reorder habit"]');
  await expect(handles).toHaveCount(0);

  // Enter reorder mode → the draggable header regions appear (cards condense;
  // the collapse is an overflow-clip animation Playwright can't assert hidden).
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

test("touch-dragging a card by its name (not the grip) reorders", async ({
  browser,
}) => {
  // Regression guard for the iOS issue: a touch drag started on the header
  // text must reorder, not just one started on the grip.
  const ctx = await browser.newContext({ hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/");
  await createHabit(page, "Alpha");
  await createHabit(page, "Beta");
  await page.getByRole("button", { name: /Reorder/ }).click();

  const beta = await page
    .getByRole("heading", { name: "Beta", level: 3 })
    .boundingBox();
  const alpha = await page
    .getByRole("heading", { name: "Alpha", level: 3 })
    .boundingBox();
  if (!beta || !alpha) throw new Error("headings not found");
  const bx = beta.x + beta.width / 2;
  const by = beta.y + beta.height / 2;
  const ax = alpha.x + alpha.width / 2;
  const ay = alpha.y + alpha.height / 2;

  // Real touch sequence via CDP — start on Beta's name, hold past the
  // press-and-hold delay, then drag up over Alpha.
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: bx, y: by }],
  });
  await page.waitForTimeout(260); // exceed the TouchSensor delay before moving
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: bx + (ax - bx) * (i / steps), y: by + (ay - by) * (i / steps) },
      ],
    });
    await page.waitForTimeout(15);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });

  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Beta",
    "Alpha",
  ]);
  await ctx.close();
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

test("switching theme recolors the heatmap cells (cheap fill effect)", async ({
  page,
}) => {
  // Guards the D3Calendar fill split: theme is a dep of the cheap fill effect,
  // and a stale-fill regression would be invisible to the page-bg theme test.
  await page.goto("/");
  await createHabit(page, "Reading");
  await page.getByRole("button", { name: "+10" }).first().click(); // give today a level>0
  await setDashView(page, "calendar");
  const today = page.locator("svg rect.dc[stroke-width='1.5']");
  await expect(today).toHaveCount(1);
  const darkFill = await today.getAttribute("fill");
  await setTheme(page, "light");
  await expect(today).not.toHaveAttribute("fill", darkFill ?? "");
});

test("month navigation and zoom keep rendering the heatmap", async ({
  page,
}) => {
  // Guards that the heavy build still fires on structural deps (offset/zoomed)
  // after `logs` was removed from its dependency list.
  await page.goto("/");
  await createHabit(page, "Reading");
  await setDashView(page, "calendar");
  // Exclude width=0 rects — exit-transitioning cells linger briefly in the DOM
  // and Playwright treats them as "hidden", which can race the visibility check.
  const aliveCell = page.locator('svg rect.dc:not([width="0"])').first();
  await expect(aliveCell).toBeVisible();

  // Navigate back one window — layout re-renders for the past period.
  await page.getByRole("button", { name: "‹" }).click();
  await page.waitForTimeout(1200); // let exit/enter transitions settle
  await expect(aliveCell).toBeVisible();

  // Forward back to the present (offset 0), then forward again zooms into a
  // single-month calendar (zoomed = true, numM = 1).
  await page.getByRole("button", { name: "›" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "›" }).click();
  await page.waitForTimeout(1200);
  await expect(aliveCell).toBeVisible();
});

test("reorder edge cases: toggle hidden with 1 habit; long-press inert in reorder", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Alpha");
  // With only one habit, there's nothing to reorder — toggle isn't shown.
  await expect(page.getByRole("button", { name: /Reorder/ })).toHaveCount(0);

  await createHabit(page, "Beta");
  await expect(page.getByRole("button", { name: /Reorder/ })).toBeVisible();

  // Enter reorder mode and confirm hold-to-edit is disabled (no Edit Habit modal).
  await page.getByRole("button", { name: /Reorder/ }).click();
  await page
    .getByRole("heading", { name: "Alpha", level: 3 })
    .dispatchEvent("mousedown");
  await page.waitForTimeout(700); // exceed the 500ms long-press threshold
  await expect(
    page.getByRole("heading", { name: /Edit Habit/, level: 2 }),
  ).toHaveCount(0);
});

test("sets-mode habit: create, log a set, persists across reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /New Habit/i }).click();
  await page.getByPlaceholder(/Morning Workout/i).fill("Bench");
  await page.getByPlaceholder(/Metric name/i).fill("Press");
  // Flip the metric to sets mode (Weighted preset is the default).
  await page.getByRole("button", { name: /Enable sets mode/i }).click();
  await page.getByRole("button", { name: /^\+ Add$/ }).click();
  await page.getByRole("button", { name: /^Create$/ }).click();
  await expect(
    page.getByRole("heading", { name: "Bench", level: 3 }),
  ).toBeVisible();

  // Add a set 135×5 via the SetInput on the dashboard card.
  await page.getByPlaceholder("Weight").fill("135");
  await page.getByPlaceholder("Reps").fill("5");
  await page.getByRole("button", { name: /\+ Set/ }).click();
  await expect(page.getByText("135 lbs").first()).toBeVisible();
  await expect(page.getByText("5 reps").first()).toBeVisible();

  // Persisted across reload (sets stored as { w, r } per set in IndexedDB).
  await page.waitForTimeout(300);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bench", level: 3 }),
  ).toBeVisible();
  await expect(page.getByText("135 lbs").first()).toBeVisible();
});

test("edit habit: long-press → rename → Save persists", async ({ page }) => {
  await page.goto("/");
  await createHabit(page, "Old");

  // Long-press the heading to trigger the edit modal (500ms threshold).
  await page
    .getByRole("heading", { name: "Old", level: 3 })
    .dispatchEvent("mousedown");
  await page.waitForTimeout(700);
  await expect(
    page.getByRole("heading", { name: /Edit Habit/, level: 2 }),
  ).toBeVisible();

  // Rename and save.
  await page.getByPlaceholder(/Morning Workout/i).fill("New");
  await page.getByRole("button", { name: /^Save$/ }).click();
  await expect(
    page.getByRole("heading", { name: "New", level: 3 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Old", level: 3 }),
  ).toHaveCount(0);

  await page.waitForTimeout(300);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "New", level: 3 }),
  ).toBeVisible();
});

test("custom unit in Settings is usable by a new habit", async ({ page }) => {
  await page.goto("/");
  await openSettings(page);
  // Fill the "Add New Unit" form (ID + Label; defaults stay for QA/thresholds).
  await page.getByPlaceholder("lbs").fill("lbs2");
  await page.getByPlaceholder("Pounds").fill("Pounds2");
  await page.getByRole("button", { name: "Add Unit" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  // Create a habit that uses the custom unit.
  await page.getByRole("button", { name: /New Habit/i }).click();
  await page.getByPlaceholder(/Morning Workout/i).fill("Weighty");
  await page.getByPlaceholder(/Metric name/i).fill("Weight");
  await page.getByRole("combobox").selectOption("lbs2");
  await page.getByRole("button", { name: /^\+ Add$/ }).click();
  await page.getByRole("button", { name: /^Create$/ }).click();
  await expect(
    page.getByRole("heading", { name: "Weighty", level: 3 }),
  ).toBeVisible();
  // Custom unit's default quickAdd is [1, 5, 10] → its quick-add buttons appear.
  await expect(page.getByRole("button", { name: "+5" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+10" })).toBeVisible();
});

test("quick-reset (↺) clears today's value and persists the reset", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Pushups");
  await page.getByRole("button", { name: "+10" }).first().click();
  await expect(page.getByText("10 reps").first()).toBeVisible();

  // Reset → today's value cleared.
  await page.getByRole("button", { name: "↺" }).click();
  await expect(page.getByText(/10 reps/)).toHaveCount(0);

  await page.waitForTimeout(300);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Pushups", level: 3 }),
  ).toBeVisible();
  await expect(page.getByText(/10 reps/)).toHaveCount(0);
});

test("stopping a timer logs the elapsed minutes (≥ 1) and they persist", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Meditate", { metricName: "Minutes", unit: "min" });
  await page.getByRole("button", { name: /Timer/ }).click();
  await expect(page.getByRole("button", { name: /Stop/ })).toBeVisible();

  // Stop almost immediately — stopTimer logs Math.max(1, round(elapsed/60)) so
  // it always records at least 1 minute.
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Stop/ }).click();
  // fmtVal(1, "min") === "1m" — the QuickLogSection header summary shows it.
  await expect(page.getByText("1m").first()).toBeVisible();

  await page.waitForTimeout(300);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Meditate", level: 3 }),
  ).toBeVisible();
  await expect(page.getByText("1m").first()).toBeVisible();
});
