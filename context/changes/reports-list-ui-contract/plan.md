# Reports list design-system contract Implementation Plan

## Overview

Put the reports list (`src/pages/reports/index.astro` + `ReportsList.tsx`, `ReportUpload.tsx`,
in-page use of `Banner.astro`) on the design-system contract and fix the five charges from
`research.md`: honest error/out-of-range states, server errors as codes shown in place instead
of raw text in the URL, one card/alert vocabulary, one date format and time zone, and an
upload progress that speaks, animates and keeps focus. End with a kitchen sink built from the
real components in both themes, and a rule + check that keep it that way.

## Current State Analysis

From `context/changes/reports-list-ui-contract/research.md` (2026-10-07, commit `32b6cce`):

- Fetch failure (`index.astro:31-33`) and `?page` past the end (`:14,30`) both render the
  "Nie masz jeszcze żadnych wgranych raportów" empty state (`ReportsList.tsx:73-83`).
- Upload and delete failures redirect to `/reports?error=<free text>`
  (`upload.ts:25,35,39,43,48,64,78,112`; `delete.ts:9,29,33`), 4 of them raw Supabase
  `.message`; `index.astro:51` renders any `?error` text in a page-top Banner.
- `ReportUpload` posts with XHR, follows the redirect and then navigates to
  `xhr.responseURL` (`ReportUpload.tsx:171-195`, `:182-183`) — so the component already sees
  the error URL before the page reloads.
- 4 hand-built cards (`index.astro:57`; `ReportUpload.tsx:104,235,392`); Banner (`Banner.astro:25-31`)
  is a full-bleed strip used inside the padded page; the network error is a bare `<p role="alert">` (`:424`).
- Dates: list `YYYY-MM-DD HH:MM` in the browser zone after hydration (`ReportsList.tsx:17-21`),
  details `DD.MM.YYYY, HH:MM` in the server zone = UTC (`[id].astro:41`), dashboard Europe/Warsaw
  (`DashboardView.astro:85`).
- Upload progress: no live region, `opacity-40` full bar for "checking", static full bar for
  "processing" (`ReportUpload.tsx:230-285,259`); focus drops to `<body>` when the subtree swaps.
- Drop-zone dashed border is `--border`: 1.26:1 (light) / 1.32:1 (dark) against the card —
  computed during planning, below WCAG 1.4.11's 3:1 in both themes.
- `button.tsx` has no `cursor-pointer`; this view adds it by hand 8 times (ReportsList 3, ReportUpload 5).
- Kitchen sink `src/pages/dev/kitchen-sink/reports-list.astro` has 2 hand-copied, stale sections,
  an invented loading skeleton, no disabled/dialog/upload-stage states and no dark frames.

## Desired End State

- Every container on the page is `Card`; every in-page message is `Alert` (new shadcn
  component with `default` / `destructive` / `success`). `Banner` stays only for the
  full-bleed config strip in `Layout.astro`.
- `?error` carries only a code from `src/lib/report-errors.ts`; the page shows the mapped
  Polish message (unknown code → generic message); raw DB messages only reach `console.error`.
  An upload failure is shown inside the upload card without a reload, parser row details included.
- A failed list query shows a destructive Alert, not the empty state; `?page` past the end
  redirects to the last page (keeping `deleted=1`); pagination shows "Strona X z Y" with
  focusable button-styled links.
- One helper `formatDateTime` (Europe/Warsaw, `DD.MM.YYYY, HH:MM`) used by the list, the delete
  dialog, the report details header and the dashboard.
- Upload stages are announced (`role="status"`), animated while indeterminate, and focus moves
  to the status / error title and back to "Wgraj raport".
- `/dev/kitchen-sink/reports-list` renders every state from real components, light and dark,
  with desktop and 390px screenshots in the change folder.
- `CLAUDE.md` names Alert vs Banner, error codes, the date helper and the kitchen sink;
  `npm run check:ui-tokens` covers this view's files.

### Key Discoveries:

- `ReportUpload.tsx:182-183` — `xhr.onload` navigates to `xhr.responseURL`; intercepting an
  `/reports?error=…` URL there moves server errors into the card with no API transport change.
- Parser errors are Polish, user-facing and row-specific (`report-parser.ts:78-101`, plus
  `Wiersz N: …` messages) — they must survive the switch to codes (`invalid_file` + `detail`).
- `delete.ts:19-20,36` forwards `page` back as `&page=`; deleting the last report on the last
  page must land on the new last page, not on an empty one — the out-of-range redirect covers it.
- `context/foundation/lessons.md` — "user-facing text must not contain raw column/field names"
  backs replacing raw Supabase messages with mapped Polish text.
- The previous `npx shadcn add card` installed an unrelated npm package `cn` and rewrote the
  import (see `context/archive/2026-10-07-dashboard-ui-tokens/`); every `shadcn add` must be
  checked against `package.json` and the `@/lib/utils` import.
- Drop-zone border candidates vs `--card` (planning computation): `--muted-foreground`
  4.73:1 light / 6.91:1 dark; `--primary` (drag-over) 6.44 / 3.91; `--ring` 2.59 / 3.79;
  `--input` 1.26 / 1.57.

## What We're NOT Doing

- `DeviationsList.tsx`: its dates (`:96`) and its 12 manual `cursor-pointer` overrides stay
  (they become redundant but harmless after Phase 1).
- No migration of other views' Banners (report details, dashboard, confirm-email) to `Alert`.
- No `--warning` token; the unused `warning` Banner variant and the oklch percentages in
  `--primary` stay.
- No `max-w-[1100px]` change; no click-to-open on the drop zone.
- No change to the success path (`upload.ts:126` → `/reports/<id>`) or to the delete form transport.
- No CI wiring for `check:ui-tokens`; no Playwright.

## Implementation Approach

`/10x-ui` order: primitives → shared values → the view → upload states → gate → guard.
Phase 2 changes the error contract and the date helper before any markup moves, so Phase 3 is
mostly substitution. Phase 4 is isolated to `ReportUpload`'s transitions. Phase 5 adds the only
dev-only props needed to render states from real components.

## Critical Implementation Details

- **Error codes are an allow-list.** `index.astro` renders `reportErrorMessage(code)` only — never
  `detail`, never the raw param. `detail` is read only by `ReportUpload` from `xhr.responseURL`,
  i.e. from the server's own redirect, not from a link the user clicked.
- **Out-of-range redirect needs the count first.** Compute `lastPage = max(1, ceil(count / 20))`
  after the count query; redirect only when `count` is known (not on fetch error) and
  `page > lastPage`, preserving `deleted`.
- **Every `shadcn add`**: afterwards `grep -c '"cn"' package.json` must be 0 and the new file
  must import `cn` from `@/lib/utils`.

## Phase 1: Primitives

### Overview

Add the Alert component and make `Button` show a pointer cursor by itself.

### Changes Required:

#### 1. shadcn alert

**File**: `src/components/ui/alert.tsx` (generated)

**Intent**: One in-page message component for success, server errors and the network error.

**Contract**: `npx shadcn@latest add alert`; exports `Alert`, `AlertTitle`, `AlertDescription`;
variants `default`, `destructive` plus an added `success` (`text-success`, success-tinted
border/background, mirroring `Banner.astro:16`). No new npm dependency; `cn` from `@/lib/utils`.

#### 2. Button cursor

**Files**: `src/components/ui/button.tsx`, `src/components/reports/ReportsList.tsx`,
`src/components/reports/ReportUpload.tsx`

**Intent**: Pointer cursor from the shared primitive instead of per-call overrides.

**Contract**: `cursor-pointer` in the `buttonVariants` base classes (disabled already sets
`pointer-events-none`); the 8 `className="cursor-pointer"` overrides in the two view files are removed.

### Success Criteria:

#### Automated Verification:

- `src/components/ui/alert.tsx` exists, imports `cn` from `@/lib/utils`, and `grep -c '"cn"' package.json` returns 0
- `grep -c cursor-pointer src/components/reports/ReportsList.tsx src/components/reports/ReportUpload.tsx` returns 0 for both
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`

#### Manual Verification:

- Buttons on the reports list, the dashboard and the report details page show a pointer cursor

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Shared values — error codes and dates

### Overview

Replace free-text `?error` with codes and introduce one date formatter.

### Changes Required:

#### 1. Error codes

**File**: `src/lib/report-errors.ts` (new)

**Intent**: Single allow-list of report error codes and their Polish messages.

**Contract**: `ReportErrorCode` = `not_configured | no_file | too_large | bad_type | invalid_file | upload_failed | delete_failed | report_not_found`;
`reportErrorMessage(code: string | null): string` (unknown → "Coś poszło nie tak. Spróbuj ponownie.");
`reportErrorUrl(code: ReportErrorCode, detail?: string): string` → `/reports?error=<code>[&detail=…]`.

#### 2. Endpoints emit codes

**Files**: `src/pages/api/reports/upload.ts`, `src/pages/api/reports/[id]/delete.ts`

**Intent**: No raw Supabase text reaches the URL or the user.

**Contract**: every `/reports?error=` redirect goes through `reportErrorUrl`; `upload.ts:64,78,112`
→ `upload_failed` after `console.error` of the original error; parser failure (`:48`) →
`invalid_file` with `detail` = the parser's message; `delete.ts:29` → `delete_failed` (logged),
`:33` → `report_not_found`; `:9` / upload `:25` → `not_configured`. Success redirects unchanged.

#### 3. Date helper

**File**: `src/lib/format-date.ts` (new)

**Intent**: Same instant, same text, on server and in the browser.

**Contract**: `formatDateTime(value: string | Date): string` via `Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day/month: "2-digit", year: "numeric", hour/minute: "2-digit" })`.
Examples: `2026-10-02T12:30:00Z` → `02.10.2026, 14:30`; `2026-01-15T23:30:00Z` → `16.01.2026, 00:30`.

#### 4. Use the helper

**Files**: `src/components/reports/ReportsList.tsx` (list + delete dialog; remove `formatUploadedAt`),
`src/pages/reports/[id].astro` (header, remove `:38-43` local formatter),
`src/components/dashboard/DashboardView.astro` (replace `dateFormatter`)

**Intent**: The list, details and dashboard show the same upload time.

**Contract**: all three call `formatDateTime`; no `getHours()` left in these files.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `grep -nE "encodeURIComponent\([^)]*\.message" src/pages/api/reports/upload.ts "src/pages/api/reports/[id]/delete.ts"` returns nothing
- `grep -n getHours src/components/reports/ReportsList.tsx "src/pages/reports/[id].astro" src/components/dashboard/DashboardView.astro` returns nothing
- A Node one-off run of `formatDateTime` returns `02.10.2026, 14:30` for `2026-10-02T12:30:00Z` and `16.01.2026, 00:30` for `2026-01-15T23:30:00Z`
- `npm run check:ui-tokens` still passes

#### Manual Verification:

- One report shows the same upload date and time on the list, its details page and the dashboard
- `/reports?error=dowolny tekst` shows the generic message, not the text

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: The view on the contract

### Overview

Cards, alerts, honest states and pagination on the page; cards, in-place server errors,
scale values and a visible drop zone in the upload component.

### Changes Required:

#### 1. Page states and messages

**File**: `src/pages/reports/index.astro`

**Intent**: Every outcome of loading the list says what actually happened.

**Contract**:
- List wrapper (`:57`) → `Card`.
- `?deleted` → `Alert variant="success"`; `?error` → `Alert variant="destructive"` with `reportErrorMessage(code)`.
- Fetch error → `Alert variant="destructive"` "Nie udało się wczytać listy raportów. Odśwież stronę." and no `ReportsList` empty state.
- `count` known and `page > lastPage` → `Astro.redirect` to `?page=<lastPage>` (omit when 1), keeping `deleted=1`. Example: 25 reports, `?page=5` → `/reports?page=2`; 0 reports, `?page=3&deleted=1` → `/reports?deleted=1`.
- Pagination: "Poprzednia" / "Następna" as `buttonVariants({ variant: "outline", size: "sm" })` links, "Strona X z Y" between them.

#### 2. Upload card

**File**: `src/components/reports/ReportUpload.tsx`

**Intent**: The upload card shows every failure in place and uses the shared vocabulary.

**Contract**:
- `ErrorCard` (`:104`) and the progress container (`:235`) → `Card` (destructive border kept via `className`).
- New `UploadError` kind `server` `{ code, detail? }`: in `xhr.onload`, if `responseURL` is `/reports` with an `error` param, set this error instead of navigating; message from `reportErrorMessage(code)`, `detail` shown under it (only for `invalid_file`).
- Network error (`:424`) → the same error card shape with a "Spróbuj ponownie" button that re-sends the last file.
- Drop zone (`:392`): `border-2 border-dashed border-muted-foreground`, drag-over `border-primary`, radius/padding aligned with `Card` (`rounded-xl`).
- `pl-[18px]` → `pl-5`, `w-[150px]` → `w-40`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `grep -nE "rounded-lg border" src/pages/reports/index.astro src/components/reports/ReportUpload.tsx` returns nothing
- `grep -noE '[a-z-]+-\[[^] ]+\]' src/pages/reports/index.astro src/components/reports/ReportUpload.tsx src/components/reports/ReportsList.tsx` lists only `max-w-[1100px]` (and `ring-[3px]` if used)
- `grep -n "<Banner" src/pages/reports/index.astro` returns nothing

#### Manual Verification:

- Uploading a file with a bad row shows "Wiersz N: …" inside the upload card with no page reload
- `/reports?page=99` lands on the last existing page; deleting the only report on the last page lands on the new last page with the success message
- Pagination shows "Strona X z Y" and both links take keyboard focus with the ring
- The drop zone's dashed border is clearly visible in light and dark

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Upload states and focus

### Overview

Make the upload progress perceivable and keep keyboard users in place.

### Changes Required:

#### 1. Announcements and animation

**File**: `src/components/reports/ReportUpload.tsx`

**Intent**: Users (and screen readers) can tell the upload is progressing, not finished or frozen.

**Contract**: stage text in a `role="status"` (`aria-live="polite"`) region; progressbar gets
`aria-valuetext` ("Sprawdzanie kolumn", "Wysyłanie 40%", "Przetwarzanie"); for `checking` and
`processing` the bar animates (`animate-pulse`, `motion-reduce:animate-none`) instead of
`opacity-40`; drag-over text changes to "Upuść plik, aby go wgrać".

#### 2. Focus management

**File**: `src/components/reports/ReportUpload.tsx`

**Intent**: Focus never falls to `<body>` when the card swaps content.

**Contract**: on entering a progress state focus moves to the status heading (`tabIndex={-1}`);
on an error the error title gets focus; "Zamknij" returns focus to "Wgraj raport".

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `grep -c "opacity-40" src/components/reports/ReportUpload.tsx` returns 0 and `grep -c 'role="status"' src/components/reports/ReportUpload.tsx` returns at least 1

#### Manual Verification:

- Keyboard only: after "Wgraj raport" focus is on the status; after an error on its title; after "Zamknij" on "Wgraj raport"
- During "Sprawdzanie kolumn" and "Przetwarzanie" the bar visibly animates

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Kitchen sink and visual gate

### Overview

Rebuild the reports-list kitchen sink from real components, both themes, and capture it.

### Changes Required:

#### 1. Dev-only state props

**Files**: `src/components/reports/ReportUpload.tsx`, `src/components/reports/ReportsList.tsx`

**Intent**: Render upload stages and the open delete dialog without user interaction.

**Contract**: `ReportUpload` gains `initialState?: UploadState` (exported type) next to
`initialError`; `ReportsList` gains `initialDeletingId?: string`. Both are used only by the kitchen sink.

#### 2. Kitchen sink

**File**: `src/pages/dev/kitchen-sink/reports-list.astro` (rewrite)

**Intent**: Every state visible at once, from the code users actually get.

**Contract**: only real components (no hand-copied tables); each state in a light frame and a
`<div class="dark">` frame; frames drop outer padding below `sm` (as in
`src/pages/dev/kitchen-sink/dashboard.astro`). States:

| State | Frame |
| --- | --- |
| default | list with 3 reports (37 / 0 / null deviations) + idle upload |
| hover | note + forced-hover samples |
| focus-visible | note + forced-ring samples (pagination link, row action, upload button) |
| disabled | **N/A** — no disabled control on this page (double submit prevented by state swap); reason shown |
| error | upload errors `too_large`, `bad_format`, `missing_columns`, `network`, `server/upload_failed`, `server/invalid_file` (with row detail); page Alerts for `delete_failed` and list fetch failure |
| empty | no reports |
| loading | upload `checking`, `uploading` 40%, `processing` |
| extra | delete dialog open; success Alert; pagination "Strona 2 z 3" |

#### 3. Screenshot script

**File**: `scripts/kitchen-sink-shot.mjs` (new, dependency-free)

**Intent**: Reproducible gate screenshots (Chrome headless ignores widths under ~485px on Windows).

**Contract**: `node scripts/kitchen-sink-shot.mjs <url> <width> <out.png>` — CDP device emulation,
full-page capture, prints `{vw, sw, h}`; used for `context/changes/reports-list-ui-contract/screenshots/kitchen-sink-{desktop,390}.png`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `/dev/kitchen-sink/reports-list` returns HTTP 200 from the dev server
- `grep -c "<Table" src/pages/dev/kitchen-sink/reports-list.astro` returns 0
- Both screenshots exist and the 390 run reports `sw` = 390

#### Manual Verification:

- The screenshots show every listed state in light and dark, N/A frames with their reason

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Guard

### Overview

Leave a rule and extend the check so the next agent keeps the view on the contract.

### Changes Required:

#### 1. Agent rule

**File**: `CLAUDE.md` (project section, next to the existing UI bullets at `:174-175`, outside the CLI block)

**Intent**: Tell the next agent where messages, errors and dates come from.

**Contract**: in-page messages use `ui/alert` (Banner only for the `Layout.astro` config strip);
report errors travel as codes from `src/lib/report-errors.ts`, never raw text; dates via
`formatDateTime` in `src/lib/format-date.ts`; kitchen sink `src/pages/dev/kitchen-sink/reports-list.astro`
and `scripts/kitchen-sink-shot.mjs`.

#### 2. Token check scope

**File**: `scripts/check-ui-tokens.mjs`

**Intent**: The reports list fails fast on literals like the dashboard does.

**Contract**: scanned files add `src/pages/reports/index.astro`, `src/components/reports/ReportsList.tsx`,
`src/components/reports/ReportUpload.tsx`, `src/components/ui/alert.tsx`; no new allow-list entries
unless a reviewed value appears (document each).

### Success Criteria:

#### Automated Verification:

- `npm run check:ui-tokens` exits 0 and lists the 4 added files
- `npm run check:ui-tokens` exits non-zero when `bg-slate-100` is temporarily added to `ReportsList.tsx` (revert after)
- Lint passes: `npm run lint`

#### Manual Verification:

- The `CLAUDE.md` bullet reads correctly and points at files that exist

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None added (no test framework). `formatDateTime` is checked by a Node one-off with a summer
  and a winter instant (Phase 2).

### Integration Tests:

- None; the kitchen sink renders states from fixtures and dev-only props.

### Manual Testing Steps:

1. Upload a file with a bad date row → error with the row number in the upload card, no reload.
2. Open `/reports?error=x` and `/reports?error=upload_failed` → generic vs mapped message.
3. `/reports?page=99` → last page; delete the last report on the last page → new last page + success Alert.
4. Compare one report's time on the list, its details and the dashboard.
5. Keyboard through an upload: focus on status, on error title, back on "Wgraj raport".
6. Toggle dark mode: drop zone border, Alerts, cards.

## Performance Considerations

None material; the out-of-range redirect adds one round trip only for invalid page numbers.

## Migration Notes

`?error` values change from text to codes; only `index.astro` and `ReportUpload` read them.
Old bookmarked `?error=<text>` links show the generic message.

## References

- Research: `context/changes/reports-list-ui-contract/research.md`
- Previous audit: `context/archive/2026-10-06-reports-list-ui-tokens/`
- Dashboard pattern (Card density, kitchen sink frames, CDP screenshots): `context/archive/2026-10-07-dashboard-ui-tokens/`
- Lessons: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Primitives

#### Automated

- [x] 1.1 `src/components/ui/alert.tsx` exists, imports `cn` from `@/lib/utils`, and `grep -c '"cn"' package.json` returns 0
- [x] 1.2 `grep -c cursor-pointer src/components/reports/ReportsList.tsx src/components/reports/ReportUpload.tsx` returns 0 for both
- [x] 1.3 Type check passes: `npx astro check`
- [x] 1.4 Lint passes: `npm run lint`

#### Manual

- [x] 1.5 Buttons on the reports list, the dashboard and the report details page show a pointer cursor

### Phase 2: Shared values — error codes and dates

#### Automated

- [ ] 2.1 Type check passes: `npx astro check`
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 `grep -nE "encodeURIComponent\([^)]*\.message" src/pages/api/reports/upload.ts "src/pages/api/reports/[id]/delete.ts"` returns nothing
- [ ] 2.4 `grep -n getHours src/components/reports/ReportsList.tsx "src/pages/reports/[id].astro" src/components/dashboard/DashboardView.astro` returns nothing
- [ ] 2.5 A Node one-off run of `formatDateTime` returns `02.10.2026, 14:30` for `2026-10-02T12:30:00Z` and `16.01.2026, 00:30` for `2026-01-15T23:30:00Z`
- [ ] 2.6 `npm run check:ui-tokens` still passes

#### Manual

- [ ] 2.7 One report shows the same upload date and time on the list, its details page and the dashboard
- [ ] 2.8 `/reports?error=dowolny tekst` shows the generic message, not the text

### Phase 3: The view on the contract

#### Automated

- [ ] 3.1 Type check passes: `npx astro check`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 `grep -nE "rounded-lg border" src/pages/reports/index.astro src/components/reports/ReportUpload.tsx` returns nothing
- [ ] 3.4 `grep -noE '[a-z-]+-\[[^] ]+\]' src/pages/reports/index.astro src/components/reports/ReportUpload.tsx src/components/reports/ReportsList.tsx` lists only `max-w-[1100px]` (and `ring-[3px]` if used)
- [ ] 3.5 `grep -n "<Banner" src/pages/reports/index.astro` returns nothing

#### Manual

- [ ] 3.6 Uploading a file with a bad row shows "Wiersz N: …" inside the upload card with no page reload
- [ ] 3.7 `/reports?page=99` lands on the last existing page; deleting the only report on the last page lands on the new last page with the success message
- [ ] 3.8 Pagination shows "Strona X z Y" and both links take keyboard focus with the ring
- [ ] 3.9 The drop zone's dashed border is clearly visible in light and dark

### Phase 4: Upload states and focus

#### Automated

- [ ] 4.1 Type check passes: `npx astro check`
- [ ] 4.2 Lint passes: `npm run lint`
- [ ] 4.3 `grep -c "opacity-40" src/components/reports/ReportUpload.tsx` returns 0 and `grep -c 'role="status"' src/components/reports/ReportUpload.tsx` returns at least 1

#### Manual

- [ ] 4.4 Keyboard only: after "Wgraj raport" focus is on the status; after an error on its title; after "Zamknij" on "Wgraj raport"
- [ ] 4.5 During "Sprawdzanie kolumn" and "Przetwarzanie" the bar visibly animates

### Phase 5: Kitchen sink and visual gate

#### Automated

- [ ] 5.1 Type check passes: `npx astro check`
- [ ] 5.2 Lint passes: `npm run lint`
- [ ] 5.3 `/dev/kitchen-sink/reports-list` returns HTTP 200 from the dev server
- [ ] 5.4 `grep -c "<Table" src/pages/dev/kitchen-sink/reports-list.astro` returns 0
- [ ] 5.5 Both screenshots exist and the 390 run reports `sw` = 390

#### Manual

- [ ] 5.6 The screenshots show every listed state in light and dark, N/A frames with their reason

### Phase 6: Guard

#### Automated

- [ ] 6.1 `npm run check:ui-tokens` exits 0 and lists the 4 added files
- [ ] 6.2 `npm run check:ui-tokens` exits non-zero when `bg-slate-100` is temporarily added to `ReportsList.tsx` (revert after)
- [ ] 6.3 Lint passes: `npm run lint`

#### Manual

- [ ] 6.4 The `CLAUDE.md` bullet reads correctly and points at files that exist
