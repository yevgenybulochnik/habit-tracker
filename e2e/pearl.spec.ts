import { test, expect } from "@playwright/test";
import { SCHEMA_VERSION } from "../src/lib/normalize";
import {
  createHabit,
  fromPearl,
  pearlMenu,
  sectionHead,
  slideDone,
  writeStored,
} from "./helpers";

// A phone's screen: the pearl sits in its corner, within reach of a thumb.
test.use({ viewport: { width: 390, height: 844 } });

const pearl = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("button", { name, exact: true });

test("the pearl opens out into its menu, and a tap outside shuts it", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Water");
  await pearl(page, "Menu").click();
  await expect(pearlMenu(page)).toBeVisible();
  await expect(pearl(page, "Close menu")).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  // Outside it, over the habits
  await page.mouse.click(40, 120);
  await expect(pearlMenu(page)).toHaveCount(0);
  await expect(pearl(page, "Menu")).toHaveAttribute("aria-expanded", "false");
});

test("the pearl jumps to a folded group at the end, unfolding it", async ({
  page,
}) => {
  // Habits in no group, then a folded group of a dozen at the end: folded,
  // there's no room to scroll its header up; unfolded, there is.
  const habit = (id: string, groupId?: string) => ({
    id,
    name: id,
    icon: "target",
    color: "Green",
    metrics: [{ id: `${id}-m`, name: "Reps", unit: "reps" }],
    intensityMode: "total",
    ...(groupId && { groupId }),
  });
  const ungrouped = ["Water", "Sleep", "Vitamins", "Walk", "Stretch", "Read"];
  const music = Array.from({ length: 12 }, (_, i) => `Song ${i + 1}`);
  await page.goto("/");
  await writeStored(page, "habit-tracker-v3", {
    schemaVersion: SCHEMA_VERSION,
    habits: [
      ...ungrouped.map((n) => habit(n)),
      ...music.map((n) => habit(n, "g1")),
    ],
    logs: {},
    groups: [{ id: "g1", name: "Music", icon: "music", collapsed: true }],
  });
  await page.reload();
  await expect(sectionHead(page, "Music")).toHaveAttribute(
    "aria-expanded",
    "false",
  );

  await pearl(page, "Menu").click();
  await pearlMenu(page)
    .getByRole("button", { name: "Music, 0 of 12 done" })
    .click();
  await expect(sectionHead(page, "Music")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  // Its header ends up at the top of the screen, its first habit in view
  await expect
    .poll(async () => (await sectionHead(page, "Music").boundingBox())!.y, {
      timeout: 3000,
    })
    .toBeLessThan(40);
  await expect(
    page.getByRole("heading", { name: "Song 1", level: 3, exact: true }),
  ).toBeInViewport();
});

test("on a page the pearl is the way back, the page having no back button", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Water");
  await fromPearl(page, "Settings");
  await slideDone(page);
  await expect(
    page.getByRole("heading", { name: "Settings", level: 1 }),
  ).toBeVisible();
  await expect(page.getByTitle(/Back to/)).toHaveCount(0);

  await pearl(page, "Back").click();
  await slideDone(page);
  await expect(page.getByRole("heading", { name: "Settings" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Water", level: 3 }),
  ).toBeVisible();
  await expect(pearl(page, "Menu")).toBeVisible();
});

test("reordering from the pearl, it's Done, with how to reorder above it", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Alpha");
  await createHabit(page, "Beta");
  await fromPearl(page, "Reorder");
  const hint = page.getByText(/Drag the/);
  await expect(hint).toBeVisible();
  // Above the pearl, not in the page, so the habits don't move: once both
  // have settled (the hint rising in, the pearl back from the menu's corner)
  await expect
    .poll(async () => {
      const box = (await hint.boundingBox())!;
      const pearlBox = (await pearl(page, "Done").boundingBox())!;
      return pearlBox.y - (box.y + box.height);
    })
    .toBeGreaterThanOrEqual(0);

  await pearl(page, "Done").click();
  await expect(hint).toHaveCount(0);
  await expect(pearl(page, "Menu")).toBeVisible();
});

test("the header has today's count on the title's line, now it has no buttons", async ({
  page,
}) => {
  await page.goto("/");
  await createHabit(page, "Water");
  const title = (await page
    .getByRole("heading", { name: "Habits", level: 1 })
    .boundingBox())!;
  const count = (await page.getByText("0/1 completed today").boundingBox())!;
  // Level with the title, to its right
  expect(count.y + count.height / 2).toBeGreaterThan(title.y);
  expect(count.y + count.height / 2).toBeLessThan(title.y + title.height);
  expect(count.x).toBeGreaterThan(title.x + title.width);
});
