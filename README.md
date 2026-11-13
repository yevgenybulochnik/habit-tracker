# Habit Tracker

An offline-first habit tracker: a client-side **PWA** (installable on iOS/Android home screens) for tracking habits with multiple metrics, a d3-rendered calendar/heatmap, streaks, and light/dark themes. All data lives on-device in IndexedDB — there is **no backend**.

It was converted from a single-file Claude-artifacts prototype (kept at the repo root as `habit-tracker-v3.jsx` for reference; it is **not** part of the build).

## Features

- **Multi-metric habits** — each habit tracks one or more metrics. A metric is either **numeric** (e.g. minutes, reps, count) or **sets mode** (weight × reps, like a workout log).
- **Configurable units** — built-in `min` / `reps` / `count`, plus custom units with their own quick-add buttons and intensity thresholds.
- **d3 calendar + heatmap** — per-habit contribution-style heatmap and month calendar, with intensity colouring, month navigation, and zoom.
- **Single dashboard** with a persisted **Quick ⟷ Calendar** toggle — Quick is a condensed log list; Calendar expands each card to its heatmap. **Tap any calendar day** to edit that date inline (exact value + quick-adds + sets), which covers back-dating. Plus **live timers** for minute-based metrics (persisted across reloads).
- **Streaks & stats** — current/longest streak, total days, totals.
- **Rolls over at midnight** — an app left open, or resumed from the background on a later day, moves to the new day without a reload.
- **Light / dark theme**, iOS safe-area aware.
- **JSON export / import** backup (Settings → Data).
- **Installable PWA** with offline support via a service worker.

## Tech stack

| Dependency                                                                           | Role                                             |
| ------------------------------------------------------------------------------------ | ------------------------------------------------ |
| [**React 18**](https://react.dev) + [**TypeScript**](https://www.typescriptlang.org) | UI, typed throughout                             |
| [**Vite 6**](https://vite.dev)                                                       | dev server + build                               |
| [**d3**](https://d3js.org)                                                           | imperative SVG rendering of the heatmap/calendar |
| [**idb-keyval**](https://github.com/jakearchibald/idb-keyval)                        | tiny IndexedDB key/value wrapper for persistence |
| [**vite-plugin-pwa**](https://vite-pwa-org.netlify.app)                              | web manifest + service worker (Workbox)          |

Styling is **CSS Modules** (`*.module.css`, colocated per component) over a small global layer of theme CSS variables + keyframes; no CSS framework.

Dev/test: **Vitest** + **Testing Library** (+ `fake-indexeddb`) for unit/component tests, **Playwright** for E2E, **Prettier** for formatting (default 80-col).

## Getting started

```bash
npm install
npm run dev        # dev server (http://localhost:5173)
npm run build      # tsc --noEmit && vite build → dist/ + service worker
npm run preview    # serve the built app (required to exercise the PWA/service worker)
npm test           # unit + component tests
npm run e2e        # Playwright end-to-end tests (auto-builds + previews)
npm run format     # format the repo with Prettier (check-only: npm run format:check)
```

> The service worker only registers over HTTPS or `localhost`, and is a no-op under `npm run dev`. To test offline/PWA behaviour use `npm run build && npm run preview`.

## Data model

The entire app state is a single JSON-serializable object, **`PersistedState`** (see `src/types.ts`):

```ts
type PersistedState = {
  habits: Habit[];
  logs: Logs; // all logged values (see shape below)
  units: Unit[]; // built-in + custom measurement units
  config: AppConfig; // calendar display + theme
  timers?: Timers; // running timers (absolute start timestamps)
};
```

### Entities

```ts
type Metric = {
  id: string;
  name: string;
  unit: string; // references a Unit.id
  mode?: "sets"; // present only for weight × reps metrics
  weightUnit?: string; // e.g. "lbs" | "kg" (sets mode)
};

type Habit = {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  color: string; // palette name, e.g. "Green"
  metrics: Metric[];
  intensityMode?: "total" | "coverage";
  thresholds?: number[];
};

type Unit = {
  id: string; // e.g. "min"
  label: string; // e.g. "Minutes"
  quickAdd: number[]; // quick-add button values, e.g. [15, 30, 60]
  thresholds: number[]; // intensity level cutoffs, e.g. [15, 30, 60]
};

type AppConfig = {
  numMonths: number;
  monthGap: number;
  theme?: "dark" | "light";
  dashView?: "quick" | "calendar";
};
```

### How logs are stored (the key shape)

Logs are a **three-level nested map**: `habitId → dateKey → metricId → value`.

```ts
type SetEntry = { w: number; r: number }; // one set: weight × reps
type DayLog = Record<string, number | SetEntry[]>; // metricId → value | sets
type HabitLogs = Record<string, DayLog>; // dateKey (YYYY-MM-DD) → DayLog
type Logs = Record<string, HabitLogs>; // habitId → HabitLogs
```

- A **numeric** metric stores a plain `number` for the day.
- A **sets-mode** metric stores an **array of `{ w, r }`** (weight × reps) for the day.
- `dateKey` is a local calendar day formatted `YYYY-MM-DD`.

Most helper functions (`logLevel`, `metricVal`, `metricActive`, `logSummary` in `src/lib/`) operate on a **single `DayLog`**, while the calendar and stats operate on one habit's `HabitLogs`.

**Intensity** (`logLevel`, `src/lib/stats.ts`) maps a day to a level **0–4** that picks a palette shade:

- `intensityMode: "total"` — sum the day's metric values and compare against `thresholds`.
- `intensityMode: "coverage"` — the fraction of the habit's metrics that have any activity.

### Example

```jsonc
{
  "schemaVersion": 1,
  "habits": [
    {
      "id": "h_1",
      "name": "Morning Run",
      "emoji": "🏃",
      "color": "Green",
      "metrics": [{ "id": "h_1_m0", "name": "Minutes", "unit": "min" }],
      "intensityMode": "total",
    },
    {
      "id": "h_2",
      "name": "Bench Press",
      "emoji": "🏋️",
      "color": "Blue",
      "metrics": [
        {
          "id": "h_2_m0",
          "name": "Reps",
          "unit": "reps",
          "mode": "sets",
          "weightUnit": "lbs",
          "setValue": "volume",
          "setFields": [
            { "id": "w", "label": "Weight", "unit": "lbs", "agg": "max" },
            { "id": "r", "label": "Reps", "agg": "sum", "primary": true },
          ],
        },
      ],
      "intensityMode": "total",
    },
  ],
  "logs": {
    "h_1": { "2026-05-24": { "h_1_m0": 35 } },
    "h_2": {
      "2026-05-24": {
        "h_2_m0": [
          { "w": 135, "r": 5 },
          { "w": 145, "r": 3 },
        ],
      },
    },
  },
  "units": [
    {
      "id": "min",
      "label": "Minutes",
      "quickAdd": [15, 30, 60],
      "thresholds": [15, 30, 60],
    },
  ],
  "config": {
    "numMonths": 4,
    "monthGap": 5,
    "theme": "dark",
    "dashView": "quick",
  },
}
```

### Persistence

- The whole `PersistedState` blob is stored in **IndexedDB** via `idb-keyval` under the key **`habit-tracker-v3`** (`src/lib/storage.ts`).
- Every state mutation funnels through one `save()` in `src/App.tsx`, which rewrites the blob — IndexedDB always mirrors the in-memory state. There is no external state library.
- On startup the app calls `navigator.storage.persist()` (best-effort, to resist iOS eviction) and migrates a legacy `habit-tracker-v2` key forward.
- Everything read from IndexedDB or a backup file passes through `normalizeState` (`src/lib/normalize.ts`), which fills in whatever older data lacks and stamps `schemaVersion`, so the rest of the app only ever sees the complete shape above.
- If the stored data can't be normalized, it is left in place, copied to the **`habit-tracker-recovery`** key, and the app shows an error screen with a **Download raw data** button instead of the dashboard.
- **Timers** are stored as absolute start timestamps, so a running timer resumes at the correct elapsed time after a reload.
- **Export/Import** (Settings → Data) serializes/parses this same blob as a downloadable `.json` file. Import accepts backups from older versions and refuses files it can't read, including backups from a newer `schemaVersion`.

## Project structure

```
src/
  lib/          pure logic, no React/DOM (dates, defaults, format, metrics, stats, d3layout, storage, normalize) — heavily unit-tested
  components/   React components (D3Calendar, DayEditor, modals, quick-log, timers, …)
  hooks/        useToday: today's date key, kept current past midnight
  types.ts      domain types (the data model above)
  theme.ts      themes, palettes, design tokens (CSS variables)
  globalCss.ts  global keyframes, utility classes and resets
  download.ts   JSON file-download helper (backup export, raw-data download)
  App.tsx       single stateful container; persistence + dashboard view toggle
e2e/            Playwright specs + shared helpers
scripts/        generate-icons.mjs (dependency-free PWA icon generator)
```

See `CLAUDE.md` for architecture notes and conventions (including the red–green TDD workflow).
