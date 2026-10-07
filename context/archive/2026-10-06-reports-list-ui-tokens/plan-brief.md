# Align reports list view with existing shadcn/Tailwind design tokens — Plan Brief

> Full plan: `context/changes/reports-list-ui-tokens/plan.md`
> Research: `context/changes/reports-list-ui-tokens/research.md`

## What & Why

`reports/index.astro` and the chrome it renders (`ReportsList.tsx`,
`Topbar.astro`, `Banner.astro`) use literal Tailwind colors (`slate-*`,
`indigo-*`, raw hex) instead of the semantic token system already defined in
`src/styles/global.css` and already correctly used by `src/components/ui/button.tsx`.
This plan makes those files read the existing tokens instead of reinventing
colors per file — no new design system, no new dependency.

## Starting Point

The token/component contract works today (`<Button>`, `<Dialog>`, `<Table>` all
consume it correctly) but is read by only 4 of ~19 page/component files repo-wide;
`reports/index.astro` and its rendered chrome are among the 15 that don't. No
`.dark` class is ever applied anywhere in the app, so dark-mode tokens are present
but unreachable infrastructure, not an active bug.

## Desired End State

Opening `/reports` shows the upload card, table, and nav using the same color
system as every shadcn `<Button>` in the app — no visual seam between
token-driven and literal surfaces. A `/dev/kitchen-sink/reports-list` page shows
all 7 UI states for review. `CLAUDE.md` tells the next agent where tokens and
shared components live.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Shared-component blast radius | Fix `Topbar.astro`/`Banner.astro` even though it changes `Welcome.astro`/`reports/[id].astro` too | They're shared chrome, not separate views — the token fix is the same class of change either way | Plan (user-confirmed) |
| Dark mode scope | Token readiness only, no toggle added | No `.dark` activation exists anywhere in the app today; adding one is a second feature, not a token fix | Plan (user-confirmed) |
| Visual gate | Dev-only kitchen-sink route (`/dev/kitchen-sink/reports-list`) | No Playwright/vitest configured; a route is the cheapest repeatable artifact and sits outside `PROTECTED_ROUTES` | Plan (user-confirmed) |
| `warning` banner variant | Keep as a scoped literal, documented inline | No `warning` token exists in `global.css`; inventing one is a new token value, out of scope for a "read existing tokens" change | Plan |
| File input | Keep native `<input type="file">`, only re-color `file:` classes | Adding a shadcn `Input` component wasn't part of the charged issue and is an avoidable new dependency surface | Plan |

## Scope

**In scope:** `src/pages/reports/index.astro`, `src/components/reports/ReportsList.tsx`,
`src/components/Topbar.astro`, `src/components/Banner.astro`, a new
`src/pages/dev/kitchen-sink/reports-list.astro`, a `CLAUDE.md` rule addition.

**Out of scope:** dark-mode toggle, `DeviationsList.tsx`, `reports/[id].astro`'s
own literals beyond what `Topbar`/`Banner` cascade, any new shadcn component,
any test-framework installation.

## Architecture / Approach

Fix shared chrome first (Phase 1), then the page that composes it (Phase 2), so
later phases build on an already-correct foundation. Phase 3 adds the visual
gate; Phase 4 adds the guard rule so the fix outlives this session.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared chrome | `Topbar.astro`/`Banner.astro` on tokens | Visible change ripples into `Welcome.astro`/`reports/[id].astro` (accepted) |
| 2. reports/index.astro + ReportsList.tsx | Page/list on tokens, real `<Button>` for submit | Dropping `bg-slate-50` must not reveal a contrast gap against `bg-background` |
| 3. 7-state matrix + gate | Kitchen-sink page, screenshots, scan re-run | Static HTML can't truly hold `:hover`; documented as a caption, not a live state |
| 4. Make it stick | `CLAUDE.md` rule | Must land outside the toolkit-managed BEGIN/END block |

**Prerequisites:** none beyond the existing repo state — no new dependencies.
**Estimated effort:** ~1 session across 4 phases (styling-only, no data/API changes).

## Open Risks & Assumptions

- `warning` banner variant keeps one scoped literal since no token exists for it —
  acceptable per the plan's "no new token values" boundary, but worth revisiting
  if a `warning`-like token is ever added for other views.
- The kitchen sink's "hover" state is documented via caption, not a true `:hover`
  screenshot, since no Playwright is configured — a future `/10x-ui` change could
  upgrade this if a screenshot tool is ever added.

## Success Criteria (Summary)

- Hardcoded-value scan on the 5 touched files drops from 29 matches to 0 (minus
  the documented `warning` exception).
- All 7 states render on `/dev/kitchen-sink/reports-list` without error.
- `CLAUDE.md` carries a rule naming the token source, the components directory,
  and the kitchen sink.
