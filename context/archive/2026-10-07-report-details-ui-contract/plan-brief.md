# Report details design-system contract — Plan Brief

> Full plan: `context/changes/report-details-ui-contract/plan.md`
> Research: `context/changes/report-details-ui-contract/research.md`

## What & Why

The report details view (Szczegóły raportu: `src/pages/reports/[id].astro` + `DeviationsList.tsx`)
already uses colour tokens, but the rest of the contract has drifted: visits open only with a mouse,
review/export failures are silent, a database problem is reported as "Nie znaleziono raportu."
with HTTP 200, containers and selects are hand-built, and the visit table scrolls sideways on phones.

## Starting Point

0 colour literals; the expand trigger is a clickable `<tr>`; errors go to `console.error`; all load
failures render one `Banner`; 8 hand-made card containers; fixed px column widths (≥ 768px table);
`getHours()` timestamps; no kitchen sink, not scanned by `check:ui-tokens`.

## Desired End State

A keyboard user can open any visit and undo a single mark; a failed action shows an in-page alert;
the page distinguishes not-found (404), not-configured (503) and load failure (500) in an `Alert`;
the view uses `Card` and the token focus ring everywhere; at 390px the review button is reachable
without sideways scroll. A kitchen sink shows the 7-state matrix and `check:ui-tokens` guards it.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Action failures | One `Alert destructive` under the toolbar, cleared by the next success; texts "Nie udało się zapisać zmiany statusu. Spróbuj ponownie za chwilę." / "Nie udało się wyeksportować listy. Spróbuj ponownie." | Same pattern as Raporty; reverses the 2026-10-01 "no error UI" decision whose premise (no alert component) is gone | Plan |
| Entry point | not found / foreign / bad UUID → "Nie znaleziono raportu." 404; no config → existing `not_configured` text 503; query error → "Nie udało się wczytać raportu. Spróbuj ponownie za chwilę." 500 | A DB outage must not look like a missing report | Plan |
| Expand control | Visit date becomes `<button aria-expanded aria-controls>`; row click kept for mouse | No new label text, valid ARIA | Plan |
| Selects | Native `<select>` + button focus classes | No new dependency, native mobile behaviour | Plan |
| Rule colour | Stays `text-destructive`, no `--rule-*` here | A rule on this view is a problem to check, not a data series | Research default, confirmed |
| Phones | Hide Klient below `md`, no fixed widths below `md`, scale values from `md` | Review button visible; client still in expanded context | Plan |
| Timestamp | `formatDateTime` (Europe/Warsaw) | Matches header and other views | Research |

## Scope

**In scope:** page load states + statuses, `ReportLoadError.astro`, date expand button, action error
alert, `Card` migration, focus ring/hover on selects and group header, phone-width table, kitchen
sink + screenshots, `check:ui-tokens` scope, CLAUDE.md bullet.

**Out of scope:** other wording changes, `--rule-*` colours, shadcn select/badge, spinners, mobile
card layout, review API, other `Banner` users, CI, test framework.

## Architecture / Approach

Two runtimes, two phases of behaviour: the Astro page decides the load state and HTTP status and
renders a shared `ReportLoadError`; the React island owns expand/action-error state. Then visual
contract (Card, focus, layout), then the kitchen sink renders the real components via dev-only
initial-state props, then the token checker and CLAUDE.md lock it in.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Entry point states | 404/503/500 + `Alert` via `ReportLoadError` | Status must be set before output |
| 2. Island interactions | Keyboard expand, action error alert, Warsaw timestamps | Double toggle if the button click bubbles to the row |
| 3. Components and layout | `Card`, focus ring, 390px table | Status button may still not fit at 390 — measure, then ask |
| 4. Kitchen sink and visual gate | 7-state matrix light/dark, 1280 + 390 screenshots | Page too tall for 390 capture (`?compact=1` allowed) |
| 5. Guard | `check:ui-tokens` covers 3 files, CLAUDE.md updated | Allow-list growing silently — each entry commented |

**Prerequisites:** local Supabase with a signed-in user and an uploaded report for manual checks.
**Estimated effort:** ~2 sessions across 5 phases.

## Open Risks & Assumptions

- Invalid-UUID handling assumes a regex check before the query (no DB round-trip).
- 390px fit is inferred from widths; Phase 3 measures it and escalates instead of improvising.

## Success Criteria (Summary)

- Keyboard-only users can open a visit and undo a mark; failures are visible.
- A DB failure is no longer reported as "report not found"; statuses are correct.
- `npm run check:ui-tokens` passes with the view in scope; screenshots show all states.
