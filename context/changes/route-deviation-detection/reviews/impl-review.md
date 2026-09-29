<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Wykrywanie nieoptymalnej trasy w wgranym raporcie

- **Plan**: context/changes/route-deviation-detection/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-09-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — `odwiedzony_klient` hard-required, breaks pre-existing S-01 report files

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability / backward compatibility)
- **Location**: `src/lib/services/report-parser.ts:126-129` (required-header check) vs. `:140-141,187-197` (`szerokosc`/`dlugosc` optional-pair handling)
- **Detail**: Two of the three new columns (`szerokosc`, `dlugosc`) degrade gracefully — a file lacking them still parses, the excess-distance sub-check just doesn't run. The third, `odwiedzony_klient`, is a hard-required header: any pre-existing report file from S-01 (missing-GPS slice) that predates this column will now be rejected outright with `"Brak wymaganej kolumny: odwiedzony_klient."`, even though that file was perfectly valid for `detectMissingGps` before this slice shipped. This was a **deliberate decision made during the planning interview** (see `plan-brief.md` Key Decisions row "Identyfikacja odwiedzonego klienta" and `plan.md` Critical Implementation Details) — not an oversight — but the concrete backward-compatibility consequence is worth a final look now that it's live.
- **Fix A ⭐ Recommended**: Keep as-is (no code change) — the interview explicitly weighed this tradeoff ("bez niej połowa FR-009 nie działa") and chose to require the column.
  - Strength: Preserves a deliberated, documented product decision instead of re-litigating a settled tradeoff; matches how S-01 itself introduced new required columns.
  - Tradeoff: Any file produced before this slice needs the new column added before it can be uploaded again.
  - Confidence: HIGH — directly matches the recorded interview decision.
  - Blind spot: None significant — this is a re-confirmation, not new information.
- **Fix B**: Relax `odwiedzony_klient` to optional (mirror `szerokosc`/`dlugosc`) — skip only the "poza zaplanowaną trasą" sub-check when the column or value is absent.
  - Strength: Fully backward-compatible with any S-01-era file.
  - Tradeoff: Silently disables half of FR-009 for files missing the column, with no signal to the uploader that detection is partially degraded.
  - Confidence: MEDIUM — reasonable, but weakens a must-have FR-009 guarantee the interview chose to keep.
  - Blind spot: This is a demo/test-data project (PRD Non-Goals) — real-world impact of "old files" existing is likely low.
- **Decision**: ACCEPTED — Fix A. Deliberate interview decision reconfirmed; no code change.

### F2 — `detectRouteDeviations` trusts `insert().select()` row order as a chronology proxy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability)
- **Location**: `src/lib/services/deviation-rules.ts:45-61`; `src/pages/api/reports/upload.ts:70,81`
- **Detail**: The plan already documents this as an accepted risk (plan-brief "Open Risks & Assumptions"). Independent re-assessment by the safety-review sub-agent: this is a reasonable engineering tradeoff for this project's stage, not a CRITICAL gap — blast radius is a silently-plausible-but-wrong advisory `route_deviation` flag (not a crash, not a security or data-loss issue), and single-statement `INSERT ... RETURNING` order preservation, while not a documented Postgres guarantee, is empirically reliable and widely relied upon. The deeper limitation — file row order is only a proxy for real visit chronology, since there's no time-of-day column — can't be fixed by hardening the DB round-trip alone.
- **Fix A**: Add an explicit `row_index` column populated at insert time from the original array position, and sort `insertedVisits` by it before calling `detectRouteDeviations`.
  - Strength: Fully removes dependency on undocumented Postgres/PostgREST insert-return ordering.
  - Tradeoff: Requires a new migration + column + parser/upload.ts changes — non-trivial scope addition for a risk that's already accepted, and doesn't fix the deeper "file row order ≈ chronology" assumption anyway.
  - Confidence: MEDIUM — the round-trip ordering is empirically reliable but technically undocumented.
  - Blind spot: Not load-tested under concurrent uploads.
- **Fix B ⭐ Recommended**: Accept as documented risk (no code change) — already explicitly recorded in `plan-brief.md`.
  - Strength: Matches the project's pre-production, small-scale stage and the plan's own conscious risk acceptance; avoids scope creep on a feature that's already fully shipped and verified.
  - Tradeoff: If the ordering assumption is ever violated, a deviation could be silently mis-attributed to the wrong "previous point."
  - Confidence: HIGH — grounded in both review sub-agents' independent analysis converging on the same WARNING-not-CRITICAL conclusion.
  - Blind spot: No automated regression test exists to catch a future ordering violation (see F3).
- **Decision**: ACCEPTED — Fix B. Matches project stage; already documented in plan-brief.md Open Risks.

### F3 — Verify script bypasses the real DB round-trip, so it can't catch an ordering regression

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria (test coverage)
- **Location**: `scripts/verify-report-detection.mjs:85-86`
- **Detail**: `syntheticVisits` is built directly from the in-memory parsed array with index-order preserved by construction — it never exercises an actual `supabase.from("visits").insert(...).select()` round trip. This is fine as a parser/rule unit check, but it means the one assumption F2 discusses (insert/select row-order preservation) is exactly the one thing this script cannot catch a regression in.
- **Fix**: No action needed now — this repo has no DB-integration-test framework by design (dependency-free verify script pattern predates this slice); note the limitation if F2 is ever revisited.
- **Decision**: ACKNOWLEDGED — no code change; limitation noted for future reference.

### F4 — Pre-existing orphaned `report` row on `visitsError` (out of scope, not introduced by this slice)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Data safety) — pre-existing, informational only
- **Location**: `src/pages/api/reports/upload.ts:70-74`
- **Detail**: Unlike the `deviationsError` branch (which explicitly deletes the just-created `report` row as a compensating action), the `visitsError` branch leaves the already-committed `report` row permanently orphaned with zero visits if the visits insert fails partway. Confirmed via `git log -p` that this predates this slice (introduced in `f07b4a1`, untouched by `840c123`) — out of scope for this review's triage, but the same compensating-transaction pattern this slice extends, so worth a `/10x-lesson` entry or a small follow-up change.
- **Fix**: Not part of this change — record as a lesson or open a separate follow-up change against S-01's upload endpoint.
- **Decision**: FIXED — user chose to fix now despite being pre-existing/out of original scope. Added compensating rollback (`delete` from `reports`) to the `visitsError` branch in `src/pages/api/reports/upload.ts`, mirroring the existing `deviationsError` branch. Verified via `npm run lint` + `npx astro check`.

## Notes

- Plan-drift sub-agent found every file across all 5 phases MATCHES its plan Intent/Contract, with one behaviorally-inert extra guard (`distance_km > 0` in `deviation-rules.ts`, mathematically cannot change any outcome) — too trivial to log as a finding.
- All automated success criteria re-verified independently by the primary reviewer after both sub-agent passes: `npm run lint`, `npx astro check`, `npm run build`, `npm run verify:report-detection` (16/16 assertions, both CSV and XLSX) all green.
- All manual success criteria in Progress are `[x]` with commit SHAs and were confirmed by the user during implementation (not rubber-stamped — evidence observed live against a linked Supabase project).
- Migration/rollback split (`supabase/migrations/` vs `supabase/rollbacks/`) and RLS transparency for the new nullable columns were both independently confirmed sound.
