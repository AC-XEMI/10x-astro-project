# Vitest and mutation-testing baseline Implementation Plan

## Overview

Give the project a real unit-test layer (Vitest) for the core detection pipeline — the report
parser and the three deviation rules — and make Stryker mutation testing run end to end against
it. The Vitest suite replaces the dependency-free `verify:report-detection` script as the single
oracle for "which rows get flagged", runs in CI, and gets one round of strengthening driven by the
first mutation report.

## Current State Analysis

- No test framework is configured (CLAUDE.md:162). `vitest@5.0.3` is present only transitively,
  via `@stryker-mutator/vitest-runner@10.0.0` (peer `vitest >=2.0.0`). There is no
  `vitest.config.*`. Vitest 5.0.3 accepts the installed Vite 8.3.0 (`astro` requires `vite ^8`).
- Stryker is half set up in the user's **uncommitted** working tree: `package.json` adds
  `@stryker-mutator/core` and `@stryker-mutator/vitest-runner`, `.gitignore` adds `.stryker-tmp`, and the untracked
  `stryker.config.json` (vitest runner, `perTest` coverage, `mutate: src/**/*.ts`, thresholds
  80/60, `break: null`, plus `ignorePatterns` added in-session to fix the `EPERM` copy of the
  `.claude/skills/10x-cli-*` symlinks). The current run stops at "No tests were executed".
- `scripts/verify-report-detection.mjs` (215 lines) is the existing oracle. Against
  `test-data/sample-report.{csv,xlsx}` (15 data rows) it asserts:
  - `missing_gps` at indexes 1, 3 and 8 (within 0–8);
  - `route_deviation` at 4, 6 and 8 (4 carries „poza zaplanowaną trasą”, 6 and 8 carry „nadmiarowy dystans”);
  - index 8 is flagged by both rules;
  - zero deviations at 0, 2, 5 and 7;
  - no route flags at 9–14;
  - `phone_instead_of_visit` at 3 and 9 (explicit „telefon”) and at 10, 11 and 12 (heuristic, detail „brak GPS”), none at 13 and 14.
- `src/lib/services/report-parser.ts:66` `parseReportFile(bytes, filename)` returns
  `{ rows } | { error }`, with 9 error returns (lines 78, 81, 87, 101, 133, 138, 156, 161,
  165/171): unsupported extension, unreadable file, no data rows, missing required columns,
  empty `przedstawiciel` / `data_wizyty`, bad date format, bad `gps_wlaczony` value. The
  fixtures exercise only the happy path.
- `src/lib/services/deviation-rules.ts` holds three pure functions:
  - `detectMissingGps`;
  - `detectPhoneInsteadOfVisit` — explicit „telefon”, explicit „wizyta” short-circuit, heuristic
    `!gps && (time === null || time <= 0)`;
  - `detectRouteDeviations` — groups explicit „wizyta” rows by representative and day in input
    order; checks against the planned route (case-insensitive, trimmed); flags
    `distance_km > haversine × 1.5`; skips the first visit of the day and always advances the
    reference point.

  It imports `haversineDistanceKm` from `src/lib/services/geo.ts` through the `@/` alias.
- CI (`.github/workflows/ci.yml`) job `ci`: `npm ci` → `astro sync` → lint → `astro check` →
  build. No test step.
- `tsconfig.json` includes `**/*`, so new `*.test.ts` files are type-checked by `astro check` and
  linted by `npm run lint`.

## Desired End State

`npm test` runs a Vitest suite (`src/lib/services/*.test.ts`) covering `geo.ts`, `report-parser.ts`
and `deviation-rules.ts`, including every assertion the old script made. `npm test` runs in CI on
every push and PR. `npm run test:mutation` completes and produces an HTML and clear-text report for
exactly those three files. The baseline score and the score after one strengthening round are
recorded in `context/changes/vitest-mutation-baseline/mutation-baseline.md`. `verify:report-detection`
no longer exists. CLAUDE.md describes the test commands instead of saying no framework exists.

### Key Discoveries:

- `src/lib/services/report-parser.ts:66-81` — format is chosen by file extension; CSV bytes are decoded as UTF-8 text, so tests can build CSV inputs with `TextEncoder` and pass `"x.csv"`.
- `src/lib/services/deviation-rules.ts:1-3` — runtime import through `@/lib/services/geo`; Vitest needs the `@` → `./src` alias (the old script needed a custom Node resolve hook for this).
- `scripts/verify-report-detection.mjs:35-41` — the index sets above are the oracle to port verbatim.
- `stryker.config.json` `mutate` already excludes `src/**/*.test.ts` — co-located tests fit it.

## What We're NOT Doing

- No tests for other `src/lib/**` modules (`report-columns.ts`, `dashboard-stats.ts`, error-code helpers) or for UI/API code.
- No Stryker step in CI and no `break` threshold — the baseline is recorded, not enforced.
- Not chasing mutants that only change user-facing message text (would force brittle string assertions); those survivors are listed, not killed.
- No `/10x-test-plan` (`context/foundation/test-plan.md`) — this change is a standalone baseline.
- No change to `npm run smoke` or `npm run verify:rls`.
- No changes to parser or rule behaviour; if a test exposes a bug, it is reported, not fixed here.

## Implementation Approach

Infrastructure first, proven by one small real test. Port the script's oracle into Vitest and
extend it to the parser's error branches and the rules' boundaries, then retire the script. Last,
run Stryker for a baseline, kill logic survivors once, and record both scores.

## Critical Implementation Details

- **User's uncommitted files.** `package.json`, `package-lock.json`, `.gitignore`,
  `stryker.config.json` (Phase 1) and `CLAUDE.md` (Phase 2) carry the user's in-progress edits.
  The Stryker-related edits in the first four belong to this change and are committed in Phase 1.
  The `CLAUDE.md` working copy also holds an unrelated toolkit-block swap that must **not** be
  committed: stage only this change's lines (apply them to the `HEAD` version in the index).
- **Vitest include.** Vitest's default include would also pick up `.claude/skills/**/*.test.mjs`
  and `.ds-sync/**`. Restrict it to `src/**/*.test.ts`.

## Phase 1: Vitest and Stryker infrastructure

### Overview

Make `npm test` and `npm run test:mutation` work, proven by one real test.

### Changes Required:

#### 1. Dependencies and scripts

**File**: `package.json`, `package-lock.json`

**Intent**: Make `vitest` a direct devDependency, at the version already resolved, and keep the
user's two Stryker devDependencies. Add the scripts.

**Contract**:
- devDependencies: `vitest` (`^5.0.3`), `@stryker-mutator/core`, `@stryker-mutator/vitest-runner`.
- scripts: `"test": "vitest run"`, `"test:mutation": "stryker run"`.

#### 2. Vitest config

**File**: `vitest.config.ts` (new)

**Intent**: Run only the app's unit tests in a Node environment, with the same `@/` alias as
`tsconfig.json`.

**Contract**:
- `test.include: ["src/**/*.test.ts"]`
- `test.environment: "node"`
- `resolve.alias`: `@` → `./src`

#### 3. Stryker config and ignore

**File**: `stryker.config.json`, `.gitignore`

**Intent**: Commit the user's Stryker setup, scoped to the files this change tests.

**Contract**:
- `mutate`: `src/lib/services/report-parser.ts`, `src/lib/services/deviation-rules.ts`, `src/lib/services/geo.ts`.
- Keep `ignorePatterns`, `testRunner: "vitest"`, `coverageAnalysis: "perTest"`, thresholds 80/60 and `break: null`.
- Point the runner at the config: `vitest.configFile: "vitest.config.ts"`.
- `.gitignore` keeps `.stryker-tmp`; add `reports/mutation` (the HTML reporter's output).

#### 4. First test

**File**: `src/lib/services/geo.test.ts` (new)

**Intent**: Prove the toolchain and cover haversine, which the route rule depends on.

**Contract**:
- Zero distance for identical points.
- Symmetry.
- One known reference distance between two Polish cities, asserted with a tolerance.

### Success Criteria:

#### Automated Verification:

- `npm test` passes and reports `geo.test.ts`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- `npm run test:mutation` completes (exit 0) and mutates exactly the 3 configured files

#### Manual Verification:

- `git diff --cached` for this phase contains no unrelated changes from the user's working tree (CLAUDE.md untouched)

**Implementation Note**: After automated verification passes, pause for manual confirmation before the next phase.

---

## Phase 2: Parser and rule tests replace the script

### Overview

Port every assertion of `verify:report-detection` to Vitest, extend it to error branches and
boundaries, retire the script and run the tests in CI.

### Changes Required:

#### 1. Parser tests

**File**: `src/lib/services/report-parser.test.ts` (new)

**Intent**: Cover the happy path on both real fixtures, and every error return on small inline CSVs.

**Contract**:
- Both `test-data/sample-report.csv` and `.xlsx` parse into 15 rows; spot-check field mapping of one row (types: boolean GPS, number/null distance and time, planned route array).
- One test per error branch:
  - unsupported extension (`.txt`);
  - unreadable or garbage bytes;
  - header only, no data rows;
  - missing required columns (the message names them);
  - empty `przedstawiciel`, empty `data_wizyty`;
  - bad date format;
  - bad `gps_wlaczony` value.
- Header matching is case-insensitive.

#### 2. Rule tests

**File**: `src/lib/services/deviation-rules.test.ts` (new)

**Intent**: Carry the script's oracle verbatim on both fixtures, and pin each rule's boundaries on
minimal inline visits built by a small local helper.

**Contract**:
- Fixture block, run for CSV and XLSX: the index sets and detail substrings from
  `scripts/verify-report-detection.mjs:35-41` and `:89-213`.
- `detectMissingGps`: GPS on → `null`; GPS off → `"missing_gps"`.
- `detectPhoneInsteadOfVisit`:
  - „telefon” in any case or with spaces → flagged with GPS on;
  - „wizyta” → `null` even with no GPS and time 0;
  - heuristic at time 0, null and negative → flagged;
  - time 1 → `null`;
  - GPS on → `null`.
- `detectRouteDeviations`:
  - first visit of the day is never distance-checked;
  - distance exactly at 1.5× the straight line is not flagged, just above is;
  - `distance_km` 0 or null is not checked;
  - a visit without coordinates does not reset the previous point;
  - different representative or day starts a new group;
  - non-„wizyta” rows are excluded;
  - planned route matches case-insensitively and trimmed;
  - an empty or non-string planned route means no plan check;
  - both reasons are joined with „; ”.

#### 3. Retire the script, wire CI

**File**: `scripts/verify-report-detection.mjs` (delete), `package.json`, `.github/workflows/ci.yml`

**Intent**: One oracle, run on every push.

**Contract**:
- Remove the `verify:report-detection` script entry.
- Job `ci`: add `- run: npm test` after `npm run lint`.

#### 4. Docs

**File**: `CLAUDE.md` (only this change's lines staged)

**Intent**: Replace the `verify:report-detection` command line and the "No test framework is
configured" bullet with the real commands and where tests live.

**Contract**:
- Commands section: `npm test` (Vitest, `src/**/*.test.ts`) and `npm run test:mutation` (Stryker, 3 service files, report in `reports/mutation/`).
- Key conventions: tests co-located as `*.test.ts`; parser and rule changes must keep `report-parser.test.ts` and `deviation-rules.test.ts` green.

### Success Criteria:

#### Automated Verification:

- `npm test` passes; suite includes `report-parser.test.ts` and `deviation-rules.test.ts`
- Every assertion from `scripts/verify-report-detection.mjs` has a Vitest counterpart (checked against the script before deletion)
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build passes: `npm run build`
- `scripts/verify-report-detection.mjs` and the `verify:report-detection` script entry no longer exist

#### Manual Verification:

- CI run on the pushed branch shows the new `npm test` step green
- Staged `CLAUDE.md` diff contains only this change's lines

**Implementation Note**: After automated verification passes, pause for manual confirmation before the next phase.

---

## Phase 3: Mutation baseline and one strengthening round

### Overview

Measure, kill logic survivors once, measure again, record both.

### Changes Required:

#### 1. Baseline

**File**: `context/changes/vitest-mutation-baseline/mutation-baseline.md` (new)

**Intent**: Record the first full `npm run test:mutation` result.

**Contract**:
- Per-file and total mutation score.
- Killed, survived, no-coverage and timeout counts.
- Survivors listed and classified as logic or message-text.

#### 2. Strengthening round

**File**: `src/lib/services/*.test.ts`

**Intent**: Add or sharpen tests so the logic survivors (conditions, boundaries, grouping,
returned values — not message wording) are killed.

**Contract**:
- Tests only; no production-code changes.
- Message-text survivors stay listed under "deliberately not killed" in the baseline file.

#### 3. Second run

**File**: `context/changes/vitest-mutation-baseline/mutation-baseline.md`

**Intent**: Record the post-round score next to the baseline, with the remaining survivors and why
they remain.

**Contract**: "Before / After" table per file and in total.

### Success Criteria:

#### Automated Verification:

- `npm run test:mutation` completes (exit 0) twice; both results recorded in `mutation-baseline.md`
- `npm test` passes
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- The after-round score is higher than the baseline, and no logic survivor remains unexplained in `mutation-baseline.md`

#### Manual Verification:

- The HTML report (`reports/mutation/mutation.html`) opens and its remaining survivors match the list in `mutation-baseline.md`

---

## Testing Strategy

### Unit Tests:

- Parser: both fixtures, plus every error branch on inline CSV.
- Rules: the fixture oracle, plus boundary tables on inline visits.
- Geo: identity, symmetry, one reference distance.

### Manual Testing Steps:

1. `npm test` locally — all green.
2. `npm run test:mutation` — open `reports/mutation/mutation.html`, compare with `mutation-baseline.md`.
3. Push — CI `ci` job shows `npm test`.

## References

- Oracle being replaced: `scripts/verify-report-detection.mjs`
- Fixtures: `test-data/sample-report.csv`, `test-data/sample-report.xlsx`
- Code under test: `src/lib/services/report-parser.ts`, `src/lib/services/deviation-rules.ts`, `src/lib/services/geo.ts`
- Stryker vitest runner: https://stryker-mutator.io/docs/stryker-js/vitest-runner

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vitest and Stryker infrastructure

#### Automated

- [x] 1.1 `npm test` passes and reports `geo.test.ts` — 683b19e
- [x] 1.2 Lint passes: `npm run lint` — 683b19e
- [x] 1.3 Type check passes: `npx astro check` — 683b19e
- [x] 1.4 `npm run test:mutation` completes (exit 0) and mutates exactly the 3 configured files — 683b19e

#### Manual

- [x] 1.5 `git diff --cached` for this phase contains no unrelated changes from the user's working tree (CLAUDE.md untouched) — 683b19e

### Phase 2: Parser and rule tests replace the script

#### Automated

- [x] 2.1 `npm test` passes; suite includes `report-parser.test.ts` and `deviation-rules.test.ts` — a59f6ce
- [x] 2.2 Every assertion from `scripts/verify-report-detection.mjs` has a Vitest counterpart (checked against the script before deletion) — a59f6ce
- [x] 2.3 Lint passes: `npm run lint` — a59f6ce
- [x] 2.4 Type check passes: `npx astro check` — a59f6ce
- [x] 2.5 Build passes: `npm run build` — a59f6ce
- [x] 2.6 `scripts/verify-report-detection.mjs` and the `verify:report-detection` script entry no longer exist — a59f6ce

#### Manual

- [ ] 2.7 CI run on the pushed branch shows the new `npm test` step green
- [x] 2.8 Staged `CLAUDE.md` diff contains only this change's lines — a59f6ce

### Phase 3: Mutation baseline and one strengthening round

#### Automated

- [x] 3.1 `npm run test:mutation` completes (exit 0) twice; both results recorded in `mutation-baseline.md`
- [x] 3.2 `npm test` passes
- [x] 3.3 Lint passes: `npm run lint`
- [x] 3.4 Type check passes: `npx astro check`
- [x] 3.5 The after-round score is higher than the baseline, and no logic survivor remains unexplained in `mutation-baseline.md`

#### Manual

- [x] 3.6 The HTML report (`reports/mutation/mutation.html`) opens and its remaining survivors match the list in `mutation-baseline.md`
