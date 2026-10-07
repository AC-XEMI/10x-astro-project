# Landing page design-system contract — Plan Brief

> Full plan: `context/changes/landing-ui-contract/plan.md`
> Research: `context/changes/landing-ui-contract/research.md`

## What & Why

The landing page is token-clean, but in dark mode the brand colour fails the 4.5:1 minimum
for small text in both directions (purple text 4.32:1, white on purple 4.38:1) — and that pair
is global, so every primary button is affected. The page also hand-builds four cards, leaves
three link types without the token focus ring, hides the section navigation on phones (the
design shows it), and spells five design values as arbitrary values the scale already has.

## Starting Point

`Welcome.astro` implemented from Claude Design "Strona startowa": 0 colour literals,
`buttonVariants` everywhere, theme toggle in the header; dark `--primary` = indigo-500 with
white text (chosen without a contrast check in the first token change); no kitchen sink, not
covered by `check:ui-tokens`.

## Desired End State

Dark theme uses indigo-400 with dark text on it (6.34:1 text, 5.74:1 on buttons); the landing
uses `Card` (design dimensions kept), shows the token focus ring on every link, keeps the
section links visible and wrapping on phones, and uses scale values. Wording unchanged. A
kitchen sink shows logged-out/logged-in × light/dark, with screenshots.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Dark `--primary` fix | indigo-400 + dark foreground `oklch(0.205 0 0)` | Fixes text and button labels with one pair (6.34 / 5.74); white on indigo-400 would be 2.99 | Plan |
| Mobile section nav | Always visible, wrapping in its own header row | Matches the design; no new interaction | Plan |
| Cards | `Card` with explicit design overrides; preview stays a `<figure>` | Same precedent as the upload cards; keeps semantics | Research |
| Arbitrary values | `py-18`, `pb-18`, `max-w-130`, `max-w-160`, `w-37.5`; keep `text-[44px]`, `leading-[1.1]` | Exact v4 scale equivalents; the headline values have none | Research |
| Wording | Unchanged | User's standing rule for Claude Design views | User rule |
| Signed-in visitors on `/` | Out of scope | Product decision tied to the signin redirect | Research |
| Gate | Kitchen sink with dev-only `user` prop + CDP screenshots | Reuses `kitchen-sink-shot.mjs` and the frame pattern | Plan |

## Scope

**In scope:** dark `--primary` pair + token-source; `Welcome.astro` cards, focus, nav, scale
values, dev-only `user` prop; `/dev/kitchen-sink/landing`; screenshots; `check:ui-tokens` +
CLAUDE.md bullet.

**Out of scope:** wording, light theme tokens, signed-in redirect, `max-w-[1100px]`, other views, CI.

## Architecture / Approach

Token values first (global, verified on every surface: buttons, auth brand panel, dashboard
GPS series, landing CTA), then the view, then the kitchen sink rendering the real component
with a `user` override, then the guard.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Dark primary token values | indigo-400 + dark foreground, token-source with measurements | Dark-mode primary surfaces change look app-wide |
| 2. Landing view on the contract | Cards, focus ring, wrapping nav, scale values | Visual drift from the design (checked by text diff + screenshots) |
| 3. Kitchen sink and visual gate | Logged-out/in × light/dark, N/A cells, 3 screenshots | Sticky header inside frames |
| 4. Guard | `check:ui-tokens` on the landing, CLAUDE.md bullet | Allow-list creep |

**Prerequisites:** dev server running; Chrome for screenshots.
**Estimated effort:** ~1 session across 4 small phases.

## Open Risks & Assumptions

- Tailwind v4 renders `py-18`, `max-w-130`, `w-37.5` as the same pixels (spacing multiples) — verified by screenshot in Phase 2.
- The dark-mode look of primary buttons and the auth brand panel changes (lighter fill, dark text) — intended, confirmed manually in Phase 1.

## Success Criteria (Summary)

- In dark mode, small text on or in the brand colour is readable at ≥ 4.5:1 everywhere.
- The landing reads the same, but every link has a visible keyboard focus and phones keep the section navigation.
- The next agent finds the landing in the kitchen sink and the token check.
