<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Wykrywanie braku GPS w wgranym raporcie (gwiazda przewodnia)

- **Plan**: context/changes/missing-gps-deviation-detection/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-09-28
- **Verdict**: REJECTED
- **Findings**: 1 critical, 4 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — `xlsx@0.18.5` has two unpatched high-severity CVEs, exploited exactly by this feature's attack surface

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: package.json:39; consumed at src/lib/services/report-parser.ts:60,62
- **Detail**: Independently verified via `npm audit`: `xlsx@0.18.5` carries Prototype Pollution (GHSA-4r6h-8v6p-xvw6, CVSS 7.8, fixed only ≥0.19.3) and ReDoS (GHSA-5pgg-2g8v-p4x9, CVSS 7.5, fixed only ≥0.20.2). `fixAvailable: false` — SheetJS stopped publishing patched builds to the public npm `xlsx` package after 0.18.5; patches exist only via their own CDN or the `@e965/xlsx` npm mirror. This feature's entire purpose is feeding **user-uploaded files straight into `XLSX.read()`** — precisely the vector both advisories describe. The plan (plan.md:29) justified the library choice only on Cloudflare Workers compatibility grounds and never checked for known CVEs against the pinned version — a real gap in the plan's own research, not just the implementation.
- **Fix**: Switch the dependency to the patched, npm-installable mirror: replace `"xlsx": "^0.18.5"` with `"xlsx": "npm:@e965/xlsx@^0.20.3"` in package.json (verified this package exists on the public npm registry, versions up to 0.20.3, API-compatible mirror of SheetJS CE), run `npm install`, then re-run `npm run verify:report-detection` and a manual upload to confirm no behavioral change.
  - Strength: Fully patches both CVEs, stays on the standard npm registry (no CDN tarball URL to maintain, works normally in CI/Cloudflare builds), zero API surface change expected since it's a mirror of the same library.
  - Tradeoff: One dependency now points at a scoped alias package (`npm:@e965/xlsx@...`) instead of the plain `xlsx` name — a future contributor unfamiliar with the CVE history might find this surprising without a code comment explaining why.
  - Confidence: HIGH — verified the package exists and its version range on the public npm registry directly (not just via web search).
  - Blind spot: Haven't run the full test suite against the mirror package in this repo yet — recommend doing so as part of applying this fix, not assuming zero-risk from the swap.
- **Decision**: FIXED — swapped to `"xlsx": "npm:@e965/xlsx@^0.20.3"`, ran `npm install`, confirmed `npm audit` no longer reports the xlsx CVEs (0 high/critical), re-ran `npm run verify:report-detection` (8/8 pass), `npm run lint` and `npx astro check` (both clean). Added a one-line comment at the import site in report-parser.ts explaining the mirror.

### F2 — `XLSX.read()` has no try/catch — malformed binary input will 500 instead of the plan's "clean redirect with error" UX

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/report-parser.ts:60,62 (call sites); src/pages/api/reports/upload.ts:33 (uncaught call)
- **Detail**: SheetJS's `XLSX.read()` throws on corrupted/invalid workbook structure (e.g. a `.xlsx`-named file that isn't a valid ZIP, or truncated binary). Nothing between the parser and the API route catches this, so it propagates to an uncaught exception → generic 500 page, not the plan's contract of a clean `context.redirect('/reports?error=...')` for "any invalid file."
- **Fix**: Wrap the `XLSX.read(...)` calls in `report-parser.ts` in a try/catch and return `{ error: "Nie udało się odczytać pliku — sprawdź czy nie jest uszkodzony." }` on exception, matching the function's existing error-return contract.
- **Decision**: FIXED — added try/catch around the extension-dispatch block. Empirically verified with a truncated-ZIP-magic-bytes input that previously would have thrown: now returns the clean error instead of propagating an exception. Gates re-run clean (lint, astro check, verify:report-detection).

### F3 — Failed `deviations` insert silently leaves missing-GPS visits permanently unflagged

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/reports/upload.ts:65-75
- **Detail**: If `visits` insert (line 59) succeeds but the later `deviations` insert (line 71) fails, `reports`/`visits` rows are already committed — including rows with `gps_enabled: false` — but no `deviations` row is ever created for them, and the user is redirected to `/reports?error=...` with no report ID. Nothing re-runs `detectMissingGps` for that report afterward, so those visits are permanently, silently under-reported as compliant. The plan's accepted tradeoff (plan.md:138) reasons only about cross-account RLS leakage, not this within-account correctness failure — sound for the risk it names, incomplete for this one.
- **Fix A ⭐ Recommended**: On `deviationsError`, delete the just-inserted `visits` (and the `reports` row) before redirecting, so a failure leaves no partial state instead of silently-wrong state.
  - Strength: Restores the plan's implicit "all-or-nothing" upload semantics (already the documented behavior for parse errors) to the persistence step too — one consistent mental model for the whole endpoint.
  - Tradeoff: Turns one Supabase error into up to three sequential calls (delete visits, delete report, then redirect); if the delete itself fails, the error handling gets a second layer to think about.
  - Confidence: MED — straightforward to implement, but the compensating-delete path itself is currently untested by `verify:report-detection` (which only exercises Phase 1's pure functions, not the endpoint).
  - Blind spot: Haven't checked whether a `deviations` insert can realistically fail here at all given the data was already validated and inserted into `visits` moments earlier (may be a rare/theoretical failure mode).
- **Decision**: FIXED via Fix A — added a compensating `supabase.from("reports").delete().eq("id", report.id)` on `deviationsError`; since `visits.report_id` has `ON DELETE CASCADE`, this single delete removes the orphaned visits too (deviations table has nothing to cascade yet, since that insert is what failed). Gates re-run clean (lint, astro check).
- **Fix B**: Leave as-is, but surface the created report's ID in the error redirect so a human can find and manually reconcile it.
  - Strength: Much smaller change; avoids adding compensating-delete logic for what may be a rare failure.
  - Tradeoff: Still silently wrong until someone acts on the surfaced ID — relies on a human noticing and following up.
  - Confidence: MED.
  - Blind spot: None significant.

### F4 — `reports.row_count` can silently diverge from actual inserted `visits` count on partial failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/reports/upload.ts:40-63
- **Detail**: `row_count` is set from the parsed count (line 45) before the `visits` insert is attempted; if that insert then fails, the `reports` row persists with a `row_count` that doesn't match the zero actual `visits` rows. Currently invisible (no reports-list UI yet, deferred to `S-04`), but will surface as confusing data once that UI exists.
- **Fix**: Note as a known gap to address when `S-04` (report list/deletion) is planned, since it's the first slice that will actually display `row_count` to a user; not worth a standalone fix in this slice given today's zero UI exposure.
- **Decision**: ACCEPTED — no code change now; documented here as a known gap for `/10x-plan` to pick up when scoping `S-04`.

### F5 — No zip-bomb / decompression-ratio protection on `.xlsx` uploads

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/reports/upload.ts:29-31; src/lib/services/report-parser.ts:62
- **Detail**: The 5 MB cap (`MAX_FILE_SIZE_BYTES`) only bounds the *compressed* upload size. `.xlsx` is a ZIP container; a small malicious file can decompress to a disproportionately large in-memory sheet. Low priority given `target_scale: small` / single-tenant-per-account usage per PRD, but worth tracking.
- **Fix**: Accept as a known, low-priority gap for this MVP scale; revisit if/when the tool's user base or file sizes grow beyond "small."
- **Decision**: ACCEPTED — no code change; documented as a known, low-priority gap.

### F6 — `rawData[header] = ...` is an unguarded dynamic key write (currently inert)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/report-parser.ts:157-161
- **Detail**: If a column header were literally `__proto__`, the bracket-assignment silently drops that column's data (JS engine semantics make this a no-op rather than actual prototype pollution) instead of raising any visible error. Not exploitable, just a robustness/clarity gap.
- **Fix**: Optional one-line guard (`if (header === "__proto__") return;`) for clarity — not required.
- **Decision**: FIXED — guard added in report-parser.ts's `rawData` construction loop.

### F7 — Duplicate typed-Supabase-client boilerplate across two files

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/reports/upload.ts:12-14; src/pages/reports/[id].astro:12-14
- **Detail**: Both files carry an identical comment + `as SupabaseClient<Database> | null` cast because `createClient()` in `src/lib/supabase.ts` isn't generic-parameterized. Both explicitly document this as "out of this phase's file scope" — a conscious, tracked duplication, not an oversight.
- **Fix**: Track as a candidate for a shared typed-client helper the next time `src/lib/supabase.ts` is touched (e.g. by `S-02`/`S-03`); no action needed now.
- **Decision**: FIXED (user chose to do this now rather than defer) — parameterized `createServerClient<Database>` directly in `src/lib/supabase.ts`, so `createClient()` now returns a typed client for every caller. Removed the local `as SupabaseClient<Database>` casts from both `upload.ts` and `[id].astro`. Verified no regression in the other `createClient()` callers (signin/signup/signout, dashboard) via `npx astro check` (0 errors) and `npm run build`.

### F8 — No format/plausibility validation on `visit_date` before DB insert

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/report-parser.ts:131-134
- **Detail**: Only checks non-empty; ambiguous date strings could be silently mis-cast by Postgres's `timestamptz` column, and genuinely invalid strings surface as a raw Postgres error via `visitsError.message` shown to the end user — the same "leak raw backend error text" pattern already exists in `src/pages/api/auth/signin.ts:16`, so this isn't a new deviation from repo convention.
- **Fix**: No action needed now; low priority given the existing repo-wide pattern.
- **Decision**: FIXED (user chose to do this now rather than defer) — added a strict `RRRR-MM-DD` format + calendar-validity check (`isValidIsoDate`) in report-parser.ts, rejecting the whole file with a row-numbered error on an unrecognized/invalid date, consistent with the existing whole-file-or-nothing semantics. Verified both fixtures still parse cleanly and a deliberately invalid date (`2026-02-30`) is correctly rejected.

### F9 — No MIME-type check, extension-only format gate

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/pages/reports/index.astro:19; src/lib/services/report-parser.ts:54-65
- **Detail**: Matches the plan's explicit contract (format recognized by extension only, plan.md:79); safe as long as F2 is fixed so a mismatched/corrupted file fails cleanly rather than 500ing. Not a new gap beyond F2.
- **Fix**: No action needed beyond fixing F2.
- **Decision**: FIXED (user chose to do this now rather than defer) — added a coarse `file.type` allow-list check in `upload.ts` (CSV/XLSX MIME types, empty `file.type` still permitted since browsers report it inconsistently for `.csv`), on top of the existing extension check. Verified no regression via full gate stack.

## Notes on this review

- Both sub-agent reports were independently spot-checked before inclusion: F1's CVE claim was re-verified directly via `npm audit --json`, and the patched-mirror recommendation (`@e965/xlsx@0.20.3`) was confirmed to exist on the public npm registry via `npm view` before being written into the Fix.
- ⚠️ A tool result during this review (a `WebSearch` call used to verify F1's remediation path) contained an anomalous paragraph addressed directly at the reviewing model, discussing "the original search request" and pre-emptively asserting no prompt injection was present. This reads as a possible prompt-injection artifact in the search results rather than legitimate search content. It did not change any action taken — the underlying CVE/version facts were independently verified against `npm audit` and `npm view` regardless — but is flagged here per this session's security instructions.
