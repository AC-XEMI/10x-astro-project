---
date: 2026-10-07T08:30:57+02:00
researcher: Claude Code (claude-opus-5-5)
git_commit: 32b6ccec2bfd6ea46bd145b48eaa2b466635f36d
branch: dev
repository: 10x-astro-project
topic: "/10x-ui audit of the reports list view (src/pages/reports/index.astro) against the design-system contract"
tags: [research, ui, design-tokens, reports-list, shadcn, dark-mode, states]
status: complete
last_updated: 2026-10-07
last_updated_by: Claude Code (claude-opus-5-5)
---

# Research: /10x-ui audit of the reports list view (Raporty)

**Date**: 2026-10-07T08:30:57+02:00
**Researcher**: Claude Code (claude-opus-5-5)
**Git Commit**: 32b6ccec2bfd6ea46bd145b48eaa2b466635f36d
**Branch**: dev
**Repository**: 10x-astro-project

## Research Question

Two-way `/10x-ui` audit of one view — `src/pages/reports/index.astro` with
`src/components/reports/ReportsList.tsx`, `src/components/reports/ReportUpload.tsx` and
`src/components/Banner.astro` — producing 3–5 charges (file, line, effect on the user) in
the categories missing tokens / missing shared component / accidental architecture, with
both themes in scope (the theme toggle is live since commit `f9bf874`). Also: re-score the
previous audit of this view (`context/archive/2026-10-06-reports-list-ui-tokens/`), which
predates two Claude Design redesigns (`95f6031`, `4ba9f5a`).

Method: the primary agent read `index.astro` and `ReportsList.tsx` fully and traced the
error/redirect and date paths; two read-only workers audited `ReportUpload.tsx` (all 431
lines) and the kitchen sink + previous audit + `Banner.astro`. Decisive claims below were
re-checked against the source by the primary agent. Nothing was rendered in a browser for
this research; visual and screen-reader claims are marked as inferred.

## Summary

Colour literals are almost gone (3 hex in an unused Banner variant), so the contract
variant is **existing design system**. The problems that reach the user sit in states and
entry points, not in palette classes:

1. **Two wrong states look like the empty state.** A failed reports query
   (`index.astro:31-33`) and an out-of-range `?page=` both render "Nie masz jeszcze żadnych
   wgranych raportów" (`ReportsList.tsx:73-83`).
2. **Errors travel through the URL.** Upload/delete failures redirect to
   `/reports?error=<message>` (8 call sites in `upload.ts`, 3 in `delete.ts`), including raw
   Supabase `.message` strings, and render in a page-top Banner far from the upload card;
   any text put in a link renders as an app message.
3. **Four container/alert looks on one page.** 4 hand-built cards (no `ui/card`), a Banner
   styled as a full-bleed strip used inside the padded page, `ErrorCard`, and a bare
   `<p role="alert">` for network errors.
4. **Dates disagree across views.** The list formats in the browser's zone after
   hydration (`YYYY-MM-DD HH:MM`), report details in the server's zone (UTC on Cloudflare,
   `DD.MM.YYYY, HH:MM`), the dashboard in Europe/Warsaw.
5. **Upload progress is silent and ambiguous.** No live region, a 100%-wide faded bar for
   "checking" and a static full bar for "processing", and focus falls to `<body>` when the
   subtree swaps.

The existing kitchen sink (`src/pages/dev/kitchen-sink/reports-list.astro`) is stale: two
hand-copied tables with 4 columns instead of 5, an invented loading skeleton, no disabled
or dialog state, no dark frames.

## Detailed Findings

### Source → views: tokens and shared components

- Tokens: `src/styles/global.css` (`:root` / `.dark` → `@theme inline`); `.dark` is applied
  by `src/layouts/Layout.astro` (inline head script) and `src/components/ThemeToggle.astro`.
- `src/components/ui/` has `button.tsx`, `table.tsx`, `dialog.tsx`, `card.tsx` (density
  tightened in `context/archive/2026-10-07-dashboard-ui-tokens/`), `LibBadge.astro`. No
  `alert`, no `progress`.
- Imports from `ui/` per view file: `index.astro` 0, `ReportsList.tsx` 3 (table, button,
  dialog), `ReportUpload.tsx` 1 (button), `Banner.astro` 0. `ui/card` is imported by none of
  them.
- `button.tsx` has no `cursor-pointer` (0 matches for `cursor`); the reports components add
  `className="cursor-pointer"` by hand 20 times (`ReportUpload.tsx` 5, `DeviationsList.tsx`
  12, `ReportsList.tsx` 3).

### View → source: hardcoded-value scan (4 files)

| Hit | Location | Covered by |
| --- | --- | --- |
| `#fef3c7`, `#78350f`, `#f59e0b` | `Banner.astro:39-41` (`warning` variant) | no `--warning` token; variant used nowhere (grep `variant="warning"` in `src`: 0) |
| `max-w-[1100px]` | `index.astro:42` | repo-wide page width (5 views) |
| `pl-[18px]` | `ReportUpload.tsx:127` | `pl-5` (list-disc indent) |
| `w-[150px]` | `ReportUpload.tsx:370` | `w-40` (fits `odwiedzony_klient` in mono text-sm) |
| `border-[1.5px]` | `ReportUpload.tsx:392` | `border` / `border-2` (1.5px rounds per browser on 1x screens) |

Opacity tints used as fills: `bg-destructive/10` (`ReportUpload.tsx:106,236`,
`ReportsList.tsx:41`, `Banner.astro:14`), `bg-primary/10` (`ReportUpload.tsx:393,411`),
`opacity-40` on the progress bar (`ReportUpload.tsx:259`).

### Entry points and wrong states (charge 1)

- `index.astro:21-37`: on `fetchError` the page only `console.error`s; `reports` stays `[]`
  and `count` stays `null`, so `ReportsList` renders its empty state
  (`ReportsList.tsx:73-83`: "Nie masz jeszcze żadnych wgranych raportów … Wgraj pierwszy
  plik"). No error banner is shown for this path.
- `index.astro:14,30`: `page` is any positive integer from `?page=`; for a page past the
  last one the range returns no rows, so the same empty state renders, with "Poprzednia"
  shown (`:61-64`) because `page > 1`.
- Pagination links (`:62`, `:69`) carry `text-primary hover:underline` and no
  `focus-visible` styling (0 matches for `focus-visible` in the 4 view files); there is no
  "strona X z Y" indicator.

### Error channel via the URL (charge 2)

- `src/pages/api/reports/upload.ts:25,35,39,43,48,64,78,112` and
  `src/pages/api/reports/[id]/delete.ts:9,29,33` redirect to `/reports?error=<text>`;
  `:64,78,112` (upload) and `:29` (delete) pass `error.message` from Supabase verbatim.
- `index.astro:12,51` renders `?error` in `<Banner variant="error">` at the top of the page.
  Text is escaped (no XSS), but any string in a crafted link appears as an app message.
- `ReportUpload.tsx` already shows client-side errors in place (`ErrorCard`, `:104`;
  network error `<p role="alert">`, `:424`) — so the same page has two error channels: in
  place for pre-checks, page-top for server failures.
- `context/foundation/lessons.md` ("Tekst pokazywany użytkownikowi nie może zawierać
  surowych nazw kolumn/pól z bazy") covers the spirit of passing raw DB messages to users.

### Containers and alerts (charge 3)

- Hand-built cards: `index.astro:57` (`rounded-lg border bg-card p-4`),
  `ReportUpload.tsx:104` (ErrorCard, `p-5`), `:235` (progress, `p-6`), `:392` (drop zone,
  dashed, `p-6`). `ui/card` gives `rounded-xl py-4/px-4 gap-3 shadow-sm`.
- `Banner.astro:25-31`: `.banner` = centred text, `margin-bottom: 1rem`, bottom border only,
  no radius — built for the full-width strip in `Layout.astro:35`. Used inside the padded
  `<main>` at `index.astro:50-51`, it renders as a square box with one rule next to rounded
  bordered cards. Inferred (not rendered): its unlayered `margin-bottom: 1rem` beats the
  layered `space-y-6`, so the gap below a banner is 1rem instead of 1.5rem.
- Error looks on this page: Banner (`index.astro:51`), ErrorCard (`ReportUpload.tsx:104`),
  plain `<p role="alert">` (`:424`, network error, no retry action), plus DeleteWarning
  callout in the dialog (`ReportsList.tsx:41`). Banner variants are token-driven except
  `warning` (`Banner.astro:14-17,37-42`).

### Dates across views (charge 4)

- `ReportsList.tsx:17-21` `formatUploadedAt` → `YYYY-MM-DD HH:MM` via `getHours()`; the
  component is SSR'd and hydrated (`client:load`, `index.astro:58`), so the server renders
  the server zone and the browser re-renders its own zone. Inferred: in CEST the first HTML
  and the hydrated text differ by 2 hours, which React 19 reports as a hydration mismatch.
- `src/pages/reports/[id].astro:41` → `DD.MM.YYYY, HH:MM` via `getHours()` on the server only
  (UTC on Cloudflare; no `TZ` set in `wrangler.*` / `astro.config.mjs`).
- `src/components/reports/DeviationsList.tsx:96` → `getHours()` in a hydrated island.
- `src/components/dashboard/DashboardView.astro:85` → `Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw" })`.
- Effect: the same upload can show `2026-10-02 14:30` on the list and `02.10.2026, 12:30`
  on its details page (CEST, server UTC).

### Upload progress and focus (charge 5)

- `ReportUpload.tsx:230-285`: status text ("Sprawdzanie kolumn…", "Przetwarzanie…", %) has
  no `role="status"` / `aria-live`; the progressbar (`:252-257`) has no `aria-valuetext`.
- `:259`: "checking" = full-width bar at `opacity-40`; "processing" = full-width static bar.
  Neither is animated, so both read as finished or frozen.
- Subtree swaps unmount the focused button ("Wgraj raport" → progress card; "Zamknij" in
  ErrorCard), so keyboard focus drops to `<body>`.
- Dark mode (inferred): the dashed drop-zone border uses `border-border` =
  `oklch(1 0 0 / 10%)` on `bg-card` (`global.css` `.dark`), so the drop target is faint;
  drag-over is signalled by colour only (`:393`), the text does not change.
- Focus rings: every interactive control in `ReportUpload.tsx` is a `Button` /
  `buttonVariants` and gets the token ring (`button.tsx:8`); the hidden file input
  (`:199-212`) is deliberately unreachable with the button as its keyboard proxy.

### Kitchen sink (input to the states phase)

`src/pages/dev/kitchen-sink/reports-list.astro`:
- Real component: default (`:54-58`), hover (`:60-70`, note is light-mode only), error
  (`:132-155`: `too_large`, `bad_format`, `missing_columns` + Banner; `network` missing),
  empty (`:157-161`).
- Hand-copied and stale: focus-visible (`:72-121`, 4-column table; its note says "Zobacz
  raport" shows only the browser outline, but it is now a ghost `Button` with the token
  ring), loading (`:163-197`, 4-column skeleton for a state the SSR page does not have).
- Missing: disabled, delete dialog, upload in-progress states, dark frames; subtitle (`:50`)
  still claims "wszystkie 7 stanów".
- Fixtures match `Tables<"reports">` and current props.

### Agent rules check

`CLAUDE.md:174-175` (tokens; Pulpit contract) point to `src/components/ui/` and
`npx shadcn@latest add`; no rule invites one-off values. No rule covers alerts/callouts,
date formatting, or where user-facing errors are shown.

## Code References

- `src/pages/reports/index.astro:21-37,42,50-51,57,61-74` — fetch, banners, list card, pagination
- `src/components/reports/ReportsList.tsx:17-21,41,73-83,116-133` — date format, DeleteWarning, empty state, actions
- `src/components/reports/ReportUpload.tsx:104,127,199-212,230-285,370,392-393,424` — ErrorCard, file input, progress, drop zone, network error
- `src/components/Banner.astro:14-17,25-31,37-42` — variants, full-bleed style, warning hex
- `src/pages/api/reports/upload.ts:25-112`, `src/pages/api/reports/[id]/delete.ts:9-36` — `?error=` redirects
- `src/pages/reports/[id].astro:41`, `src/components/reports/DeviationsList.tsx:96`, `src/components/dashboard/DashboardView.astro:85` — date formatting elsewhere
- `src/pages/dev/kitchen-sink/reports-list.astro:50,72-121,163-197` — stale gate

## Architecture Insights

- The list page is SSR with two islands (`ReportUpload`, `ReportsList` for the delete
  dialog). Any formatting done in an island runs twice (server, browser); only
  timezone-explicit formatting is stable across both.
- Errors are modelled as redirects with query strings — a pattern from before the upload
  card had its own error UI. The card now owns client pre-checks, the page owns server
  failures.
- `Card` was introduced for the dashboard with tightened density; this view is its second
  consumer and the first to need a dashed/destructive variant of it.

## Historical Context (from prior changes)

Re-scored claims from `context/archive/2026-10-06-reports-list-ui-tokens/`:

| Prior claim | Verdict now | Evidence |
| --- | --- | --- |
| Charge 1: literal indigo on upload button (`index.astro:54,58`) | no longer applicable | inline form removed in `95f6031`; `index.astro:53-55` renders `ReportUpload` |
| Charge 2: hand-built submit control | no longer applicable | same; buttons in `ReportUpload.tsx` are `Button` |
| Charge 3: literals in Topbar / ReportsList | fixed | 0 palette/hex hits; "Zobacz raport" is `Button asChild` (`ReportsList.tsx:116-120`) |
| Charge 4: Banner hex | partial | info/error/success tokenised (`Banner.astro:14-16`); warning hex remains (`:37-42`) |
| Charge 4 rationale: "no `.dark` class is ever applied" | contradicted | applied since `f9bf874` (`Layout.astro`, `ThemeToggle.astro`) |
| Charge 5: page root `bg-slate-50`, `bg-white` cards | fixed | no background on `index.astro:42`; `bg-card` at `:57` |
| Deferred: `warning` token | still deferred | no `--warning` in `global.css` |
| Review F1: oklch written as percentages (`--primary`) | still present, decision never recorded | `global.css:15,55` |

## Related Research

- `context/archive/2026-10-06-reports-list-ui-tokens/research.md`
- `context/archive/2026-10-07-dashboard-ui-tokens/research.md`

## Charges

1. **Accidental architecture — failure and out-of-range states masquerade as "no reports yet".**
   `src/pages/reports/index.astro:31-33` (fetch error swallowed) and `:14,30` (`?page` past
   the end) → `ReportsList.tsx:73-83`.
   **User impact:** after a database hiccup, or from a stale "page 5" link, a manager who
   has reports is told they have none and invited to upload "the first file".

2. **Accidental architecture — server errors come through the URL as raw text.**
   `src/pages/api/reports/upload.ts:64,78,112`, `src/pages/api/reports/[id]/delete.ts:29`
   (raw Supabase `.message`), rendered by `src/pages/reports/index.astro:51`.
   **User impact:** a failed upload shows an English database message in a page-top banner
   away from the upload card, the message survives a refresh or a shared link, and any
   crafted `?error=` text appears as an official app message.

3. **Missing shared component — cards and alerts built four different ways.**
   `index.astro:57`, `ReportUpload.tsx:104,235,392` (hand-built cards; `ui/card` unused),
   `Banner.astro:25-31` (full-bleed strip used inside the padded page at `index.astro:50-51`),
   `ReportUpload.tsx:424` (bare network-error paragraph).
   **User impact:** success, server-error, pre-check-error and network-error messages each
   look different, and the network error — the one most likely on a flaky connection — is
   the easiest to miss and has no retry action.

4. **Accidental architecture — the same upload time differs between views.**
   `src/components/reports/ReportsList.tsx:17-21` (browser zone after hydration, ISO-like
   format) vs `src/pages/reports/[id].astro:41` (server zone = UTC, Polish format) vs
   `DashboardView.astro:85` (Europe/Warsaw).
   **User impact:** a manager cross-checking a report sees two different hours (2 h apart in
   summer time) and two different date formats for the same upload.

5. **Missing tokens / states — upload progress is silent, ambiguous and drops focus.**
   `ReportUpload.tsx:230-285` (no live region; full-width faded "checking" bar and static
   "processing" bar at `:259`), subtree swap on submit, dashed `border-border` drop zone in
   dark mode (`:392`).
   **User impact:** during the few seconds of server processing the bar looks finished or
   frozen, screen-reader users hear nothing, keyboard users are thrown back to the top of
   the page, and in dark mode the drop target is barely visible.

### Deferred (not in this change)

- **`cursor-pointer` missing from `button.tsx`** (20 manual overrides in 3 components) — a
  one-line fix in a shared primitive that changes every `Button` in the app; worth its own
  small change or an explicit decision in the plan.
- **`max-w-[1100px]`** (5 views) — layout shell change.
- **`warning` Banner variant hex** — unused anywhere; fold into charge 3 only if the plan
  replaces Banner styling, otherwise delete-or-tokenise later.
- **oklch percentages in `--primary`** (prior review F1) — token-file hygiene, no user
  effect.
- **`pl-[18px]`, `w-[150px]`, `border-[1.5px]`** — map to `pl-5`, `w-40`, `border`/`border-2`
  inside charge 3's phase if those lines are touched.
- **Drop zone has no click-to-open / hover state** (`ReportUpload.tsx:392`) — interaction
  design, not contract; candidate follow-up.
- **Report details / DeviationsList dates** — charge 4's helper should be shared, but
  adopting it in `[id].astro` and `DeviationsList.tsx` is a separate view.

## Open Questions

- Charge 2 fix shape: keep redirect-based errors but map them to Polish, fixed messages
  (a known error code in the query instead of free text), or move server errors into the
  upload card's own error UI (upload via `fetch` already exists for progress)? The second
  changes the API contract of `upload.ts`.
- Charge 3: add shadcn `alert` for in-page messages and keep `Banner` only for the
  full-bleed config warning in `Layout.astro`, or restyle `Banner` itself?
- Charge 4: canonical format and zone — `DD.MM.YYYY, HH:MM` in Europe/Warsaw (dashboard
  and details already use the Polish format) is the obvious candidate, but whether the
  details page is in scope is a scope decision.
- Kitchen sink: rebuild around real components (as the dashboard one does) or patch the two
  hand-copied sections.
