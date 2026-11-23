import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROUP_ICON,
  DEFAULT_HABIT_ICON,
  ICON_IDS,
  ICON_NAMES,
  ICON_SECTIONS,
  iconForEmoji,
  isIconId,
} from "./icons";

describe("the icons", () => {
  it("are each in one section, once", () => {
    expect(new Set(ICON_IDS).size).toBe(ICON_IDS.length);
    expect(ICON_IDS).toEqual(ICON_SECTIONS.flatMap((s) => s.icons));
  });

  it("fill whole rows of the picker's eight columns", () => {
    for (const s of ICON_SECTIONS) expect(s.icons.length % 8, s.title).toBe(0);
  });

  it("each have a name to be read out", () => {
    for (const id of ICON_IDS) expect(ICON_NAMES[id], id).toMatch(/\w/);
  });

  it("include the defaults", () => {
    expect(isIconId(DEFAULT_HABIT_ICON)).toBe(true);
    expect(isIconId(DEFAULT_GROUP_ICON)).toBe(true);
  });
});

describe("isIconId", () => {
  it("knows the icons, and nothing else", () => {
    expect(isIconId("push-up")).toBe(true);
    expect(isIconId("folder")).toBe(true);
    expect(isIconId("push-ups")).toBe(false);
    expect(isIconId("")).toBe(false);
    expect(isIconId(undefined)).toBe(false);
    expect(isIconId(3)).toBe(false);
  });
});

describe("iconForEmoji", () => {
  it("gives each emoji the pickers offered its icon", () => {
    const offered = {
      "🎯": "target",
      "💪": "flex",
      "📚": "book",
      "🧘": "meditation",
      "🏃": "run",
      "💧": "water",
      "🎨": "palette",
      "✍️": "pencil",
      "🎵": "music",
      "💤": "sleep",
      "🍎": "apple",
      "🧠": "brain",
      "🌱": "plant",
      "⚡": "bolt",
      "🔥": "fire",
      "🏋️": "weightlifter",
      "📁": "folder",
      "☀️": "sun",
      "🌙": "moon",
      "🏠": "home",
      "💼": "work",
      "💰": "savings",
      "❤️": "heart",
      "👥": "people",
    };
    for (const [emoji, icon] of Object.entries(offered))
      expect(iconForEmoji(emoji, "star"), emoji).toBe(icon);
  });

  it("knows other emojis a habit is likely to have", () => {
    expect(iconForEmoji("🚶", "star")).toBe("walk");
    expect(iconForEmoji("🎸", "star")).toBe("guitar");
    expect(iconForEmoji("🦷", "star")).toBe("tooth");
  });

  it("reads an emoji with or without its emoji-style selector", () => {
    expect(iconForEmoji("✍", "star")).toBe("pencil");
    expect(iconForEmoji("🏋", "star")).toBe("weightlifter");
    expect(iconForEmoji("❤", "star")).toBe("heart");
  });

  it("reads a person's emoji whatever their skin tone or gender", () => {
    expect(iconForEmoji("💪🏽", "star")).toBe("flex");
    expect(iconForEmoji("🏋️‍♀️", "star")).toBe("weightlifter");
    expect(iconForEmoji("🏃🏿‍♂️", "star")).toBe("run");
  });

  it("gives the fallback for an emoji it doesn't know, or no emoji", () => {
    expect(iconForEmoji("🦄", "star")).toBe("star");
    expect(iconForEmoji("", "folder")).toBe("folder");
    expect(iconForEmoji(undefined, "folder")).toBe("folder");
    expect(iconForEmoji(7, "folder")).toBe("folder");
  });
});
