---
date: 2026-10-07T12:06:38+02:00
researcher: Claude Code (claude-opus-5-5)
git_commit: a384e6763699c46388fb3db19e546d4685d1e397
branch: dev
repository: 10x-astro-project
topic: "/10x-ui audit of the landing page (src/components/Welcome.astro) against the design-system contract"
tags: [research, ui, design-tokens, landing, dark-mode, contrast, focus]
status: complete
last_updated: 2026-10-07
last_updated_by: Claude Code (claude-opus-5-5)
---

# Research: /10x-ui audit of the landing page (Strona startowa)

**Date**: 2026-10-07T12:06:38+02:00
**Researcher**: Claude Code (claude-opus-5-5)
**Git Commit**: a384e6763699c46388fb3db19e546d4685d1e397
**Branch**: dev
**Repository**: 10x-astro-project

## Research Question

Two-way `/10x-ui` audit of one view — `src/components/Welcome.astro`, rendered by
`src/pages/index.astro` — producing 3–5 charges (file, line, user effect) in the categories
missing tokens / missing shared component / accidental architecture, with both themes in
scope. Constraint from the user (CLAUDE.md:177, memory): the view comes from Claude Design
("Strona startowa"); styles and display logic may change, user-facing wording may not.

Method: single-area scope (one 372-line file written from the design file whose full source
is in this session), so investigated locally without delegation. `Welcome.astro` read fully;
contrast computed from the token values in `src/styles/global.css` (oklch → sRGB, WCAG
relative luminance; same method as `context/archive/2026-10-07-dashboard-ui-tokens/token-source.md`).
Nothing rendered in a browser for this research.

## Summary

The view already uses tokens only (0 colour literals or palette classes, 58 token-class
uses) and `buttonVariants` for every button-styled link. The contract variant is **existing
design system**. Findings:

1. **Dark-mode `--primary` misses 4.5:1 for small text** — `text-primary` on the page
   background is 4.32:1 and `--primary-foreground` on `--primary` is 4.38:1 (light: 6.44 /
   6.17). This hits the eyebrow (`:154`), the footer link (`:357`), the CTA band paragraph
   (`:340`) — and every `default` button label in the app, so it is a token-level finding.
2. **4 hand-built cards** (`:191, :244, :267, :323`) although `ui/card.tsx` exists.
3. **3 link types without a token focus ring** (`:118` logo, `:124` section nav, `:357`
   footer link) — they rely on the base `outline-ring/50` outline (`global.css:131`).
4. **Section navigation disappears below `md`** (`:122` `hidden md:flex`) — on a phone the
   four section links of the design are not reachable from the header.
5. **5 of the view's arbitrary values have exact Tailwind v4 scale equivalents**
   (`py-[72px]`, `pb-[72px]`, `max-w-[520px]`, `max-w-[640px]`, `w-[150px]`), 2 have none
   (`text-[44px]`, `leading-[1.1]`), 1 is the repo-wide page width.

There is no kitchen sink for this view and `check:ui-tokens` does not scan it.

## Detailed Findings

### Source → view

- Tokens: `src/styles/global.css` (`:root` / `.dark` → `@theme inline`); theme toggle in the
  view's own header (`Welcome.astro:145`).
- Shared components used: `buttonVariants` (`:15` import; used at `:131, :136, :140, :165,
  :168, :174, :178, :318, :342`). Not used: `ui/card` (exists since
  `context/archive/2026-10-07-dashboard-ui-tokens/`, density tightened), `ui/alert`.
- Hardcoded-value scan on `Welcome.astro` + `index.astro`: 0 hex/rgb/oklch, 0 palette
  classes. Arbitrary values: 13 occurrences of 8 distinct values (table below).
- Opacity tints: `bg-muted/50` ×4 (`:205, :236, :275, :285`), `bg-primary/10` (`:294`),
  `bg-destructive/10` (`:268`) — same tint pattern as the reports upload card.

### Contrast (charge 1)

Computed against the tokens, small-text threshold 4.5:1, large text (≥ 24px, or ≥ 18.66px
bold) 3:1:

| Pair | Light | Dark | Where |
| --- | --- | --- | --- |
| `text-primary` on `--background` | 6.44 | **4.32** | eyebrow `:154` (14px medium), footer link `:357` (14px) |
| `--primary-foreground` on `--primary` | 6.17 | **4.38** | CTA band paragraph `:340` (14px); CTA heading `:339` (24px) passes as large text; every `default` button label (`button.tsx:12`, 14px) app-wide |
| `text-muted-foreground` on `bg-muted/50` | 4.53 | 6.84 | preview tiles `:206`, examples `:275-276` |
| `text-destructive` on `bg-muted/50` over card | 4.56 | 5.73 | preview counts `:207` |
| `text-muted-foreground` on `--background` | 4.73 | 7.63 | body copy |

The two dark failures pull in opposite directions: a lighter dark `--primary` raises
text-on-background but lowers white-text-on-primary. One token cannot fix both while
`--primary-foreground` stays white. The dark values were chosen in
`context/archive/2026-10-06-reports-list-ui-tokens/token-source.md` (indigo-500 + white
foreground) without a contrast check.

### Containers (charge 2)

| Line | Current | Role |
| --- | --- | --- |
| `:191` | `figure … rounded-xl border bg-card p-5 shadow-lg` | app preview (design: `rounded-xl … shadow-lg p-5`) |
| `:244` | `li … rounded-lg border bg-card p-5` | step cards |
| `:267` | `div … rounded-lg border bg-card p-6` | rule cards |
| `:323` | `div rounded-lg border bg-card` (rows `px-4 py-3`) | required-columns table |

`ui/card.tsx` gives `rounded-xl py-4 px-4 gap-3 shadow-sm`; adopting it with the design's
dimensions as explicit overrides (as done for the upload cards in
`context/archive/2026-10-07-reports-list-ui-contract/`) keeps the look.

### Focus (charge 3)

- `:118` logo link, `:124` section anchors (`navLink` = `text-muted-foreground … hover:text-foreground`),
  `:357` footer "Zaloguj się" (`text-primary hover:underline`): no `focus-visible:*` classes
  (0 matches in the file). They get the base outline only: `global.css:131`
  `* { @apply … outline-ring/50 }` → the browser's focus outline in `--ring` at 50% opacity.
- Every `buttonVariants` link and `ThemeToggle` get the token ring
  (`focus-visible:ring-ring/50 focus-visible:ring-[3px]`, `button.tsx:8`; `ThemeToggle.astro`).

### Mobile navigation (charge 4)

- `:122` `<nav class="hidden … md:flex">` — below 768px the four section links
  ("Jak to działa", "Co sprawdzamy", "Możliwości", "Przygotowanie pliku") are removed.
- The design (`Strona startowa.dc.html`, header) renders the nav unconditionally inside a
  `flex-wrap` header — no breakpoint hides it. The implementation added the hiding.

### Arbitrary values (charge 5)

| Value | Line(s) | From design | Tailwind v4 scale equivalent |
| --- | --- | --- | --- |
| `py-[72px]` | `:151` (`md:`) | `padding-top/bottom:72px` | `py-18` (18 × 0.25rem = 72px) |
| `pb-[72px]` | `:336` | `padding-bottom:72px` | `pb-18` |
| `max-w-[520px]` | `:158` | `max-width:520px` | `max-w-130` |
| `max-w-[640px]` | `:260` | `max-width:640px` | `max-w-160` |
| `w-[150px]` | `:327` | `width:150px` | `w-37.5` |
| `text-[44px]` | `:155` (`md:`) | `font-size:44px` | none (`text-4xl` 36px, `text-5xl` 48px) |
| `leading-[1.1]` | `:155` | `line-height:1.1` | none (`leading-none` 1, `leading-tight` 1.25) |
| `max-w-[1100px]` | `:111, :117, :151, :337, :352` | `max-width:1100px` | repo-wide page width (5 views) |

Inference, to verify in the plan's first visual phase: Tailwind v4 derives spacing and
`max-w-<n>` from `--spacing` multiples, so the five equivalents render identically.

### Entry points

- Logged-out `/`: full landing with sign-up CTAs (`:134-143, :172-181, :335-348, :354-361`).
- Logged-in `/`: header shows "Przejdź do pulpitu" (`:131`), hero CTAs switch to
  "Przejdź do pulpitu" / "Raporty" (`:163-171`), CTA band and footer prompt hidden. The
  marketing copy stays. Whether a signed-in user should be redirected to `/dashboard` is a
  product decision (signin already redirects to `/reports`, `src/pages/api/auth/signin.ts:24`).
- `index.astro` is 8 lines: `<Layout><Welcome /></Layout>` (default title).

### Gate and guard

- No kitchen sink for this view (`src/pages/dev/kitchen-sink/` has `dashboard.astro`,
  `reports-list.astro`).
- `scripts/check-ui-tokens.mjs` scans the dashboard and reports list files only.
- Tooling available: `scripts/kitchen-sink-shot.mjs` (CDP screenshots, desktop + 390px).

## Code References

- `src/components/Welcome.astro:111-112` — `section` / `navLink` class strings
- `src/components/Welcome.astro:118, :124, :357` — links without a token focus ring
- `src/components/Welcome.astro:122` — section nav hidden below `md`
- `src/components/Welcome.astro:151, :155, :158, :260, :327, :336` — arbitrary values
- `src/components/Welcome.astro:154, :337-345, :357` — `--primary` as text / as background of text
- `src/components/Welcome.astro:191, :244, :267, :323` — hand-built cards
- `src/styles/global.css:131` — base `outline-ring/50`
- `src/components/ui/button.tsx:8,12` — token focus ring; `default` variant `bg-primary text-primary-foreground`

## Architecture Insights

- This is the first view where `--primary` is used as running text on the page background;
  previous audits measured it only as a non-text series colour (3:1 threshold).
- The dark `--primary` / `--primary-foreground` pair is global: any fix moves every primary
  button, link and the dashboard GPS series (which references `var(--primary)` and was
  measured at 3.91:1 dark as non-text).

## Historical Context (from prior changes)

- `context/archive/2026-10-06-reports-list-ui-tokens/token-source.md` — dark `--primary` =
  indigo-500, `--primary-foreground` overridden to white "which assumed a light primary";
  no contrast figures recorded. Still the current values (`global.css:55-56`).
- `context/archive/2026-10-07-dashboard-ui-tokens/token-source.md` — `--rule-gps` =
  `var(--primary)`; measured 3.91:1 dark as a non-text series. A dark `--primary` change
  must keep it ≥ 3:1.
- `context/archive/2026-10-07-reports-list-ui-contract/` — precedent for keeping Claude Design
  dimensions as explicit overrides on `Card`, and for the wording rule.

## Related Research

- `context/archive/2026-10-07-dashboard-ui-tokens/research.md`
- `context/archive/2026-10-07-reports-list-ui-contract/research.md`

## Charges

1. **Missing tokens — dark `--primary` is below 4.5:1 for small text.**
   `src/styles/global.css:55-56` (dark `--primary` / `--primary-foreground`), surfacing at
   `Welcome.astro:154, :340, :357` and every `default` button label.
   **User impact:** in dark mode the eyebrow line, the footer sign-in link, the CTA band
   sentence and the text on every primary button sit at 4.32–4.38:1 — readable for many,
   but below the minimum for small text, so low-vision users struggle exactly on the calls
   to action.

2. **Missing shared component — four hand-built cards.**
   `Welcome.astro:191, :244, :267, :323`.
   **User impact:** none visible today; the next landing section copied from these will drift
   from the cards on the dashboard and reports list (radius, padding, shadow are spelled out
   four different ways in one file).

3. **Missing tokens — links without the token focus ring.**
   `Welcome.astro:118, :124, :357`.
   **User impact:** a keyboard user tabbing through the header and footer gets a faint
   50%-opacity browser outline on the logo, the section links and "Zaloguj się", but a clear
   3px ring on the buttons next to them.

4. **Accidental architecture — section navigation removed on phones.**
   `Welcome.astro:122` (`hidden md:flex`).
   **User impact:** on a phone the header offers no way to jump to "Jak to działa",
   "Co sprawdzamy", "Możliwości" or "Przygotowanie pliku"; the design kept them visible in a
   wrapping header.

5. **Missing tokens — design values written as arbitrary values although the scale has them.**
   `Welcome.astro:151, :158, :260, :327, :336`.
   **User impact:** none visually; these five values are the same pixels as `py-18`,
   `pb-18`, `max-w-130`, `max-w-160`, `w-37.5`, but as arbitrary values they look like
   one-off drift to every reviewer and every future token check.

### Deferred (not in this change)

- **Signed-in visitors on `/`** — redirect to `/dashboard` vs keep the landing with "Przejdź
  do pulpitu": product decision, also tied to signin's `/reports` redirect and the smoke test.
- **`max-w-[1100px]`** — repo-wide page width (5 views); layout change.
- **`text-[44px]`, `leading-[1.1]`** — no scale equivalent; keep as Claude Design values,
  allow-listed in the token check.
- **Static preview numbers** (`:197-229`, "248 wizyt", 9/8/24, "14 z 41") — illustrative
  content from the design; wording rule applies.

## Open Questions

- Charge 1 fix shape: (a) lighter dark `--primary` with a dark `--primary-foreground`
  (shadcn's usual dark pattern: light fill, dark text) — fixes both pairs but changes how
  every dark primary button looks; (b) keep the fill, add a separate text-role token
  (e.g. `--primary-text`) used for `text-primary` on dark backgrounds — fixes text only,
  buttons stay at 4.38:1; (c) darken the dark fill — fixes buttons, worsens text. Needs the
  user's choice; it is global.
- Charge 4: wrap the nav below `md` (as in the design) or add a compact menu.
