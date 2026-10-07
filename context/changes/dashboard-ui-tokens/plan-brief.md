# Dashboard (Pulpit) design-system contract — Plan Brief

> Full plan: `context/changes/dashboard-ui-tokens/plan.md`
> Research: `context/changes/dashboard-ui-tokens/research.md`

## What & Why

The dashboard is already free of colour literals, but its three rule series are opacity
steps of `--primary` that fall to 1.31–2.63:1 against the card (below the 3:1 non-text
minimum) in both themes, its 8 containers are hand-built with three different paddings, and
it mixes a visit-date axis (numbers) with an upload-date axis (recent reports, the "Przejdź
do listy" target) without saying so. This change puts the view on the contract and leaves a
rule and a check so the next chart does not repeat it.

## Starting Point

`src/pages/dashboard.astro` + `RankingTable.tsx`, shipped 2026-10-06 from the Claude Design
mockup; tokens in `src/styles/global.css` with working dark mode; `src/components/ui/` has
no `card`; a kitchen sink exists only for the reports list.

## Desired End State

Every dashboard container is a shadcn `Card`; the rules are coloured by `bg-rule-gps`,
`bg-rule-phone`, `bg-rule-route` (≥3:1 in both themes, same hue in both); the period reads
as a visit period, recent reports read as uploads, and "Przejdź do listy" opens the report
with the most unreviewed deviations inside the current period; links show the focus ring;
the header wraps at 390px; `/dev/kitchen-sink/dashboard` shows all 7 states in light and
dark, with screenshots in the change folder.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Series colours | New `--rule-gps/phone/route` tokens: indigo (=primary), teal, amber | All ≥3:1 vs card in both themes (min 3.19) and hue-stable across the toggle; `--chart-*` swap hue between themes and `--chart-1` dark is 2.63:1 | Plan |
| Rule → colour mapping | One TS constant used by legend, chart and ranking | It was copied 3 times | Research |
| Time axes | Keep visit-date buckets; label them; button target from the same window | User kept visit-date semantics on 2026-10-06; only the target crossed axes | Research + Plan |
| "Most unreviewed" tie-break | Newest visit in window, then lowest `report_id` | Deterministic and favours the freshest work | Plan (agent-derived) |
| Container | `npx shadcn@latest add card` | Stack's own path, no new dependency | Research |
| Progress bar / segmented control | Not shared in this change | Only one copy each per view; belongs to the `DeviationsList` change | Plan |
| Visual gate | Kitchen sink from fixtures + Chrome headless screenshots | Same pattern as `reports-list.astro`, no Supabase or test framework needed | Plan |
| Guard | `CLAUDE.md` bullet + `npm run check:ui-tokens` (not in CI) | Rule tells the agent, check catches it; CI edits are out of scope | Plan |

## Scope

**In scope:**
- `ui/card.tsx`, three rule tokens, `token-source.md`
- Dashboard: cards, rule colours, focus ring on links, wrapping header, axis labels, `reviewTarget`
- `DashboardView.astro` extraction, dashboard kitchen sink, 2 screenshots
- `CLAUDE.md` bullet, `scripts/check-ui-tokens.mjs`

**Out of scope:**
- Other views' cards/progress bars, post-login redirect, `max-w-[1100px]`, chart geometry, `--chart-*` values, CI, period semantics, missing-config path

## Architecture / Approach

Library → token values → view → states → guard. The page keeps data fetching; the body
moves into `DashboardView.astro` so the kitchen sink renders identical markup from
`computeDashboardStats` over fixture visits. `reviewTarget` is computed in the pure stats
function from `report_id` added to the visits query.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Card primitive | `ui/card.tsx` + render check from Astro | `astro-static-slot` wrapper breaking card spacing |
| 2. Rule-series tokens | 3 tokens × 2 themes, published; TS mapping; token-source | Forgetting `@theme inline` → classes not generated |
| 3. Dashboard view on the contract | Cards, colours, focus, wrap, labels, `reviewTarget` | Visual density shift from card defaults |
| 4. States and visual gate | `DashboardView.astro`, kitchen sink (7 states × 2 themes), screenshots | Extraction changing real-data rendering |
| 5. Guard | `CLAUDE.md` rule, `check:ui-tokens` script | Allow-list too broad to catch regressions |

**Prerequisites:** local dev server; Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`.
**Estimated effort:** ~1–2 sessions across 5 small phases.

## Open Risks & Assumptions

- Amber-600 in light is 3.19:1 — passes, but with little margin; a future `--card` change must re-check it.
- Teal/indigo/amber distinguishability for colour-vision deficiencies is assumed from lightness and hue spread, not tested with a simulator.
- Mobile overflow at `:157` is an estimate until the Phase 3 check confirms it.

## Success Criteria (Summary)

- A manager can tell which rule drives each month's total, in light and in dark.
- "Przejdź do listy" never leads to deviations the tile did not count.
- The next agent touching the dashboard finds the tokens, the card and the kitchen sink named in `CLAUDE.md`, and `npm run check:ui-tokens` fails if it regresses.
