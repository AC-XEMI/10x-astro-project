<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Eksport listy odstępstw do pliku

- **Plan**: context/changes/export-deviations-list/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-10-02
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 1 observation

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

### F1 — CSV formula-injection gap: `representative_name` not escaped against leading `=`/`+`/`-`/`@`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/reports/DeviationsList.tsx:288-290 (`csvField`), :313/:324-335 (`buildExportRows`)
- **Detail**: `representative_name` comes from the uploaded report file (free text, not system-generated) and flows into the CSV row unescaped against a leading `=`, `+`, `-`, or `@`. `csvField` only quotes on `;`/`"`/newline — it doesn't neutralize formula-triggering prefixes. If a name in the source file were e.g. `=HYPERLINK(...)`, the exported CSV would carry that through, and Excel's classic CSV-formula-injection behavior could evaluate it on open. The XLSX path is likely safe (`aoa_to_sheet` writes plain string cells, not formula cells). Low exploitability here (internal single-tenant tool, uploader and exporting manager are typically the same side), but it's a textbook gap worth a conscious call rather than silent carry-forward.
- **Fix**: In `csvField` (or just before building the row), prefix any value starting with `=`, `+`, `-`, `@`, tab, or CR with a `'` before quoting/escaping — the standard CSV-injection mitigation.
- **Decision**: FIXED

### F2 — `exportList` has no error handling, unlike its sibling `updateDeviationStatus`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/reports/DeviationsList.tsx:474-485
- **Detail**: `updateDeviationStatus` in the same file wraps its work in `try/catch` and logs failures without crashing. `exportList` has zero handling around `buildXlsx`/`XLSX.write`/`buildCsv` — a library-level failure (unlikely for this data shape, but possible) would bubble as an uncaught exception out of a React event handler with no feedback to the user beyond the button silently doing nothing.
- **Fix**: Wrap the build+download logic in `exportList` in a `try/catch`, matching `updateDeviationStatus`'s pattern (`console.error` on failure).
- **Decision**: FIXED

### F3 — `downloadBlob` doesn't guard `anchor.click()` before revoking the object URL

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/reports/DeviationsList.tsx:465-472
- **Detail**: `URL.revokeObjectURL(url)` runs unconditionally right after `anchor.click()` with no `try/finally`. If `click()` threw (rare — e.g. a hardened CSP or extension intercepting synthetic clicks), the revoke would be skipped and the blob URL would leak until page unload. Low impact — per-click, bounded, cleaned up on navigation regardless.
- **Fix**: Wrap in `try { anchor.click(); } finally { URL.revokeObjectURL(url); }`.
- **Decision**: FIXED

## Agent evidence (condensed)

**Plan drift**: every planned change matches the actual code exactly — the 9 export columns and their value-derivation rules, `csvField`'s exact regex, the CSV separator/BOM construction (`String.fromCharCode(0xfeff)`, confirmed NOT a literal BOM character in source — the lint failure during implementation was fixed correctly), the exact `XLSX.utils.aoa_to_sheet`/`book_new`/`book_append_sheet`/`write` call chain, a correctly one-shot (non-persistent) `ExportMenu` distinct from `MultiSelectDropdown`'s toggle behavior, correct MIME types and filenames for both formats, the two-row filter-bar restructuring, and the `reportId` passthrough from `[id].astro`. No scope-boundary violations: no new API route, no touch to `getVisibleVisits`/`toDateOnly`/`formatActivityType`/`RULE_LABELS`/`STATUS_LABELS`, export confined to `visibleVisits`, no extra formats, no persisted format preference. The `xlsx` client-side reuse was an explicit, user-requested, documented scope expansion mid-phase — not drift.

**Safety & quality / pattern**: `ExportMenu` is a faithful, appropriately-adapted sibling of `MultiSelectDropdown` (same click-outside `useEffect`, same dark-theme styling) with the one-shot-vs-persistent difference being the intended behavioral delta, not an inconsistency. Its use of the shadcn `Button` component (matching its second-row siblings Sort/Clear-filters) rather than a plain `<button>` (like the first-row filter controls) is a reasonable, deliberate split given the plan's own two-row layout decision. The static top-level `import * as XLSX from "xlsx"` ships the library to every visitor regardless of use — already flagged and consciously accepted in the plan's "Open Risks" section, confirmed as exactly that tradeoff (not a new, undisclosed cost). No data-mutating code (`updateDeviationStatus`, `/api/deviations/review`) was touched.

## Automated verification (from Progress)

- Lint: PASS (commit 2522583) — one `no-irregular-whitespace` error caught and fixed during implementation (literal BOM character → `String.fromCharCode(0xfeff)`) before this commit landed.
- Type-check (`npx astro check`): PASS (commit 2522583)
- Build: PASS (commit 2522583)

## Manual verification (from Progress)

All 9 manual items are checked `[x]` with commit SHA, matching the user's explicit confirmation ("jest ok") after live iteration mid-phase added the XLS format, the `ExportMenu` dropdown, and the two-row filter-bar layout (all three were user-requested additions beyond the original plan draft, incorporated into the plan before the phase-end commit). No rubber-stamping concern — the diff visibly implements every criterion.
