import { test, expect, type Page } from "@playwright/test";
import { createHabit, groupChip, sectionNames, slideDone } from "./helpers";

/** Hold `name`'s chip (or a section header) long enough to edit its group. */
async function holdToEdit(page: Page, target: ReturnType<Page["locator"]>) {
  await target.dispatchEvent("mousedown");
  await page.waitForTimeout(700); // the long-press threshold is 500ms
  // The editor's page has slid in over the chip: the release lands on it.
  await page.locator("body").dispatchEvent("mouseup");
  await expect(
    page.getByRole("heading", { name: "Edit Group", level: 1 }),
  ).toBeVisible();
}

test("a habit made in a new group shows in its section, also after a reload", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Water");
  await createHabit(page, "Piano", { group: "Music" });
  await createHabit(page, "Guitar", { group: "Music" });

  const music = page.getByRole("region", { name: "Music" });
  await expect(music.getByRole("heading", { level: 3 })).toHaveText([
    "Piano",
    "Guitar",
  ]);
  await expect(groupChip(page, "Music")).toContainText("0/2");
  // Water is in no group: above the sections, not in one.
  await expect(
    page.getByRole("region").getByRole("heading", { name: "Water" }),
  ).toHaveCount(0);

  await page.waitForTimeout(300); // let the IndexedDB write flush
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Music" })
      .getByRole("heading", { level: 3 }),
  ).toHaveText(["Piano", "Guitar"]);
});

test("groups reorder from a chip with the keyboard, and the order persists", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Piano", { group: "Music" });
  await createHabit(page, "Run", { group: "Fitness" });
  expect(await sectionNames(page)).toEqual(["Music", "Fitness"]);

  await page.getByRole("button", { name: /Reorder/ }).click();
  // The keyboard sensor, the accessible path: pick Fitness up, move it left.
  // Small waits between keys: dnd-kit measures layout asynchronously.
  await groupChip(page, "Fitness").focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(150);
  await page.keyboard.press("Space");

  await expect.poll(() => sectionNames(page)).toEqual(["Fitness", "Music"]);
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(300); // let the IndexedDB write flush

  await page.reload();
  await expect.poll(() => sectionNames(page)).toEqual(["Fitness", "Music"]);
});

test("holding a chip edits its group; deleting the group keeps its habits", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Piano", { group: "Music" });
  await createHabit(page, "Water");

  await holdToEdit(page, groupChip(page, "Music"));
  await page.getByRole("textbox", { name: "Group name" }).fill("Practice");
  await page.getByRole("checkbox", { name: /Water/ }).check();
  await page.getByRole("button", { name: "Save" }).click();
  const practice = page.getByRole("region", { name: "Practice" });
  await expect(practice.getByRole("heading", { level: 3 })).toHaveText([
    "Piano",
    "Water",
  ]);

  await holdToEdit(page, practice.getByRole("button", { name: /Practice/ }));
  await page.getByRole("button", { name: "Delete group" }).click();
  await page.getByRole("button", { name: "Delete Group" }).click();
  await expect(page.getByRole("region")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Groups" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Piano",
    "Water",
  ]);
});

test("releasing a touch hold doesn't tap the editor it opened", async ({
  browser,
}) => {
  // Regression guard: the editor opens under the finger, and lifting it used
  // to click whatever was there.
  const ctx = await browser.newContext({ hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/");
  await createHabit(page, "Piano", { group: "Music" });

  const cdp = await ctx.newCDPSession(page);
  const touchHold = async (box: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point],
    });
    await page.waitForTimeout(700);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  };
  await page.evaluate(() => {
    (window as unknown as { clicks: number }).clicks = 0;
    window.addEventListener(
      "click",
      () => (window as unknown as { clicks: number }).clicks++,
      true,
    );
  });
  const clicks = () =>
    page.evaluate(() => (window as unknown as { clicks: number }).clicks);

  // A habit card
  await touchHold(
    (await page
      .getByRole("heading", { name: "Piano", level: 3 })
      .boundingBox())!,
  );
  await expect(
    page.getByRole("heading", { name: "Edit Habit", level: 1 }),
  ).toBeVisible();
  expect(await clicks()).toBe(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Edit Habit" })).toHaveCount(
    0,
  );
  await slideDone(page);

  // A group chip
  const before = await clicks();
  await touchHold((await groupChip(page, "Music").boundingBox())!);
  await expect(
    page.getByRole("heading", { name: "Edit Group", level: 1 }),
  ).toBeVisible();
  expect(await clicks()).toBe(before);
  await ctx.close();
});

test("the icon grids fit their form on an iPhone 13's screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /New Habit/i }).click();
  await page
    .getByRole("combobox", { name: "Group" })
    .selectOption({ label: "+ New group…" });

  for (const label of ["Icon", "Group icon"]) {
    const grid = page.getByRole("group", { name: label });
    const { scrollWidth, clientWidth } = await grid.evaluate((g) => ({
      scrollWidth: g.scrollWidth,
      clientWidth: g.clientWidth,
    }));
    expect(scrollWidth, label).toBeLessThanOrEqual(clientWidth);
  }
});
