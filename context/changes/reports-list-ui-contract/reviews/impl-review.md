<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Reports list design-system contract

- **Plan**: context/changes/reports-list-ui-contract/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-10-07
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

Notes: drift review found every planned change present and no MISSING items; the 7 user-approved deviations (Phase 2 early mapping, PGRST103 count re-query, `.astro` ESLint narrowing, Claude Design dimensions restored on the upload cards, design wording kept, dialog on `?dialog=1`, check-ui-tokens variant skip + allow-lists) are implemented as described. "What We're NOT Doing" respected (DeviationsList, other views' Banners, `--warning`, `max-w-[1100px]`, CI untouched). Automated criteria re-run 2026-10-07: alert/cn 0, cursor-pointer 0, astro check 0 errors, lint 0 errors, no `.message` in redirects, no `getHours`, no `<Banner` in index.astro, opacity-40 0 / role=status 1, kitchen sink 200, 0 `<Table`, check:ui-tokens OK on 9 files. Criteria 3.3/3.4 now report the restored design values (`rounded-lg border-[1.5px]`, `pl-[18px]`, `w-[150px]`) — superseded by the user's Phase 4 decision (see F8). All 13 manual rows were confirmed by the user during implementation.

## Findings

### F1 — Upload ignores non-redirect error responses

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/reports/ReportUpload.tsx:233-244
- **Detail**: `xhr.onload` never checks `xhr.status`. If the endpoint answers without a redirect (unhandled 500, platform 413/502), `responseURL` stays `/api/reports/upload` and `window.location.assign` sends a GET to a POST-only route — the user lands on an error page instead of the upload error card.
- **Fix**: When `xhr.status >= 400` or `responseURL` is still the API path, set `{ kind: "server", code: "upload_failed" }` instead of navigating.
- **Decision**: FIXED — xhr.onload treats status >= 400 or a responseURL still under /api/ as upload_failed and shows it in the card

### F2 — `?page` accepts fractions and huge numbers

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/reports/index.astro:17
- **Detail**: `Math.max(1, Number(p) || 1)` keeps `1.5` (label "Strona 1.5 z N", prev link `page=0.5`, odd offsets) and `1e21`/`Infinity` (offset serialised as `2e+22`/`Infinity`, likely a non-PGRST103 error → "Nie udało się wczytać" instead of the out-of-range redirect).
- **Fix**: Parse with `Number.parseInt` and fall back to 1 unless the result is a safe integer ≥ 1.
- **Decision**: FIXED — ?page parsed with Number.parseInt + Number.isSafeInteger (>= 1), otherwise page 1

### F3 — CLAUDE.md states rules the code does not fully meet yet

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: CLAUDE.md:176
- **Detail**: "Upload/visit timestamps … never `getHours()`" — DeviationsList.tsx:93-97 still formats `reviewed_at` with `getHours()` (out of scope by plan). "`Banner.astro` stays only for the full-bleed config strip" — 4 other Banner uses remain (DashboardView, report details, confirm-email). A future agent reading the rule as fact will be misled.
- **Fix**: Reword to "upload timestamps" + "DeviationsList not migrated yet", and "in-page messages on the reports list use Alert; other views still use Banner until migrated".
- **Decision**: FIXED — CLAUDE.md narrowed: Alert on this view (Banner still in-page elsewhere until migrated); upload timestamps via formatDateTime, DeviationsList not migrated yet

### F4 — Parser row details show raw header names, against lesson 3

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/report-parser.ts:156-171 (shown via ReportUpload.tsx:418)
- **Detail**: Messages like "Wiersz 12: nierozpoznana wartość gps_wlaczony (oczekiwano TAK/NIE)." are now deliberately shown in the upload card. They contain snake_case column names, which `lessons.md` rule 3 forbids in user-facing text; but these are exactly the spreadsheet headers the user must type, the missing-columns card shows them on purpose, and the user's standing rule forbids rewording existing messages without approval.
- **Fix A ⭐ Recommended**: Add an explicit exception to lesson 3: spreadsheet header names the user must type may appear (ideally as code), DB-internal names may not.
  - Strength: Matches how the design's missing-columns card already uses header names; keeps the user's wording rule.
  - Tradeoff: The lesson becomes slightly more nuanced.
  - Confidence: HIGH — the headers are the user's own sheet vocabulary.
  - Blind spot: None significant.
- **Fix B**: Rephrase the parser messages in descriptive Polish (e.g. "kolumna z informacją o GPS (nagłówek gps_wlaczony)").
  - Strength: Satisfies lesson 3 as written.
  - Tradeoff: Changes user-facing wording — needs the user's approval under their rule; touches the parser and `verify:report-detection` expectations.
  - Confidence: MED — wording decisions are the user's.
  - Blind spot: Other places that show the same messages.
- **Decision**: FIXED (Fix A) — lessons.md rule 3 clarified: spreadsheet header names the user must type are allowed; DB-internal names and raw Supabase messages are not

### F5 — Screenshot script can "pass" on an error page or hang

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: scripts/kitchen-sink-shot.mjs:96-112
- **Detail**: `Page.navigate`'s `errorText` is not checked (an unreachable URL still fires `loadEventFired` on Chrome's error page, so the visual gate produces a screenshot of an error page); `send()` has no per-command timeout; no SIGINT/SIGTERM cleanup (Chrome and the temp profile stay behind on Ctrl+C).
- **Fix**: Fail on `errorText`, wrap `send` in a timeout, register a signal handler that runs `cleanup()`.
- **Decision**: FIXED — screenshot script fails on Page.navigate errorText and document HTTP >= 400, 60 s timeout per CDP command, pending calls rejected on socket close, SIGINT/SIGTERM cleanup (verified: ERR_CONNECTION_REFUSED and 404 exit 1)

### F6 — Screen readers may announce upload status and errors twice

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/reports/ReportUpload.tsx:113,119,334-339
- **Detail**: Focus moves onto the `role="status"` live region itself (`aria-live` is also redundant with the role), and the ErrorCard has `role="alert"` while focus goes to its title — focus announcement + live announcement. Behaviour varies by screen reader; not tested.
- **Fix**: Keep one mechanism per case (e.g. drop `role="alert"` from the error card since its title receives focus; drop the redundant `aria-live`).
- **Decision**: FIXED — ErrorCard no longer role="alert" (its title receives focus); redundant aria-live removed from the role="status" line

### F7 — `responseURL` not checked for same origin

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/reports/ReportUpload.tsx:234,244
- **Detail**: Defense in depth: today only same-origin relative redirects are issued, but the client would follow any `responseURL`.
- **Fix**: Navigate only when `target.origin === location.origin`, otherwise fall back to `/reports`.
- **Decision**: FIXED — only a same-origin responseURL is trusted; otherwise navigation falls back to /reports

### F8 — Plan criteria superseded by the design restore are not recorded in the plan

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/reports-list-ui-contract/plan.md (Phase 3 §2, criteria 3.3/3.4; Phase 4 drag text; Phase 5 dialog light-only)
- **Detail**: The user-approved changes (Claude Design dimensions restored, drag text kept, dialog only on `?dialog=1` and light-only) live in commit messages, not in the plan; re-running 3.3/3.4 now reports the restored values.
- **Fix**: Append a short "Deviations during implementation" addendum to plan.md.
- **Decision**: FIXED — plan.md gained a "Deviations during implementation" section before Progress

### F9 — `bg-primary/10` tint allowed globally in check-ui-tokens

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: scripts/check-ui-tokens.mjs (ALLOWED_PRIMARY_TINTS)
- **Detail**: The exception meant for the upload card also relaxes the "no primary/NN" series rule for the dashboard files.
- **Fix**: Scope the tint allowance to `src/components/reports/ReportUpload.tsx`.
- **Decision**: FIXED — bg-primary/10 tint allowed only in src/components/reports/ReportUpload.tsx (verified: dashboard still flags it)

### F10 — Kitchen sink hygiene

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/pages/dev/kitchen-sink/reports-list.astro:123-124 (and both kitchen sinks)
- **Detail**: Intro renders "`ReportUpload` ,`ReportsList`" (stray newline before the comma); both kitchen sinks ship to production without a dev guard (fixtures only, no data exposure — pre-existing pattern).
- **Fix**: Fix the typo; optionally 404 both kitchen sinks when `!import.meta.env.DEV` in a separate small change.
- **Decision**: FIXED (typo) — kitchen sink intro comma fixed; production guard for kitchen sinks left for a separate change
