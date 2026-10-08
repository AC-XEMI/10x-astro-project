# Vitest and mutation-testing baseline — Plan Brief

> Full plan: `context/changes/vitest-mutation-baseline/plan.md`

## What & Why

The project has no test framework, so Stryker stops at "No tests were executed". We add Vitest,
write the first unit tests for the core detection pipeline (report parser + three deviation
rules), and get a working mutation-testing run with one round of strengthening — turning the
current ad-hoc `verify:report-detection` script into a real, measured test suite.

## Starting Point

`scripts/verify-report-detection.mjs` checks which fixture rows each rule flags, but it is a plain
Node script outside any framework. `vitest` is installed only transitively via the Stryker runner,
with no config. The user's Stryker setup (deps, `.gitignore`, `stryker.config.json`) sits
uncommitted in the working tree. CI runs lint, type check and build, but no tests.

## Desired End State

`npm test` runs co-located Vitest suites for `geo.ts`, `report-parser.ts` and `deviation-rules.ts`
— every old script assertion plus parser error branches and rule boundaries — and runs in CI.
`npm run test:mutation` completes for those three files; baseline and post-round scores are
recorded in `mutation-baseline.md`. The old script is gone.

## Key Decisions Made

| Decision            | Choice                                                         | Why (1 sentence)                                                                 |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Test location/data  | Co-located `src/lib/services/*.test.ts`; fixtures + inline data | Matches Stryker's existing exclude; inline data hits boundaries fixtures miss.   |
| Old script          | Replace with Vitest, delete script                             | One oracle; Stryker measures the same expectations the team relies on.          |
| CI                  | `npm test` in CI; Stryker local only (`test:mutation`)          | Cheap protection on every push without ~1000-mutant runs in CI.                 |
| Mutation scope      | parser, rules, `geo.ts`; `break: null`                          | Report covers exactly the tested code; baseline first, no arbitrary threshold.  |
| Vitest version      | `^4.1.10` (planned `^5.0.3`, changed in Phase 1)               | The Stryker runner silently never activates mutants on Vitest 5; 4.1 is what it is built against. |
| Done criterion      | One strengthening round on logic survivors                     | Shows Stryker's value now; message-text mutants are listed, not chased.         |

## Scope

**In scope:** Vitest dep + config + scripts; Stryker config scoped to 3 files; tests for geo,
parser (fixtures + all error branches) and rules (oracle + boundaries); delete the script; CI
`npm test`; CLAUDE.md commands; `mutation-baseline.md` with before/after.

**Out of scope:** other `src/lib` modules, UI/API tests, Stryker in CI or a `break` threshold,
killing message-text mutants, `/10x-test-plan`, production-code fixes (bugs found are reported).

## Architecture / Approach

Vitest (Node env, `@` → `./src` alias, include `src/**/*.test.ts`) runs pure-function tests; the
parser reads the real CSV/XLSX fixtures and inline `TextEncoder`-built CSVs. Stryker's vitest
runner mutates the three service files with per-test coverage.

## Phases at a Glance

| Phase                                  | What it delivers                                          | Key risk                                                       |
| -------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Vitest and Stryker infrastructure   | `npm test`, `test:mutation`, geo test, committed Stryker setup | Bundling the user's unrelated uncommitted edits             |
| 2. Parser and rule tests replace script | Full oracle in Vitest, script removed, CI step, CLAUDE.md | An assertion lost in the port                                  |
| 3. Mutation baseline + one round       | Scores before/after in `mutation-baseline.md`             | Survivors only killable via brittle text assertions            |

**Prerequisites:** `npm ci` works; the user's Stryker deps in `package.json` are kept.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- A test may expose a real parser/rule bug — reported, not fixed in this change.
- CLAUDE.md has unrelated uncommitted edits; only this change's lines are staged.

## Success Criteria (Summary)

- `npm test` is green locally and in CI, and covers everything the old script checked.
- `npm run test:mutation` finishes and the post-round score beats the recorded baseline.
