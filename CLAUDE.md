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
- End every commit message with the trailer:
  `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.
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
current-format state), and `defaults` (storage key, built-in units, default config,
month/weekday labels). Prefer adding logic here over inside components. `boundary.test.ts`
enforces the purity: a lib module may import only other lib modules, `../types`, and
`idb-keyval`.

**Shared non-lib constants** live in two root modules: `src/theme.ts` (`THEMES`, the `C`
CSS-variable tokens, `THEME_CSS`, the palettes + `resolvePalette`, the font `F`) and
`src/globalCss.ts` (`CSS`). `src/download.ts` (`downloadJson`) is the shared file-download
helper; it needs the DOM, so it isn't in lib. Anything used by a single component sits with
it (`EMOJIS` in `components/emojis.ts`, the d3 easing `D3E` inside `D3Calendar`).

**The data model is nested and worth internalizing** (`src/types.ts`):
`Logs = habitId → dateKey → DayLog`, where `DayLog = metricId → (number | SetEntry[])`.
A metric is either **normal** (numeric, e.g. minutes/reps) or **sets mode** (`SetsMetric`,
`mode: "sets"`, storing `{w, r}[]` weight×reps, with its own `setFields` schema and
`setValue`; `isSetMetric` narrows to it). Most helpers (`logLevel`, `metricVal`,
`metricActive`, `logSummary`) operate on a **single `DayLog`**, while `D3Calendar` and
`habitStats` take one habit's `HabitLogs` (`dateKey → DayLog`). Intensity colouring has two
modes per habit (`intensityMode`): `total` (sum vs `thresholds`) or `coverage` (fraction of
metrics done), both producing a level 0–4 that maps to a palette shade.

**Data is normalized once, at the boundary (`src/lib/normalize.ts`).** Everything read from
IndexedDB or a backup file passes through `normalizeState`, which fills in what older data
lacks (a habit's `metrics`/`intensityMode`, a sets metric's `setFields`/`setValue`, config
settings, built-in units) and stamps `schemaVersion`. The types therefore mark those fields
required, and code that reads state must **not** add its own fallbacks for old data (no
`habit.metrics || []`): a new default or a format migration goes in `normalizeState`, with
a `SCHEMA_VERSION` bump for a migration. It rejects data it can't read, including a
`schemaVersion` newer than its own.

**"Today" is passed in, never looked up (`src/hooks/useToday.ts`).** `App` calls
`useToday()` once and passes `today` (a date key) down as a prop; lib functions that depend
on the date (`habitStats`, `findLastSet`, `getRecentDays`, the two layouts) take it as a
parameter. Don't call `todayK()` or `new Date()` to find the date in lib or in a component:
`todayK()` is for the hook, plus one-off stamps such as the backup filename. The hook keeps
the key current while the app stays open, with a timeout for the next midnight and a re-check
on `visibilitychange` (an iOS home-screen app resumes instead of reloading). It applies the
new day on the next animation frame, so d3's animation clock catches up first after the page
was asleep. Tests pass a fixed `today`; they never build keys from the real clock.

**State & persistence (`src/App.tsx`).** `App` is the single stateful container: it holds
`habits`, `logs`, `units`, `appConfig`, and `timers`, and every mutation funnels through one
`save()` callback → `storage.saveState()`. On mount it calls `requestPersistence()` (asks iOS
to keep storage durable) then `loadState()`, which migrates a legacy `habit-tracker-v2` key
forward to `habit-tracker-v3` and returns normalized state. If the stored data can't be
normalized, `loadState` copies it to the `habit-tracker-recovery` key and rejects with an
`InvalidDataError`; `App` then shows its load-error screen (where saving is blocked) with a
"Download raw data" button. There is no external state library and no backend. The dashboard
is a **single view** (no Log Entry tab) with a persisted `appConfig.dashView` (`quick` |
`calendar`) toggle.

**`D3Calendar` is the one imperative component.** It renders the SVG heatmap/calendar via d3
data-joins inside a `useEffect`; the pure geometry is extracted to `src/lib/d3layout.ts`. The
d3 selection/animation code is intentionally **loosely typed (`any`) at the d3 boundary** —
keep it that way rather than fighting d3's generics; correctness there is covered by E2E render
checks, not unit tests. Each card collapses (Quick) or expands to its heatmap (Calendar) via an
`expanded` prop, animated with `grid-template-rows`; the d3 build is gated off while collapsed.
Tapping a calendar day opens an inline `DayEditor` for that date (exact-value entry +
back-dating). Selection highlight and `pal` are kept out of the main build (separate effect /
`useMemo`) so a tap doesn't re-ripple the heatmap. A cell outlives a change of `today`, so
anything in the build that depends on `today` or on the selection must be set on the merged
(enter + update) selection, not only on enter.

**Styling — CSS Modules.** Each component has a colocated `Component.module.css`; the
component imports `styles` and sets `className={styles.x}` (Vite types `*.module.css` via
`vite/client`; no config). Equal-width / wrapping layouts use **CSS grid** (e.g. the emoji
picker and intensity selector in `HabitFormFields`, the unit forms in `SettingsModal`). State
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
  modules. The **d3 layer in `D3Calendar` stays imperative** (only its React chrome is a module);
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
how a day is drawn with the `dayCell` helper (cells are found through their d3 datum).
