# Architecture refactor plan

A phased plan for the issues found in the November 2026 architectural review.
Each phase leaves `main` green and deployable (every push to `main` deploys to
GitHub Pages). Each checklist item is one red–green commit, per the workflow in
`CLAUDE.md`: write the test, see it fail for the right reason, make it pass,
commit.

## Why

The review found these problems, most important first:

1. **A failed load can overwrite the only copy of the data.** If `loadState()`
   throws, `App` starts empty and the next change saves that empty state over
   the real data. Save failures are only logged to the console.
2. **Stored data has no version and isn't normalized.** Defaults for older data
   are filled in wherever they're read, and import only checks the top-level
   shape.
3. **State in `App` is copied and saved in a fragile way.** Twelve change
   functions work from render-time snapshots and call a four-argument `save()`;
   timers ride along on a ref. These changes are only tested end-to-end.
4. **`D3Calendar` is really the whole habit card:** 863 lines, 18 props, about
   eight responsibilities.
5. **Weighted-set habits only show empty or full colour on the heatmap.** Their
   value is volume (weight × reps), but it's compared against the reps
   thresholds.
6. **"Today" is read from the clock throughout lib and render**, so lib
   functions aren't pure and an app left open past midnight keeps treating
   yesterday as today.
7. **`constants.ts` is a grab bag**, it imports d3, and lib depends on it.
8. **Duplication and dead code:** the custom-unit form, the modal close timing,
   the volume unit label, plus unused components, helpers and CSS.
9. **Effects are used to send changes upward** in `DayEditor` and `SetInput`.

Plus smaller items: streak shows 0 until today is logged, IDs come from
`Date.now()`, and CI doesn't run `format:check` or E2E.

## Overview

| Phase | Theme                                        | Size | Users notice?           | Depends on |
| ----- | -------------------------------------------- | ---- | ----------------------- | ---------- |
| 1     | Data safety                                  | S    | Yes (error messages)    | —          |
| 2     | Groundwork: dead code, `constants` split, CI | S    | No                      | —          |
| 3     | Versioned, normalized data                   | M    | No                      | 2          |
| 4     | Explicit "today"                             | M    | Yes (midnight rollover) | —          |
| 5     | Domain fixes: weighted-set colour, streak    | S    | Yes                     | 3, 4       |
| 6     | State reducer                                | L    | No                      | 4          |
| 7     | Split the habit card                         | L    | No                      | 6          |
| 8     | Forms, modals, effect cleanup                | M    | No                      | 7 (partly) |

"Today" comes before the state reducer so the reducer can be pure from the
start.

## Phase 1: Data safety

**Goal:** the app can never overwrite data it failed to read, and you find out
when a save fails.

- [x] **Load errors.** `App` gets a `loadError` state. While it's set, the app
      shows a "Couldn't open your data, nothing was changed" screen with a Retry
      button, and `save()` does nothing.
  - New `App.test.tsx` mocks `lib/storage`: when `loadState` rejects, the error
    screen shows and `saveState` is never called.
  - With no habits rendered, jsdom needs no ResizeObserver stub.
- [x] **Save errors.** A failed save shows a persistent banner ("Changes aren't
      being saved — export a backup"). The next successful save clears it.
      Tested by making `saveState` reject.

## Phase 2: Groundwork (no behaviour change)

**Goal:** shrink the code before refactoring, and enforce that lib stays pure.

- [ ] **Delete dead code:**
  - `LiveTimer.tsx`
  - `setsVolume`, `setsTotalReps`, `setsMaxWeight`, `findLastWeight` and their
    tests
  - the `.panel-slide-*`, `.date-shift-*` and `.save-pulse` classes
  - the `fadeSlide*`, `dateShift*` and `pulseGlow` keyframes (`fadeIn` is still
    used, so it stays)
  - `THEMES.*.emptyCell`, and `Cell.r` / `Cell.vis`
- [ ] **Split `constants.ts`:**
  - `src/lib/defaults.ts`: `STORAGE_KEY`, `BUILTIN_UNITS`, `DEFAULT_CONFIG`,
    `MONTHS`, `WK_FULL`
  - `src/theme.ts`: `THEMES`, `C`, `THEME_CSS`, the palettes, `resolvePalette`,
    `F`
  - `src/globalCss.ts`: `CSS`
  - `EMOJIS` moves next to `HabitFormFields`, and `D3E` moves into
    `D3Calendar`.
- [ ] **Boundary test.** A test scans the imports in `src/lib/*.ts` (not test
      files) and fails on anything outside `lib/`, `types`, or an allowlist
      (just `idb-keyval`). It goes green once the split lands.
- [ ] **CI: format check.** Add `npm run format:check` to the deploy workflow.
- [ ] **CI: E2E.** Add an E2E job
      (`npx playwright install --with-deps chromium && npm run e2e`) that must
      pass before deploy. Phases 6 and 7 rely on E2E as the safety net, so it
      should be in CI before then.
- [ ] Update `CLAUDE.md` where it describes `constants`.

## Phase 3: Versioned, normalized data

**Goal:** one function turns any stored or imported data into a complete,
current-format state.

- [ ] **`src/lib/normalize.ts`.** `normalizeState(raw: unknown)` returns
      `{ ok: true, state } | { ok: false, reason }`. It fills in all defaults
      once:
  - `metrics: []` and `intensityMode: "total"`
  - explicit `setValue` / `setFields` on sets metrics (old metrics with only
    `weightUnit` get the weighted schema)
  - config merged over `DEFAULT_CONFIG`
  - built-in units added when missing
  - a new `schemaVersion: 1`
  - **Tests:** an old v2-shaped fixture, a partial config, running it twice
    gives the same result, and non-objects are rejected.
- [ ] **On load.** `loadState` runs it. If normalization fails, the raw data is
      copied to a recovery key, and the Phase 1 error screen gains a "Download
      raw data" button.
- [ ] **On import and export.** Import uses `normalizeState` instead of the
      hand-written check in `SettingsModal`, and export writes `schemaVersion`.
- [ ] **Tighten the types.** Make those fields required in `types.ts` and
      delete the defaults applied at read time: `setValue ?? "volume"` (4
      places), `habit.metrics || []`, `appConfig || DEFAULT_CONFIG`, and the
      fallback in `setFieldsOf`. This touches many files, but TypeScript points
      to every one.

## Phase 4: Explicit "today"

**Goal:** lib functions no longer read the clock, and the UI rolls over at
midnight.

- [ ] **Date helpers.** Add `addDays(key, n)` and `parseKey(key)` to
      `dates.ts`.
- [ ] **Pass `today` in.** `habitStats`, `findLastSet`, `getRecentDays`,
      `compactHeatLayout` and `compactCalLayout` take a `today` parameter. Their
      tests switch to fixed dates instead of keys built from `new Date()`.
- [ ] **`useToday()` hook.** Returns today's key and sets a timeout for the next
      midnight. It also re-checks on `visibilitychange`, because an iOS
      home-screen app resumes from the background rather than reloading. Tested
      with fake timers.
- [ ] **Wiring.** `App` calls `useToday()` once and passes `today` down.
      `QuickLogSection`, `DayEditor` and `D3Calendar` stop calling `todayK()`.
- [ ] **E2E.** Use Playwright's `page.clock` to cross midnight and check that
      the today outline moves.

## Phase 5: Domain fixes

Both items need a decision; the recommendation is given for each.

### Weighted-set heatmap colour

**Recommendation:** add a built-in `volume` unit and have the weighted preset
use it instead of `reps`. Its thresholds would be something like
`[1000, 2500, 5000]`, editable in Settings.

- It fits the existing model: `logLevel`'s threshold lookup just works.
- It also fixes a second bug. Today a habit with both a weighted and a
  reps-only metric sums volume and reps together, because both are labelled
  "reps". With distinct units, the form switches it to coverage mode
  automatically.
- The card's stat label becomes "Volume" instead of calling a volume total
  "Reps".
- Caveat: kg and lbs share the same thresholds.

Steps:

- [ ] Weighted preset uses the `volume` unit; `logLevel` tests cover the new
      levels. Check whether the sets E2E spec needs updating for the new label.
- [ ] Migration in `normalizeState`: existing weighted metrics with
      `unit: "reps"` become `volume`.

### Streak

**Recommendation:** the current streak counts through yesterday until today is
over, so a 30-day streak doesn't show "0d" at 8am.

- [ ] Test-first fix in `habitStats`.

## Phase 6: State reducer

**Goal:** every state change is a pure, tested function, and saving happens in
one place.

- [ ] **`src/lib/state.ts`.** `reduce(state, action)`, built one group of
      actions per commit:
  - habits: add, update, delete, reorder
  - logs: set a day, add, reset, add a set, remove a set
  - timers: start and stop (stop adds the rounded minutes to the given day)
  - units, config, and replace-all
  - Actions carry `id`, `now` and `dateKey`, computed by the caller. That keeps
    the reducer pure, which matters because React runs reducers twice in dev
    mode.
- [ ] **`src/lib/ids.ts`.** `newId(prefix)` uses `crypto.randomUUID()` when it
      exists, with a fallback for the plain-HTTP `devbox.lan` host.
- [ ] **Switch `App` to `useReducer`.**
  - One effect saves the state once it has loaded, and never while `loadError`
    is set.
  - `timersRef`, the four-argument `save` and all the dependency arrays go
    away.
  - `App.test.tsx` gets tests that act through the UI and check what
    `saveState` receives.
- [ ] **Wiring.** Cards get one `useHabitActions(habitId)` helper instead of 8
      callbacks, and the duplicate `habitId` prop is dropped. Smaller components
      keep their callback props, so their tests don't change.

This is the riskiest internal change, because the whole save path moves. Run
E2E before merging.

## Phase 7: Split the habit card

**Goal:** `D3Calendar` shrinks to the d3 code its name describes.

- [ ] **`src/lib/calendarNav.ts`.** A pure reducer over
      `{ offset, zoomed, view }`.
  - Tests for the edge cases: forward at offset 0 zooms in, back while zoomed
    zooms out, and forward from −N clamps to 0.
  - This removes the `setZoomed` call inside the `setOffset` updater, and
    `canFwd` becomes `!zoomed`.
- [ ] **Hooks.** Extract `useLongPress` and `useElementWidth`, tested with fake
      timers and a mocked ResizeObserver.
- [ ] **`CalendarPanel`.** Extract the controls, SVG, legend, tooltip and the
      three d3 effects. Move the d3 code as-is and keep it loosely typed.
- [ ] **Rename.** `git mv` what's left (and its CSS module) to `HabitCard.tsx`
      so the file history follows. Update `CLAUDE.md`'s architecture section.
- [ ] Merge the two copies of the auto-zoom-on-quick-log code into one handler.

d3 behaviour is only covered by E2E, so run E2E after each commit in this
phase, not just at the end.

## Phase 8: Forms, modals, effect cleanup

- [ ] **Unit form.** `src/lib/units.ts` gets `parseNumList`, `normalizeUnitId`
      and a validating `buildUnit(form)`. A shared `UnitForm` component replaces
      the duplicate forms in `SettingsModal` and `HabitFormFields`.
- [ ] **Modal closing.** `ModalShell` owns the close animation. It exposes
      `requestClose` and calls `onClose` when the animation ends. That replaces
      the three `setTimeout(onClose, 350)` copies and the hard-coded 350.
- [ ] **`DayEditor`.** Call `onChange` from the event handlers instead of an
      effect, and drop the ref that skips the first run.
  - Tests: mounting writes nothing, which also removes the extra dev-mode
    write. Each edit writes exactly once.
- [ ] **`SetInput`.** Reset its fields inside `add()` instead of the `prevLen`
      effect.
- [ ] **Small dedupes.** `fmtSets` reuses `setUnitLabel`, and
      `QuickLogSection`'s four branches share one `IntensityBar` component.

## Left out on purpose

Saving the whole state on every change stays as it is. It's fine at personal
scale.

## Open decisions

- **Phase 1:** wording of the load-error screen and save-failure banner.
- **Phase 5:** the `volume` unit approach and its default thresholds.
- **Phase 5:** streak counting through yesterday until today is over.
