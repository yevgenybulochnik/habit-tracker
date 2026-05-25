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
node scripts/generate-icons.mjs   # regenerate PWA icons into public/

npx vitest run src/lib/stats.test.ts   # run one test file
npx vitest run -t "streak"             # run tests matching a name
```

- **Typecheck** is part of `npm run build` (`tsc --noEmit`); there is no separate lint step.
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
most tests are. `dates` (date keys), `metrics` (unit resolution, sets aggregation, per-metric
values), `stats` (intensity `logLevel`, `logSummary`, `habitStats` incl. streaks), `format`,
`d3layout` (calendar/heatmap cell+label coordinate math), and `storage` (IndexedDB via
`idb-keyval`). Prefer adding logic here over inside components.

**The data model is nested and worth internalizing** (`src/types.ts`):
`Logs = habitId → dateKey → DayLog`, where `DayLog = metricId → (number | SetEntry[])`.
A metric is either **normal** (numeric, e.g. minutes/reps) or **sets mode** (`mode: "sets"`,
storing `{w, r}[]` weight×reps). Most helpers (`logLevel`, `metricVal`, `metricActive`,
`logSummary`) operate on a **single `DayLog`**, while `D3Calendar` and `habitStats` take one
habit's `HabitLogs` (`dateKey → DayLog`). Intensity colouring has two modes per habit
(`intensityMode`): `total` (sum vs `thresholds`) or `coverage` (fraction of metrics done),
both producing a level 0–4 that maps to a palette shade.

**State & persistence (`src/App.tsx`).** `App` is the single stateful container: it holds
`habits`, `logs`, `units`, `appConfig`, and `timers`, and every mutation funnels through one
`save()` callback → `storage.saveState()`. On mount it calls `requestPersistence()` (asks iOS
to keep storage durable) then `loadState()`, which migrates a legacy `habit-tracker-v2` key
forward to `habit-tracker-v3`. There is no external state library and no backend. The dashboard
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
`useMemo`) so a tap doesn't re-ripple the heatmap.

**Styling.** All styling is **inline styles** plus one injected `<style>` block (the `CSS`
const, holding keyframes). Design tokens live in `src/constants.ts`: `C` (colors), `PALETTES`,
`F` (font), and the shared `inpS`/`lbl` style objects (typed `React.CSSProperties` so spreads
like `{...inpS, fontSize: 12}` don't widen literal unions). No CSS framework.

**PWA.** Configured in `vite.config.ts` via `vite-plugin-pwa` (`autoUpdate`, standalone
manifest, font runtime-cache). iOS home-screen meta tags and `viewport-fit=cover` are in
`index.html`; the app pads with `env(safe-area-inset-*)` so content clears the notch/home
indicator. Icons are generated by the dependency-free `scripts/generate-icons.mjs`.

## Tests

Three layers. Unit/component tests are colocated as `*.test.ts(x)` next to their source
(Vitest + Testing Library, jsdom via `src/test/setup.ts`). Tests touching `storage` import
`fake-indexeddb/auto`. E2E specs live in `e2e/` and run against the **built + previewed** app
so the real service worker is active (see the red–green workflow above for how tests drive
development).
