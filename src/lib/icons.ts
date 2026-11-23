// The icons a habit or a group can have, by id: what's stored, in the order
// the pickers offer them. The drawings themselves are in
// components/iconDrawings.

/** The pickers' sections, each a whole number of rows of eight. */
export const ICON_SECTIONS = [
  {
    title: "General",
    icons: ["target", "star", "fire", "bolt", "heart", "sun", "moon", "folder"],
  },
  {
    title: "Fitness",
    icons: [
      "push-up",
      "crunch",
      "bench-press",
      "kettlebell",
      "weightlifter",
      "dumbbell",
      "flex",
      "run",
      "walk",
      "bike",
      "swim",
      "rowing",
      "yoga",
      "jump-rope",
      "hiking",
      "boxing",
    ],
  },
  {
    title: "Music and making",
    icons: [
      "guitar",
      "electric-guitar",
      "piano",
      "violin",
      "microphone",
      "music",
      "palette",
      "camera",
    ],
  },
  {
    title: "Mind",
    icons: [
      "book",
      "brain",
      "study",
      "language",
      "pencil",
      "idea",
      "chess",
      "code",
    ],
  },
  {
    title: "Health",
    icons: [
      "water",
      "sleep",
      "apple",
      "carrot",
      "pill",
      "tooth",
      "no-smoking",
      "meditation",
    ],
  },
  {
    title: "Home and life",
    icons: [
      "home",
      "broom",
      "dog",
      "plant",
      "savings",
      "work",
      "phone-off",
      "people",
    ],
  },
] as const;

export type IconId = (typeof ICON_SECTIONS)[number]["icons"][number];

export const ICON_IDS: readonly IconId[] = ICON_SECTIONS.flatMap(
  (s) => s.icons,
);

/** Each icon's name, for a screen reader. */
export const ICON_NAMES: Record<IconId, string> = {
  target: "Target",
  star: "Star",
  fire: "Fire",
  bolt: "Lightning",
  heart: "Heart",
  sun: "Sun",
  moon: "Moon",
  folder: "Folder",
  "push-up": "Push-up",
  crunch: "Crunch",
  "bench-press": "Bench press",
  kettlebell: "Kettlebell",
  weightlifter: "Weightlifter",
  dumbbell: "Dumbbell",
  flex: "Flexed arm",
  run: "Run",
  walk: "Walk",
  bike: "Bike",
  swim: "Swim",
  rowing: "Rowing",
  yoga: "Yoga",
  "jump-rope": "Jump rope",
  hiking: "Hiking",
  boxing: "Boxing",
  guitar: "Guitar",
  "electric-guitar": "Electric guitar",
  piano: "Piano",
  violin: "Violin",
  microphone: "Microphone",
  music: "Music",
  palette: "Palette",
  camera: "Camera",
  book: "Book",
  brain: "Brain",
  study: "Study",
  language: "Language",
  pencil: "Pencil",
  idea: "Idea",
  chess: "Chess",
  code: "Code",
  water: "Water",
  sleep: "Sleep",
  apple: "Apple",
  carrot: "Carrot",
  pill: "Pill",
  tooth: "Tooth",
  "no-smoking": "No smoking",
  meditation: "Meditation",
  home: "Home",
  broom: "Broom",
  dog: "Dog",
  plant: "Plant",
  savings: "Savings",
  work: "Work",
  "phone-off": "Phone off",
  people: "People",
};

/** A new habit's icon, and a new group's. */
export const DEFAULT_HABIT_ICON: IconId = "target";
export const DEFAULT_GROUP_ICON: IconId = "folder";

const KNOWN = new Set<string>(ICON_IDS);
export const isIconId = (v: unknown): v is IconId =>
  typeof v === "string" && KNOWN.has(v);

/** Each emoji the app's pickers offered, and others a habit is likely to
 *  have, by its base form (see `baseEmoji`). */
const EMOJI_ICONS: Record<string, IconId> = {
  "🎯": "target",
  "⭐": "star",
  "🌟": "star",
  "🔥": "fire",
  "⚡": "bolt",
  "❤": "heart",
  "♥": "heart",
  "☀": "sun",
  "🌅": "sun",
  "🌙": "moon",
  "📁": "folder",
  "📂": "folder",
  "💪": "flex",
  "🏋": "weightlifter",
  "🏃": "run",
  "🚶": "walk",
  "🚴": "bike",
  "🚲": "bike",
  "🏊": "swim",
  "🚣": "rowing",
  "🤸": "yoga",
  "🥾": "hiking",
  "⛰": "hiking",
  "🥊": "boxing",
  "🎸": "guitar",
  "🎹": "piano",
  "🎻": "violin",
  "🎤": "microphone",
  "🎵": "music",
  "🎶": "music",
  "🎧": "music",
  "🎨": "palette",
  "📷": "camera",
  "📸": "camera",
  "📚": "book",
  "📖": "book",
  "🧠": "brain",
  "🎓": "study",
  "🗣": "language",
  "✍": "pencil",
  "✏": "pencil",
  "📝": "pencil",
  "💡": "idea",
  "♟": "chess",
  "💻": "code",
  "💧": "water",
  "🚰": "water",
  "💤": "sleep",
  "😴": "sleep",
  "🛌": "sleep",
  "🍎": "apple",
  "🍏": "apple",
  "🥕": "carrot",
  "🥗": "carrot",
  "💊": "pill",
  "🦷": "tooth",
  "🚭": "no-smoking",
  "🧘": "meditation",
  "🏠": "home",
  "🏡": "home",
  "🧹": "broom",
  "🐕": "dog",
  "🐶": "dog",
  "🌱": "plant",
  "🪴": "plant",
  "💰": "savings",
  "🐷": "savings",
  "💵": "savings",
  "💼": "work",
  "📵": "phone-off",
  "👥": "people",
  "👫": "people",
};

/** An emoji without what only changes how it's drawn: the emoji-style
 *  selector, a skin tone, and a gender or anything else joined on. */
const baseEmoji = (e: string) =>
  e.split("‍")[0].replace(/[️\u{1f3fb}-\u{1f3ff}]/gu, "");

/** The icon for an emoji (a habit's or group's from before icons), or
 *  `fallback` for one there's no icon for. */
export function iconForEmoji(emoji: unknown, fallback: IconId): IconId {
  if (typeof emoji !== "string") return fallback;
  return EMOJI_ICONS[baseEmoji(emoji)] ?? fallback;
}
