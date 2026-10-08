<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Upload error visibility

- **Plan**: context/changes/upload-error-visibility/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
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

Automated criteria were re-run on `249435d`: `npm test` passes 118 tests, lint has 0 errors (13 pre-existing `no-console` warnings, down from 18), `astro check` has 0 errors, and no `console.error`/`console.warn` remains in `src/pages/api/reports/`. Build and deploy are green in CI runs 37753059538 and 37755006276.

Manual rows 1.4, 2.6 and 2.7 were confirmed by the user in-session: 2.6 locally with the corrected scenarios (addendum in the plan), 2.7 in Workers Logs on production.

The diff matches the plan's file list. Deviations are documented: the UUID guard on ids (beyond plan) is noted in CLAUDE.md, and the `wrangler.jsonc` observability sync was user-initiated from the dashboard. "What We're NOT Doing" was respected: no external service, no user-facing message changes, no route tests.

## Findings

### F1 — CLAUDE.md still says raw Supabase messages go to console.error for report upload/delete

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: CLAUDE.md:153 (Reports list contract)
- **Detail**: The Reports list contract bullet says "raw Supabase messages go to `console.error` only". For upload and delete this is no longer true: the routes now log through `logAppEvent`, which keeps only `error.code` and drops the message entirely. The new "Logging server-side failures" bullet (CLAUDE.md:158) says the opposite. lessons.md entry 1 calls for documented rules and code to agree. The auth bullet (CLAUDE.md:127) is still accurate, because the auth routes are out of scope (S-18).
- **Fix**: Reword the sentence to "raw Supabase messages are never shown; upload/delete failures are logged with `logAppEvent` (code only, see Logging server-side failures)".
- **Decision**: FIXED — CLAUDE.md:153 now says raw Supabase messages are never shown and upload/delete failures are logged with logAppEvent (code only)

### F2 — A malformed report id in a delete request logs as an error-level database failure

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/reports/[id]/delete.ts:26-41
- **Detail**: For a non-UUID `id` (a hand-typed or crafted URL), Postgres rejects the uuid cast (`22P02`). The route logs `report.delete.failed` at `error` level and the user sees `delete_failed` ("spróbuj ponownie"). This user-made mistake lands in the same bucket as real outages. The redirect behaviour predates this change; only the log entry is new. `src/pages/reports/[id].astro:18-28` already handles the same case with a UUID check before any query, treating it as "not found".
- **Fix**: Check the id against the same UUID shape before the delete query and treat a malformed id as `report_not_found` (`report.delete.rejected`, warn). User wording is unchanged, since the message already exists.
- **Decision**: FIXED — delete.ts checks the id against the UUID shape before the query; a malformed id is report_not_found (report.delete.rejected, warn)
