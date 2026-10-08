# Light surface tokens Implementation Plan

## Overview

In the light theme the page background, cards and popovers are the same white, so every
`Card`-based view (Raporty, Szczegóły raportu, Pulpit) separates cards from the page only by a
border. This change gives the light page background a neutral-50 tint (`oklch(0.985 0 0)`) while
cards, popovers, the dialog and outline buttons stay white — the same "surface above page"
relationship the dark theme already has (`--card` 0.205 over `--background` 0.145).

## Current State Analysis

- `src/styles/global.css:8,10,12` — light `--background`, `--card`, `--popover` are all
  `oklch(1 0 0)`. Dark: `--background` 0.145, `--card`/`--popover` 0.205.
- Two shadcn primitives paint themselves with `bg-background`, i.e. they use the *page* colour as
  their own surface; once the page turns grey they would turn grey too:
  - `src/components/ui/button.tsx:16` — `outline` variant (`border bg-background … dark:bg-input/30`),
    11 call sites outside kitchen-sinks, several inside white cards.
  - `src/components/ui/dialog.tsx:51` — `DialogContent` (`bg-background`), the delete-report dialog.
- `src/components/Welcome.astro:288,339` — landing bands `#jak` and `#mozliwosci` are
  `bg-muted/50` on `bg-background`; `--muted` is 0.97, so at 50% over a 0.985 page the bands
  (≈0.9775) would become nearly indistinguishable from the page.
- Contrast of `--muted-foreground` (`oklch(0.556 0 0)`, hints/placeholders/descriptions):
  4.73:1 on white, 4.53:1 on 0.985, 4.34:1 on 0.97 — 0.985 is the darkest neutral step that
  keeps it ≥ 4.5 without touching other tokens.
- Form inputs (`src/components/auth/FormField.tsx:64`) are `bg-transparent` — they follow the
  surface they sit on, no change needed. Kitchen-sink frames
  (`src/pages/dev/kitchen-sink/*.astro`) wrap a `bg-background` frame in a `bg-card` section, so
  they show the new page colour without edits.
- Prior token changes record their values and measurements in a `token-source.md`
  (format: `context/archive/2026-10-07-landing-ui-contract/token-source.md`) and point to it from
  a comment next to the token in `global.css`.

## Desired End State

Light theme: page background `oklch(0.985 0 0)`; `Card`, `Alert`, popovers, `DialogContent` and
`outline` buttons render white on it; landing bands remain visibly distinct from the page. Dark
theme: pixel-identical to today except the landing bands (`bg-muted` instead of `bg-muted/50`,
accepted). Every text pair on the new background measured ≥ 4.5:1 and recorded in
`token-source.md`. Verified by before/after screenshots of all four kitchen-sinks in both themes.

### Key Discoveries:

- `src/components/ui/button.tsx:16` and `src/components/ui/dialog.tsx:51` use `bg-background` as
  a surface colour — the only shared primitives that would silently inherit the page tint.
- `src/components/ui/card.tsx:10` and `src/components/ui/alert.tsx:10,12` already use `bg-card` —
  they get the separation for free.
- `src/components/Welcome.astro:137` header is already `bg-card` — stays white over the tinted page.
- `scripts/kitchen-sink-shot.mjs <url> <width> <out.png>` is the established capture tool.

## What We're NOT Doing

- No dark-theme token changes; `outline` keeps `dark:bg-input/30`, the dialog keeps the dark page
  colour via an explicit `dark:` override.
- No change to `--muted`, `--accent`, `--secondary`, `--muted-foreground` or any other token.
- No `--warning` token for `Banner.astro`'s hex colours (separate concern, not charged here).
- No permanent automated contrast check in `scripts/check-ui-tokens.mjs` — measurement is a
  one-off, recorded in `token-source.md` (user decision).
- No change to `ring-offset-background` in `dialog.tsx` (focus-ring offset colour; visually
  negligible on a white dialog).
- No wording changes in any Claude Design view.

## Implementation Approach

Change the one token value, then re-point the two primitives that misuse the page colour as a
surface to the surface roles (`card` for the outline button, `popover` for the dialog) in the
light theme only, and restore the landing bands' contrast. Measure, record, then gate visually
across every kitchen-sink in both themes.

## Phase 1: Tokens and surfaces

### Overview

Tint the light page background and keep every surface above it white.

### Changes Required:

#### 1. Light page background

**File**: `src/styles/global.css`

**Intent**: Set light `--background` to neutral-50 so cards separate from the page; add a comment
pointing at the archived `token-source.md` like the existing `--primary` comment.

**Contract**: `:root { --background: oklch(0.985 0 0); }`; `--card`, `--popover` stay `oklch(1 0 0)`;
`.dark` block untouched.

#### 2. Outline button surface

**File**: `src/components/ui/button.tsx`

**Intent**: The outline button is a surface on whatever it sits on; in light it must stay white
inside cards rather than adopt the page tint.

**Contract**: `outline` variant `bg-background` → `bg-card`; all `dark:` classes unchanged.

#### 3. Dialog surface

**File**: `src/components/ui/dialog.tsx`

**Intent**: The dialog is an overlay surface — white in light; keep the current dark look.

**Contract**: `DialogContent` `bg-background` → `bg-popover dark:bg-background` (dark stays 0.145).

#### 4. Landing bands

**File**: `src/components/Welcome.astro`

**Intent**: Keep the band rhythm of the Claude Design landing visible on the tinted page.

**Contract**: `#jak` (`:288`) and `#mozliwosci` (`:339`) `bg-muted/50` → `bg-muted`. Other
`bg-muted/50` boxes inside cards (`:256`, `:329`) unchanged. No wording changes.

#### 5. Token source record

**File**: `context/changes/light-surface-tokens/token-source.md`

**Intent**: Record before/after values and contrast measurements, following the landing-ui-contract
format and method (oklch → linear sRGB → WCAG luminance), computed by a one-off Node script that
reads the values from `global.css`.

**Contract**: Sections Values / Contrast (light) / Affected surfaces. Contrast table covers at least
`--foreground`, `--muted-foreground`, `text-primary`, `text-destructive`, `text-success` on the new
`--background`, plus `--card` vs `--background` (informational, no threshold). Threshold 4.5 for
text pairs.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build passes: `npm run build`
- UI token guard passes: `npm run check:ui-tokens`
- One-off contrast script reports every text pair on the new `--background` ≥ 4.5:1 (results in `token-source.md`)

#### Manual Verification:

- `/reports` in light: cards visibly white on a light-grey page; outline buttons inside cards are white
- Delete dialog (`/dev/kitchen-sink/reports-list?dialog=1`) is white in light and unchanged in dark

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Visual gate and rule

### Overview

Prove the light change across every view and that dark is unchanged (except landing bands); leave a
rule so future views keep the surface roles.

### Changes Required:

#### 1. Screenshots

**File**: `context/changes/light-surface-tokens/screenshots/`

**Intent**: Before (from the commit preceding Phase 1) and after captures of
`/dev/kitchen-sink/{reports-list,report-details,dashboard,landing}` in light and dark, at desktop
width plus 390px for landing (`?compact=1`), via `scripts/kitchen-sink-shot.mjs`.

**Contract**: File names `<view>-<theme>-<before|after>[-390].png`.

#### 2. Surface roles rule

**File**: `CLAUDE.md`

**Intent**: Record that `--background` is the page only; any component that is a surface on top of
the page (cards, panels, dialogs, outline controls) uses `bg-card` / `bg-popover`, never
`bg-background`, and point at this change's archived `token-source.md`.

**Contract**: One bullet under "Key conventions" next to "Design tokens over literals".

### Success Criteria:

#### Automated Verification:

- Screenshots exist for all four kitchen-sinks, light and dark, before and after
- `npm run check:ui-tokens` still passes

#### Manual Verification:

- Light after-shots: every card, alert, dialog and outline button is white on the tinted page in all four views
- Dark before/after pairs are identical except the landing bands
- Landing bands remain distinct from the page in light (desktop and 390px)

---

## Testing Strategy

### Manual Testing Steps:

1. `npm run dev`, open `/reports`, `/reports/<id>`, `/dashboard` (Pulpit) and `/` in light — cards white on grey.
2. Open the delete dialog on `/reports` — dialog white, outline "Anuluj" button white.
3. Toggle dark — compare with before-screenshots.
4. Auth pages (`/auth/signin`) — form fields still readable on the tinted page.

## References

- Token-source format: `context/archive/2026-10-07-landing-ui-contract/token-source.md`
- Dashboard surface contract: `context/archive/2026-10-07-dashboard-ui-tokens/token-source.md`
- Capture tool: `scripts/kitchen-sink-shot.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tokens and surfaces

#### Automated

- [x] 1.1 Lint passes: `npm run lint`
- [x] 1.2 Type check passes: `npx astro check`
- [x] 1.3 Build passes: `npm run build`
- [x] 1.4 UI token guard passes: `npm run check:ui-tokens`
- [x] 1.5 One-off contrast script reports every text pair on the new `--background` ≥ 4.5:1 (results in `token-source.md`)

#### Manual

- [x] 1.6 `/reports` in light: cards visibly white on a light-grey page; outline buttons inside cards are white
- [x] 1.7 Delete dialog (`/dev/kitchen-sink/reports-list?dialog=1`) is white in light and unchanged in dark

### Phase 2: Visual gate and rule

#### Automated

- [ ] 2.1 Screenshots exist for all four kitchen-sinks, light and dark, before and after
- [ ] 2.2 `npm run check:ui-tokens` still passes

#### Manual

- [ ] 2.3 Light after-shots: every card, alert, dialog and outline button is white on the tinted page in all four views
- [ ] 2.4 Dark before/after pairs are identical except the landing bands
- [ ] 2.5 Landing bands remain distinct from the page in light (desktop and 390px)
