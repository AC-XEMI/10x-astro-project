# Light surface tokens — Plan Brief

> Full plan: `context/changes/light-surface-tokens/plan.md`

## What & Why

In the light theme the page, cards and popovers are all pure white, so cards on Raporty,
Szczegóły raportu and Pulpit stand out only by their border. We tint the light page background to
neutral-50 so surfaces separate the way they already do in dark mode.

## Starting Point

`global.css` sets light `--background`, `--card` and `--popover` to `oklch(1 0 0)`. Two shadcn
primitives — the `outline` button and `DialogContent` — paint themselves with `bg-background`, so
they would inherit any page tint. Landing bands use `bg-muted/50`, which nearly vanishes on a
tinted page.

## Desired End State

Light page is `oklch(0.985 0 0)`; cards, alerts, popovers, the dialog and outline buttons stay
white on it; landing bands remain visibly distinct. Dark theme is unchanged except the landing
bands. All text on the new background measures ≥ 4.5:1, recorded in `token-source.md`.

## Key Decisions Made

| Decision                    | Choice                                              | Why (1 sentence)                                                                 |
| --------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| Scope                       | Separate page and surfaces (not Banner hex)         | The only light/dark asymmetry in surface tokens; Banner is a separate concern.    |
| Background value            | `oklch(0.985 0 0)` (neutral-50)                     | Keeps `--muted-foreground` at 4.53:1 without touching other tokens (0.97 → 4.34). |
| Outline button / dialog     | Light only: `bg-card`; `bg-popover dark:bg-background` | Stay white in light while dark stays pixel-identical.                          |
| Landing bands               | `bg-muted/50` → `bg-card` (planned `bg-muted`, changed in Phase 1) | Grey text on `--muted` is 4.34:1; white bands on the tinted page keep it at 4.73 and keep the rhythm. |
| Contrast guard              | One-off measurement in `token-source.md`            | Consistent with previous token changes; no new script to maintain.              |

## Scope

**In scope:** light `--background` value; `outline` button and `DialogContent` surfaces; landing
bands; `token-source.md` with measurements; before/after screenshots of four kitchen-sinks; a
CLAUDE.md rule on surface roles.

**Out of scope:** dark token changes; other tokens (`--muted`, `--muted-foreground`, …); Banner
`--warning` token; permanent contrast check in `check-ui-tokens.mjs`; any wording changes.

## Architecture / Approach

One token value change in `global.css` cascades through `bg-background` (page) while `bg-card` /
`bg-popover` users stay white. The two primitives that used the page colour as a surface are
re-pointed to surface roles, light-only. Measure, record, then gate visually.

## Phases at a Glance

| Phase                     | What it delivers                                             | Key risk                                                  |
| ------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| 1. Tokens and surfaces    | New background, white outline buttons/dialog, landing bands, token-source | A missed `bg-background` surface turns grey             |
| 2. Visual gate and rule   | Before/after screenshots light+dark, CLAUDE.md surface-role rule | Unintended dark-theme drift in shadcn primitives       |

**Prerequisites:** none beyond a working `npm run dev` and Chrome for `kitchen-sink-shot.mjs`.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Card vs page separation at 0.985 is subtle (≈1.04:1); it relies on border + shadow as well — accepted.
- Landing bands moved to `bg-card`; in dark this is visually identical (`muted/50` over 0.145 ≈ 0.207 vs `--card` 0.205) — verified in Phase 2.

## Success Criteria (Summary)

- In light mode, every card, dialog and outline button reads as white on a light-grey page across all views.
- Dark mode looks the same as before (landing bands excepted).
- No text pair on the page background drops below 4.5:1.
