# Landing page design-system contract Implementation Plan

## Overview

Put the landing page (`src/components/Welcome.astro`, rendered by `src/pages/index.astro`) on
the design-system contract — shared `Card`, token focus ring on every link, the section
navigation visible on phones as in the Claude Design file, scale values instead of arbitrary
ones — and fix the global dark-mode `--primary` pair so text on and in the brand colour
reaches 4.5:1. The page's wording stays word for word (CLAUDE.md:177).

## Current State Analysis

From `context/changes/landing-ui-contract/research.md` (2026-10-07, commit `a384e67`):

- 0 colour literals / palette classes; 58 token-class uses; every button-styled link uses
  `buttonVariants`.
- Dark `--primary` (indigo-500, `global.css:55`) with white `--primary-foreground` (`:56`):
  `text-primary` on `--background` 4.32:1, white on `--primary` 4.38:1 — below 4.5:1 for small
  text (eyebrow `Welcome.astro:154`, footer link `:357`, CTA paragraph `:340`, every `default`
  button label `button.tsx:12`). Light theme 6.44 / 6.17.
- 4 hand-built cards (`:191` preview `rounded-xl p-5 shadow-lg`, `:244` steps `rounded-lg p-5`,
  `:267` rules `rounded-lg p-6`, `:323` columns `rounded-lg`, rows `px-4 py-3`).
- Links without token focus ring: `:118` logo, `:124` section anchors, `:357` footer link
  (base `outline-ring/50` only, `global.css:131`).
- Section nav `:122` is `hidden md:flex`; the design renders it in a wrapping header at every width.
- Arbitrary values with exact v4 scale equivalents: `py-[72px]` (`:151`), `pb-[72px]` (`:336`),
  `max-w-[520px]` (`:158`), `max-w-[640px]` (`:260`), `w-[150px]` (`:327`). No equivalent:
  `text-[44px]`, `leading-[1.1]` (`:155`). Repo-wide: `max-w-[1100px]`.
- No kitchen sink; `check:ui-tokens` does not scan `Welcome.astro`.

## Desired End State

- Dark theme: `--primary` = `oklch(67.3% 0.182 276.935)` (indigo-400), `--primary-foreground`
  = `oklch(0.205 0 0)`; light theme unchanged. Measured: `text-primary` on background 6.34:1,
  button label on primary 5.74:1, GPS series vs card 5.74:1.
- The four landing containers are `Card` with explicit overrides reproducing the design's
  radius/padding/shadow; the preview keeps its `<figure>` semantics.
- Logo, section links and footer link show the token focus ring.
- The section nav is visible below `md` and wraps inside the header.
- The five scale-equivalent values use `py-18`, `pb-18`, `max-w-130`, `max-w-160`, `w-37.5`.
- `/dev/kitchen-sink/landing` renders the landing logged out and logged in, light and dark,
  with screenshots at 1280 and 390 in the change folder.
- `check:ui-tokens` scans `Welcome.astro`; CLAUDE.md notes the landing contract and the 4.5:1
  rule for text on/in `--primary`.

Verify: `npx astro check`, `npm run lint`, `npm run check:ui-tokens`, kitchen-sink
screenshots, manual pass in both themes.

### Key Discoveries:

- Every surface that puts text on `--primary` uses the token: `button.tsx:12`,
  `Welcome.astro:245` (step numbers), `:337` (CTA band), `src/layouts/AuthLayout.astro:17-18`
  (auth brand panel). The destructive button's `text-white` sits on red and is unaffected.
- `--rule-gps` is `var(--primary)` (`global.css:34, :74`); the dashboard series changes with
  it (dark 3.91 → 5.74:1 vs card, still hue-stable).
- `Welcome.astro` reads `Astro.locals.user`; a kitchen sink needs an override prop to render
  the signed-in variant.
- Precedent for keeping design dimensions on `Card`:
  `context/archive/2026-10-07-reports-list-ui-contract/` (ErrorCard `rounded-lg p-5 shadow-none`).

## What We're NOT Doing

- No change to the page's wording, sections or the static preview numbers.
- No redirect of signed-in visitors away from `/` (product decision; signin → `/reports`).
- No change to `max-w-[1100px]`, `text-[44px]`, `leading-[1.1]` (allow-listed as design values).
- No light-theme token change; no new tokens; no change to `--ring`.
- No migration of other views; no CI wiring.

## Implementation Approach

`/10x-ui` order: token values → view → gate → guard. The token change is global, so it goes
first and is checked on every surface that uses it before the view work.

## Critical Implementation Details

- **Dark foreground direction flips.** With the lighter dark `--primary`, text on it must be
  dark (`oklch(0.205 0 0)`, 5.74:1); white would drop to 2.99:1. Change both values together.
- **`Card` is a `div`.** Keep the preview's `<figure aria-label="Podgląd aplikacji">` as the
  outer element and put `Card` inside it (or the figure styles on `Card` via a wrapper) — do
  not lose the figure semantics.

## Phase 1: Dark primary token values

### Overview

Raise the dark `--primary` pair to ≥ 4.5:1 for small text in both directions.

### Changes Required:

#### 1. Token values

**File**: `src/styles/global.css`

**Intent**: Fix text-on-primary and primary-as-text contrast in the dark theme with one pair.

**Contract**: `.dark` `--primary: oklch(67.3% 0.182 276.935)` (Tailwind indigo-400,
`node_modules/tailwindcss/theme.css:146`), `--primary-foreground: oklch(0.205 0 0)`; update the
existing comment to point at `context/changes/landing-ui-contract/token-source.md`. `:root`
untouched.

#### 2. Token source record

**File**: `context/changes/landing-ui-contract/token-source.md` (new)

**Intent**: Record old/new values, contrast before/after, method, rejected options and every
affected surface.

**Contract**: Table with: `text-primary` on background (4.32 → 6.34), foreground on primary
(4.38 → 5.74), GPS series vs card (3.91 → 5.74); affected surfaces `button.tsx:12`,
`Welcome.astro:245, :337`, `AuthLayout.astro:17-18`, `--rule-gps`; rejected: separate
`--primary-text` token (buttons stay 4.38), darker fill (text worse), white foreground on
indigo-400 (2.99).

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- A Node one-off contrast run on the new `.dark` values reports ≥ 4.5 for `text-primary` on `--background` and `--primary-foreground` on `--primary`, and ≥ 3 for `--rule-gps` vs `--card`

#### Manual Verification:

- In dark mode a primary button (e.g. "Wgraj raport"), the dashboard GPS series and the auth brand panel read clearly; light mode looks unchanged

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Landing view on the contract

### Overview

Cards, focus ring, visible section nav on phones and scale values — with identical wording.

### Changes Required:

#### 1. Cards

**File**: `src/components/Welcome.astro`

**Intent**: Use the shared `Card` for the four containers while keeping the design's look.

**Contract**: `:191` preview → `<figure aria-label="Podgląd aplikacji">` containing a `Card`
with `rounded-xl p-5 gap-4 shadow-lg` overrides; `:244` steps → `Card` `rounded-lg p-5 gap-3
shadow-none`; `:267` rules → `Card` `rounded-lg p-6 gap-4 shadow-none`; `:323` columns → `Card`
`rounded-lg p-0 gap-0 shadow-none` keeping the inner rows. Overrides merged by `cn` inside `Card`.

#### 2. Focus ring

**File**: `src/components/Welcome.astro`

**Intent**: Same keyboard focus treatment as the buttons next to them.

**Contract**: `:118`, `:124` (`navLink`), `:357` get `rounded-sm outline-none
focus-visible:ring-[3px] focus-visible:ring-ring/50`.

#### 3. Section nav on phones

**File**: `src/components/Welcome.astro`

**Intent**: Keep the four section links available at every width, as in the design.

**Contract**: remove `hidden md:flex` from `:122`; the nav wraps (`flex flex-wrap`), and below
`md` takes its own full-width row in the header (`order-last w-full md:order-none md:w-auto`
or equivalent); the header must not overflow at 390px.

#### 4. Scale values

**File**: `src/components/Welcome.astro`

**Intent**: Same pixels without arbitrary values.

**Contract**: `md:py-[72px]` → `md:py-18`, `pb-[72px]` → `pb-18`, `max-w-[520px]` → `max-w-130`,
`max-w-[640px]` → `max-w-160`, `w-[150px]` → `w-37.5`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `grep -nE "rounded-(lg|xl) border" src/components/Welcome.astro` returns nothing
- `grep -noE '[a-z-]+-\[[^] ]+\]' src/components/Welcome.astro` lists only `max-w-[1100px]`, `leading-[1.1]`, `text-[44px]` and `ring-[3px]`
- `grep -c "hidden md:flex" src/components/Welcome.astro` returns 0
- The visible text of `/` (tags stripped) is identical before and after the phase for a logged-out visitor

#### Manual Verification:

- `/` looks the same as before on desktop in both themes (cards, spacing, headline)
- At 390px the section links are visible in the header and the page does not scroll horizontally
- Tab through the header and footer: logo, section links and "Zaloguj się" show the ring

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Kitchen sink and visual gate

### Overview

Render the landing in every relevant state from the real component and capture it.

### Changes Required:

#### 1. Dev-only user override

**File**: `src/components/Welcome.astro`

**Intent**: Let the kitchen sink render the signed-in variant without a session.

**Contract**: optional prop `user?: { email: string } | null`; when the prop is passed
(including `null`) it replaces `Astro.locals.user`; absent → current behaviour.

#### 2. Kitchen sink

**File**: `src/pages/dev/kitchen-sink/landing.astro` (new)

**Intent**: Both visitor variants in both themes, plus the matrix cells that apply.

**Contract**: frames as in `dashboard.astro` (light + `<div class="dark">`, page-width below
`sm`): default logged out, default logged in; hover note + forced samples (nav link, footer
link, buttons); focus-visible forced ring samples (logo, nav link, footer link, button);
disabled / error / empty / loading as **N/A** with reasons (static marketing page: no disabled
controls, no data, no requests). Note in the page that the sticky header is sticky inside
each frame.

#### 3. Screenshots

**Files**: `context/changes/landing-ui-contract/screenshots/`

**Intent**: Evidence and baseline.

**Contract**: `node scripts/kitchen-sink-shot.mjs` → `kitchen-sink-desktop.png` (1280),
`kitchen-sink-390.png` (390); plus `landing-390.png` of `/` itself to prove the wrapping nav
with `sw` = 390.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `/dev/kitchen-sink/landing` returns HTTP 200
- The three screenshots exist and the 390 runs report `sw` = 390

#### Manual Verification:

- The screenshots show logged-out and logged-in variants in light and dark, and the N/A cells with their reasons

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Guard

### Overview

Keep the landing and the brand-colour contrast on the contract.

### Changes Required:

#### 1. Token check scope

**File**: `scripts/check-ui-tokens.mjs`

**Intent**: Fail fast on literals in the landing.

**Contract**: add `src/components/Welcome.astro`; allow-list `text-[44px]` and `leading-[1.1]`
with a comment "Claude Design landing headline"; tints `bg-muted/50` are not `primary/NN` and
need no entry; `bg-primary/10` on the landing gets a file-scoped tint entry if present.

#### 2. Agent rule

**File**: `CLAUDE.md` (next to the UI bullets, outside the CLI block)

**Intent**: Tell the next agent about the landing kitchen sink and the brand-colour contrast rule.

**Contract**: one bullet: landing kitchen sink path and `user` override prop; text on or in
`--primary` must stay ≥ 4.5:1 in both themes (values and measurements in
`context/changes/landing-ui-contract/token-source.md`); dark theme pairs a light `--primary`
with a dark `--primary-foreground`.

### Success Criteria:

#### Automated Verification:

- `npm run check:ui-tokens` exits 0 and lists `src/components/Welcome.astro`
- `npm run check:ui-tokens` exits non-zero when `text-indigo-600` is temporarily added to `Welcome.astro` (revert after)
- Lint passes: `npm run lint`

#### Manual Verification:

- The CLAUDE.md bullet reads correctly and points at files that exist

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None (no test framework). Contrast checked by a Node one-off in Phase 1; visible text
  compared before/after in Phase 2.

### Integration Tests:

- None; kitchen sink renders from the real component with a dev-only prop.

### Manual Testing Steps:

1. Dark mode: a primary button, the auth brand panel (`/auth/signin`), the dashboard GPS series.
2. `/` logged out and logged in, light and dark, desktop and 390px.
3. Tab through header and footer.

## Performance Considerations

None.

## Migration Notes

Visible change limited to dark mode: primary fills become lighter with dark text on them.

## References

- Research: `context/changes/landing-ui-contract/research.md`
- Prior token decisions: `context/archive/2026-10-06-reports-list-ui-tokens/token-source.md`, `context/archive/2026-10-07-dashboard-ui-tokens/token-source.md`
- Card-with-design-dimensions precedent: `context/archive/2026-10-07-reports-list-ui-contract/`
- Wording rule: `CLAUDE.md:177`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dark primary token values

#### Automated

- [x] 1.1 Type check passes: `npx astro check` — cd97e5c
- [x] 1.2 Lint passes: `npm run lint` — cd97e5c
- [x] 1.3 A Node one-off contrast run on the new `.dark` values reports ≥ 4.5 for `text-primary` on `--background` and `--primary-foreground` on `--primary`, and ≥ 3 for `--rule-gps` vs `--card` — cd97e5c

#### Manual

- [x] 1.4 In dark mode a primary button (e.g. "Wgraj raport"), the dashboard GPS series and the auth brand panel read clearly; light mode looks unchanged — cd97e5c

### Phase 2: Landing view on the contract

#### Automated

- [x] 2.1 Type check passes: `npx astro check` — 7eaf7f2
- [x] 2.2 Lint passes: `npm run lint` — 7eaf7f2
- [x] 2.3 `grep -nE "rounded-(lg|xl) border" src/components/Welcome.astro` returns nothing — 7eaf7f2
- [x] 2.4 `grep -noE '[a-z-]+-\[[^] ]+\]' src/components/Welcome.astro` lists only `max-w-[1100px]`, `leading-[1.1]`, `text-[44px]` and `ring-[3px]` — 7eaf7f2
- [x] 2.5 `grep -c "hidden md:flex" src/components/Welcome.astro` returns 0 — 7eaf7f2
- [x] 2.6 The visible text of `/` (tags stripped) is identical before and after the phase for a logged-out visitor — 7eaf7f2

#### Manual

- [x] 2.7 `/` looks the same as before on desktop in both themes (cards, spacing, headline) — 7eaf7f2
- [x] 2.8 At 390px the section links are visible in the header and the page does not scroll horizontally — 7eaf7f2
- [x] 2.9 Tab through the header and footer: logo, section links and "Zaloguj się" show the ring — 7eaf7f2

### Phase 3: Kitchen sink and visual gate

#### Automated

- [x] 3.1 Type check passes: `npx astro check`
- [x] 3.2 Lint passes: `npm run lint`
- [x] 3.3 `/dev/kitchen-sink/landing` returns HTTP 200
- [x] 3.4 The three screenshots exist and the 390 runs report `sw` = 390

#### Manual

- [x] 3.5 The screenshots show logged-out and logged-in variants in light and dark, and the N/A cells with their reasons

### Phase 4: Guard

#### Automated

- [ ] 4.1 `npm run check:ui-tokens` exits 0 and lists `src/components/Welcome.astro`
- [ ] 4.2 `npm run check:ui-tokens` exits non-zero when `text-indigo-600` is temporarily added to `Welcome.astro` (revert after)
- [ ] 4.3 Lint passes: `npm run lint`

#### Manual

- [ ] 4.4 The CLAUDE.md bullet reads correctly and points at files that exist
