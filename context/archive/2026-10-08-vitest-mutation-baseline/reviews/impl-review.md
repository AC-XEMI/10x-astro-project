<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Vitest and mutation-testing baseline

- **Plan**: context/changes/vitest-mutation-baseline/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Automated criteria were re-run on `62f3677`: `npm test` passes 98 tests, lint has 0 errors, and `astro check` has 0 errors. CI run 37748307412 on master was green, including the `npm test` step. The three Stryker runs (58.05 → 82.68 → 88.54) are recorded in `mutation-baseline.md`. Manual rows 1.5, 2.7, 2.8 and 3.6 were confirmed by the user in-session; 2.7 is backed by the CI run. Every planned file is present. The extra paths (`.claude/.10x-cli-manifest.json`, CLAUDE.md toolkit block) went into `683b19e` at the user's explicit request. No production code changed, and the "What We're NOT Doing" list was respected.

## Findings

### F1 — Unanchored `ignorePatterns` drop `src/**/reports/` from the Stryker sandbox

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: stryker.config.json (`ignorePatterns`)
- **Detail**: The patterns use gitignore syntax, so `"reports"` matches any directory named `reports`. It was meant only for the mutation report output. A dry run with `--cleanTempDir false` confirmed that the sandbox lacks both `src/components/reports/` and `src/pages/reports/`. This is harmless today, because only `src/lib/services/*` is tested. The first test that imports `DeviationsList.tsx`, `ReportsList.tsx` or a reports page would pass under `npm test` and fail with "module not found" under `npm run test:mutation`. `"context"` and `"dist"` share the same unanchored shape.
- **Fix**: Anchor the root-only patterns with a leading `/` (`/reports`, `/context`, `/dist`, `/.astro`, `/.wrangler`, `/ds-bundle`, `/.claude`, `/.agents`, `/.ds-sync`, `/.design-sync`) and re-run `npm run test:mutation` to confirm the score is unchanged.
- **Decision**: FIXED — patterns anchored with a leading /; sandbox now contains src/**/reports (122 files), test:mutation score unchanged at 88.54%

### F2 — Plan Phase 1 still describes Vitest 5 and `vitest.configFile`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/vitest-mutation-baseline/plan.md (Phase 1, changes 1 and 3), plan-brief.md
- **Detail**: Two user-approved deviations are recorded in CLAUDE.md, the commit message of `683b19e` and `mutation-baseline.md`, but not in the plan and brief that archive with the change:
  - `vitest ^4.1.10` was used instead of `^5.0.3`, because on v5 the Stryker runner silently never activates mutants;
  - `vitest.configFile` was dropped from `stryker.config.json`, because it was resolved to the original repository path instead of the sandbox.

  Separately, `mutation-baseline.md` documents the Phase 3 static-collection discovery.
- **Fix**: Add a short addendum under Phase 1 (changes 1 and 3) and a "Vitest version" row to the brief's Key Decisions.
- **Decision**: FIXED — addenda under Phase 1 changes 1 and 3 in plan.md; Vitest version row in plan-brief Key Decisions
