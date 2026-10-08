# Upload error visibility Implementation Plan

## Overview

Every failed or rejected report upload and deletion leaves one structured, PII-free log entry that
Cloudflare Workers Logs keeps and lets the team query after the fact — instead of today's raw
`console.error` calls that are only useful while watching `wrangler tail` live. A small, tested
event module defines the entry shape once, so S-17…S-19 (roadmap M-4) reuse it.

## Current State Analysis

- `wrangler.jsonc` has `"observability": { "enabled": true }`: Workers Logs already stores console
  output and indexes the fields of a logged **object** (not of a concatenated string). No code
  writes structured entries today.
- `src/pages/api/reports/upload.ts`:
  - `console.error` with the raw Supabase error object on four branches:
    - inserting the report (`:66`);
    - inserting visits (`:81`);
    - inserting deviations (`:116`);
    - storing the deviation count (`:128`, non-fatal).
  - User-caused rejections (`not_configured :26`, `no_file :36`, `too_large :40`, `bad_type :44`,
    `invalid_file :50`) redirect with no trace at all.
  - The compensating report delete after a failed visits/deviations insert (`:80`, `:115`) ignores
    its own result — a failed rollback leaves an orphaned report nobody hears about.
- `src/pages/api/reports/[id]/delete.ts`: `console.error` only on `delete_failed` (`:30`);
  `not_configured` (`:10`) and `report_not_found` (`:35`) leave no trace.
- Error codes already exist in `src/lib/report-errors.ts` (`ReportErrorCode`); user-facing
  messages and redirects stay unchanged.
- Raw Postgres errors (`message`, `details`) can embed row values; filenames can contain names.
  Parser messages (`report-parser.ts`) contain only row numbers and the user's own sheet column
  names — allowed by the lessons.md exception for input-sheet headers.
- Tests: Vitest for pure modules in `src/lib/**` (`npm test`, CI step in job `ci`); no route tests.

## Desired End State

Each of the upload/delete paths below produces exactly one console entry whose argument is a plain
object with a fixed set of fields. Our own failures log at `error`, rejections caused by the file
or the request log at `warn`. No entry contains a filename, a raw Supabase `message`/`details`, or
any value from the uploaded sheet. After deployment, filtering Workers Logs on
`event = "report.upload.rejected"` (or `.failed`, `.rollback_failed`, `report.delete.*`) shows the
entries. Verified by unit tests of the event module, a local run, and a query in the Cloudflare
dashboard.

### Key Discoveries:

- `src/pages/api/reports/upload.ts:80,115` — rollback result unchecked (silent orphan risk).
- `src/lib/report-errors.ts:7-18` — `ReportErrorCode` is the existing vocabulary for `code`.
- `wrangler.jsonc` `observability.enabled: true` — no config change needed.
- `context/foundation/lessons.md` — no raw DB column/field names in user-facing text; sheet headers
  are allowed. Log entries are not user-facing, but the same PII caution drives the field whitelist.

## What We're NOT Doing

- No external error-tracking service, no new dependency, no secret (Workers Logs only).
- No changes to user-facing messages, redirects or `report-errors.ts` codes.
- No entries for successful uploads/deletions (duration is S-19).
- No logging for report details, review, export (S-17) or auth (S-18).
- No route-level automated tests (pattern left to the test plan, F-03).
- No alerts or dashboards (Parked in the roadmap).
- No `wrangler.jsonc` sampling/retention changes.

## Implementation Approach

Define the entry once as a pure builder with a field whitelist and unit-test it, then call a thin
`logAppEvent` wrapper at every error redirect in the two routes. Keeping the builder pure makes the
"no PII" guarantee testable without mocking Astro or Supabase.

## Critical Implementation Details

- **One object argument.** `console.error(entry)` / `console.warn(entry)` with a single plain
  object — a string prefix or a second argument turns the entry into unindexed text in Workers Logs.
- **Rollback check order.** On a failed visits/deviations insert, log the insert failure first,
  then attempt the compensating delete and, if *that* returns an error, log a separate
  `report.upload.rollback_failed` entry with the report id — the user still gets `upload_failed`.

## Phase 1: Event module

### Overview

A typed, PII-safe entry builder and logger, covered by unit tests.

### Changes Required:

#### 1. Event builder and logger

**File**: `src/lib/app-events.ts` (new)

**Intent**: One place that decides which fields a log entry may carry, so no call site can leak a
filename or a raw database message, and S-17…S-19 reuse the same shape.

**Contract**:
- `buildAppEvent(input): AppEvent` — pure. Output has `event`, `level` and only these optional
  fields:
  - `code` (a `ReportErrorCode`);
  - `stage` (e.g. `config`, `validate`, `parse`, `insert_report`, `insert_visits`,
    `insert_deviations`, `store_count`, `rollback`, `delete`);
  - `user_id`, `report_id`;
  - `file_ext`, `file_size`, `row_count`;
  - `db_code` — only `error.code` from a Supabase/Postgres error passed in as `dbError`;
  - `detail` — parser message, only for `code: "invalid_file"`.

  Unknown keys are dropped; `undefined` values are omitted.
- `event` names:
  - `report.upload.rejected` (warn);
  - `report.upload.failed` (error);
  - `report.upload.rollback_failed` (error);
  - `report.upload.count_failed` (warn);
  - `report.delete.rejected` (warn);
  - `report.delete.failed` (error).
- `logAppEvent(input): void` — `console.error` for `error`, `console.warn` for `warn`, called with
  the built object as the only argument.
- `fileExtension(filename)` helper returns the lower-cased extension only (e.g. `.xlsx`), never the name.

#### 2. Unit tests

**File**: `src/lib/app-events.test.ts` (new)

**Intent**: Pin the privacy contract and the level routing.

**Contract**:
- A `dbError` with `message`/`details`/`hint` yields only `db_code`.
- Extra keys (e.g. `filename`, `email`) are dropped.
- `detail` is kept for `invalid_file` and dropped for any other code.
- `fileExtension("Jan Kowalski raport.XLSX")` returns `.xlsx`; a name without a dot returns `""`.
- `logAppEvent` calls `console.error` vs `console.warn` by level, with exactly one object argument
  (spied, not printed).

### Success Criteria:

#### Automated Verification:

- `npm test` passes and includes `app-events.test.ts`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification:

- Reviewer confirms the whitelist in `app-events.ts` contains no field that can carry a filename, sheet value or raw database message

**Implementation Note**: After automated verification passes, pause for manual confirmation before the next phase.

---

## Phase 2: Wire the routes and document

### Overview

Every error redirect in upload and delete leaves one entry; the rollback result is checked; raw
`console.error` calls go away; the convention is written down.

### Changes Required:

#### 1. Upload route

**File**: `src/pages/api/reports/upload.ts`

**Intent**: Make every failed or rejected upload visible after the fact, including a failed rollback.

**Contract**:

| Path | Event | Level | Stage |
| --- | --- | --- | --- |
| `not_configured` | `report.upload.failed` | error | `config` |
| `no_file` | `report.upload.rejected` | warn | `validate` |
| `too_large` | `report.upload.rejected` | warn | `validate` |
| `bad_type` | `report.upload.rejected` | warn | `validate` |
| `invalid_file` | `report.upload.rejected` | warn | `parse` (with `detail`) |
| report insert error | `report.upload.failed` | error | `insert_report` |
| visits insert error | `report.upload.failed` | error | `insert_visits` |
| deviations insert error | `report.upload.failed` | error | `insert_deviations` |
| failed compensating delete | `report.upload.rollback_failed` | error | `rollback` |
| count update error | `report.upload.count_failed` | warn | `store_count` |

- Context carried when known: `user_id`, `report_id`, `file_ext`, `file_size`, `row_count`,
  `db_code`.
- The four existing `console.error` calls are replaced.
- Redirects and user messages are unchanged.
- The unauthenticated redirect to sign-in is not an error code and gets no entry.

#### 2. Delete route

**File**: `src/pages/api/reports/[id]/delete.ts`

**Intent**: Same for deletions.

**Contract**:

| Path | Event | Level | Stage |
| --- | --- | --- | --- |
| `not_configured` | `report.delete.failed` | error | `config` |
| `delete_failed` | `report.delete.failed` | error | `delete` |
| `report_not_found` | `report.delete.rejected` | warn | `delete` |

- Context carried: `user_id`, `report_id` (the route param), `db_code`.
- The existing `console.error` is replaced.

#### 3. Convention

**File**: `CLAUDE.md`

**Intent**: Tell the next change (S-17…S-19) how to log.

**Contract**: One bullet under "Key conventions":
- server-side failures are logged with `logAppEvent` from `src/lib/app-events.ts`, never `console.error` with raw error objects;
- add a new event name and allowed field there rather than at the call site;
- entries are queryable in Cloudflare Workers Logs (dashboard → Workers → Logs) by `event`;
- note the retention observed in Phase 2 manual verification.

### Success Criteria:

#### Automated Verification:

- `npm test` passes
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build passes: `npm run build`
- No `console.error`/`console.warn` remains in `src/pages/api/reports/` (grep returns nothing)

#### Manual Verification:

- Locally (`npm run dev`), uploading a >5 MB file and a CSV missing a required column prints one `report.upload.rejected` object each in the terminal, with `file_ext`/`file_size` and no filename
- After deployment, a Workers Logs query filtered on `event` shows the rejected-upload entries; the retention period shown in the dashboard is noted in the CLAUDE.md bullet

---

## Testing Strategy

### Unit Tests:

- `app-events.test.ts`: field whitelist, `db_code`-only extraction, `detail` gating, extension helper, level routing.

### Manual Testing Steps:

1. `npm run dev`, sign in, upload a file > 5 MB → terminal shows one `report.upload.rejected` (`code: too_large`).
2. Upload a CSV without `data_wizyty` → `report.upload.rejected` with `code: invalid_file` and the parser `detail`, no filename.
3. Delete a report id that does not exist (or another user's) → `report.delete.rejected`.
4. After merge to `master` (CI deploys), repeat step 1 on production and find the entry in Workers Logs by `event`.

## References

- Roadmap item: `context/foundation/roadmap.md` — S-16 (M-4, MS-01)
- Error codes: `src/lib/report-errors.ts`
- Workers Logs context: `context/foundation/infrastructure.md` (logs section), `wrangler.jsonc`
- PII rule priors: `context/foundation/lessons.md` (raw column names in user-facing text)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Event module

#### Automated

- [x] 1.1 `npm test` passes and includes `app-events.test.ts`
- [x] 1.2 Lint passes: `npm run lint`
- [x] 1.3 Type check passes: `npx astro check`

#### Manual

- [x] 1.4 Reviewer confirms the whitelist in `app-events.ts` contains no field that can carry a filename, sheet value or raw database message

### Phase 2: Wire the routes and document

#### Automated

- [ ] 2.1 `npm test` passes
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 Type check passes: `npx astro check`
- [ ] 2.4 Build passes: `npm run build`
- [ ] 2.5 No `console.error`/`console.warn` remains in `src/pages/api/reports/` (grep returns nothing)

#### Manual

- [ ] 2.6 Locally (`npm run dev`), uploading a >5 MB file and a CSV missing a required column prints one `report.upload.rejected` object each in the terminal, with `file_ext`/`file_size` and no filename
- [ ] 2.7 After deployment, a Workers Logs query filtered on `event` shows the rejected-upload entries; the retention period shown in the dashboard is noted in the CLAUDE.md bullet
