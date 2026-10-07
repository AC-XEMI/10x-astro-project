# UI leftovers Implementation Plan

## Overview

Finish the `Banner` → `Alert` migration for in-page messages (dashboard, confirm-email) and fix two
small report-details issues left out of `report-details-ui-contract`: the representative group
header squeezes at 390px, and "0 z odstępstwami" is red when there are no deviations. The wording
does not change anywhere.

## Current State Analysis

- `src/components/dashboard/DashboardView.astro:131` renders the load error as
  `<Banner variant="error">`. This is the full-bleed strip style: centred, `border-bottom`, margin.
- `src/pages/auth/confirm-email.astro:52-53` renders `resent` with `Banner variant="success"` and `error`
  with `Banner variant="error"`.
- CLAUDE.md ("Reports list (Raporty) contract") says in-page messages use `Alert` and that `Banner` is
  the full-bleed strip, with the dashboard and confirm-email listed as "not migrated yet".
- `src/components/reports/DeviationsList.tsx` ~787-822: the group header is one wrapping flex row:
  chevron · name block (`flex-1`) · rule counts · progress (`w-37.5`). At 390px the name block
  shrinks to a narrow column next to the counts and the progress bar
  (`context/archive/2026-10-07-report-details-ui-contract/screenshots/kitchen-sink-390.png`).
- `DeviationsList.tsx:623`: the flagged count in the "Wizyty" tile is always `text-destructive`,
  even when it is 0.

## Desired End State

- No in-page `Banner` remains outside `Layout.astro`. The dashboard error and both confirm-email
  messages are `Alert` (`destructive` / `success` + `role="status"`) with
  `AlertDescription className="text-current"`, using the same text as before.
- Below `md`, the group header shows chevron + name/count label on the first row, and the rule
  counts + progress on a second row aligned under the name. From `md` up it looks as before.
- The "Wizyty" tile's flagged count is `text-destructive` only when it is > 0, otherwise
  `text-muted-foreground`.
- CLAUDE.md no longer lists the dashboard and confirm-email as using `Banner` in-page.

## What We're NOT Doing

- `Banner` in `Layout.astro` (config warning strip) stays — it is the full-bleed use.
- No wording changes.
- confirm-email renders `?error` free text from the URL (same class of issue the reports list
  solved with error codes). Out of scope here; candidate for a separate change.
- No change to the group progress unit (fully reviewed visits, decided 2026-10-07).

## Phase 1: Banner → Alert

### Overview

Migrate the last in-page `Banner` uses to `Alert`.

### Changes Required:

#### 1. Dashboard load error

**File**: `src/components/dashboard/DashboardView.astro`

**Intent**: Show the load error as an in-page alert, like the reports list does.

**Contract**: `<Alert variant="destructive"><AlertDescription className="text-current">Nie udało się wczytać danych pulpitu. Odśwież stronę.</AlertDescription></Alert>`; the `Banner` import is removed.

#### 2. Confirm-email messages

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Same for the auth confirmation page.

**Contract**: `resent` → `Alert variant="success" role="status"`, `error` → `Alert variant="destructive"`, both with `AlertDescription className="text-current"`; the `Banner` import is removed. The text stays left-aligned inside the centred column, matching `Alert`'s own layout.

#### 3. Agent rule

**File**: `CLAUDE.md`

**Intent**: Remove the stale "still use it in-page" note.

**Contract**: The reports-list bullet says `Banner.astro` is only the full-bleed strip (config warning in `Layout.astro`), and every in-page message uses `Alert`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `grep -rln "Banner" src --include=*.astro --include=*.tsx` lists only `src/components/Banner.astro`, `src/layouts/Layout.astro` and `src/components/ui/alert.tsx` (comment)
- `npm run check:ui-tokens` exits 0

#### Manual Verification:

- `/dev/kitchen-sink/dashboard` error state shows an in-page alert in light and dark
- `/auth/confirm-email?resent` and `/auth/confirm-email?error=Test` show a success / error alert in the column

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Report details polish

### Overview

Group header at phone width, and a neutral zero count.

### Changes Required:

#### 1. Group header layout

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: At 390px, the representative name and its count label get the full row width.

**Contract**: The rule counts and the progress block are wrapped in one container that is
`w-full` with left padding equal to chevron + gap (`pl-8`) and `justify-between` below `md`, and
`md:w-auto md:pl-0` (with the existing gaps) from `md`. The button keeps `flex-wrap`, so this
container moves to its own row below `md`. No text or ARIA changes.

#### 2. Zero flagged count

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Red marks a problem; zero is not a problem.

**Contract**: The flagged count span in the "Wizyty" tile is `text-destructive` when
`flaggedVisits.length > 0`, else `text-muted-foreground`.

#### 3. Screenshots

**Files**: `context/changes/ui-leftovers/screenshots/`

**Intent**: Evidence for both fixes.

**Contract**: `node scripts/kitchen-sink-shot.mjs` of `/dev/kitchen-sink/report-details` at 390 → `report-details-390.png`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `npm run check:ui-tokens` exits 0
- The 390 screenshot run reports `sw` = 390

#### Manual Verification:

- At 390px every group header shows the full name on its own row with counts and progress below it; desktop looks as before
- The "Wizyty" tile in the empty states ("Brak wizyt…", "Brak wykrytych odstępstw…") shows a grey 0

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## References

- `context/archive/2026-10-07-report-details-ui-contract/` (the leftovers come from its final summary)
- `context/archive/2026-10-07-reports-list-ui-contract/` (Alert as the in-page message component)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Banner → Alert

#### Automated

- [x] 1.1 Type check passes: `npx astro check`
- [x] 1.2 Lint passes: `npm run lint`
- [x] 1.3 `grep -rln "Banner" src --include=*.astro --include=*.tsx` lists only `src/components/Banner.astro`, `src/layouts/Layout.astro` and `src/components/ui/alert.tsx` (comment)
- [x] 1.4 `npm run check:ui-tokens` exits 0

#### Manual

- [x] 1.5 `/dev/kitchen-sink/dashboard` error state shows an in-page alert in light and dark
- [x] 1.6 `/auth/confirm-email?resent` and `/auth/confirm-email?error=Test` show a success / error alert in the column

### Phase 2: Report details polish

#### Automated

- [ ] 2.1 Type check passes: `npx astro check`
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 `npm run check:ui-tokens` exits 0
- [ ] 2.4 The 390 screenshot run reports `sw` = 390

#### Manual

- [ ] 2.5 At 390px every group header shows the full name on its own row with counts and progress below it; desktop looks as before
- [ ] 2.6 The "Wizyty" tile in the empty states ("Brak wizyt…", "Brak wykrytych odstępstw…") shows a grey 0
