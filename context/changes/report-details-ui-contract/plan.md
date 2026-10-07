# Report details design-system contract Implementation Plan

## Overview

Put the report details view (Szczegóły raportu) — `src/pages/reports/[id].astro` and its island
`src/components/reports/DeviationsList.tsx` — on the design-system contract: the entry point tells
"not found" from "could not load" with real HTTP statuses, a visit opens from the keyboard,
review/export failures are visible, containers are `Card`, every control shows the token focus
ring, and the visit table fits a 390px phone. Wording stays word for word except three messages
approved during planning (CLAUDE.md, "Claude Design views keep their user-facing information").

## Current State Analysis

From `context/changes/report-details-ui-contract/research.md` (2026-10-07, commit `cc4918d`):

- 0 colour literals / palette classes; 56 token-class uses in the island, 2 in the page.
- `[id].astro`: `report` stays `null` when `createClient` returns `null`, when either query
  errors, or when `maybeSingle()` finds nothing; all three render
  `<Banner variant="error">Nie znaleziono raportu.</Banner>` with HTTP 200. An invalid UUID in
  the URL makes Postgres error and lands in the same branch.
- Visit expansion is a clickable `<TableRow onClick aria-expanded>` (`DeviationsList.tsx:370-377`),
  not focusable; single "Cofnij" / "Oznacz jako sprawdzone" and "Cofnij wszystkie" exist only in the
  expanded row (`:485-563`).
- `updateDeviationStatus` and `exportList` fail with `console.error` only (`:311-313`, `:327-328`,
  `:350-351`). Reachable: an expired session makes the middleware redirect, so `fetch` gets HTML;
  `src/pages/api/deviations/review.ts:42` returns 500 on a Supabase error.
- 8 hand-built `bg-card rounded-lg border` containers (`:520, :581, :593, :610, :712, :716, :737`);
  `SELECT_CLASS` (`:79`) and the group header `<button>` (`:738-745`) have no token focus ring.
- Fixed widths `w-[110px]`, `w-[200px]` (×2), `w-[230px]` (`:398, :783-786`) make the visit table
  ≥ 768px; on 390px it scrolls inside the group card and the Status column starts off-screen.
- `formatTimestamp` (`:93-97`) uses browser-local `getHours()`; the header uses `formatDateTime`.
- No kitchen sink; `check:ui-tokens` does not scan either file.

## Desired End State

- `/reports/<id>`: missing / foreign / malformed id → "Nie znaleziono raportu." + 404; Supabase not
  configured → `REPORT_ERROR_MESSAGES.not_configured` + 503; query error → "Nie udało się wczytać
  raportu. Spróbuj ponownie za chwilę." + 500 (raw message to `console.error` only). All three in
  `Alert variant="destructive"`, no `Banner` on this page.
- The visit date in each row is a `<button aria-expanded aria-controls>` with the token focus
  ring; mouse click on the row still toggles.
- A failed review or export shows one `Alert variant="destructive"` under the toolbar —
  "Nie udało się zapisać zmiany statusu. Spróbuj ponownie za chwilę." /
  "Nie udało się wyeksportować listy. Spróbuj ponownie." — cleared by the next successful action.
- "Sprawdzono: …" uses `formatDateTime` (Europe/Warsaw).
- Summary tiles, empty states, representative groups and deviation cards are `Card` with the
  design's dimensions; both selects and the group header show the button focus ring.
- Below `md` the Klient column is hidden and the visit table has no fixed widths; at 390px the
  review button is visible without horizontal scroll.
- `/dev/kitchen-sink/report-details` renders the 7-state matrix (light + dark) from the real
  components; screenshots at 1280 and 390 in the change folder.
- `check:ui-tokens` scans the page, the island and the new error component; CLAUDE.md records the
  contract and drops the two "not migrated yet" notes for this view.

Verify: `npx astro check`, `npm run lint`, `npm run check:ui-tokens`, kitchen-sink screenshots,
manual keyboard and failure pass.

### Key Discoveries:

- `Alert` is already used from `.astro` without hydration (`src/pages/reports/index.astro:83-101`,
  `AlertDescription className="text-current"`) — same pattern for the page error.
- `REPORT_ERROR_MESSAGES.not_configured` (`src/lib/report-errors.ts:7`) is reusable text; the other
  two load messages are local to this view.
- Kitchen-sink precedent with dev-only initial-state props: `src/pages/dev/kitchen-sink/reports-list.astro`
  (`initialState`, `initialDeletingId`); `Card`-with-design-dimensions precedent:
  `context/archive/2026-10-07-reports-list-ui-contract/`, `context/archive/2026-10-07-landing-ui-contract/plan.md`.
- Focus-ring classes to copy: `button.tsx:8` (`outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50`).
- `check:ui-tokens` already allows `ring-[3px]` and has a per-file `bg-primary/10` tint map.
- Lesson (`context/foundation/lessons.md`): `TableCell` has `whitespace-nowrap`; any cell that must
  wrap below `md` (Status, Odstępstwa) needs `whitespace-normal` on the cell itself.

## What We're NOT Doing

- No wording change beyond the three approved messages; "Nie znaleziono raportu." stays as is.
- No `--rule-*` colours on this view — rule labels/counts stay `text-destructive` (decided).
- No shadcn `select` / `badge`; `StatusPill` stays hand-built (tint allowed).
- No per-action spinner; pending stays "disabled button".
- No card layout for visits on phones; no change to filters, sorting, export content or the review API.
- No change to `max-w-[1100px]`, `transition-[width]` or the two grid templates (allow-listed).
- No migration of other views still using `Banner`; no CI wiring; no test framework.

## Implementation Approach

`/10x-ui` order: contract of behaviour first (entry point, interactions), then components and
layout, then the visual gate, then the guard. Entry point and island are separate phases because
they fail in different runtimes (Astro SSR vs React).

## Critical Implementation Details

- **Status before render.** `Astro.response.status` must be set in the frontmatter, before any
  output; the error branch keeps the "Wynik raportu" heading and the "Wróć do raportów" link.
- **Row click vs button click.** The date button's handler must `stopPropagation()`, otherwise the
  row's `onClick` toggles the visit a second time and nothing opens.
- **Hidden cell and `colSpan`.** Hiding Klient with `hidden md:table-cell` leaves the expanded
  row's `colSpan={5}`; that is valid (spans the visible columns), keep it.

## Phase 1: Entry point states

### Overview

Separate not-found, not-configured and load failure, with HTTP statuses and `Alert`.

### Changes Required:

#### 1. Load error component

**File**: `src/components/reports/ReportLoadError.astro` (new)

**Intent**: One place for the three page-level messages, rendered identically by the page and the kitchen sink.

**Contract**: prop `kind: "not_found" | "not_configured" | "load_failed"`; renders
`Alert variant="destructive"` + `AlertDescription className="text-current"` with, respectively,
"Nie znaleziono raportu.", `REPORT_ERROR_MESSAGES.not_configured`,
"Nie udało się wczytać raportu. Spróbuj ponownie za chwilę.".

#### 2. Page load logic

**File**: `src/pages/reports/[id].astro`

**Intent**: A database problem must not tell the manager the report does not exist.

**Contract**: frontmatter computes `loadError: kind | null` in this order: no client →
`not_configured` (503); `id` not a UUID (regex, no query) → `not_found` (404); either query
`error` → `load_failed` (500, `console.error` with the raw message); report `null` → `not_found`
(404). Sets `Astro.response.status`. Renders `<ReportLoadError kind={loadError} />` instead of
`Banner`; the `Banner` import is removed. Success path unchanged.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `grep -c "Banner" "src/pages/reports/[id].astro"` returns 0

#### Manual Verification:

- Signed in: `/reports/nie-uuid` and `/reports/<random valid UUID>` show "Nie znaleziono raportu." in an in-page alert with status 404 (devtools Network); an existing report renders as before
- With `SUPABASE_URL` removed from `.dev.vars`, `/reports/<id>` shows the not-configured message with status 503

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Island interactions

### Overview

Keyboard-reachable visit details, visible action failures, shared timestamp format.

### Changes Required:

#### 1. Date as the expand control

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Keyboard and screen-reader users can open a visit's context and its per-deviation actions.

**Contract**: the date cell content becomes `<button type="button" aria-expanded={isOpen}
aria-controls={<details row id>}>` showing the formatted date (its accessible name), with
`rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50` and
`cursor-pointer`; handler calls `stopPropagation()` and `toggleVisit`. The expanded `TableRow`
gets that `id`. `aria-expanded` moves off the `<tr>`; the row's `onClick` and `data-state` stay.

#### 2. Action error alert

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: A failed review or export tells the user, instead of a button that flickers.

**Contract**: state `actionError: "review" | "export" | null`. Set to `"review"` on non-OK /
non-JSON response or thrown fetch in `updateDeviationStatus`; to `"export"` on a throw in
`exportList`; set to `null` after a successful review update or export. `console.error` calls stay.
Rendered between the toolbar and the list as `Alert variant="destructive"` +
`AlertDescription className="text-current"` with "Nie udało się zapisać zmiany statusu. Spróbuj
ponownie za chwilę." / "Nie udało się wyeksportować listy. Spróbuj ponownie."

#### 3. Timestamp

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: "Sprawdzono: …" matches the header's time zone.

**Contract**: remove `formatTimestamp`; `:548` uses `formatDateTime` from `@/lib/format-date`.
`formatVisitDate` stays.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `grep -cE "getHours|formatTimestamp" src/components/reports/DeviationsList.tsx` returns 0
- `grep -c "aria-controls" src/components/reports/DeviationsList.tsx` returns at least 1

#### Manual Verification:

- Keyboard only: Tab reaches each visit date, Enter and Space open/close the details, the ring is visible, and "Cofnij" on a single deviation works
- Mouse click anywhere on the row still toggles it once
- With devtools "Offline", "Oznacz jako sprawdzone" shows the review alert; back online, a successful mark clears it
- A reviewed deviation shows "Sprawdzono: DD.MM.YYYY, HH:MM" equal to Warsaw time

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Components and layout

### Overview

Shared `Card`, token focus ring on the remaining controls, phone-width table.

### Changes Required:

#### 1. Cards

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Use the repo's container with the design's look.

**Contract**: summary tiles (`:581`, `:593`, `:610`) → `Card` with `rounded-lg p-4 gap-1
shadow-none` (`gap-2` on "Przejrzane"); empty states (`:712`, `:716`) → `Card` `rounded-lg p-10
shadow-none` keeping their text/flex classes; representative group (`:737`) → `Card` `rounded-lg
p-0 gap-0 shadow-none`; deviation card (`:520`) → `Card` `rounded-lg p-3 gap-4 flex-row
flex-wrap items-start justify-between` keeping the done / not-done variants (`bg-muted/50
shadow-none` vs `border-destructive shadow-xs`). The status segmented control container stays a
`div role="group"`.

#### 2. Focus ring and hover

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Every control on the toolbar and group header looks focused the same way as the buttons.

**Contract**: `SELECT_CLASS` adds `outline-none focus-visible:border-ring focus-visible:ring-[3px]
focus-visible:ring-ring/50`; the group header button adds `rounded-lg outline-none
focus-visible:ring-[3px] focus-visible:ring-ring/50 hover:bg-muted/50`.

#### 3. Phone-width visit table

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: The review button is reachable on a 390px phone without sideways scrolling.

**Contract**: Klient `TableHead`/`TableCell` → `hidden md:table-cell md:w-50` (client stays in the
expanded "Kontekst wizyty"); date column `w-27.5`; Status column `md:w-57.5`; rule label span
`md:w-50 md:shrink-0` (no fixed width below `md`); below `md` the Status cell gets
`whitespace-normal` and its content stacks (`flex-col items-end` → `md:flex-row`). Group header
progress `w-[150px]` → `w-37.5`. If the table still exceeds the group card at 390px, record the
measured width and ask before changing anything else.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `grep -nE "bg-card[^\"]*rounded-lg border|rounded-lg border p-" src/components/reports/DeviationsList.tsx` returns nothing
- `grep -noE '[a-z-]+-\[[^] ]+\]' src/components/reports/DeviationsList.tsx` lists only `ring-[3px]`, `transition-[width]`, `grid-cols-[300px_minmax(0,1fr)]` and `grid-cols-[1.2fr_repeat(3,1fr)_1.3fr]`
- Visible text of the island (tags stripped) for a fixed fixture is identical before and after the phase

#### Manual Verification:

- Desktop, both themes: tiles, groups, deviation cards and empty states look as before
- Tab through selects and a group header: ring identical to the neighbouring buttons
- At 390px a group with visits shows date, deviations and the "Oznacz…" button without horizontal scroll

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Kitchen sink and visual gate

### Overview

Render every state from the real components and capture it.

### Changes Required:

#### 1. Dev-only initial-state props

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Let the kitchen sink show states that need interaction (open visit, filters, pending, failure).

**Contract**: optional `initialOpenVisitIds?: string[]`, `initialFilters?: Partial<FilterState>`,
`initialPendingIds?: string[]`, `initialActionError?: "review" | "export" | null`; absent →
current behaviour. Only the kitchen sink passes them.

#### 2. Kitchen sink

**File**: `src/pages/dev/kitchen-sink/report-details.astro` (new)

**Intent**: The 7-state matrix in light and dark.

**Contract**: fixtures (≥ 2 representatives, a multi-rule visit, a reviewed deviation with
`reviewed_at`, a no-GPS visit); frames as in `reports-list.astro` (light + `<div class="dark">`):
default (one visit open); hover (note + group header / row); focus-visible (forced ring samples:
date button, select, group header, button); disabled (pending ids; filters with no matches →
export disabled); error (`initialActionError` review and export; `ReportLoadError` ×3); empty
(no visits, no deviations, no filter matches); loading — N/A, SSR, pending shown as disabled.
A `?compact=1` mode is allowed if the 390 capture is too tall (landing precedent).

#### 3. Screenshots

**Files**: `context/changes/report-details-ui-contract/screenshots/`

**Intent**: Evidence and baseline, including the charge-5 check.

**Contract**: `node scripts/kitchen-sink-shot.mjs` → `kitchen-sink-desktop.png` (1280) and
`kitchen-sink-390.png` (390).

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `/dev/kitchen-sink/report-details` returns HTTP 200
- Both screenshots exist and the 390 run reports `sw` = 390

#### Manual Verification:

- The screenshots show all 7 matrix cells in light and dark, the three page errors, both action errors, and at 390 the review button inside the card

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Guard

### Overview

Keep the view on the contract and tell the next agent.

### Changes Required:

#### 1. Token check scope

**File**: `scripts/check-ui-tokens.mjs`

**Intent**: Fail fast on literals in this view.

**Contract**: add `src/pages/reports/[id].astro`, `src/components/reports/DeviationsList.tsx`,
`src/components/reports/ReportLoadError.astro` under a "Report details" comment; allow-list
`transition-[width]`, `grid-cols-[300px_minmax(0,1fr)]`, `grid-cols-[1.2fr_repeat(3,1fr)_1.3fr]`
with a comment "Claude Design report details layout"; add `DeviationsList.tsx` to the
`bg-primary/10` tint entry (StatusPill); update the header comment's view list.

#### 2. Agent rule

**File**: `CLAUDE.md` (UI bullets, outside the toolkit block)

**Intent**: Record the contract and remove stale "not migrated" notes.

**Contract**: drop "report details" from the `Banner` in-page list and the "`DeviationsList.tsx`
… is not migrated yet" sentence; add one bullet: page errors via `ReportLoadError` (404 / 503 /
500), action failures via one `Alert` in the island, the visit date button is the expand control
(row click is a mouse convenience only), kitchen sink path and its dev-only props,
`check:ui-tokens` covers the view.

### Success Criteria:

#### Automated Verification:

- `npm run check:ui-tokens` exits 0 and lists the three files
- `npm run check:ui-tokens` exits non-zero when `text-red-600` is temporarily added to `DeviationsList.tsx` (revert after)
- Lint passes: `npm run lint`

#### Manual Verification:

- The CLAUDE.md bullet reads correctly and points at files that exist

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None (no test framework; out of this lesson's scope). Visible-text comparison in Phase 3 guards wording.

### Integration Tests:

- None; the kitchen sink renders the real components with dev-only props.

### Manual Testing Steps:

1. Keyboard-only pass: open a visit, mark and undo a single deviation.
2. Offline review click → alert; successful click → alert gone.
3. `/reports/nie-uuid`, random UUID, missing Supabase config — message and status.
4. 390px: review button visible; desktop unchanged in both themes.

## Performance Considerations

None.

## Migration Notes

User-visible changes: in-page alert instead of the strip, real 404/503/500 statuses, a visible
error after a failed action, Klient column hidden below `md`.

## References

- Research: `context/changes/report-details-ui-contract/research.md`
- Prior decision reversed: `context/archive/2026-10-01-mark-deviation-reviewed/plan.md:48`
- Kitchen-sink and Card precedents: `src/pages/dev/kitchen-sink/reports-list.astro`, `context/archive/2026-10-07-landing-ui-contract/plan.md`
- Wording rule: CLAUDE.md "Claude Design views keep their user-facing information"

## Deviations during implementation

Each was approved by the user during implementation; Progress rows were not renamed.

- **Phase 1:** `ReportLoadErrorKind`, the messages and the status map live in `src/lib/report-load-errors.ts` instead of the `.astro` frontmatter — type-aware ESLint cannot resolve types exported from an `.astro` file.
- **Phase 3 — 390px table (user decision after measurement):** with the planned contract the table measured 449px in a 308px container. Below `md` the Status column is hidden and the same block (`statusContent`, one JSX value rendered twice, one copy `display:none` at each width) sits under the deviations in the Odstępstwa cell; the date column is content-sized below `md` (`md:w-27.5`), the group table wrapper has no side padding below `md` (`md:px-4`) and the chevron cell drops its right padding below `md`. Measured after: 340px table in a 340px container at 390; desktop 1018 = 1018. Criterion 3.5 checked as "same words; the only additions are the hidden duplicate of the status block".
- **Phase 3 — manual gate feedback (user request):** (a) the deviation card's single-action button ("Cofnij" / "Oznacz jako sprawdzone") landed top-right or bottom-left depending on text length (pre-existing `flex-wrap` + `justify-between`); now it is always top-right from `md` (text wraps, button `shrink-0`) and always below the text under `md`. (b) Representative groups no longer start with the largest one expanded (Claude Design rule, which could put the open group last in the date order); every group starts collapsed. Criterion 3.5 was measured before (b) — with all groups collapsed the visit table is simply not rendered on load. Phase 4 therefore needs a dev-only initial-expanded-groups prop next to `initialOpenVisitIds`.
- **Implementation review F1 (user decision):** the action error is no longer "cleared by the next successful action". A new attempt of the same kind (review / export) clears it, and a success never does, so an overlapping successful request or an export cannot hide a failed review.
- **Implementation review F2:** manual criterion 1.5 (503 "not configured") cannot be observed on `/reports/<id>` itself. Without Supabase the middleware cannot resolve a user and redirects to sign-in before the page runs. The branch stays as defence in depth, and 1.5 was verified through the kitchen-sink render of `ReportLoadError kind="not_configured"`.
- **Implementation review F3–F5:** the visit date button sets `aria-controls` only while the details row is mounted. The group header gets `aria-controls` (the panel id comes from `useId`) and `sr-only` rule labels before each count, using existing `RULE_LABELS` text. A 200 response that updates fewer rows than requested now shows the review error.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Entry point states

#### Automated

- [x] 1.1 Type check passes: `npx astro check` — 55af009
- [x] 1.2 Lint passes: `npm run lint` — 55af009
- [x] 1.3 `grep -c "Banner" "src/pages/reports/[id].astro"` returns 0 — 55af009

#### Manual

- [x] 1.4 Signed in: `/reports/nie-uuid` and `/reports/<random valid UUID>` show "Nie znaleziono raportu." in an in-page alert with status 404 (devtools Network); an existing report renders as before — 55af009
- [x] 1.5 With `SUPABASE_URL` removed from `.dev.vars`, `/reports/<id>` shows the not-configured message with status 503 — 55af009

### Phase 2: Island interactions

#### Automated

- [x] 2.1 Type check passes: `npx astro check` — cd777f7
- [x] 2.2 Lint passes: `npm run lint` — cd777f7
- [x] 2.3 `grep -cE "getHours|formatTimestamp" src/components/reports/DeviationsList.tsx` returns 0 — cd777f7
- [x] 2.4 `grep -c "aria-controls" src/components/reports/DeviationsList.tsx` returns at least 1 — cd777f7

#### Manual

- [x] 2.5 Keyboard only: Tab reaches each visit date, Enter and Space open/close the details, the ring is visible, and "Cofnij" on a single deviation works — cd777f7
- [x] 2.6 Mouse click anywhere on the row still toggles it once — cd777f7
- [x] 2.7 With devtools "Offline", "Oznacz jako sprawdzone" shows the review alert; back online, a successful mark clears it — cd777f7
- [x] 2.8 A reviewed deviation shows "Sprawdzono: DD.MM.YYYY, HH:MM" equal to Warsaw time — cd777f7

### Phase 3: Components and layout

#### Automated

- [x] 3.1 Type check passes: `npx astro check` — a7c192b
- [x] 3.2 Lint passes: `npm run lint` — a7c192b
- [x] 3.3 `grep -nE "bg-card[^\"]*rounded-lg border|rounded-lg border p-" src/components/reports/DeviationsList.tsx` returns nothing — a7c192b
- [x] 3.4 `grep -noE '[a-z-]+-\[[^] ]+\]' src/components/reports/DeviationsList.tsx` lists only `ring-[3px]`, `transition-[width]`, `grid-cols-[300px_minmax(0,1fr)]` and `grid-cols-[1.2fr_repeat(3,1fr)_1.3fr]` — a7c192b
- [x] 3.5 Visible text of the island (tags stripped) for a fixed fixture is identical before and after the phase — a7c192b

#### Manual

- [x] 3.6 Desktop, both themes: tiles, groups, deviation cards and empty states look as before — a7c192b
- [x] 3.7 Tab through selects and a group header: ring identical to the neighbouring buttons — a7c192b
- [x] 3.8 At 390px a group with visits shows date, deviations and the "Oznacz…" button without horizontal scroll — a7c192b

### Phase 4: Kitchen sink and visual gate

#### Automated

- [x] 4.1 Type check passes: `npx astro check` — 0c5eb27
- [x] 4.2 Lint passes: `npm run lint` — 0c5eb27
- [x] 4.3 `/dev/kitchen-sink/report-details` returns HTTP 200 — 0c5eb27
- [x] 4.4 Both screenshots exist and the 390 run reports `sw` = 390 — 0c5eb27

#### Manual

- [x] 4.5 The screenshots show all 7 matrix cells in light and dark, the three page errors, both action errors, and at 390 the review button inside the card — 0c5eb27

### Phase 5: Guard

#### Automated

- [x] 5.1 `npm run check:ui-tokens` exits 0 and lists the three files — c1bbbe9
- [x] 5.2 `npm run check:ui-tokens` exits non-zero when `text-red-600` is temporarily added to `DeviationsList.tsx` (revert after) — c1bbbe9
- [x] 5.3 Lint passes: `npm run lint` — c1bbbe9

#### Manual

- [x] 5.4 The CLAUDE.md bullet reads correctly and points at files that exist — c1bbbe9
