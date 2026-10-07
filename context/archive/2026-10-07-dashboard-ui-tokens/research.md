---
date: 2026-10-07T06:25:05+02:00
researcher: Claude Code (claude-opus-5-5)
git_commit: 44d0539ce5a2062a330d17f43bbd02bf1c8b86a7
branch: dev
repository: 10x-astro-project
topic: "/10x-ui audit of the dashboard view (src/pages/dashboard.astro) against the design-system contract"
tags: [research, ui, design-tokens, dashboard, shadcn, dark-mode]
status: complete
last_updated: 2026-10-07
last_updated_by: Claude Code (claude-opus-5-5)
---

# Research: /10x-ui audit of the dashboard view (Pulpit)

**Date**: 2026-10-07T06:25:05+02:00
**Researcher**: Claude Code (claude-opus-5-5)
**Git Commit**: 44d0539ce5a2062a330d17f43bbd02bf1c8b86a7
**Branch**: dev
**Repository**: 10x-astro-project

## Research Question

Two-way `/10x-ui` audit of one view — `src/pages/dashboard.astro` plus its subcomponents
`src/components/dashboard/RankingTable.tsx` and `DashboardExport.tsx` — producing 3–5
charges (file, line, effect on the user) in the three categories: missing tokens, missing
shared component, accidental architecture. Both themes (light/dark) are in scope because
the app ships a theme toggle (`src/components/ThemeToggle.astro`).

## Summary

The view is already largely token-driven: on the three inspected files the hardcoded-value
scan finds **0** colour literals (hex/rgb/oklch/palette classes) and **3** arbitrary values,
against 62 token-class uses. The contract variant is **existing design system**. The
problems are one level up:

1. The three rule series (Brak GPS / Telefon / Trasa) are coloured with ad-hoc opacity
   steps of `--primary` (`bg-primary`, `/55`, `/25`) repeated in 3 places, and the 55% and
   25% steps fall below WCAG 1.4.11's 3:1 non-text contrast against the card in **both**
   themes (computed: 25% = 1.50:1 light, 1.31:1 dark). The repo already defines
   `--chart-1..5` tokens that no view reads.
2. There is no `Card` in `src/components/ui/`; the view hand-builds 8 card containers with
   three different paddings, and duplicates the progress bar and the segmented control that
   `DeviationsList.tsx` also hand-builds.
3. The screen mixes two time axes without saying so: KPIs/ranking/trend are bucketed by
   **visit-date** month, while "Ostatnie raporty" and the "Przejdź do listy" target are
   picked by **upload date**. The user already hit this on 2026-10-06.
4. Two links have no token focus ring (browser default only).
5. The header control row does not wrap; at a 390px viewport its estimated width exceeds the
   available width (estimate, not yet screenshot-confirmed).

Deferred: post-login landing (`/reports` vs `/dashboard`, a product decision tied to the
smoke test), repo-wide `max-w-[1100px]`, chart magic numbers, the missing-config path, and
migrating other views to the new `Card`.

## Detailed Findings

### Source → views: token source and shared components

- Token values live in `src/styles/global.css:6-41` (`:root`) and `:43-77` (`.dark`) and are
  published as `--color-*` in `@theme inline` (`:79-116`). Dark mode is a class variant
  (`global.css:4`), toggled by `src/components/ThemeToggle.astro` and applied before paint
  in `src/layouts/Layout.astro` (inline head script).
- `--chart-1` … `--chart-5` are defined in both themes (`global.css:28-32`, `:64-68`) and
  published (`:103-107`), but a search for `chart-[1-5]` in `src/**/*.{astro,tsx}` returns
  **0** matches — a token family nothing reads.
- `src/components/ui/` contains exactly 4 files: `button.tsx`, `table.tsx`, `dialog.tsx`,
  `LibBadge.astro`. There is no `card`, `progress` or `toggle-group`.
- The view imports from `ui/` in 2 places: `buttonVariants` (`dashboard.astro:6`) and the
  table primitives (`RankingTable.tsx:1`); `DashboardExport.tsx:2` imports `Button`.

### View → source: hardcoded-value scan (pre-audit, 3 files)

| Hit | Location | Should be covered by |
| --- | --- | --- |
| `max-w-[1100px]` | `dashboard.astro:143` | layout width — same literal in 5 files (`Topbar.astro`, `Welcome.astro`, `dashboard.astro`, `reports/index.astro`, `reports/[id].astro`); repo-level, see Deferred |
| `h-[180px]` | `dashboard.astro:279` | chart height; coupled to the `130` px max bar in `:291` |
| `w-[150px]` | `RankingTable.tsx:30` | "Struktura" column; coupled to `MAX_BAR_PX = 130` (`RankingTable.tsx:11`) |

Inline `style=` occurrences: 5 in `dashboard.astro`, 4 in `RankingTable.tsx`. All 9 carry
data-driven geometry (bar width/height or flex weight from counts); none carries a colour.

### Rule-series colours (charge 1)

- The rule → colour mapping is written out 3 times: legend `dashboard.astro:119-123`, trend
  bar segments `dashboard.astro:294-296`, ranking structure bar `RankingTable.tsx:55-57`.
  Each copy uses `bg-primary` (GPS), `bg-primary/55` (Telefon), `bg-primary/25` (Trasa).
- Contrast, computed from the token values (oklch → sRGB, alpha composited over `--card`,
  WCAG relative luminance):

  | Theme | 100% vs card | 55% vs card | 25% vs card | 55% vs 100% | 25% vs 55% |
  | --- | --- | --- | --- | --- | --- |
  | light (`--primary` 51.1%, card white) | 6.44 | 2.63 | 1.50 | 2.44 | 1.75 |
  | dark (`--primary` 58.5%, card 0.205) | 3.91 | 2.02 | 1.31 | 1.94 | 1.54 |

  WCAG 1.4.11 asks 3:1 for graphical objects; under these inputs the 55% and 25% steps
  fail in both themes, and adjacent steps are below 2:1 apart in 3 of the 4 pairs.
- Per-segment counts exist only in `aria-label` (`dashboard.astro:292`,
  `RankingTable.tsx:53`) — no visible tooltip or value — so a sighted user reading the bar
  composition depends on telling these steps apart.
- The ranking table does repeat the counts as numbers (`RankingTable.tsx:61-63`), so the
  table is readable without the bar; the trend chart (`dashboard.astro:279-302`) has only
  the monthly total as visible text (`:283`).

### Hand-built containers and primitives (charge 2)

- Card containers in `dashboard.astro` (pattern `rounded-lg border … bg-card p-*`): **8**, at
  `:183` (p-8), `:197`, `:204`, `:221`, `:237` (p-4), `:258`, `:267`, `:313` (p-5) — three
  paddings on one screen.
- Same pattern elsewhere (count of `rounded-lg border` occurrences): `DeviationsList.tsx` 7,
  `ReportUpload.tsx` 3, `Welcome.astro` 4 (with `bg-card`), `reports/index.astro` 1.
- Progress bar: hand-built in `dashboard.astro:224-233` and, separately, as a local
  `ProgressBar` in `DeviationsList.tsx:197-203` (identical classes `bg-muted h-1.5 … rounded-full`
  + `bg-primary` fill). Only the dashboard copy has `role="progressbar"` and an accessible name.
- Segmented control: `dashboard.astro:158-168` (`<nav aria-label="Okres">`, links with
  `aria-current`) and `DeviationsList.tsx:652-667` (`role="group" aria-label="Status"`,
  buttons with `aria-pressed`) — same visual (`bg-card … rounded-md border p-0.5` +
  secondary/ghost buttons), built twice. Both semantic choices are correct for their case
  (navigation vs. filter state), so this is a shared-visual, not a shared-behaviour, finding.

### Time axes and entry points (charge 3)

- KPIs, ranking and trend: reference month = month of the latest `visit_date`
  (`dashboard.astro:40,49`), buckets by `visit_date` in Europe/Warsaw
  (`src/lib/services/dashboard-stats.ts:4-6`, `:137`).
- "Ostatnie raporty": the 3 newest reports by `uploaded_at` (`dashboard.astro:41`), shown
  with their upload timestamp (`:330`).
- "Przejdź do listy" in the "Czeka na przegląd" tile links to the newest of those 3 reports
  that has unreviewed deviations (`:112`, `:250`), while the number on the tile is the
  unreviewed count **within the visit-date window** (`:246`). Under the condition "the newest
  report with unreviewed items holds visits outside the current window", the button leads
  to deviations that the tile did not count.
- Period labels say "Ostatni miesiąc / 3 miesiące / 6 miesięcy" (`:85`) and the subtitle
  shows the month name (`:152`); neither says the period is a visit-date period.
- Observed: on 2026-10-06 the user reported that with two reports uploaded 2026-10-01 and
  2026-10-02, "Ostatni miesiąc" showed data from only one of them; the cause was this
  visit-date vs upload-date split. The user chose to keep visit-date semantics, so the
  finding is about making the axis visible, not changing it.

### Focus-visible (charge 4)

- `dashboard.astro:316` ("Wszystkie" link: `text-xs text-primary hover:underline`) and
  `:322-324` (each recent-report row link) carry no `focus-visible:*` classes; a search for
  `focus-visible` in the 3 view files returns 0 matches. Controls built with
  `buttonVariants`/`Button` (`:160-166`, `:188`, `:249-254`, `DashboardExport.tsx:50`) get
  `focus-visible:ring-ring/50 focus-visible:ring-[3px]` from `src/components/ui/button.tsx:8`.

### Narrow-viewport header (charge 5)

- `dashboard.astro:157`: `<div class="flex items-center gap-2">` holding the period
  `<nav>` (3 `sm` buttons, labels "Ostatni miesiąc", "3 miesiące", "6 miesięcy") and the
  "Eksportuj" button has no `flex-wrap`. The parent (`:144`) does wrap, so this group drops
  below the title but cannot break internally.
- Estimate (not measured): ≈ 330px for the nav + 8px gap + ≈ 118px for the export button
  ≈ 456px, against 390 − 48 (`p-6`) = 342px at a 390px viewport. Needs a screenshot to
  confirm during the plan's first visual phase.

### 7-state baseline (for the plan's states phase)

| State | Current |
| --- | --- |
| default | token-driven except charge 1 |
| hover | report rows `hover:bg-muted/50` (`:324`); link underline (`:316`); buttons via `buttonVariants` |
| focus-visible | buttons: ring token; 2 link types: browser default (charge 4) |
| disabled | `DashboardExport.tsx:50` disables on empty ranking, but that branch is unreachable from this page: the export renders only when `stats` exists (`dashboard.astro:156`), and the ranking keeps every representative with ≥1 visit in the current window (`dashboard-stats.ts:172`), which always includes the reference month that by construction has ≥1 visit → candidate N/A |
| error | page-level `Banner variant="error"` (`:180`), no retry action |
| empty | real empty state with CTA (`:182-192`) |
| loading | SSR, no client loading state; period switch is a full navigation (`:160-166`) → candidate N/A with that reason |

### Agent rules check

- `CLAUDE.md:174` ("Design tokens over literals") already directs agents to tokens and to
  `src/components/ui/` and names the kitchen sink for the reports list. It has no guidance
  for chart/series colours and no card component to point to. No rule found in `CLAUDE.md`
  or `AGENTS.md:15,23` that invites arbitrary one-off values.

## Code References

- `src/pages/dashboard.astro:119-123` — legend rule → colour mapping (copy 1)
- `src/pages/dashboard.astro:294-296` — trend segments (copy 2)
- `src/components/dashboard/RankingTable.tsx:55-57` — structure bar (copy 3)
- `src/styles/global.css:28-32,64-68,103-107` — unused `--chart-*` tokens
- `src/pages/dashboard.astro:183,197,204,221,237,258,267,313` — hand-built cards
- `src/pages/dashboard.astro:224-233`, `src/components/reports/DeviationsList.tsx:197-203` — duplicated progress bar
- `src/pages/dashboard.astro:158-168`, `src/components/reports/DeviationsList.tsx:652-667` — duplicated segmented control
- `src/pages/dashboard.astro:40-41,49,112,246,250` — visit-date vs upload-date axes
- `src/pages/dashboard.astro:316,322-324` — links without focus ring
- `src/pages/dashboard.astro:157` — non-wrapping header group
- `src/pages/api/auth/signin.ts:24`, `scripts/smoke.mjs:54` — post-login redirect to `/reports`

## Architecture Insights

- The dashboard is the first view in the repo with data visualisation, so it is where a
  series-colour contract has to be decided; whatever it uses will be copied by the next
  chart.
- `computeDashboardStats` (`dashboard-stats.ts:137`) is a pure function and `RankingTable`
  renders without hydration, so a kitchen-sink page can render every dashboard state from
  fixture visits without Supabase — the cheapest visual gate here.
- Dark mode is purely token-level today (class toggle + `.dark` block); any colour added for
  this view must be added to both blocks or the toggle will not move it.

## Historical Context (from prior changes)

- `context/changes/reports-list-ui-tokens/research.md` (Charges) — the previous `/10x-ui`
  pass found literal `slate-*`/`indigo-*` across the reports list and Topbar; its charge 4
  noted "no `.dark` class is ever applied anywhere in the app". That note is **contradicted
  now**: since commit `f9bf874` (2026-10-06) `.dark` is applied by `ThemeToggle.astro` /
  `Layout.astro`. Its other findings concern a different view and are not re-scored here.
- `context/changes/reports-list-ui-tokens/token-source.md` — `--primary` was promoted from
  `indigo-600` (light) / `indigo-500` (dark). The opacity steps in charge 1 inherit those
  values.
- `context/foundation/lessons.md` — the `TableCell` `whitespace-nowrap` lesson applies to
  `RankingTable.tsx`: representative names are short today, but any free-text cell added to
  the ranking must override it.

## Related Research

- `context/changes/reports-list-ui-tokens/research.md`

## Charges

1. **Missing tokens — rule-series colours.**
   `src/pages/dashboard.astro:119-123,294-296`, `src/components/dashboard/RankingTable.tsx:55-57`
   — the three deviation rules are coloured with ad-hoc opacity steps of `--primary`,
   copied in 3 places, while `--chart-1..5` (`global.css:28-32,64-68`) go unused.
   **User impact:** in the monthly chart the "Telefon" and "Trasa" segments sit at
   2.63:1 / 1.50:1 against the card in light mode and 2.02:1 / 1.31:1 in dark mode, so a
   manager cannot reliably tell which rule drives a month's total — the trend chart shows
   only the total as visible text.

2. **Missing shared component — card (plus progress bar and segmented control).**
   `src/pages/dashboard.astro:183,197,204,221,237,258,267,313` (8 hand-built cards, paddings
   p-4/p-5/p-8), `:224-233` (progress bar duplicated in `DeviationsList.tsx:197-203`),
   `:158-168` (segmented control duplicated in `DeviationsList.tsx:652-667`); `ui/` has no
   `card`.
   **User impact:** tiles and panels on the same screen have different inner spacing, and
   the same "reviewed" progress bar is announced as a progress bar on the dashboard but not
   on the report page — the next view will copy whichever variant it finds first.

3. **Accidental architecture — two unlabeled time axes on one screen.**
   `src/pages/dashboard.astro:40,49` (visit-date window) vs `:41,330` (upload-date list) and
   `:112,246,250` (tile count from one axis, button target from the other).
   **User impact:** a report uploaded yesterday can be listed under "Ostatnie raporty" while
   its visits are absent from "Ostatni miesiąc" (reported by the user on 2026-10-06), and
   "Przejdź do listy" can open deviations the tile did not count.

4. **Missing tokens — focus ring on links.**
   `src/pages/dashboard.astro:316,322-324` — "Wszystkie" and the recent-report row links have
   no `focus-visible` styling, unlike every `buttonVariants` control on the page
   (`button.tsx:8`).
   **User impact:** a keyboard user tabbing through the page gets the token ring on buttons
   and the browser's default outline (or none, depending on the browser) on the three report
   rows — the rows that lead to the actual review work.

5. **Accidental architecture — header controls do not wrap on narrow screens.**
   `src/pages/dashboard.astro:157` — the period switch and "Eksportuj" share a non-wrapping
   flex row (estimated ≈456px vs 342px available at 390px).
   **User impact (to confirm by screenshot):** on a phone the page scrolls horizontally or
   the export button is pushed off-screen.

### Deferred (not in this change)

- **Post-login landing** — `src/pages/api/auth/signin.ts:24` redirects to `/reports`, and
  `scripts/smoke.mjs:54` asserts it. Whether the manager should land on `/dashboard` is a
  product decision that also changes the smoke contract; out of scope for a token change.
- **`max-w-[1100px]` in 5 files** — a repo-wide layout-width literal; fixing it here alone
  would split the layout width in two. Belongs to a layout/shell change.
- **Chart geometry numbers** (`h-[180px]` + `130` at `dashboard.astro:279,291`;
  `w-[150px]` + `MAX_BAR_PX` at `RankingTable.tsx:11,30`) — internal coupling, no user-visible
  defect today. Optional cleanup inside charge 1's phase if it touches the same lines.
- **Missing-config path** — when Supabase is not configured, `supabase` is null
  (`dashboard.astro:38`), `stats` stays null and the page shows "Brak danych do
  podsumowania" (`:182-192`) under the layout's config banner. Developer-only scenario.
- **Migrating other views to the new card/progress/segmented components** — one view per
  change; `DeviationsList.tsx` and `reports/index.astro` keep their copies until their own
  change.

## Open Questions

- Series colours: map the three rules onto existing `--chart-1..3` values, or add
  role-named tokens (e.g. `--rule-gps`, `--rule-phone`, `--rule-route`) whose values may
  reuse the chart hues? The second keeps the rule ↔ colour meaning in one place; the first
  adds no tokens. Either needs contrast ≥3:1 against `--card` in both themes and a re-check
  that the chosen hues stay distinguishable for common colour-vision deficiencies.
- Charge 3 fix shape: label-only ("miesiąc wizyt", upload date shown as such) vs. also
  scoping "Przejdź do listy" to a report inside the window. The user's 2026-10-06 decision
  (keep visit-date semantics) settles the axis, not the button target.
