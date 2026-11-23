import { test, expect, type Locator, type Page } from "@playwright/test";
import { createHabit, readStored } from "./helpers";
import type { PersistedState } from "../src/types";

// A phone's screen: the runner and the editor are laid out for one.
test.use({ viewport: { width: 390, height: 844 } });

const TODAY = "2026-05-24";

/** Choose the habit named `name` in a step's menu: tap it open, then tap
 *  the habit in its list. */
async function chooseHabit(menu: Locator, name: string) {
  await menu.click();
  await menu.page().getByRole("option", { name, exact: true }).click();
}

/** What's saved for the habit named `name` today, as a list of values. */
async function loggedToday(page: Page, name: string) {
  const state = (await readStored(page, "habit-tracker-v3")) as PersistedState;
  const habit = state.habits.find((h) => h.name === name)!;
  return Object.values(state.logs[habit.id]?.[TODAY] ?? {});
}

test("a routine is made, run through a reload, and logs to its habits", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(2026, 4, 24, 9, 0) });
  await page.goto("/");
  await createHabit(page, "Push-ups");
  await createHabit(page, "Plank", { metricName: "Minutes", unit: "min" });

  // Made: 12 push-ups at your own pace, a 30 s break, a minute of plank.
  await page.getByTitle("Routines").click();
  await page.getByRole("button", { name: /New Routine/ }).click();
  await page.getByLabel("Name").fill("Morning");
  const habitMenu = page.getByRole("button", { name: /^Habit:/ });
  await page.getByRole("button", { name: "+ Habit" }).click();
  await chooseHabit(habitMenu.nth(0), "Push-ups");
  await page
    .getByRole("group", { name: "Done by" })
    .getByRole("button", { name: "Reps" })
    .click();
  await page.getByRole("textbox", { name: "Count" }).fill("12");
  await page.getByRole("button", { name: "+ Break" }).click();
  await page.getByRole("button", { name: "+ Habit" }).click();
  await chooseHabit(habitMenu.nth(1), "Plank");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("1 round · at your pace")).toBeVisible();

  // Run: the push-ups take 20 s, then Done logs their 12.
  await page.getByRole("button", { name: "Start Morning" }).click();
  const centre = page.getByTestId("centre");
  await expect(centre).toContainText("Get ready");
  await page.clock.fastForward(5_000 + 20_000);
  await expect(centre).toContainText("12");
  await expect(centre).toContainText("0:20");
  await page.getByTitle("Done").click();
  await expect(centre).toContainText("Break");
  await expect.poll(() => loggedToday(page, "Push-ups")).toEqual([12]);

  // A reload picks the run back up where it was.
  await page.clock.fastForward(10_000);
  await page.reload();
  await expect(page.getByText("Round 1 of 1", { exact: false })).toBeVisible();

  // The plank's minute logs itself as it ends, and the run is done.
  await page.clock.fastForward(120_000);
  await expect(page.getByText("Finished · 1:50 in all")).toBeVisible();
  const log = page.getByRole("list", { name: "Log" });
  await expect(
    log.getByRole("button", { name: "Change Push-ups" }),
  ).toContainText("12 reps in 0:20");
  await expect(log.getByRole("button", { name: "Change Plank" })).toContainText(
    "1m",
  );
  await expect.poll(() => loggedToday(page, "Plank")).toEqual([1]);

  // Done closes it; the routine is kept with the habits.
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(centre).toHaveCount(0);
  const stored = (await readStored(page, "habit-tracker-v3")) as PersistedState;
  expect(stored.routines.map((r) => r.name)).toEqual(["Morning"]);
});

test("a run goes on minimised, while the habits fill in", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 4, 24, 9, 0) });
  await page.goto("/");
  await createHabit(page, "Plank", { metricName: "Minutes", unit: "min" });
  await page.getByTitle("Routines").click();
  await page.getByRole("button", { name: /New Routine/ }).click();
  await page.getByLabel("Name").fill("Quick plank");
  await page.getByRole("button", { name: "+ Habit" }).click();
  await chooseHabit(page.getByRole("button", { name: /^Habit:/ }), "Plank");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Start Quick plank" }).click();

  await page.getByTitle(/Minimise/).click();
  await page.getByTitle("Back to habits").click();
  const pill = page.getByTitle("Back to the routine");
  await expect(pill).toBeVisible();
  await page.clock.fastForward(5_000 + 61_000);
  await expect(pill).toContainText("Done");
  await expect.poll(() => loggedToday(page, "Plank")).toEqual([1]);
  await pill.click();
  await expect(page.getByText("Finished · 1:00 in all")).toBeVisible();
});
