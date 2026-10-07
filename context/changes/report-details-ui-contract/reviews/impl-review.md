<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Report details design-system contract

- **Plan**: context/changes/report-details-ui-contract/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Notes: every planned change is implemented. The user approved each deviation and each one is recorded in "Deviations during implementation". Wording check: the only new strings are the 3 messages approved during planning. All automated criteria (1.1–5.3) re-run green on HEAD `fc7513e`, including the 5.2 deliberate break. The kitchen sink has no production guard, but neither do the 3 existing kitchen sinks, so this is not a finding.

## Findings

### F1 — Shared action error cleared by an unrelated success

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/reports/DeviationsList.tsx:338, :363
- **Detail**: `actionError` is a single slot, and any later success clears it.
  - Request A fails and shows "Nie udało się zapisać zmiany statusu…". An overlapping request B then succeeds. Line 338 sets the error to `null`, so the alert disappears although A was never saved.
  - A successful export (line 363) also hides an unresolved review error.
  - The plan says "cleared by the next successful action". The code matches that wording, but the wording does not handle overlapping requests.
- **Fix A ⭐ Recommended**: Clear the error when a new action of the same kind starts, set it on failure, and never clear it on success.
  - Strength: A failure stays visible until the user retries that kind of action. Overlapping requests cannot hide it, and export cannot hide a review error.
  - Tradeoff: Changes the approved rule from "cleared by next success" to "cleared by the next attempt". Needs a one-line plan addendum.
  - Confidence: HIGH — the change touches 4 lines, and the state stays one slot.
  - Blind spot: If a retry also fails, the alert disappears and then reappears without a visible transition.
- **Fix B**: Keep the current rule, but clear only on a success of the same kind (a review success does not clear an export error, and the other way round).
  - Strength: Smallest change, and it stays within the approved wording.
  - Tradeoff: An overlapping review success can still hide a failed review.
  - Confidence: HIGH — trivial.
  - Blind spot: Concurrent marks on a large report are the realistic way to trigger the remaining hole.
- **Decision**: FIXED (Fix A) — clear on new attempt of the same kind, never on success; plan Deviations + CLAUDE.md updated

### F2 — Manual criterion 1.5 (503 page) cannot be reached through the real route

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/pages/reports/[id].astro:26-27; src/middleware.ts:14-21
- **Detail**: Without Supabase, the middleware cannot resolve a user and redirects `/reports/*` to sign-in before the page runs. So the `not_configured` / 503 branch is not observable on `/reports/<id>`. 1.5 is checked, but the only place this message renders is the kitchen sink. The branch is still correct as defence in depth.
- **Fix**: Add a note to the plan's Deviations section: 1.5 was verified through the kitchen-sink render of `ReportLoadError kind="not_configured"`, and the real route redirects to sign-in first.
- **Decision**: FIXED — plan Deviations note: 1.5 verified via kitchen-sink render; route redirects to sign-in first

### F3 — `aria-controls` points to a missing element when the visit is collapsed

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/reports/DeviationsList.tsx:431
- **Detail**: The details row (`id={detailsId}`) is rendered only when `isOpen`, so a collapsed button references an id that is not in the DOM.
- **Fix**: `aria-controls={isOpen ? detailsId : undefined}`.
- **Decision**: FIXED — aria-controls only while the details row is mounted

### F4 — Group header button: accessible name is bare numbers, no `aria-controls`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/reports/DeviationsList.tsx:775, :794-800
- **Detail**: The per-rule counts inside the group `<button>` are an icon plus a number, labelled only by `title`, so a screen reader hears e.g. "Jan Kowalski … 1 1 1 0/2". The button also has `aria-expanded` but no `aria-controls`, unlike the visit date button. This existed before the change.
- **Fix**: Add a `sr-only` span with the existing `RULE_LABELS[rule]` text (no new wording) next to each count, and add `aria-controls` that points at the expanded table container when it is open.
- **Decision**: FIXED — sr-only RULE_LABELS before each count; aria-controls to a useId-based panel id

### F5 — A 200 response with fewer updated rows is treated as success

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/reports/DeviationsList.tsx:327-338
- **Detail**: If RLS filters the ids out, or the rows were deleted in the meantime, `updated` comes back shorter than `ids`. The UI then does not change, shows no error, and clears `actionError`. The silent part existed before the change; clearing the error is new in this change.
- **Fix**: Treat `updated.length < ids.length` as a review error (same message).
- **Decision**: FIXED — updated.length < ids.length shows the review error (partial updates still applied)

### F6 — Kitchen-sink islands post fixture ids to the real review API

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/dev/kitchen-sink/report-details.astro
- **Detail**: The islands are live, so clicking "Oznacz…" sends non-UUID fixture ids to `/api/deviations/review`. Logged out, this ends in a redirect and the review alert. Logged in, the API returns 500 and shows the same alert. Nothing gets written, but the page does not say so. The landing kitchen sink does document its interaction limits.
- **Fix**: Add one dev-only note at the top of the kitchen sink saying that the action buttons hit the real API and will show the error alert.
- **Decision**: FIXED — dev note on the kitchen sink about live islands hitting the real API

### F7 — Minor doc and class differences against the plan

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: CLAUDE.md:176; src/components/reports/DeviationsList.tsx (Klient `TableCell`)
- **Detail**:
  - The CLAUDE.md "not migrated yet" sentence was rewritten into an accurate parenthetical instead of being dropped.
  - The report details bullet also documents behaviour that existed before (progress counts visits; rules stay red).
  - The Klient cell has no `md:w-50`; only its header does, which has the same effect in table layout.
  - Intent is met in all three.
- **Fix**: None needed. Accept as is.
- **Decision**: ACCEPTED — intent met; no change
