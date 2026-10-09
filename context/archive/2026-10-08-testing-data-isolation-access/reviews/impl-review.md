<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Izolacja danych i dostęp w CI — plan wdrożenia (test-plan, faza 1)

- **Plan**: context/changes/testing-data-isolation-access/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Success Criteria evidence:

- **Local (2026-10-09):** lint 0 errors; `astro check` 0/0; `npm test` 119/119; grep `verify-rls` returns nothing; prettier check passes; no `TBD — see §3 Phase 1` remains.
- **CI on PR #8 (`b7b26ad`):** `ci` and `smoke` green, integration 47/47.
- **Manual checks:** 2.6 and 3.3 rest on temporary PRs #9 and #10, both red as expected. 2.5, 4.3 and 4.4 were confirmed by the user.

Plan drift:

- No MISSING or DRIFT in code.
- Minor documentation items: §6.5 runs to 5 bullets instead of 2–3, and §8 has its date updated. Both are harmless and are not listed as findings.

## Findings

### F1 — Smoke failure hides the isolation signal; the preview wait loop does not fail

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:56-61
- **Detail**:
  - Smoke and `test:integration` run in one `run:` block, under `bash -e`. If smoke fails, the integration suite never starts, so a smoke regression hides the isolation and access result.
  - The `for … seq 1 60` loop also ends without an error when preview never starts. The failure then shows up later as an unrelated smoke error.
- **Fix A ⭐ Recommended**: Fail explicitly after the wait loop when the server never came up, and move `test:integration` into its own step with a server-readiness check.
  - Strength: Each gate has its own verdict in the CI log. GitHub Actions does not kill background processes between steps, so preview stays up.
  - Tradeoff: The step depends on a process started in an earlier step, which is less obvious than one block.
  - Confidence: MED — runner behaviour is documented, but this repo has not exercised it.
  - Blind spot: Behaviour on the `ubuntu-latest` runner after a failed preceding step has not been checked.
- **Fix B**: Keep one step, add `|| exit 1` after the loop, and run both suites while collecting exit codes (`smoke; s=$?; test:integration; i=$?; exit $((s||i))`).
  - Strength: The smallest change, with no reliance on a process surviving between steps.
  - Tradeoff: Still one verdict for two gates in the CI log.
  - Confidence: HIGH — plain bash.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A — osobne kroki: start preview z jawnym błędem, smoke, integracja z `!cancelled()` i warunkiem na preview, log preview przy porażce)

### F2 — `review.ts` does not log 503 `not_configured` or 400 `invalid_request`, unlike delete.ts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/deviations/review.ts:14, :33-37
- **Detail**: `delete.ts` logs `not_configured` as `report.delete.failed` with stage `config`, and logs a malformed id as `report.delete.rejected`. A misconfigured worker answering 503 on review leaves no entry in Workers Logs.
- **Fix**:
  - On the 503, log `deviation.review.failed` with code `not_configured` and stage `config`.
  - On the 400, log `deviation.review.rejected` with code `invalid_request`.
  - Extend `ReviewErrorCode` and the `app-events.test.ts` test to match.
- **Decision**: FIXED — review.ts loguje 503 (deviation.review.failed, not_configured, stage config) i oba 400 (deviation.review.rejected, invalid_request, stage validate); ReviewErrorCode + test app-events

### F3 — Path-variant test accepts any non-2xx, including 500

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/route-access.int.test.ts:179
- **Detail**: Asserting "not 2xx" lets a 500 (a crashing page) and the handler's own 401 pass, so the test does not prove that routing or the middleware refused. CI currently shows the expected values: 404 for case variants and 302 for `%72eports`, `/reports/` and `/dashboard/`.
- **Fix**: Assert that the status is either 404, or 302 with a `Location` starting with `/auth/signin`. Any other status fails and is printed.
- **Decision**: FIXED — warianty ścieżki muszą dać 404 albo 302 na /auth/signin

### F4 — CLAUDE.md: wrong `.dev.vars` variable names and the stale "pure modules only so far"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: CLAUDE.md:56, CLAUDE.md:112
- **Detail**:
  - Line 56 tells the reader to put `API_URL`/`ANON_KEY` into `.dev.vars`, but the app reads `SUPABASE_URL`/`SUPABASE_KEY`.
  - The Tests bullet opens with "pure modules only so far — no … Supabase" and then describes integration tests that use Supabase.
- **Fix**:
  - Line 56: "`SUPABASE_URL`/`SUPABASE_KEY` set to `API_URL`/`ANON_KEY` from `npx supabase status -o env`".
  - Tests bullet: limit "pure modules only" to `*.test.ts` in `src/`.
- **Decision**: FIXED — CLAUDE.md: SUPABASE_URL/SUPABASE_KEY w .dev.vars; „pure modules only” zawężone do src/**/*.test.ts

### F5 — Weaker assertions in rls-isolation: anon INSERT and the owner re-reads after DELETE

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/rls-isolation.int.test.ts:283-285, :236-237, :245-246, :254-255
- **Detail**:
  - The anon INSERT checks only `error !== null`, so a column or schema error would pass. The B-side inserts check `42501`.
  - In the DELETE block, the owner's re-read does not check `asA.error`, so a failed read produces a confusing diff instead of the real error.
- **Fix**: Assert `error?.code === "42501"` for anon, and add `expect(asA.error).toBeNull()` to the three re-reads.
- **Decision**: FIXED — anon INSERT oczekuje 42501; expect(asA.error).toBeNull() w trzech odczytach po DELETE

### F6 — Route inventory scans only `.astro`/`.ts`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/route-access.int.test.ts:87
- **Detail**: A page or endpoint added as `.tsx`, `.js`, `.md` or `.mdx` would be skipped by the inventory without any warning.
- **Fix**: Widen the extension regex to every route type Astro supports (`astro|ts|js|tsx|jsx|md|mdx|html`).
- **Decision**: FIXED — inwentarz skanuje astro|md|mdx|html|js|ts

### F7 — Local auth rate limit on repeated runs is not documented

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/global-setup.ts (whole file), context/foundation/test-plan.md §6.2
- **Detail**: One `npm run test:integration` run makes about 10 sign-up or sign-in calls. A third run within 5 minutes locally hits `sign_in_sign_ups = 30` and fails with what looks like a test error. In CI there are about 13 calls per run, which is fine.
- **Fix**: Add one line to §6.2 under "Run locally" about the limit, and have globalSetup recognise HTTP 429 and print a clear message.
- **Decision**: FIXED — globalSetup zgłasza czytelny błąd na HTTP 429; §6.2 opisuje limit przy lokalnych powtórkach

### F8 — `ReviewErrorCode` lives in app-events.ts and does not cover every response code

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/app-events.ts:38-41
- **Detail**: Report codes have their own module (`report-errors.ts`), but review codes are defined in the logging module. The type also misses `invalid_request`, `unauthorized` and `not_configured`, which review.ts does return, and the tests hard-code those strings.
- **Fix**: Add `src/lib/review-errors.ts` with a union of every JSON `error` code review.ts returns, and import it from review.ts, app-events.ts and the tests.
- **Decision**: FIXED — src/lib/review-errors.ts (ReviewErrorCode z wszystkimi kodami + reviewErrorResponse), importowany przez review.ts, app-events.ts i http-isolation (satisfies)
