# Reports list design-system contract — Plan Brief

> Full plan: `context/changes/reports-list-ui-contract/plan.md`
> Research: `context/changes/reports-list-ui-contract/research.md`

## What & Why

The reports list has almost no colour literals left, but it tells users wrong things: a
failed query or a stale page link says "you have no reports", server failures arrive as raw
English database text in the URL (and any text in a crafted link shows as an app message),
the same upload shows different times on the list and on its details page, and the upload
progress is silent and drops keyboard focus. This change fixes those states and puts the view
on the shared components and tokens.

## Starting Point

`index.astro` + `ReportsList` + `ReportUpload` after two Claude Design redesigns; 4 hand-built
cards, Banner (a full-bleed strip) used in-page, `?error=<free text>` from `upload.ts`/`delete.ts`,
three date formatters in three zones, a stale kitchen sink with no dark frames. `ui/card` and
the CDP screenshot approach exist from the dashboard change.

## Desired End State

Cards and Alerts everywhere on the page; `?error` is a code mapped to Polish text, and upload
failures (including "Wiersz N: …" parser details) appear inside the upload card without a
reload; failed queries show an error, out-of-range pages redirect to the last page; one
Europe/Warsaw date format on list, details and dashboard; upload stages are announced,
animated and keep focus; a kitchen sink of real components in both themes, with screenshots.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Server error channel | Codes in `?error` + mapped messages; upload errors shown in the card via `xhr.responseURL` | Removes raw DB text and link spoofing, and shows the error where the action happened | Plan |
| Parser row details | Kept as `detail`, rendered only by the upload card | They are our own Polish, row-specific messages; the page never renders `detail` | Plan (agent-derived) |
| Message component | `npx shadcn add alert` (+ `success`); Banner only for the Layout config strip | Rounded in-page messages next to cards without restyling Banner's 6 other uses | Plan |
| Date format & scope | `formatDateTime` (Europe/Warsaw, `DD.MM.YYYY, HH:MM`) on list, delete dialog, details header, dashboard | The places a manager compares the same upload; DeviationsList stays | Plan |
| Out-of-range page | 302 to the last page, keeping `deleted=1`; "Strona X z Y" | Users always see their reports; covers deleting the last item on the last page | Plan |
| Drop-zone border | `border-2 border-dashed border-muted-foreground` (4.73 / 6.91:1) | Current `--border` is 1.26 / 1.32:1 in both themes | Plan (computed) |
| Button cursor | `cursor-pointer` in `button.tsx`; remove 8 overrides here | One-line fix in the primitive; DeviationsList's overrides become redundant | Plan |
| Kitchen sink | Rebuild from real components, light + dark, dev-only `initialState` / `initialDeletingId` | The old one had stale hand-copied sections and no dark mode | Plan |
| Screenshots | `scripts/kitchen-sink-shot.mjs` (CDP, no deps) | Reproducible 390px gate; Chrome headless enforces ~485px min on Windows | Plan |

## Scope

**In scope:**
- `ui/alert.tsx`, `button.tsx` cursor, `src/lib/report-errors.ts`, `src/lib/format-date.ts`
- `upload.ts` / `delete.ts` error redirects; `[id].astro` and `DashboardView` date calls
- `index.astro`, `ReportsList.tsx`, `ReportUpload.tsx`; kitchen sink + screenshot script; `CLAUDE.md`, `check:ui-tokens`

**Out of scope:**
- DeviationsList dates/cursor overrides, other views' Banners, `--warning`, `max-w-[1100px]`, drop-zone click, CI wiring, Playwright

## Architecture / Approach

Primitives (Alert, Button cursor) → shared values (error-code map, date helper, endpoints emit
codes) → view (Card/Alert, honest states, pagination, in-card server errors, scale values,
visible drop zone) → upload states (live region, animation, focus) → kitchen sink from real
components with dev-only state props + CDP screenshots → CLAUDE.md rule and wider token check.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Primitives | `ui/alert` (+success), pointer cursor in Button | `shadcn add` installing a stray package again |
| 2. Shared values | Error codes, `formatDateTime`, endpoints and 3 views on them | Losing parser row detail in the switch to codes |
| 3. The view | Cards/Alerts, fetch-error and out-of-range states, pagination, in-card errors, drop zone | Redirect loop or lost `deleted` flag on the out-of-range path |
| 4. Upload states | Live region, animated indeterminate bar, focus management | Focus jumps that fight the user |
| 5. Gate | Real-component kitchen sink, both themes, screenshots | Dev-only props leaking into product behaviour |
| 6. Guard | CLAUDE.md bullet, `check:ui-tokens` on 4 more files | Allow-list growing without review |

**Prerequisites:** local dev server; Chrome installed; signed-in account with reports for the manual checks.
**Estimated effort:** ~2 sessions across 6 phases.

## Open Risks & Assumptions

- `Intl.DateTimeFormat` with `timeZone: "Europe/Warsaw"` is available in Cloudflare workerd (the dashboard already relies on it).
- The XHR follows the redirect same-origin, so `responseURL` exposes `?error=` (current code already depends on it).
- Screen-reader behaviour of the live region is assumed from ARIA semantics, not tested with NVDA.

## Success Criteria (Summary)

- A manager is never told "no reports" when the list failed to load or the page number is stale.
- An upload failure is explained in Polish, next to the upload card, with the row to fix.
- One upload shows one date and time everywhere it appears.
