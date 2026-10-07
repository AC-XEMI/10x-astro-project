---
date: 2026-10-07T13:54:54+02:00
researcher: Claude Code (claude-opus-5-5)
git_commit: cc4918d5470db1edd7db9a808f68f6997f6b8e78
branch: dev
repository: 10x-astro-project
topic: "/10x-ui audit of the report details view (src/pages/reports/[id].astro + DeviationsList.tsx) against the design-system contract"
tags: [research, ui, design-tokens, report-details, deviations-list, keyboard, error-state, focus]
status: complete
last_updated: 2026-10-07
last_updated_by: Claude Code (claude-opus-5-5)
---

# Research: /10x-ui audit of the report details view (Szczegóły raportu)

**Date**: 2026-10-07T13:54:54+02:00
**Researcher**: Claude Code (claude-opus-5-5)
**Git Commit**: cc4918d5470db1edd7db9a808f68f6997f6b8e78
**Branch**: dev
**Repository**: 10x-astro-project

## Research Question

Two-way `/10x-ui` audit of one view — the report details page `src/pages/reports/[id].astro`
and its React island `src/components/reports/DeviationsList.tsx` — against the repo's existing
design system (`src/styles/global.css` tokens, `src/components/ui/*`). Output: 3–5 charges with
file, line and user impact, plus the deferred list, as input for `/10x-plan`.

Constraint (CLAUDE.md, "Claude Design views keep their user-facing information"): the view
comes from Claude Design ("Szczegóły raportu", variant 1a, commit `39d701e`); styles, components
and display logic may change, wording of messages/labels/hints may not without approval.

## Summary

The view is already on tokens for colour — 0 hex/oklch literals and 0 palette classes in both
files; 56 token-class uses in `DeviationsList.tsx`, 2 in `[id].astro`. What drifted is the
other half of the contract and the states nothing exercises on the happy path:

1. **Keyboard users cannot open a visit** — the expand trigger is a clickable `<tr>`
   (`DeviationsList.tsx:370-377`), and per-deviation actions ("Cofnij", single
   "Oznacz jako sprawdzone") exist only inside that expanded row (`:552-563`).
2. **Review and export failures are silent** — `console.error` only (`:311-313`, `:327-328`,
   `:350-351`); the click appears to do nothing.
3. **The entry point conflates "not found" with "could not load"** — any query error or missing
   Supabase client renders "Nie znaleziono raportu." in the full-bleed `Banner`, with HTTP 200
   (`[id].astro:20-36, :67`).
4. **Hand-built containers and controls instead of shared components** — 8 `rounded-lg border`
   containers instead of `Card`, 2 native `<select>` and a native `<button>` without the token
   focus ring (`:79, :520, :581, :593, :610, :622, :637, :712, :716, :737-745`).
5. **Fixed column widths force the visit table into horizontal scroll on phones**, pushing the
   action column off-screen (`:398, :783-786`, inference from widths — to confirm by screenshot).

Riders inside the same view: `formatTimestamp` (`:93-97`) uses browser-local `getHours()`
instead of the shared `formatDateTime` (Europe/Warsaw) that the page header uses.

## Detailed Findings

### Source → view (what the view reads)

- Tokens: `[id].astro` uses `text-muted-foreground` (`:52`) and `buttonVariants` (`:45`);
  everything else is in `DeviationsList.tsx` (56 token-class matches for
  `bg|text|border|ring-(primary|muted|…|rule-*)`, counted with grep on this commit).
- Shared components imported: `Table*` and `Button` (`DeviationsList.tsx:3-4`); `Banner`,
  `Topbar`, `buttonVariants` in the page (`[id].astro:4-6`). Not imported although present in
  `src/components/ui/`: `Card`, `Alert`.
- `--rule-*` tokens / `RULE_SERIES` (`src/lib/rule-series.ts:9-13`) are not read by this view;
  rule counts and labels use `text-destructive` (`:399, :529, :601, :753`). See Open Questions.
- `formatDateTime` (`src/lib/format-date.ts`) is used by the page header (`[id].astro:56`) but not
  by the island (`DeviationsList.tsx:93-97`, `:548`).

### View → source (each literal and what should cover it)

Hardcoded-value scan (`/10x-ui` regex) on both files: 6 hits, all arbitrary px widths, no colours:

| Literal | Location | Covering value |
| --- | --- | --- |
| `max-w-[1100px]` | `[id].astro:41` | repo-wide page width, already allow-listed (`scripts/check-ui-tokens.mjs:47`) |
| `w-[200px]` | `DeviationsList.tsx:398` (rule label in row), `:784` (Klient column) | `w-50` scale value; see charge 5 |
| `w-[150px]` | `:770` (group progress) | `w-37.5` |
| `w-[110px]` | `:783` (Data wizyty column) | `w-27.5` |
| `w-[230px]` | `:786` (Status column) | `w-57.5` |

Other arbitrary values (not caught by the px-only regex, caught by `check:ui-tokens`'s general
pattern): `transition-[width]` (`:200`, no Tailwind utility for width-only transition),
`md:grid-cols-[300px_minmax(0,1fr)]` (`:446`), `lg:grid-cols-[1.2fr_repeat(3,1fr)_1.3fr]`
(`:580`) — design layout values from the Claude Design file.

Primary opacity step: `bg-primary/10` (`:210`, StatusPill "Sprawdzone") — a tint, same role as the
already-allowed upload-card and landing chips.

### Charge 1 evidence — visit row expansion is mouse-only

- `TableRow onClick={() => toggleVisit(visit.id)} aria-expanded={isOpen} className="cursor-pointer"`
  (`DeviationsList.tsx:370-377`). A `<tr>` is not focusable and has no key handler; there is no
  other control that toggles `openVisitIds` (only `toggleVisit`, called only from `:372`).
- The expanded panel (`:443-571`) holds the only per-deviation buttons: single
  "Oznacz jako sprawdzone" / "Cofnij" (`:552-563`) and "Cofnij wszystkie" (`:485-496`). The
  collapsed row offers only "Oznacz wszystkie" / "Oznacz jako sprawdzone" for the whole visit
  (`:426-438`), which never un-reviews.
- Effect: a keyboard or screen-reader user can mark a whole visit reviewed but cannot open its
  context (client, GPS, route) nor undo a mistaken mark.
- The group header is a real `<button>` (`:738-745`), so representative groups are reachable;
  it has no `focus-visible:` classes and relies on the base `outline-ring/50`
  (`global.css:132`).

### Charge 2 evidence — silent failures

- `updateDeviationStatus`: non-OK or non-JSON response → `console.error(...)` and `return`
  (`:311-313`); network error → `console.error` (`:327-328`). The pending set clears (`:329-334`),
  the button re-enables, status stays as before. No message reaches the UI.
- `exportList`: any throw → `console.error` (`:350-351`).
- History: `context/archive/2026-10-01-mark-deviation-reviewed/plan.md:48` chose
  "bez dedykowanego UI błędu (brak w tym repo systemu powiadomień/toastów)". Since
  `reports-list-ui-contract`, `src/components/ui/alert.tsx` exists with `destructive` and is the
  in-page message component (CLAUDE.md "Reports list (Raporty) contract"). The premise of the
  old decision no longer holds; the decision itself is the user's (Open Questions).
- Failure is reachable: session expiry between page load and click makes the middleware
  redirect (`src/middleware.ts:18`), so `fetch` gets HTML, not JSON (`:310-311`); the API also
  returns 500 on a Supabase error (`src/pages/api/deviations/review.ts:42`).

### Charge 3 evidence — entry point

- `[id].astro:20-36`: `report` stays `null` when `createClient` returns `null` (Supabase not
  configured), when either query returns an error, or when `maybeSingle()` finds no row
  (non-existent id, or another user's report hidden by RLS).
- All three render `<Banner variant="error">Nie znaleziono raportu.</Banner>` (`:67`) under the
  "Wynik raportu" heading; the response status is not set, so it is 200.
- `Banner` is the full-bleed strip (`src/components/Banner.astro`: `text-align: center`,
  `border-bottom`, `margin-bottom`); CLAUDE.md lists report details as one of the views that
  "still use it in-page until they are migrated" to `Alert`.
- An invalid UUID in the URL makes Postgres return an error (`invalid input syntax for type uuid`)
  — inference from Postgres behaviour, not run — which today also lands in the same message.
  Not-found for an invalid id is the right message; a DB outage is not.
- Unauthenticated access is handled: `/reports` prefix is in `PROTECTED_ROUTES`
  (`src/middleware.ts:4`) → redirect to sign-in.

### Charge 4 evidence — hand-built containers and controls

- Containers styled as cards (`bg-card … rounded-lg border p-…`): summary tiles `:581`, `:593`,
  `:610`; empty states `:712`, `:716`; representative group `:737`; deviation card `:520`. `Card`
  (`src/components/ui/card.tsx`, tightened density) is the repo's container
  (dashboard, reports list, landing all moved to it).
- `SELECT_CLASS` (`:79`) = `border-input bg-card h-9 rounded-md border px-3 text-sm shadow-xs` —
  no `focus-visible:` ring, no `outline-none`; the two filters (`:622`, `:637`) show the browser
  focus outline with base `outline-ring/50`, unlike the `Button`s next to them
  (`button.tsx:8`: `focus-visible:ring-ring/50 focus-visible:ring-[3px]`). `src/components/ui/`
  has no `select` (listed: alert, button, card, dialog, LibBadge.astro, table).
- `StatusPill` (`:205-216`) is a hand-built badge; `ui/` has no `badge`.
- Status segmented control (`:652-667`) is a `div role="group"` of `Button`s with
  `aria-pressed` — functional and accessible; only its container is hand-styled.

### Charge 5 evidence — mobile table width (inferred)

- Visit table columns: chevron `w-7` (28px) + `w-[110px]` + `w-[200px]` + Odstępstwa (rule label
  span alone is `w-[200px] shrink-0`, `:398`) + `w-[230px]` (`:782-786`) ≥ 768px before cell padding.
- `Table` wraps in `overflow-x-auto` (`table.tsx:6`), so on a 390px viewport the table scrolls
  inside the group card and the Status column with the "Oznacz…" button starts off-screen.
- Not verified by screenshot in this research (the page needs a session and real data); the
  kitchen sink in the plan will show it.

### Rider — timestamp formatting

- `formatTimestamp` (`:93-97`) formats with `getDate()/getHours()` in the browser's time zone;
  the header's "wgrano …" uses `formatDateTime` (Europe/Warsaw). The "Sprawdzono: …" line
  (`:548`) can therefore disagree with the header for a viewer outside Polish time. CLAUDE.md
  already names this file as "not migrated yet". Output format is the same (`DD.MM.YYYY, HH:MM`).
- `formatVisitDate` (`:87-90`) slices the date string — no time zone involved; keep.

### 7-state matrix (current)

| State | Current |
| --- | --- |
| default | tokens yes; containers and selects hand-built (charge 4) |
| hover | rows `hover:bg-muted/50` (table.tsx), buttons via variants; group header has no hover |
| focus-visible | buttons yes; selects, group header no token ring; visit rows not focusable (charges 1, 4) |
| disabled | pending buttons `disabled` (`:430, :489, :501, :556`); export disabled at 0 visible (`:689, :700`) |
| error | missing — review/export (charge 2); page-level conflated (charge 3) |
| empty | present: no visits (`:713`), no deviations (`:713`), no filter matches with reset (`:716-721`) |
| loading | SSR, no client fetch on load; per-action pending = disabled button only, no spinner |

## Code References

- `src/pages/reports/[id].astro:20-36` — data load, all failures → `report = null`
- `src/pages/reports/[id].astro:67` — `Banner` "Nie znaleziono raportu."
- `src/components/reports/DeviationsList.tsx:79` — `SELECT_CLASS`
- `src/components/reports/DeviationsList.tsx:93-97` — `formatTimestamp`
- `src/components/reports/DeviationsList.tsx:205-216` — `StatusPill` (`bg-primary/10`)
- `src/components/reports/DeviationsList.tsx:299-336` — `updateDeviationStatus`, silent failure
- `src/components/reports/DeviationsList.tsx:338-353` — `exportList`, silent failure
- `src/components/reports/DeviationsList.tsx:370-377` — clickable `<tr>`
- `src/components/reports/DeviationsList.tsx:520, 581, 593, 610, 712, 716, 737` — card-like containers
- `src/components/reports/DeviationsList.tsx:738-745` — group header button
- `src/components/reports/DeviationsList.tsx:782-786` — fixed column widths
- `src/components/ui/card.tsx`, `src/components/ui/alert.tsx`, `src/components/ui/button.tsx:8`
- `src/pages/api/deviations/review.ts:9-45` — 503/401/400/500/200 responses
- `scripts/check-ui-tokens.mjs` — does not scan these two files yet

## Architecture Insights

- Data is fetched once on the server; filters, sorting, review status and export are client-side
  in the island. Error UI therefore lives in two places: page-level (Astro) and action-level (React).
- A kitchen sink can render `DeviationsList` from fixture `visits` (it takes props only), and
  the page's not-found/error branch from a dev-only prop, following
  `src/pages/dev/kitchen-sink/reports-list.astro`.
- `Alert` in a React island is the same component the reports list uses (`ReportUpload.tsx`).

## Historical Context (from prior changes)

- `context/archive/2026-10-01-mark-deviation-reviewed/plan.md:48, :115` — deliberate
  "console.error, no error UI" because the repo had no notification component.
- `context/archive/2026-10-01-filter-sort-deviations-list/reviews/impl-review.md:24-31` — an
  earlier a11y fix on this component (hidden date input); keyboard reachability of rows was not
  reviewed.
- `context/archive/2026-10-07-reports-list-ui-contract/research.md:276-277` — deferred
  "Report details / DeviationsList dates" to a separate view change (this one).
- `context/archive/2026-10-07-dashboard-ui-tokens/` — `--rule-*` tokens are a data-series palette
  (legend/chart/ranking).

## Related Research

- `context/archive/2026-10-07-reports-list-ui-contract/research.md`
- `context/archive/2026-10-07-landing-ui-contract/research.md`

## Charges

1. **Accidental architecture — visit details are mouse-only.**
   `src/components/reports/DeviationsList.tsx:370-377` (trigger), `:552-563` (actions only
   inside). User impact: a keyboard or screen-reader user cannot open a visit's context or undo a
   single mistaken "Sprawdzone".
2. **Accidental architecture / error state — review and export fail silently.**
   `DeviationsList.tsx:311-313, :327-328, :350-351`. User impact: after an expired session or a
   server error the manager clicks "Oznacz jako sprawdzone", the button flickers and nothing
   changes, with no hint why or what to do.
3. **Accidental architecture — "not found" covers load failures, full-bleed Banner, HTTP 200.**
   `src/pages/reports/[id].astro:20-36, :67`. User impact: during a database problem the manager
   is told the report does not exist (and may re-upload it), and the message looks like a page
   strip rather than an in-page notice.
4. **Missing shared component — hand-built cards, selects and toggle without the token focus ring.**
   `DeviationsList.tsx:79, :520, :581, :593, :610, :622, :637, :712, :716, :737-745`. User impact:
   keyboard focus on the two filters and on a representative header looks different from
   (or weaker than) every button beside it; container styles drift from the other views.
5. **Missing tokens / layout — fixed px column widths on phones.**
   `DeviationsList.tsx:398, :783-786`. User impact: at 390px the visit table scrolls sideways and
   the review button column starts off-screen (inferred; confirm in the kitchen sink).

Deferred (with reason):
- **Rule colour `text-destructive` vs `--rule-*`** (`:399, :529, :601, :753`) — on this view a
  rule is a problem to check, not a data series; red is the intended semantic. Product choice,
  see Open Questions; no change by default.
- **`max-w-[1100px]`** — repo-wide, allow-listed.
- **`transition-[width]`, grid templates `:446`, `:580`** — design layout values with no scale
  equivalent; allow-list in `check:ui-tokens`.
- **`bg-primary/10` StatusPill** — tint, add as a file-scoped allowance.
- **No `Badge` / `Select` in `ui/`** — adding shadcn `select` (Radix) changes behaviour and adds
  a dependency; giving the native select the button focus classes reaches the contract with
  no dependency. Decide in planning.
- **Per-action spinner** — disabled-while-pending is adequate for sub-second requests.

Riders (no separate charge, same view): `formatTimestamp` → `formatDateTime` (`:93-97, :548`).

## Open Questions

1. Charge 2: show failures inline (an `Alert` near the filters, or text in the visit row), and
   what wording? Any new message text is new user-facing information under the Claude Design
   rule and needs the user's approval. Reverses the 2026-10-01 "no error UI" decision.
2. Charge 3: keep "Nie znaleziono raportu." for not-found and add a separate message for a load
   failure (new wording → approval), or keep one message and only switch `Banner` → `Alert` and
   set 404? Should the page set 404/500 status codes?
3. Charge 1 shape: make the date cell (or a chevron) a real `<button aria-expanded>` inside the
   row, keeping row click for mouse users — or move the expand control elsewhere?
4. Charge 4: native `<select>` with token focus classes vs adding shadcn `select`.
5. Rule colours: confirm red (`destructive`) stays for rule labels/counts on this view.
