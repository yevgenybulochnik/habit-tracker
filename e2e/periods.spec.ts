import { test, expect } from "@playwright/test";
import {
  cardStat,
  createHabit,
  openQuickLog,
  rings,
  setDashView,
  setHowOften,
  slideDone,
} from "./helpers";

// Sunday 24 May 2026, at noon.
const SUNDAY = new Date(2026, 4, 24, 12, 0);

test("a habit due every 2 days: its streak holds over the day between, and its card says when the next log is due", async ({
  page,
}) => {
  await page.clock.install({ time: SUNDAY });
  await page.goto("/");
  await createHabit(page, "Run", { every: { n: 2, unit: "day" } });
  const streak = cardStat(page, "Streak");
  await expect(page.getByText("Every 2 days", { exact: true })).toBeVisible();

  await openQuickLog(page, "Run");
  await page.getByRole("button", { name: "+10" }).first().click();
  await expect(page.getByText("Every 2 days · due Tue")).toBeVisible();
  await expect(page.getByText("1/1 completed today")).toBeVisible();
  await expect(streak).toHaveText("1d");

  // Monday: nothing logged, but Sunday's log still covers it
  await page.clock.fastForward("24:00:00");
  await expect(page.getByText("Every 2 days · due tomorrow")).toBeVisible();
  await expect(page.getByText("1/1 completed today")).toBeVisible();
  await expect(streak).toHaveText("1d");

  // Tuesday: due today; a log makes it three days, Sunday to Tuesday
  await page.clock.fastForward("24:00:00");
  await expect(page.getByText("Every 2 days · due today")).toBeVisible();
  await expect(page.getByText("0/1 completed today")).toBeVisible();
  await page.getByRole("button", { name: "+10" }).first().click();
  await expect(streak).toHaveText("3d");
  await expect(page.getByText("Every 2 days · due Thu")).toBeVisible();

  // Friday, with nothing since Tuesday: Thursday passed, the streak is over
  for (let day = 0; day < 3; day++) await page.clock.fastForward("24:00:00");
  await expect(streak).toHaveText("0d");
  await expect(page.getByText("Every 2 days", { exact: true })).toBeVisible();
});

test("the calendar rings each log with the days it covers, and How often can be changed", async ({
  page,
}) => {
  await page.clock.install({ time: SUNDAY });
  await page.goto("/");
  await createHabit(page, "Run", { every: { n: 3, unit: "day" } });
  await setDashView(page, "calendar");

  // Sunday's log covers it and the next two days: Monday and Tuesday sit at
  // the top of the next heatmap column, so its ring comes in two pieces
  await page.getByRole("button", { name: "+10" }).first().click();
  await expect
    .poll(() => rings(page), { timeout: 5000 })
    .toEqual(["2026-05-24#0", "2026-05-24#1"]);

  // Weekly: one ring, Sunday to Saturday
  await page
    .getByRole("heading", { name: "Run", level: 3 })
    .dispatchEvent("mousedown");
  await expect(page.getByRole("heading", { name: "Edit Habit" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "How often" })).toHaveValue(
    "3",
  );
  await setHowOften(page, 1, "week");
  await page.getByRole("button", { name: "Save" }).click();
  await slideDone(page);
  await expect(page.getByText("Every week · due May 31")).toBeVisible();
  await expect
    .poll(() => rings(page), { timeout: 5000 })
    .toEqual(["2026-05-24#0", "2026-05-24#1"]);
});
