# Align reports list view with existing shadcn/Tailwind design tokens — Implementation Plan

## Overview

`src/pages/reports/index.astro` (the post-login reports list/upload view) and the
components it renders (`ReportsList.tsx`, `Topbar.astro`, `Banner.astro`) use
literal Tailwind palette classes (`slate-*`, `indigo-*`) and raw hex instead of the
semantic shadcn/Tailwind tokens already defined in `src/styles/global.css` and
already correctly consumed by `src/components/ui/{button,dialog,table}.tsx`. This
plan brings the view and its chrome onto that existing contract — no new tokens,
no new dependencies, no dark-mode toggle.

## Current State Analysis

- Token source (`src/styles/global.css:6-120`) defines a complete `:root`/`.dark`
  token set published via `@theme inline`; `body` already defaults to
  `bg-background text-foreground` (`global.css:117-119`).
- `src/components/ui/button.tsx` is the correct reference implementation
  (`bg-primary`, `bg-destructive`, `focus-visible:ring-ring/50`) — proof the
  contract works, just unread by this view.
- Across `src/pages`/`src/components`/`src/layouts`, only 4 files reference any
  token class at all (the 3 `ui/*` primitives + `DeviationsList.tsx`); 15 files,
  including every file this plan touches, use literal palette classes instead
  (`context/changes/reports-list-ui-tokens/research.md`, "Repo-wide token
  adoption").
- No `.dark` class is ever applied anywhere in `src/` — dark mode is latent
  infrastructure, not a reachable state today.
- `AGENTS.md`/`CLAUDE.md` contain no rule that encourages literal values; the
  drift is from absence of a token-usage rule, not an active bad one.
- `Topbar.astro` is also rendered by `Welcome.astro` (homepage) and
  `reports/[id].astro`; `Banner.astro` is rendered via `Layout.astro`. Fixing
  these two shared components changes those screens too (confirmed acceptable
  with the user).

### Key Discoveries:

- `src/pages/reports/index.astro:58` — the page's only submit button is a literal
  `<button>`, not the already-imported-nearby `<Button>` (`ReportsList.tsx:4`).
- `src/components/reports/ReportsList.tsx:53-73` — in the same table row, the
  "Zobacz raport" link (literal indigo) sits beside "Usuń raport"
  (`<Button variant="destructive">`, token-driven) — the clearest single piece of
  evidence for the inconsistency.
- `src/middleware.ts:4` — `PROTECTED_ROUTES` only matches `/reports`,
  `/api/reports`, `/api/deviations`; a route under `/dev/` is unprotected and safe
  for a kitchen-sink page.

## Desired End State

`reports/index.astro`, `ReportsList.tsx`, `Topbar.astro`, and `Banner.astro`
reference only semantic tokens (`bg-primary`, `text-muted-foreground`,
`border-border`, `bg-card`, `bg-destructive`/equivalents) and the existing
`<Button>` component — no `slate-*`/`indigo-*` literals, no raw hex. A kitchen-sink
page shows all 7 states for this view's key controls. `CLAUDE.md` carries a rule
telling future agents where the tokens/components live.

**Verification:** the hardcoded-value scan from `research.md` run against the same
5 files returns 0 matches (previously 29); the kitchen-sink page renders all 7
states; `npm run lint` and `npm run build` pass.

## What We're NOT Doing

- Not adding a dark-mode toggle or any `.dark`-class activation mechanism — token
  readiness only (per user decision).
- Not inventing a brand-new token slot for the brand color — `--primary` already
  exists and was simply unset (`components.json` ships `baseColor: "neutral"`,
  never customized after the "Kontrola Trasówek" rebrand). Promoting the
  pre-existing `indigo-600` literal into that existing slot (Phase 1, added
  mid-implementation per user decision after manual verification showed Topbar
  icons losing their color) is in scope; inventing an unrelated new slot (like
  the `warning` banner variant below) remains out of scope.
- Not introducing a new shadcn component (e.g. `Input`) for the file picker —
  the file input keeps its native element, only its `file:` pseudo-class colors
  move to tokens.
- Not touching `DeviationsList.tsx`, `reports/[id].astro`'s own literals, or any
  other view beyond what `Topbar.astro`/`Banner.astro` cascade into — those are
  separate `/10x-ui` changes.
- Not installing a screenshot-testing framework (Playwright etc.) — the kitchen
  sink is screenshotted manually per the repo's "no test framework" convention
  (`CLAUDE.md` "Key conventions").
- Not changing `Banner.astro`'s variant API (`info`/`warning`/`error`) or any
  component prop signature — only internal class/style implementation.

## Implementation Approach

Work bottom-up: fix the shared chrome components first (Phase 1) so their
token-correct versions are in place before the page that composes them is edited
(Phase 2), then build the 7-state kitchen sink against the now-token-correct view
(Phase 3), then leave the guard rule (Phase 4). Each phase ends with a re-run of
the hardcoded-value scan to show the count dropping.

## Phase 1: Shared chrome — Topbar.astro + Banner.astro

### Overview

Move `Topbar.astro`'s and `Banner.astro`'s internal styling onto tokens. Both are
rendered by other pages (`Welcome.astro`, `reports/[id].astro`, `Layout.astro`
slot consumers); this phase's effect is visible there too, by design.

### Changes Required:

#### 1. Topbar.astro

**File**: `src/components/Topbar.astro`

**Intent**: Replace the literal surface/text/link colors with their token
equivalents so the nav bar matches the rest of the token-driven UI and its
hover/focus affordances come from the same `--ring`/`--accent` system as
`<Button>`.

**Contract**: `border-slate-200 bg-white` → `border-border bg-card`;
`text-slate-500` (email / "Niezalogowany") → `text-muted-foreground`; the five
`text-indigo-600 ... hover:bg-indigo-50 hover:text-indigo-700` nav/action links
(lines 16, 24, 33, 46, 52) → a token-driven treatment consistent with
`buttonVariants({ variant: "ghost" })` from `src/components/ui/button.tsx:18`
(`hover:bg-accent hover:text-accent-foreground`), applied as plain classes since
these stay native `<a>`/`<button>` elements, not `<Button>` instances (no
behavior change needed, just color).

#### 2. Primary brand color (added mid-implementation)

**File**: `src/styles/global.css`

**Intent**: Manual verification of this phase's Topbar edit showed nav icons
rendering black instead of the app's brand color — `--primary` is Tailwind's
default `neutral` (`baseColor: "neutral"` in `components.json`, never
customized), i.e. fully achromatic, so every `bg-primary`/`text-primary` site
(including the `<Button>` default variant Phase 2 will route the CTA through)
loses the brand color the moment literals are replaced with tokens. The
`indigo-600` literal scattered through the pre-token codebase was the de facto
brand color; this promotes it into the token slot that already exists for
exactly this purpose, instead of leaving it undefined or reinventing a
second color system.

**Contract**: In `:root`, set `--primary: oklch(51.1% 0.262 276.966);` (Tailwind
`indigo-600`, source: `node_modules/tailwindcss/theme.css:148`) and keep
`--primary-foreground` as the existing near-white value. In `.dark`, set
`--primary: oklch(58.5% 0.233 277.117);` (Tailwind `indigo-500`, lighter for a
dark background, source: `theme.css:147`) and `--primary-foreground:
oklch(0.985 0 0);` (white text — overriding the current dark `--primary-foreground:
oklch(0.205 0 0)`, which assumed a light/near-white primary and would be
unreadable dark-on-indigo). No other token changes (`--ring`, `--accent`, etc.
stay neutral — only the brand/CTA color is promoted). Add a one-line comment
above the `:root` block naming the source
(`context/changes/reports-list-ui-tokens/token-source.md`).

#### 3. Banner.astro

**File**: `src/components/Banner.astro`

**Intent**: Replace the three variants' raw hex with token-driven colors so the
component sits inside the Tailwind/token pipeline like every other surface, and
is dark-mode-ready without a toggle actually existing yet.

**Contract**: Convert the `<style>` block's hardcoded hex per variant to Tailwind
utility classes on the root `div` (via `class:list`) using the nearest matching
tokens: `error` → `bg-destructive/10 text-destructive border-destructive`; `info`
→ `bg-accent text-accent-foreground border-border` (no dedicated "info" token
exists — reuse `accent`, the closest semantic neutral-highlight token); `warning`
has no dedicated token either — keep a scoped literal only for this one variant
in the `<style>` block (documented inline as "no `warning` token exists yet") since
inventing a new token value is out of this change's scope (one view, no new
token values per `/10x-ui`'s "fresh starter with a dead token file" guidance).
Remove the now-unused hex rules for `info`/`error`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- Hardcoded-value scan on `src/components/Topbar.astro` and
  `src/components/Banner.astro` returns 0 matches for the palette-class/hex part
  of the pattern (the deliberate `warning` literal is excluded by name in the
  check, documented in the scan note)

#### Manual Verification:

- `Welcome.astro` (homepage) and `reports/[id].astro` Topbar render visually
  consistent with `reports/index.astro`'s Topbar (same hover/focus affordance)
- `Banner.astro`'s `info`/`error` variants render with visibly different, correct
  colors (not both defaulting to the same token by mistake)
- Topbar nav icons (Home, Raporty, Wyloguj) render in the brand indigo color on
  default state, not black

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human that the
manual testing was successful before proceeding to the next phase.

---

## Phase 2: reports/index.astro + ReportsList.tsx

### Overview

Fix the page root, the upload form, and the list's empty-state/view-link so the
audited view itself is fully token-driven.

### Changes Required:

#### 1. Page root and cards

**File**: `src/pages/reports/index.astro`

**Intent**: Stop overriding the already-token-driven `body` default and the card
surfaces with literals.

**Contract**: `min-h-screen bg-slate-50 p-4` (line 40) → `min-h-screen p-4` (drop
the literal background entirely; `body`'s `bg-background` already applies).
`border-slate-200 bg-white` (lines 44, 65) → `border-border bg-card`.
`text-slate-900` headings (lines 45, 66) → drop the literal (text already
inherits `text-foreground` from `body`) or use `text-card-foreground` if a
distinct card-text token is preferred for contrast — keep whichever one
`Topbar.astro`'s Phase 1 edit settled on for consistency within the same page.

#### 2. Upload form (file input + submit button)

**File**: `src/pages/reports/index.astro`

**Intent**: The only primary call-to-action on the page should be the real
`<Button>` component, not a hand-styled `<button>`, so it inherits the token-driven
`focus-visible` ring and disabled handling every other button in the app has.

**Contract**: Import `Button` from `@/components/ui/button` (already the pattern
in `ReportsList.tsx:4`). Replace the literal submit `<button>` (line 56-61) with
`<Button type="submit" className="w-full">Wgraj</Button>` — no client directive
needed (no interactivity beyond native form submit). Keep the native
`<input type="file">` (no new `Input` component per "What We're NOT Doing") but
replace its `file:bg-indigo-600 ... hover:file:bg-indigo-500` with
`file:bg-primary ... hover:file:bg-primary/90` to match `buttonVariants`'s
`default` variant color.

#### 3. Pagination links

**File**: `src/pages/reports/index.astro`

**Intent**: Pagination links should use the token for interactive text instead of
a literal indigo.

**Contract**: `text-indigo-600 hover:underline` (lines 71, 78) → `text-primary
hover:underline`.

#### 4. ReportsList.tsx

**File**: `src/components/reports/ReportsList.tsx`

**Intent**: Empty-state text and the "Zobacz raport" link should match the
token system already used one line away by the "Usuń raport" `<Button>`.

**Contract**: `text-sm text-slate-500` (line 31) → `text-sm text-muted-foreground`.
The "Zobacz raport" `<a>` (lines 53-60): `text-indigo-600 hover:bg-indigo-50` →
the same ghost-link treatment settled in Phase 1 for `Topbar.astro`'s links
(`text-primary hover:bg-accent hover:text-accent-foreground`), so the two actions
in this row share one visual language even though only one of them is a real
`<Button>`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- Hardcoded-value scan on `src/pages/reports/index.astro` and
  `src/components/reports/ReportsList.tsx` returns 0 matches

#### Manual Verification:

- Upload form's submit button shows a visible focus ring on Tab, matching other
  `<Button>` instances in the app
- "Zobacz raport" and "Usuń raport" in the same table row now read as one
  coherent action group, not two color systems
- Page background no longer shows a visible seam between the literal
  `bg-slate-50` and token `bg-background` (there should be no seam at all post-fix)

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human that the
manual testing was successful before proceeding to the next phase.

---

## Phase 3: 7-state matrix + visual gate

### Overview

Build a dev-only kitchen-sink page rendering the upload card and the reports
table in all 7 states (default, hover, focus-visible, disabled, error, empty,
loading), screenshot it at desktop and one mobile width, and re-run the
hardcoded-value scan across all 5 touched files as the final regression check.

### Changes Required:

#### 1. Kitchen-sink page

**File**: `src/pages/dev/kitchen-sink/reports-list.astro` (new)

**Intent**: A single page an implementer or reviewer can open to see every state
of the upload card and the reports table side by side, without needing real
Supabase data or a running upload.

**Contract**: Renders, stacked vertically with a heading per state:
- **default** — `ReportsList` with 2-3 fabricated `Tables<"reports">` rows.
- **hover** — same as default; hover is demonstrated via a caption noting which
  classes change (`hover:bg-primary/90` etc.), since static HTML can't hold a
  `:hover` state for a screenshot tool without JS — acceptable for a manual
  screenshot gate.
- **focus-visible** — a row with the "Zobacz raport" link/`Button` given
  `autofocus` (or a visible `:focus-visible` style note) to prove the ring token
  renders.
- **disabled** — submit `<Button disabled>`.
- **error** — `<Banner variant="error">` with sample text, matching
  `index.astro:47`'s usage.
- **empty** — `ReportsList` with `reports={[]}` (exercises the
  `text-muted-foreground` empty-state line from Phase 2).
- **loading** — a static skeleton row (e.g. `animate-pulse` placeholder matching
  the table's column widths) since no existing loading state exists yet for this
  view; add the minimal skeleton markup needed to show it, not a new loading
  mechanism.

Route sits outside `PROTECTED_ROUTES` (`src/middleware.ts:4` only matches
`/reports`, `/api/reports`, `/api/deviations`) so it needs no auth to view locally.

### Success Criteria:

#### Automated Verification:

- `npm run build` succeeds with the new route included
- Hardcoded-value scan on all 5 touched files
  (`src/pages/reports/index.astro`, `src/components/reports/ReportsList.tsx`,
  `src/components/Topbar.astro`, `src/components/Banner.astro`, plus the new
  kitchen-sink page) returns 0 matches outside the documented `warning`-variant
  exception from Phase 1

#### Manual Verification:

- All 7 states are visible on `/dev/kitchen-sink/reports-list` without errors
- Screenshots taken at a desktop width and one mobile width (e.g. 1280px and
  390px) show no layout jump between states and no state rendering identically
  to another by mistake (e.g. disabled must look visibly different from default)

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human that the
manual testing was successful before proceeding to the next phase.

---

## Phase 4: Make it stick

### Overview

Leave a rule in the repo's agent-rules file so the next agent touching this view
(or any other) reaches for tokens and existing components by default, closing the
gap research.md identified (no rule currently exists, good or bad).

### Changes Required:

#### 1. CLAUDE.md UI rule

**File**: `CLAUDE.md`

**Intent**: Document the token/component contract and point at the kitchen sink,
outside the toolkit-managed block.

**Contract**: Add a new bullet (or short subsection) to "Key conventions"
(`CLAUDE.md:143-156`, after the existing shadcn/ui bullet, line 148) — this
section is outside the `<!-- BEGIN/END @przeprogramowani/10x-cli -->` block
(lines 1-89), so it's safe to edit by hand. Content: tokens live in
`src/styles/global.css` (`@theme inline`); shared components live in
`src/components/ui/`; check that directory before building a one-off control,
add missing primitives via `npx shadcn@latest add [name]`; no literal Tailwind
palette colors (`slate-*`, `indigo-*`, etc.) or raw hex in views — reference a
token by role; see `src/pages/dev/kitchen-sink/reports-list.astro` for the
7-state reference render of the reports list.

### Success Criteria:

#### Automated Verification:

- `CLAUDE.md` still parses as valid markdown (no automated tooling beyond a
  visual diff; none configured in this repo)

#### Manual Verification:

- The new rule reads clearly inside "Key conventions" and does not duplicate or
  contradict the existing `cn()`/shadcn bullets
- The rule sits outside the `<!-- BEGIN/END @przeprogramowani/10x-cli -->` markers

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human that the
manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Not applicable — no test framework is configured in this repo
  (`CLAUDE.md` "Key conventions"); this is a styling-only change with no new
  business logic.

### Manual Testing Steps:

1. Run `npm run dev`, visit `/reports` while logged in, confirm the upload card,
   table, and pagination render with token colors (no literal indigo/slate
   visible against a visual diff from the "before" screenshot).
2. Visit `/` (Welcome.astro) and `/reports/<id>` to confirm `Topbar`/`Banner`
   changes cascaded correctly and didn't regress those pages.
3. Visit `/dev/kitchen-sink/reports-list`, tab through controls to confirm
   `focus-visible` rings appear, and screenshot at desktop + one mobile width.
4. Re-run the hardcoded-value scan from `research.md` against the 5 touched
   files and confirm the count dropped from 29 to 0 (minus the documented
   `warning`-variant exception).

## Performance Considerations

None — this is a class-name-only change with no new client-side JS beyond the
existing `<Button>`/`<Dialog>` islands already present.

## Migration Notes

Not applicable — no data or schema changes.

## References

- Related research: `context/changes/reports-list-ui-tokens/research.md`
- Token-correct reference implementation: `src/components/ui/button.tsx:7-33`
- Dialog/Table already-correct usage: `src/components/ui/dialog.tsx`,
  `src/components/ui/table.tsx`, consumed by `src/components/reports/ReportsList.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Shared chrome — Topbar.astro + Banner.astro

#### Automated

- [x] 1.1 `npm run lint` passes — 24f1307
- [x] 1.2 `npm run build` passes — 24f1307
- [x] 1.3 Hardcoded-value scan on Topbar.astro/Banner.astro returns 0 matches (excluding documented `warning` literal) — 24f1307

#### Manual

- [x] 1.4 Welcome.astro and reports/[id].astro Topbar render consistent with reports/index.astro — 24f1307
- [x] 1.5 Banner.astro info/error variants render with visibly distinct correct colors — 24f1307
- [x] 1.6 Topbar nav icons render in brand indigo color on default state, not black — 24f1307

### Phase 2: reports/index.astro + ReportsList.tsx

#### Automated

- [x] 2.1 `npm run lint` passes — 49437bc
- [x] 2.2 `npm run build` passes — 49437bc
- [x] 2.3 Hardcoded-value scan on index.astro/ReportsList.tsx returns 0 matches — 49437bc

#### Manual

- [x] 2.4 Upload submit button shows visible focus ring on Tab — 49437bc
- [x] 2.5 "Zobacz raport"/"Usuń raport" read as one coherent action group — 49437bc
- [x] 2.6 No visible background seam at page root — 49437bc

### Phase 3: 7-state matrix + visual gate

#### Automated

- [x] 3.1 `npm run build` succeeds with new kitchen-sink route — 952d6e3
- [x] 3.2 Hardcoded-value scan on all 5 touched files returns 0 matches (excluding documented exception) — 952d6e3

#### Manual

- [x] 3.3 All 7 states visible on /dev/kitchen-sink/reports-list without errors — 952d6e3
- [x] 3.4 Desktop + mobile screenshots show no layout jump and no two states rendering identically — 952d6e3

### Phase 4: Make it stick

#### Automated

- [x] 4.1 CLAUDE.md remains valid markdown — f908969

#### Manual

- [x] 4.2 New rule reads clearly, no duplication/contradiction with existing bullets — f908969
- [x] 4.3 Rule sits outside the toolkit BEGIN/END markers — f908969
