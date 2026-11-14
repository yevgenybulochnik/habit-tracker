import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import {
  createHabit,
  openSettings,
  setTheme,
  deleteHabit,
  setDashView,
  writeStored,
  readStored,
  dayCell,
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

test("unreadable stored data: the error screen offers it as a download and a recovery copy is kept", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/No habits yet/i)).toBeVisible();

  // Stored data the app can't make sense of: the habits aren't a list
  const raw = { habits: "none", logs: { h1: { "2026-05-24": { m1: 30 } } } };
  await writeStored(page, "habit-tracker-v3", raw);
  await page.reload();

  // The error screen replaces the dashboard, so nothing can save over the data
  await expect(page.getByText(/Couldn't open your data/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /New Habit/i })).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download raw data" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^habit-tracker-raw-data-/);
  expect(JSON.parse(readFileSync(await download.path(), "utf8"))).toEqual(raw);

  // The data is still where it was, with an untouched copy beside it
  expect(await readStored(page, "habit-tracker-v3")).toEqual(raw);
  expect(await readStored(page, "habit-tracker-recovery")).toEqual(raw);
});

test("data stored by an older version loads, works, and is saved in the current format", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/No habits yet/i)).toBeVisible();

  // What the v2 app stored, under its own key: no units, config or schema
  // version; a sets metric with only a weight unit; a habit with no metrics.
  const today = await page.evaluate(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  await writeStored(page, "habit-tracker-v2", {
    habits: [
      {
        id: "h1",
        name: "Lift",
        emoji: "🏋️",
        color: "Red",
        metrics: [
          {
            id: "m1",
            name: "Bench",
            unit: "reps",
            mode: "sets",
            weightUnit: "kg",
          },
        ],
      },
      { id: "h2", name: "Read", emoji: "📚", color: "Blue" },
    ],
    logs: { h1: { [today]: { m1: [{ w: 60, r: 8 }] } } },
  });
  await page.reload();

  // Both habits render, and the old sets metric shows as weight × reps in kg
  await expect(
    page.getByRole("heading", { name: "Lift", level: 3 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Read", level: 3 }),
  ).toBeVisible();
  await expect(page.getByText("SETS · kg")).toBeVisible();
  await expect(page.getByText("1 set · 480 kg vol").first()).toBeVisible();

  // Logging another set works on the migrated metric
  await page.getByPlaceholder("Reps").fill("5");
  await page.getByRole("button", { name: /\+ Set/ }).click();
  await expect(page.getByText("2 sets · 780 kg vol").first()).toBeVisible();
  await page.waitForTimeout(300); // let the IndexedDB write flush

  // The v3 key now holds complete, current-format state
  const stored = (await readStored(page, "habit-tracker-v3")) as {
    schemaVersion: number;
    habits: {
      intensityMode: string;
      metrics: { setValue: string; setFields: { id: string }[] }[];
    }[];
    units: { id: string }[];
    config: { theme: string; dashView: string };
  };
  expect(stored.schemaVersion).toBe(1);
  expect(stored.habits.map((h) => h.intensityMode)).toEqual(["total", "total"]);
  expect(stored.habits[0].metrics[0].setValue).toBe("volume");
  expect(stored.habits[0].metrics[0].setFields.map((f) => f.id)).toEqual([
    "w",
    "r",
  ]);
  expect(stored.habits[1].metrics).toEqual([]);
  expect(stored.units.map((u) => u.id)).toEqual([
    "min",
    "reps",
    "count",
    "volume",
  ]);
  expect(stored.config).toMatchObject({ theme: "dark", dashView: "quick" });
});

test("an app left open past midnight moves on to the new day", async ({
  page,
}) => {
  // One minute to midnight, mid-month: both days stay in the same calendar,
  // so the cells are updated in place rather than drawn fresh.
  await page.clock.install({ time: new Date(2026, 4, 24, 23, 59) });
  await page.goto("/");
  await createHabit(page, "Reading");
  await page.getByRole("button", { name: "+10" }).first().click();
  await expect(page.getByText("1/1 completed today")).toBeVisible();
  await setDashView(page, "calendar");
  await page.getByRole("button", { name: "Cal", exact: true }).click(); // day numbers

  const today = {
    strokeWidth: "1.5",
    opacity: "1",
    cursor: "pointer",
    numberWeight: "700",
  };
  const past = { ...today, strokeWidth: "1", numberWeight: "400" };
  const future = { ...past, opacity: "0.35", cursor: "default" };
  await expect.poll(() => dayCell(page, "2026-05-24")).toEqual(today);
  await expect.poll(() => dayCell(page, "2026-05-25")).toEqual(future);

  await page.clock.fastForward("02:00"); // to 00:01 on the 25th

  await expect(page.getByText("0/1 completed today")).toBeVisible();
  await expect.poll(() => dayCell(page, "2026-05-25")).toEqual(today);
  await expect.poll(() => dayCell(page, "2026-05-24")).toEqual(past);
  await expect.poll(() => dayCell(page, "2026-05-26")).toEqual(future);
});

test("coming back to the app on a later day shows that day without a reload", async ({
  page,
}) => {
  // A backgrounded iOS home-screen app is frozen: no timers run, and coming
  // back to it fires visibilitychange instead of reloading the page.
  // setSystemTime moves the clock the same way, without firing any timer.
  await page.clock.install({ time: new Date(2026, 4, 30, 21, 0) });
  await page.goto("/");
  await createHabit(page, "Reading");
  await page.getByRole("button", { name: "+10" }).first().click();
  await expect(page.getByText("1/1 completed today")).toBeVisible();
  await setDashView(page, "calendar");
  await expect(page.getByText("Feb – May 2026")).toBeVisible();
  await expect
    .poll(() => dayCell(page, "2026-05-30"))
    .toMatchObject({ strokeWidth: "1.5" });

  // Two days later, in the next month
  await page.clock.setSystemTime(new Date(2026, 5, 1, 8, 0));
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );

  await expect(page.getByText("0/1 completed today")).toBeVisible();
  await expect(page.getByText("Mar – Jun 2026")).toBeVisible();
  await expect
    .poll(() => dayCell(page, "2026-06-01"))
    .toMatchObject({ strokeWidth: "1.5", opacity: "1" });
  await expect
    .poll(() => dayCell(page, "2026-05-30"))
    .toMatchObject({ strokeWidth: "1", opacity: "1" });
  await expect
    .poll(() => dayCell(page, "2026-06-02"))
    .toMatchObject({ strokeWidth: "1", opacity: "0.35" });
});

test("a day being edited keeps its outline when the day changes", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(2026, 4, 24, 23, 59) });
  await page.goto("/");
  await createHabit(page, "Reading");
  await setDashView(page, "calendar");
  const cell = page.locator("svg rect.dc").nth(20); // a past day
  await cell.click();
  await page.mouse.move(5, 5); // clear hover so only the selection stroke remains
  await expect(cell).toHaveAttribute("stroke-width", "2.5");

  await page.clock.fastForward("02:00"); // to 00:01 on the 25th
  await expect
    .poll(() => dayCell(page, "2026-05-25"))
    .toMatchObject({ strokeWidth: "1.5" }); // the calendar has moved on
  await page.waitForTimeout(1200); // let the rebuild's transitions finish

  await expect(page.getByText(/^Edit ·/)).toBeVisible();
  await expect(cell).toHaveAttribute("stroke-width", "2.5");
});
