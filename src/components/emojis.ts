import { DEFAULT_GROUP_EMOJI } from "../lib/defaults";

// Icon choices offered by the habit form's emoji picker.
export const EMOJIS = [
  "🎯",
  "💪",
  "📚",
  "🧘",
  "🏃",
  "💧",
  "🎨",
  "✍️",
  "🎵",
  "💤",
  "🍎",
  "🧠",
  "🌱",
  "⚡",
  "🔥",
  "🏋️",
];

// A group's choices: the default, a few for parts of life and the day, then
// the habit icons.
export const GROUP_EMOJIS = [
  DEFAULT_GROUP_EMOJI,
  "☀️",
  "🌙",
  "🏠",
  "💼",
  "💰",
  "❤️",
  "👥",
  ...EMOJIS,
];
