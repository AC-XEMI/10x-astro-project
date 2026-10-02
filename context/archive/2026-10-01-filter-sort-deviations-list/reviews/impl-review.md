<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Filtrowanie i sortowanie listy odstępstw

- **Plan**: context/changes/filter-sort-deviations-list/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Hidden date input combines `aria-hidden` with programmatic focus

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/reports/DeviationsList.tsx:183-193
- **Detail**: The real `<input type="date">` behind `DateField` is visually hidden (`absolute h-0 w-0 opacity-0`) and carries both `tabIndex={-1}` and `aria-hidden="true"`. `tabIndex={-1}` alone is correct (keeps the visible trigger button as the real tab stop). But `openPicker()` calls `.showPicker()` (or `.focus()` as fallback) on this same element, moving DOM focus into an `aria-hidden` node — a recognized WCAG/axe violation ("aria-hidden element must not be focusable"). Behavior for assistive-tech users in that state is undefined by spec.
- **Fix**: Remove `aria-hidden="true"` from the input; keep `tabIndex={-1}` and the existing visual-hiding classes (`absolute h-0 w-0 opacity-0`), which already remove it from the visual and tab-order flow without the accessibility-tree conflict.
- **Decision**: FIXED

### F2 — Filter bar container and dropdown popup use a different visual system than the controls inside them

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/reports/DeviationsList.tsx:300 (filter bar `border-slate-700`), :118 (dropdown popup `bg-slate-800`)
- **Detail**: The app's established panel convention (`src/pages/reports/index.astro:41,64`, `src/pages/reports/[id].astro:36`) is translucent glass: `border-white/10 bg-white/10 backdrop-blur-xl`. The individual filter controls (`MultiSelectDropdown`/`DateField` triggers, Sort/Clear buttons) correctly follow this. But the outer filter-bar `<div>` and the open dropdown's option panel use solid slate colors instead, reading as a different system from their own siblings. The dropdown popup's opacity is arguably a deliberate, defensible exception (a menu overlaying table rows needs a readable background), but it wasn't called out as a conscious choice. Separately, the two pre-existing icon buttons (lines 407, 465) override the shadcn `outline` variant with a different recipe (`text-foreground` + light `bg-background`) than the two new toolbar buttons (`border-white/10 bg-white/10 ...`) — both are reasonable for their own context (inline icon actions vs. toolbar pills), but it means the file now carries two distinct override idioms; a third toolbar button added later should match the Sort/Clear recipe, not the icon-button one.
- **Fix**: Either align `border-slate-700` → `border-white/10` on the filter bar wrapper, or leave the current styling and note in a one-line comment that the dropdown popup's opaque background is a deliberate legibility exception.
- **Decision**: FIXED

### F3 — `ALL_RULES`/`ALL_STATUSES` hand-duplicate the DB enum values

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/reports/DeviationsList.tsx:33-34
- **Detail**: `DeviationRule`/`DeviationStatus` *types* are correctly derived from `src/types.ts`'s generated types, but the literal value arrays `ALL_RULES`/`ALL_STATUSES` used to build the filter options are hand-maintained duplicates of the DB enums (`deviation_rule`, `deviation_review_status`). If a new rule/status is ever added to the DB enum, these arrays silently fall out of sync — no compiler error catches it, the new value just never appears as a filter option.
- **Fix**: Derive from `Constants.public.Enums.deviation_rule` / `deviation_review_status` (already exported from `src/types.ts`) instead of hardcoding the literal arrays.
- **Decision**: FIXED

## Agent evidence (condensed)

**Plan drift**: every planned change in both phases matches the actual code, including the load-bearing rule+status same-deviation-record AND semantics (reproduced near-verbatim from the plan's reference implementation), `flaggedVisits` (not `visits`) feeding both the representative list and the filter pipeline, sort running after filtering, the untouched zero-deviations message alongside a distinct empty-filtered-result message, Polish labels confined to filter controls only, unchanged `Props`, and zero touches to `src/pages/reports/[id].astro` or the deviation-review API. One intentional divergence: "Wyczyść filtry" shows whenever any filter is active (not only when results are empty, as the plan's literal trigger condition said) — this was an explicit, live user correction during Phase 1 manual verification, already implemented and confirmed working; not treated as a finding since it's a deliberate, approved amendment, not drift.

**Safety & quality**: no security surface (pure client-side filter over already-fetched props), no data-mutating code touched (`updateDeviationStatus`'s POST to `/api/deviations/review` confirmed byte-for-byte unchanged), `getVisibleVisits` is linear and appropriate for realistic report sizes, and the `MultiSelectDropdown` click-outside listener is correctly registered/cleaned up with no leak. `DateField.openPicker` correctly feature-detects `showPicker` before calling it.

## Automated verification (from Progress)

- Lint: PASS (phases 1 and 2, commits 1d3c563 / 27bb59a)
- Type-check (`npx astro check`): PASS (phase 1, commit 1d3c563)
- Build: PASS (phases 1 and 2, commits 1d3c563 / 27bb59a)

## Manual verification (from Progress)

All manual items in both phases are checked `[x]` with commit SHAs, matching explicit user confirmations in the conversation ("działa poprawnie", "jest ok") after live iteration on filter UX (dropdown-not-listbox, per-field clear, always-visible clear-filters, no native date placeholder) during Phase 1, and dark-theme styling during Phase 2. No rubber-stamping concern — the diff for each phase visibly implements what the corresponding manual checklist describes.
