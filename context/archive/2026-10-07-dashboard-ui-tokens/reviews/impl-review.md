<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dashboard (Pulpit) design-system contract

- **Plan**: context/changes/dashboard-ui-tokens/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Notes: every planned change is present (drift review: MATCH on all Phase 1–5 items). The four user-approved deviations (card density, full-width button, kitchen-sink frame width + CDP screenshots, removal of the CLI-installed `cn` package) are implemented as described. Benign extras within the plan's intent: CardDescriptions "miesiące wizyt" / "wg daty wgrania"; hover/focus kitchen-sink frames show forced-state samples instead of a full dashboard. Nothing from "What We're NOT Doing" was touched. Automated criteria re-run 2026-10-07: astro check 0 errors, lint 0 errors, `grep -c rule-` = 9, no `bg-primary/NN` / hand-built cards, kitchen sink 200, both screenshots present, `npm run check:ui-tokens` OK. All 13 manual rows were confirmed by the user during implementation.

## Findings

### F1 — Trend chart rule split is colour-only and its aria-label is ignored

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/DashboardView.astro:253-259 (also src/components/dashboard/RankingTable.tsx:51-54)
- **Detail**: Each trend bar carries the per-rule breakdown only in `aria-label` on a plain `<div>` with no role; ARIA 1.2 does not name generic elements, so screen readers typically skip it. Visibly, only the monthly total is text; which rule drives it is conveyed by segment colour alone. Contrast is now ≥3:1 (charge 1 fixed), but a colour-vision-deficient user still has no text equivalent on the chart. The ranking bar has the same aria pattern but its numbers are visible in the Brak GPS / Telefon / Trasa columns.
- **Fix A ⭐ Recommended**: Add `role="img"` to each trend bar and ranking bar container (so the existing aria-label is announced) and a `title` with the same breakdown for hover.
  - Strength: Two-attribute change per bar; makes the existing label work and gives sighted users a tooltip without new layout.
  - Tradeoff: Tooltip needs hover — not available on touch.
  - Confidence: HIGH — role="img" + aria-label is the standard pattern for small inline charts.
  - Blind spot: Not tested with a real screen reader.
- **Fix B**: Fix A plus a visible per-month breakdown (e.g. small "3 · 2 · 2" line under each bar or a collapsible data table).
  - Strength: Text equivalent for everyone, including touch and CVD users.
  - Tradeoff: More visual noise on a compact card; layout work at 390px.
  - Confidence: MED — needs a design pass.
  - Blind spot: How it fits the 6-column chart on a phone.
- **Decision**: FIXED (Fix A) — role="img" + aria-label + title on trend and ranking bars via ruleBreakdown()/breakdown()

### F2 — check:ui-tokens misses non-px/rem arbitrary values and skips rule-series.ts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/check-ui-tokens.mjs:32,49 (file list at :12-18)
- **Detail**: The arbitrary-value regex `/[\w-]+-\[[0-9.]+(px|rem)\]/` only matches px/rem, so `lg:grid-cols-[1.4fr_1fr]` (DashboardView.astro:229), `w-[50%]`, `bg-[var(--x)]` pass silently — the plan promised a failure on "an arbitrary value outside an explicit allow-list". The `replace(/^.*?:(?=…)/)` at :49 is dead code (the match never contains a variant prefix). `src/lib/rule-series.ts`, the source of the series classes, is not scanned. Inherited from the research scan, which also only counted px/rem.
- **Fix**: Broaden the pattern to any `-[…]` arbitrary value, add `grid-cols-[1.4fr_1fr]` to the allow-list, drop the dead `replace`, and add `src/lib/rule-series.ts` to the scanned files.
- **Decision**: FIXED — any -[…] arbitrary value; grid-cols-[1.4fr_1fr] allow-listed; dead replace removed; src/lib/rule-series.ts scanned; verified with a deliberate w-[50%] break (exit 1)

### F3 — Progress bar announces 0% when the tile shows "—"

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/DashboardView.astro:183-191
- **Detail**: With no deviations `reviewedPct` is null and the title shows "—", but the progressbar still sets `aria-valuenow={reviewedPct ?? 0}`, so assistive tech reads "0%".
- **Fix**: Omit `aria-valuenow` (indeterminate) or hide the bar when `reviewedPct` is null.
- **Decision**: FIXED — aria-valuenow omitted when reviewedPct is null

### F4 — "Przejdź do listy" opens one report while the tile counts all reports in the window

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/dashboard-stats.ts:207-213, src/components/dashboard/DashboardView.astro:206-213
- **Detail**: Implemented exactly as decided in planning (report with the most unreviewed in the window). When unreviewed deviations span several reports, the tile's N is larger than what the opened report contains; "listy" may suggest the full list.
- **Fix**: Rename the button to "Przejdź do raportu" (or leave as is — planned behaviour).
- **Decision**: FIXED — label "Przejdź do raportu" when reviewTarget exists, "Przejdź do listy" when it links to /reports

### F5 — Unreviewed counts for recent reports run even when the dashboard is empty

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard.astro:63-73
- **Detail**: Pre-existing (moved 1:1 from the previous page). The three `count` queries run after the sequential visits loop and also when `stats` is null, where `recent` is never rendered. Bounded (`limit(3)`), so latency-only.
- **Fix**: Skip the counts when `stats` is null and/or run them in parallel with the visits loop.
- **Decision**: FIXED — per-report unreviewed counts skipped when stats is null

### F6 — Dev kitchen sinks are reachable in production builds

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/pages/dev/kitchen-sink/dashboard.astro:1-5 (same for reports-list.astro)
- **Detail**: Fixture-only, no Supabase import, no data leak — but `/dev/kitchen-sink/*` has no `import.meta.env.DEV` guard, so it ships to Cloudflare. Same pattern as the existing reports-list kitchen sink, so not a regression.
- **Fix**: Return 404 from both kitchen sinks when `!import.meta.env.DEV` (separate small change covering both).
- **Decision**: SKIPPED — same pattern as the existing reports-list kitchen sink; candidate for a separate change covering both
