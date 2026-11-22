# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An offline-first habit tracker: a **Vite + React 18 + TypeScript** PWA with multi-metric
habits, a d3-rendered calendar/heatmap, streak stats, and IndexedDB persistence. It was
converted from a single-file Claude-artifacts prototype; that original is kept at the repo
root as `habit-tracker-v3.jsx` — it is the historical baseline/reference and is **not part
of the build**.

## Commands

```bash
npm run dev          # Vite dev server (listens on all IPs; allows host devbox.lan)
npm run build        # tsc --noEmit && vite build  → dist/ + service worker + manifest
npm run preview      # serve the built app (needed to exercise the PWA/service worker)
npm test             # Vitest unit + component tests (jsdom), single run
npm run test:watch   # Vitest watch mode
npm run e2e          # Playwright E2E against an auto-built preview server
npm run format       # Prettier --write over the repo (check-only: npm run format:check)
node scripts/generate-icons.mjs   # regenerate PWA icons into public/

npx vitest run src/lib/stats.test.ts   # run one test file
npx vitest run -t "streak"             # run tests matching a name
```

- **Typecheck** is part of `npm run build` (`tsc --noEmit`); there is no lint step.
- **Formatting** is **Prettier** (default config, 80-col `printWidth`) — run `npm run format`
  after editing and keep `format:check` clean. `.prettierignore` excludes `dist`,
  `test-results`, `package-lock.json`, and `habit-tracker-v3.jsx` (the historical prototype
  is intentionally left unformatted).
- **Service workers only register over HTTPS or `localhost`**, and `vite-plugin-pwa` uses a
  no-op `registerSW` in dev. Verify PWA/offline behavior with `npm run build && npm run preview`,
  not `npm run dev`.
- **E2E env quirks (this host):** `playwright.config.ts` sets `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64`
  on Linux because the bundled browser doesn't recognize Ubuntu 26.04. The browser also needs
  system libs (`libnss3`, `libnspr4`, etc.) installed via apt; `npx playwright install chromium`
  alone is not enough.

## Development workflow (red–green TDD)

This repo is built with a **red–green TDD loop** and **incremental commits** — match it:

1. **Write the test first** (`*.test.ts(x)` beside the source), then run it and confirm it
   **fails for the right reason** (red): `npx vitest run src/lib/<file>.test.ts`.
2. **Implement** the smallest change to make it pass; rerun until **green**.
3. **Commit that increment** before moving on — don't batch many changes into one commit at
   the end. Each commit bundles the test with its implementation so history stays green (avoid
   landing a commit with failing tests).

Because the core logic is isolated, the natural rhythm is to push new behavior into `src/lib/`
(pure, trivially red–green) and let components stay thin.

### Commit conventions

- **Commit as you go — do not ask for approval before committing.** Land each increment
  yourself as you complete it (per the red–green loop above); never pause to ask "should I
  commit this?". This standing instruction overrides the default of committing only when asked.
  (Still do **not** `git push` without being asked.)
- **Conventional Commits**: `feat:`, `fix:`, `test:`, `chore:`, `refactor:`, `revert:`.
- End every commit message with the trailer
  `Co-Authored-By: <model> <noreply@anthropic.com>`, where `<model>` is the name of the model
  running the current session (for example `Claude Fable 5.2`). Use the model you actually
  are, not a name copied from this file or from earlier commits.
- To back out a shipped change while keeping its history, prefer `git revert` over deleting or
  rewriting commits (e.g. the auto-backup feature was added then reverted — both commits remain
  in the log).

## Architecture

The codebase is layered so the core logic is framework-agnostic and unit-tested:

**`src/lib/` — pure logic, no React/DOM.** This is where the real behavior lives and where
most tests are. `dates` (date keys and date arithmetic), `metrics` (unit resolution, sets aggregation, per-metric
values), `stats` (intensity `logLevel`, `logSummary`, `habitStats` incl. streaks), `format`,
`d3layout` (calendar/heatmap cell+label coordinate math), `storage` (IndexedDB via
`idb-keyval`), `normalize` (`normalizeState`: any stored or imported data → complete,
current-format state), `state` (the app's reducer, below), `groups` (habits split into group
sections: `groupSections`, `ungroupedHabits`, and `setMembers` for a group's habits),
`calendarNav` (a card's calendar
navigation, `navigate` over `{ offset, zoomed, view }`), `units` (parsing and validating a
unit form: `buildUnit`), `ids` (`newId`), the routines' three (below: `routines`,
`routineRun`, `routineLog`), and `defaults`
(storage keys, built-in units, default config, month/weekday labels). Prefer adding logic
here over inside components. `boundary.test.ts`
enforces the purity: a lib module may import only other lib modules, `../types`, and
`idb-keyval`.

**Shared non-lib constants** live in two root modules: `src/theme.ts` (`THEMES`, the `C`
CSS-variable tokens, `THEME_CSS`, the palettes + `resolvePalette`, the font `F`) and
`src/globalCss.ts` (`CSS`). `src/download.ts` (`downloadJson`) is the shared file-download
helper; it needs the DOM, so it isn't in lib, and so are `src/slide.ts` (`slide`, the
sideways page change, a view transition whose keyframes are in `globalCss`) and `src/cues.ts`
(a routine's sounds and buzzes). Anything used by a single component sits with
it (the d3 easing `D3E` inside `CalendarPanel`). The emoji choices, `EMOJIS` for a habit and
`GROUP_EMOJIS` for a group, are in `components/emojis.ts`.

**The data model is nested and worth internalizing** (`src/types.ts`):
`Logs = habitId → dateKey → DayLog`, where `DayLog = metricId → (number | SetEntry[])`.
A metric is either **normal** (numeric, e.g. minutes/reps) or **sets mode** (`SetsMetric`,
`mode: "sets"`, storing `{w, r}[]` weight×reps, with its own `setFields` schema and
`setValue`; `isSetMetric` narrows to it). A weighted sets metric's value is its volume (weight ×
reps), so the weighted preset gives it the built-in `volume` unit, not `reps`. Most helpers (`logLevel`, `metricVal`,
`metricActive`, `logSummary`) operate on a **single `DayLog`**, while `CalendarPanel` and
`habitStats` take one habit's `HabitLogs` (`dateKey → DayLog`). Intensity colouring has two
modes per habit (`intensityMode`): `total` (sum vs `thresholds`) or `coverage` (fraction of
metrics done), both producing a level 0–4 that maps to a palette shade. `total` only makes
sense within one unit: the habit form switches a habit to `coverage` when `hasMixedUnits` says
its metrics differ. The current streak in `habitStats` counts back from today, or from
yesterday while today has nothing logged, so an unfinished day doesn't break it.

**Groups.** `PersistedState.groups` lists the `Group`s (`id`, `name`, `emoji`, `collapsed`)
in display order, and a habit names its group with an optional `groupId`: absent means it's in
none, and a habit is in at most one. The habit list keeps a single order, so a section's
habits are that list filtered, and reordering within a section is a `habit/reorder`.

**Routines.** `PersistedState.routines` (schema v4) lists the `Routine`s: a name, `rounds`, a
get-ready (`prep`, seconds) and `steps`, each a `HabitStep` (one `habitId` + `metricId`, done
`by` `"time"` for `seconds` or by `"count"` for `count`, at your own pace; both values are
kept) or a timed `BreakStep`. `lib/routines` holds what a routine is: `captureFor` (how a step
logs: a count, minutes from its time, or a check-off), `routineProblems` (what the editor needs
before saving), and `fitRoutine`, which keeps routines in line with the habits (a step whose
habit or metric is gone is dropped, and a counted step whose metric no longer counts is
timed); `normalizeState` runs it on load and the reducer on `habit/update` and `habit/delete`.
It is also the **one place that knows about multi-metric habits** (`stepName`,
`stepFullName`, `stepChoices`, `stepShade`): they are to be retired, so keep that rule there.
`lib/routineRun` lays a routine out in `Slot`s (round by round, the last round's closing breaks
dropped) and works out where a `Run` is from timestamps alone (`startedAt`, pauses, skips, and
`ends`, when each counted step was said to be done), so a run survives a reload or the phone
sleeping; a counted step is `open` (end Infinity) until then. `lib/routineLog` turns a slot into
the reducer's log actions, and `relogActions` changes or takes back what it logged (its set
replaced where it stands in the day). The run in progress is **not** in the saved state: it
changes with every pause and skip and isn't backed up, so `useRoutineRun`
(`src/hooks/useRoutineRun.ts`) keeps it in localStorage under `RUN_KEY`, read back through
`normalizeRun` (which gives up on a run it can't read; the logs are saved already). A run keeps
the routine as it was at Start. The hook ticks every frame while a run is going: it cues each
change, logs the habits that log themselves as they end, and marks the run finished.

**Data is normalized once, at the boundary (`src/lib/normalize.ts`).** Everything read from
IndexedDB or a backup file passes through `normalizeState`, which fills in what older data
lacks (a habit's `metrics`/`intensityMode`, a sets metric's `setFields`/`setValue`, config
settings, built-in units, the groups and a group's fields, the routines and theirs; it drops a
`groupId` whose group doesn't exist, and a routine's step whose habit doesn't) and stamps
`schemaVersion`. The types therefore mark those fields
required, and code that reads state must **not** add its own fallbacks for old data (no
`habit.metrics || []`): a new default or a format migration goes in `normalizeState`, with
a `SCHEMA_VERSION` bump for a migration (the versions are listed beside that constant; a
migration runs only on data older than its version). It rejects data it can't read, including
a `schemaVersion` newer than its own. Tests take the current version from `SCHEMA_VERSION`
instead of repeating the number.

**"Today" is passed in, never looked up (`src/hooks/useToday.ts`).** `App` calls
`useToday()` once and passes `today` (a date key) down as a prop; lib functions that depend
on the date (`habitStats`, `findLastSet`, `getRecentDays`, the two layouts) take it as a
parameter. Don't call `todayK()` or `new Date()` to find the date in lib or in a component:
`todayK()` is for the hook, plus one-off stamps such as the backup filename. The hook keeps
the key current while the app stays open, with a timeout for the next midnight and a re-check
on `visibilitychange` (an iOS home-screen app resumes instead of reloading). It applies the
new day on the next animation frame, so d3's animation clock catches up first after the page
was asleep. Tests pass a fixed `today`; they never build keys from the real clock.

**State & persistence (`src/App.tsx`, `src/lib/state.ts`).** `App` is the single stateful
container: one `useReducer` over `reduce` from `lib/state` holds `habits`, `logs`, `units`,
`config`, `groups`, `routines` and `timers`, and every change is a dispatched `Action`. The reducer must stay pure
(React calls it twice in dev), so anything else an action needs (a `newId`, `Date.now()` for
a timer, the `today` key) is worked out by the caller and carried in the action. One effect in
`App` saves each new state through `storage.saveState()`. It starts only after a load has
succeeded, and it skips the loaded state itself, so opening the app writes nothing. Habit cards
dispatch their own changes through `useHabitActions(habit.id, today)`
(`src/hooks/useHabitActions.ts`), which reads `App`'s dispatch from `DispatchContext`; the
smaller components below a card keep plain callback props. On mount `App` calls `requestPersistence()` (asks iOS
to keep storage durable) then `loadState()`, which migrates a legacy `habit-tracker-v2` key
forward to `habit-tracker-v3` and returns normalized state. If the stored data can't be
normalized, `loadState` copies it to the `habit-tracker-recovery` key and rejects with an
`InvalidDataError`; `App` then shows its load-error screen (where saving is blocked) with a
"Download raw data" button. There is no external state library and no backend. The dashboard
is a **single view** (no Log Entry tab) with a persisted `appConfig.dashView` (`quick` |
`calendar`) toggle. With no groups it's one list of cards. Once there are groups it's
`GroupSections`: a pinned `GroupBar` (a scroll-to-top button and a chip per group, with its
count done today), the habits in no group, then a collapsible section per group; a chip jumps
to its section and the chip of the section under the bar is highlighted. Each list of cards
(`renderList` in `App`) is its own `SortableHabits` drag context, so reorder mode moves a card
within its list, and a group by its chip (sideways) or its section's header. Holding a chip or
a header opens `GroupEditPage` (name, emoji, its habits as a checklist, delete).

**Pages.** The forms and the Routines page are pages that slide in over the habits (`slide`, a
view transition), not dialogs: `App` holds the open `page` (the Routines page, `NewHabitPage`,
`EditHabitPage` held from a card, or `GroupEditPage` held from a chip or section header), and
`openPage`/`closePage` do the slide and the scroll. The habits stay mounted underneath with the
`.away` class (hidden and taking no height, not `display: none`, so cards keep their state) and
get their scroll position back on the way back. A page is a `PageShell` (`PageHeader`, with the
way back and the title as the page's `h1`, then a panel); a form closes through
`ClosePage(then?)`, where `then` (the save or delete) runs as the page slides back, so the
habits come back already showing it. Settings is the one dialog left (`ModalShell`).

**The Routines page.** The header's stopwatch opens the Routines page (`RoutinesView`: the
list, and `RoutineEditor` as a page of its own). `Routines`, mounted for as long as
`App` is, holds the engine (`useRoutineRun`) and shows the page while it's open and a run over
everything: `RoutineRunner` full screen (the `RoutineRing` timeline ring, the controls, and the
log, a section per habit as the run reaches it: a counted one asks for its count, the others
show what they logged, to change or take back; at the end a Done button closes the run), or
minimised to `RoutinePill` in the corner. Under 440px New Habit shrinks to its "+" to make room
in the header.

**The habit card (`HabitCard`).** Each habit is a `HabitCard`: a header (hold-to-edit via
`useLongPress`, the drag region in reorder mode, stats), a collapsible body holding its
`CalendarPanel`, an inline `DayEditor` and the quick-log. A card collapses (Quick) or expands
to its heatmap (Calendar) via an `expanded` prop, animated with `grid-template-rows`. The card
owns the calendar's navigation (`useReducer` over `navigate` from `lib/calendarNav`) rather than
the panel, because logging from quick-log zooms the calendar in to this month as well as the
arrows. It also owns the selected day: tapping a calendar day opens the inline `DayEditor` for
that date (exact-value entry + back-dating).

**`CalendarPanel` is the one imperative component.** It draws the SVG heatmap/calendar via d3
data-joins inside `useEffect`s, with its view/month controls, legend and hover tooltip; it
measures its own width with `useElementWidth` and gets `nav`/`onNav` and
`selectedDate`/`onTapDay` from the card. The pure geometry is extracted to
`src/lib/d3layout.ts`. The d3 selection/animation code is intentionally **loosely typed
(`any`) at the d3 boundary**: keep it that way rather than fighting d3's generics. Its
correctness is mostly covered by E2E render checks; `CalendarPanel.test.tsx` checks the wiring
(cells drawn, taps, selection outline, tooltip) under jsdom. The d3 build is gated off while
collapsed. Selection highlight and `pal` are kept out of the main build (separate effect /
`useMemo`) so a tap doesn't re-ripple the heatmap. A cell outlives a change of `today`, so
anything in the build that depends on `today` or on the selection must be set on the merged
(enter + update) selection, not only on enter.

**Modals and forms.** A modal (Settings) renders through `ModalShell`, which passes its content a
`requestClose(then?)`: it plays the close animation, then runs `then` and `onClose`. The
duration is `CLOSE_MS`, handed to the CSS as `--modal-close-ms`, so don't add close timers in a
modal. Units are added and edited through the shared `UnitForm` (Settings and the habit form's
"+ Custom..." unit), which validates with `buildUnit` and shows why it can't submit. The
habit form's Group menu (`GroupField`) makes a group the same way, with "+ New group…".
Emojis are picked from a grid, the shared `EmojiPicker` (the habit form's icon, and a group's
in `GroupField` and `GroupEditPage`), never typed: a text box is no way to choose one on a phone.
Hold-to-edit (`useLongPress`, on cards, group chips and section headers) is cancelled by a
finger moving more than 10px, and after a hold fires it prevents the release's click: the
editor it opened is under the finger. While a slide runs, a touch or click lands on the page as a
whole, so E2E specs wait for it with `slideDone` (`createHabit` does).
Components send edits up from their **event handlers, not from effects** watching local state:
`DayEditor` writes each edit as it's made (mounting writes nothing, even under StrictMode's
double effects), and `SetInput` derives its carried-over weight from the latest set instead of
copying it into state.

**Styling — CSS Modules.** Each component has a colocated `Component.module.css`; the
component imports `styles` and sets `className={styles.x}` (Vite types `*.module.css` via
`vite/client`; no config). Equal-width / wrapping layouts use **CSS grid** (e.g. the emoji
picker and intensity selector in `HabitFormFields`, the fields of `UnitForm`). State
is expressed as **modifier classes** (`className={`${styles.btn}${on ? " "+styles.on : ""}`}`)
and hover/focus via **`:hover`/`:focus-visible`** (not `onMouseEnter` handlers). Shared form
classes (`inp`, `lbl`) live in `src/styles/shared.module.css` and are pulled in with `composes:`.

There are two things CSS Modules **don't** own:

- **Theme tokens + keyframes stay global**, defined in `src/theme.ts` (`THEME_CSS`) and
  `src/globalCss.ts` (`CSS`) and injected once via `<style>{CSS + THEME_CSS}</style>` in `App`
  (`THEME_CSS` sets the `--c-*` vars on `:root`/`[data-theme="light"]`; `CSS` holds
  `@keyframes` + global resets + the `.stagger-child`/`.reorder-drag` utility classes). Module
  classes consume `var(--c-*)` and reference the global keyframe names. The app font is set
  once on `App`'s root class and inherited.
- **Runtime values** — per-habit palette colours (`pal.shades[i]`), dnd-kit transforms, and the
  d3 SVG — can't be static classes. Palette colours are passed as **inline CSS custom
  properties** consumed by a class (`style={{ "--p4": pal.shades[4] }}` → `.x { color: var(--p4) }`);
  see `--p*` in `QuickLogSection`, `--tb-a*`/`--set-*`/`--de-*` in the timer/set/day-editor
  modules. The **d3 layer in `CalendarPanel` stays imperative** (only its React chrome is a module);
  `BrandMark` (size-driven, runtime-generated keyframes) and the dnd transform on
  `SortableHabitCard` also stay inline. No CSS framework.

**PWA.** Configured in `vite.config.ts` via `vite-plugin-pwa` (`autoUpdate`, standalone
manifest, font runtime-cache). iOS home-screen meta tags and `viewport-fit=cover` are in
`index.html`; the app pads with `env(safe-area-inset-*)` so content clears the notch/home
indicator. Icons are generated by the dependency-free `scripts/generate-icons.mjs`.

## Tests

Three layers. Unit/component tests are colocated as `*.test.ts(x)` next to their source
(Vitest + Testing Library, jsdom via `src/test/setup.ts`). Tests touching `storage` import
`fake-indexeddb/auto`. E2E specs live in `e2e/` and run against the **built + previewed** app
so the real service worker is active (see the red–green workflow above for how tests drive
development). Date-dependent E2E specs set the time with Playwright's `page.clock`, and read
how a day is drawn with the `dayCell` and `dayFill` helpers (cells are found through their d3
datum). The routines spec moves the clock with `page.clock.fastForward`: a run works from
timestamps, and `runFor` replays every animation frame, which is slow over minutes.
Vitest doesn't build CSS Modules, so a broken `composes:` path only shows in `npm run build`
(which the E2E run does first).
