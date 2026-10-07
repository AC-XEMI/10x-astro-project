# Dashboard (Pulpit) design-system contract Implementation Plan

## Overview

Bring the dashboard view (`src/pages/dashboard.astro` + `src/components/dashboard/RankingTable.tsx`)
onto the repo's design-system contract: a shared `Card` component instead of hand-built
containers, role-named rule-series tokens with ≥3:1 contrast in both themes instead of
opacity steps of `--primary`, one visible time axis for the numbers and the "Przejdź do
listy" target, a token focus ring on every link, a header that wraps on a phone — then
prove all of it in a kitchen sink and leave a rule plus a check so the next agent keeps it.

## Current State Analysis

From `context/changes/dashboard-ui-tokens/research.md` (2026-10-07, commit `44d0539`):

- The view is already token-driven for colours: 0 colour literals, 3 arbitrary values,
  62 token-class uses across the 3 view files.
- Rule series use `bg-primary`, `bg-primary/55`, `bg-primary/25`, written out in 3 places
  (`dashboard.astro:119-123`, `:294-296`; `RankingTable.tsx:55-57`). Computed contrast vs
  `--card`: 55% = 2.63:1 light / 2.02:1 dark, 25% = 1.50:1 light / 1.31:1 dark — below
  WCAG 1.4.11's 3:1.
- `--chart-1..5` (`global.css:28-32,64-68`) are unused and unsuitable as-is: they change hue
  between themes (`--chart-1` orange in light, blue in dark) and `--chart-1` dark is 2.63:1
  against the dark card (computed during planning).
- `src/components/ui/` has `button`, `table`, `dialog`, `LibBadge` — no `card`. The view
  hand-builds 8 card containers with paddings p-4 / p-5 / p-8.
- KPIs, ranking and trend bucket by **visit-date** month (`dashboard.astro:49`,
  `dashboard-stats.ts:4-6`); "Ostatnie raporty" lists by **upload date** (`:41`); the
  "Czeka na przegląd" button target comes from the upload-date list (`:112,250`) while its
  number comes from the visit-date window (`:246`).
- Links at `:316` and `:322-324` have no `focus-visible` styling.
- The header control group at `:157` does not wrap (estimated ≈456px vs 342px at 390px).
- There is no kitchen sink for the dashboard; `src/pages/dev/kitchen-sink/reports-list.astro`
  is the pattern (dev-only, not in `PROTECTED_ROUTES`, fixtures instead of Supabase).

## Desired End State

- Every container on the dashboard is a `Card` from `src/components/ui/card.tsx`.
- The three rules are coloured by `bg-rule-gps`, `bg-rule-phone`, `bg-rule-route`, defined
  once in `:root` and `.dark`, each ≥3:1 against `--card` in both themes and the same hue in
  both themes; the rule → class/label mapping exists once in TypeScript and is used by the
  legend, the trend chart and the ranking bar.
- The period is visibly a visit-date period; recent reports are visibly upload-dated;
  "Przejdź do listy" opens the report with the most unreviewed deviations **inside the
  current visit-date window** (tie → the report whose newest visit is latest; none →
  `/reports`).
- "Wszystkie" and the recent-report rows show the `--ring` focus ring; the header controls
  wrap at 390px with no horizontal page scroll.
- `/dev/kitchen-sink/dashboard` renders the dashboard body in all 7 states, light and dark,
  from fixtures; desktop and 390px screenshots are saved in the change folder.
- `CLAUDE.md` names the rule tokens, `ui/card`, and the dashboard kitchen sink;
  `npm run check:ui-tokens` fails on colour literals, arbitrary values or `primary/NN`
  series colours in the dashboard files.

Verify: `npx astro check`, `npm run lint`, `npm run check:ui-tokens`, then the kitchen-sink
screenshots and a manual pass on real data in both themes.

### Key Discoveries:

- `computeDashboardStats` (`src/lib/services/dashboard-stats.ts:137`) is pure, and
  `RankingTable` renders without hydration — the whole dashboard body can render from
  fixture visits in a kitchen sink.
- Dark mode is a class variant (`global.css:4`, `@custom-variant dark (&:is(.dark *))`) and
  tokens are redefined on `.dark` (`global.css:43`), so wrapping a kitchen-sink frame in
  `<div class="dark">` renders that frame in dark tokens without toggling the page.
- Non-hydrated React components rendered from Astro get their Astro children wrapped in an
  `astro-static-slot` element styled `display: contents`; a `Card` with `CardHeader`/
  `CardContent` children must be checked once for layout (Phase 1) — table markup is the
  known case where this breaks, which is why `RankingTable` stays a single React tree.
- `lessons.md`: shadcn `TableCell` carries `whitespace-nowrap`; any free-text cell added to
  the ranking must override it.
- Chrome headless is installed (`C:/Program Files/Google/Chrome/Application/chrome.exe`) —
  `--headless --screenshot --window-size=W,H` gives desktop and 390px screenshots without a
  test framework.

## What We're NOT Doing

- No shared progress bar or segmented-control component; `DeviationsList.tsx:197-203,652-667`
  and the dashboard keep their own copies until the `DeviationsList` view gets its change.
- No migration of other views (`reports/index.astro`, `DeviationsList.tsx`, `ReportUpload.tsx`,
  `Welcome.astro`) to `Card`.
- No change to the post-login redirect (`src/pages/api/auth/signin.ts:24` → `/reports`,
  asserted by `scripts/smoke.mjs:54`).
- No change to `max-w-[1100px]` (repo-wide, 5 files) or the chart geometry numbers
  (`h-[180px]`/`130`, `w-[150px]`/`MAX_BAR_PX`) beyond what the touched lines need.
- No change to period semantics: buckets stay visit-date months (user decision 2026-10-06).
- No change to `--chart-*` values (still unused; shadcn defaults).
- No Playwright / screenshot-diff tooling, no CI workflow edits.
- No change to the missing-config path (`dashboard.astro:38,182-192`).

## Implementation Approach

Follow the `/10x-ui` order: library → token values → one view → states → guard. Phase 1
adds the only new primitive and proves it renders inside Astro. Phase 2 adds values only,
so the view change in Phase 3 is a pure substitution plus the time-axis logic. Phase 4
extracts the dashboard body into a component so the page and the kitchen sink render the
same code, then shoots the gate. Phase 5 writes the rule and the check.

## Critical Implementation Details

- **Token publishing:** each new `--rule-*` value must be defined in both `:root` and
  `.dark` **and** published as `--color-rule-*` in `@theme inline`; a value written straight
  into `@theme inline` would not move with the theme toggle.
- **Contrast inputs:** values below were verified during planning with oklch → sRGB, WCAG
  luminance, against `--card` (`oklch(1 0 0)` light, `oklch(0.205 0 0)` dark). If any value
  changes during implementation, recompute before committing.

## Phase 1: Card primitive

### Overview

Add shadcn's `card` through the stack's own path and confirm it lays out correctly when
rendered (non-hydrated) from an `.astro` file.

### Changes Required:

#### 1. shadcn card

**File**: `src/components/ui/card.tsx` (generated)

**Intent**: Provide the shared container the dashboard currently hand-builds 8 times.

**Contract**: `npx shadcn@latest add card` with the existing `components.json` (new-york,
`@/components/ui`, `cn` from `@/lib/utils`). Exports `Card`, `CardHeader`, `CardTitle`,
`CardDescription`, `CardAction`, `CardContent`, `CardFooter`. No new npm dependency; if the
CLI proposes one or rewrites `global.css`, stop and report instead of accepting.

#### 2. Render check

**File**: `src/pages/dev/kitchen-sink/dashboard.astro` (new, stub — completed in Phase 4)

**Intent**: A minimal dev page rendering one `Card` with `CardHeader` + `CardContent` from
Astro, to confirm the `astro-static-slot` wrapper does not break the card's internal gap/
padding before the view depends on it.

**Contract**: Dev-only route under `/dev/kitchen-sink/`, not linked, not protected.

### Success Criteria:

#### Automated Verification:

- `src/components/ui/card.tsx` exists and `git diff --stat package.json package-lock.json src/styles/global.css` shows no changes
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`

#### Manual Verification:

- `/dev/kitchen-sink/dashboard` shows the stub card with header and content spaced as in shadcn's new-york card (no collapsed gap, no double padding)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Rule-series tokens

### Overview

Add three role-named colour tokens for the deviation rules and a single TypeScript mapping
from rule to token class and label.

### Changes Required:

#### 1. Token values

**File**: `src/styles/global.css`

**Intent**: Replace opacity steps of `--primary` with three stable hues that pass 3:1
against the card in both themes and keep their hue when the theme flips.

**Contract**: New variables in `:root` and `.dark`, published in `@theme inline` as
`--color-rule-gps`, `--color-rule-phone`, `--color-rule-route`, with a comment pointing at
`context/changes/dashboard-ui-tokens/token-source.md`:

| Token | `:root` | `.dark` | vs card light / dark |
| --- | --- | --- | --- |
| `--rule-gps` | `var(--primary)` (indigo-600) | `var(--primary)` (indigo-500) | 6.44 / 3.91 |
| `--rule-phone` | `oklch(0.6 0.118 184.704)` (teal-600) | `oklch(0.777 0.152 181.912)` (teal-400) | 3.66 / 9.60 |
| `--rule-route` | `oklch(0.666 0.179 58.318)` (amber-600) | `oklch(0.828 0.189 84.429)` (amber-400) | 3.19 / 10.43 |

#### 2. Token source record

**File**: `context/changes/dashboard-ui-tokens/token-source.md` (new)

**Intent**: Deposit the values, their origin (Tailwind v4 default palette in
`node_modules/tailwindcss/theme.css`) and the contrast computation, so the next session does
not re-invent them.

**Contract**: Same table as above plus the method (oklch → sRGB, WCAG relative luminance,
against `--card`) and the rejected options (`--chart-1..3`: hue swaps between themes,
`--chart-1` dark 2.63:1; `primary` opacity steps: 1.31–2.63:1).

#### 3. Rule mapping

**File**: `src/lib/services/dashboard-stats.ts` (or a sibling `src/lib/rule-series.ts` if the
implementer prefers keeping UI classes out of the stats service)

**Intent**: One place that says which rule gets which colour class and short label, so the
legend, the trend chart and the ranking bar cannot drift apart again.

**Contract**: A constant keyed by `DeviationRule` (`missing_gps`, `phone_instead_of_visit`,
`route_deviation`) → `{ label: "Brak GPS" | "Telefon" | "Trasa", className: "bg-rule-gps" | "bg-rule-phone" | "bg-rule-route" }`,
plus a fixed display order (GPS, Telefon, Trasa). Class names must be written as full
literals so Tailwind's scanner emits them.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `grep -c "rule-" src/styles/global.css` returns 9 (3 in `:root`, 3 in `.dark`, 3 in `@theme inline`)

#### Manual Verification:

- `token-source.md` lists all six values with their contrast numbers, and the numbers match a re-run of the contrast computation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Dashboard view on the contract

### Overview

Apply the card, the rule tokens, the focus ring, the wrapping header, and the single
time axis to the dashboard.

### Changes Required:

#### 1. Cards

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the 8 hand-built `rounded-lg border … bg-card p-*` containers
(`:183,197,204,221,237,258,267,313`) with `Card` parts, so padding comes from one component.

**Contract**: The "Czeka na przegląd" tile keeps its conditional `border-destructive`
(via `className` on `Card`, merged with `cn`). The empty state (`:182-192`) becomes a `Card`
too. Visual density may change to the card's default spacing; that is intended.

#### 2. Rule colours

**Files**: `src/pages/dashboard.astro`, `src/components/dashboard/RankingTable.tsx`

**Intent**: Legend (`:119-123`), trend segments (`:294-296`) and ranking bar
(`RankingTable.tsx:55-57`) read the Phase 2 mapping instead of `bg-primary/NN`.

**Contract**: No `bg-primary/` class remains in either file; segment order in the trend bar
and the ranking bar follows the mapping's display order.

#### 3. Focus ring on links

**File**: `src/pages/dashboard.astro`

**Intent**: "Wszystkie" (`:316`) and the recent-report row links (`:322-324`) get the same
focus treatment as `buttonVariants` controls.

**Contract**: `focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none` (the token
ring from `src/components/ui/button.tsx:8`), with a radius on the "Wszystkie" link so the
ring is not clipped.

#### 4. Wrapping header

**File**: `src/pages/dashboard.astro`

**Intent**: The period switch and "Eksportuj" (`:157`) wrap instead of overflowing at 390px.

**Contract**: The group allows wrapping; the period `<nav>` itself may wrap or shrink its
labels, but the page body must not scroll horizontally at 390px.

#### 5. One time axis for the "Czeka na przegląd" target

**Files**: `src/lib/services/dashboard-stats.ts`, `src/pages/dashboard.astro`

**Intent**: The tile's button opens the report holding the most unreviewed deviations
**inside the current visit-date window**, so the number and the destination come from the
same axis.

**Contract**:
- `DashboardVisit` gains `report_id`; the paginated visits query selects it.
- `DashboardStats` gains `reviewTarget: string | null` = the `report_id` with the highest
  count of `unreviewed` deviations among visits in the current window; tie → the report
  whose latest `visit_date` in the window is newest; then lowest `report_id` for
  determinism; `null` when the window has 0 unreviewed.
- The page links to `/reports/<reviewTarget>` or, when `null`, to `/reports`. The old
  `todoTarget` from the 3 recent reports (`:112`) is removed.
- Example: window = September; report A has 5 unreviewed (newest visit 2026-09-28),
  report B has 5 unreviewed (newest visit 2026-09-30), report C (uploaded later, visits in
  October) has 9 → target is **B** (C is outside the window; A/B tie broken by newest visit).

#### 6. Time-axis labels

**File**: `src/pages/dashboard.astro`

**Intent**: Make the axis of each section visible without changing semantics.

**Contract**:
- Subtitle and the ranking header name the period as a visit period, e.g.
  "wizyty: wrzesień 2026" (1m) / "wizyty: lipiec 2026 – wrzesień 2026" (3m).
- Period `<nav>` gets `aria-label="Okres wizyt"`.
- Recent-report rows prefix the timestamp with "wgrano ", e.g. "wgrano 06.10.2026, 09:14 · 248 wierszy".
- "Ostatnie raporty" heading stays; it is upload-ordered by definition.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `grep -nE "bg-primary/[0-9]+|rounded-lg border[^\"]*bg-card" src/pages/dashboard.astro src/components/dashboard/RankingTable.tsx` returns nothing
- A Node one-off run of `computeDashboardStats` on the Phase 3 §5 example returns `reviewTarget` = report B (run with `node --experimental-strip-types` against a copy in the scratchpad, as in research)

#### Manual Verification:

- On real data in both themes, the three rule colours are distinguishable in the legend, the trend bars and the ranking bars
- Tabbing through the page shows the ring on "Wszystkie" and on each recent-report row
- At a 390px-wide window the header controls wrap and the page does not scroll horizontally
- "Przejdź do listy" opens a report whose visits fall in the selected period

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: States and visual gate

### Overview

Extract the dashboard body into a component, render it in the kitchen sink across the
7-state matrix in both themes, and capture screenshots.

### Changes Required:

#### 1. Dashboard body component

**Files**: `src/components/dashboard/DashboardView.astro` (new), `src/pages/dashboard.astro`

**Intent**: The page keeps data fetching; everything from the title row down renders from
props, so the kitchen sink renders the exact same markup.

**Contract**: Props: `stats: DashboardStats | null`, `recent` (reports with `unreviewed`),
`period: PeriodKey`, `loadError: boolean`. Derived labels (period label, comparison
strings, legend, notes) move into the component. The page renders
`<Topbar />` + `<DashboardView … />`.

#### 2. Kitchen sink

**File**: `src/pages/dev/kitchen-sink/dashboard.astro` (replaces the Phase 1 stub)

**Intent**: Every state of the dashboard visible at once, from fixtures, in light and dark.

**Contract**: Fixture visits (3–6 representatives, 6 months, all three rules, mixed review
status) passed through `computeDashboardStats`; frames for each state, each shown twice —
plain and inside `<div class="dark">`:

| State | Frame |
| --- | --- |
| default | full fixture stats + 3 recent reports |
| hover | default frame + note listing the hover classes (static screenshots cannot hold `:hover`), as in `reports-list.astro` |
| focus-visible | default frame + note; links and buttons forced into their focus style via the same class string for the screenshot |
| disabled | **N/A** — export renders only with non-empty ranking (`dashboard.astro:156`, `dashboard-stats.ts:172`); frame states the reason |
| error | `loadError = true` |
| empty | `stats = null`, `recent = []` |
| loading | **N/A** — SSR page, period switch is a full navigation; frame states the reason |

#### 3. Screenshots

**Files**: `context/changes/dashboard-ui-tokens/screenshots/` (new)

**Intent**: Evidence for review and the baseline for the next change.

**Contract**: Chrome headless against the running dev server:
`kitchen-sink-desktop.png` (1280 wide) and `kitchen-sink-390.png` (390 wide), full-height
window sizes chosen to fit the page.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- `/dev/kitchen-sink/dashboard` returns HTTP 200 from the dev server
- Both screenshot files exist in `context/changes/dashboard-ui-tokens/screenshots/`
- Hardcoded-value scan on `dashboard.astro`, `DashboardView.astro`, `RankingTable.tsx`, `DashboardExport.tsx` reports 0 colour literals and no `primary/NN` series classes

#### Manual Verification:

- The screenshots show all 7 states in both themes, with N/A frames explaining why
- `/dashboard` on real data renders identically to before the extraction (same numbers, same sections)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Guard

### Overview

Leave a rule and a check so the next agent keeps the dashboard on the contract.

### Changes Required:

#### 1. Agent rule

**File**: `CLAUDE.md` (project section, the "Design tokens over literals" bullet at `:174` or a
short sibling bullet; outside any CLI-managed block)

**Intent**: Point agents at the rule tokens, `ui/card`, and the dashboard kitchen sink, and
forbid opacity steps of `--primary` as series colours.

**Contract**: Names `--rule-gps/--rule-phone/--rule-route` (`bg-rule-*`) and the TS mapping
location, `src/components/ui/card.tsx`, `src/pages/dev/kitchen-sink/dashboard.astro`, and
`npm run check:ui-tokens`.

#### 2. Token check script

**Files**: `scripts/check-ui-tokens.mjs` (new), `package.json` (`check:ui-tokens` script)

**Intent**: Fail fast when a dashboard file gains a colour literal, an arbitrary value
outside an explicit allow-list, or a `primary/NN` series colour.

**Contract**: Dependency-free Node script (same style as `scripts/verify-report-detection.mjs`);
scans `src/pages/dashboard.astro`, `src/components/dashboard/*.{astro,tsx}`; patterns from
the `/10x-ui` hardcoded-value scan plus `bg-primary/[0-9]+`; allow-list for the 3 known
arbitrary values (`max-w-[1100px]`, `h-[180px]`, `w-[150px]`) and the focus `ring-[3px]`;
exits non-zero with `file:line` on any hit. Not wired into CI or lint-staged in this change.

### Success Criteria:

#### Automated Verification:

- `npm run check:ui-tokens` exits 0 on the finished view
- `npm run check:ui-tokens` exits non-zero when a `bg-primary/25` class is temporarily added to `RankingTable.tsx` (revert after)
- Lint passes: `npm run lint`

#### Manual Verification:

- The `CLAUDE.md` bullet reads correctly and points at files that exist

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None added (no test framework in the repo, per `CLAUDE.md`). The `reviewTarget` rule is
  checked by a one-off Node run on the Phase 3 §5 example.

### Integration Tests:

- None; the kitchen sink renders from fixtures without Supabase.

### Manual Testing Steps:

1. Open `/dashboard` on real data, light theme: rule colours, card spacing, labels "wizyty: …" and "wgrano …".
2. Toggle dark: same hues, all segments visible against the card.
3. Tab through: ring on period links, export, "Przejdź do listy", "Wszystkie", each recent row.
4. Resize to 390px: header wraps, no horizontal scroll (the ranking table may scroll inside its own container).
5. Click "Przejdź do listy": the opened report has visits in the selected period.

## Performance Considerations

Adding `report_id` to the visits select adds one UUID per row to the paginated query; no
extra round trip.

## Migration Notes

None — no schema change.

## References

- Research: `context/changes/dashboard-ui-tokens/research.md`
- Prior token decision: `context/changes/reports-list-ui-tokens/token-source.md`
- Kitchen-sink pattern: `src/pages/dev/kitchen-sink/reports-list.astro`
- Lesson: `context/foundation/lessons.md` (shadcn `TableCell` `whitespace-nowrap`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Card primitive

#### Automated

- [x] 1.1 `src/components/ui/card.tsx` exists and `git diff --stat package.json package-lock.json src/styles/global.css` shows no changes — e026fb1
- [x] 1.2 Type check passes: `npx astro check` — e026fb1
- [x] 1.3 Lint passes: `npm run lint` — e026fb1

#### Manual

- [x] 1.4 `/dev/kitchen-sink/dashboard` shows the stub card with header and content spaced as in shadcn's new-york card (no collapsed gap, no double padding) — e026fb1

### Phase 2: Rule-series tokens

#### Automated

- [x] 2.1 Type check passes: `npx astro check` — c0c3ab8
- [x] 2.2 Lint passes: `npm run lint` — c0c3ab8
- [x] 2.3 `grep -c "rule-" src/styles/global.css` returns 9 (3 in `:root`, 3 in `.dark`, 3 in `@theme inline`) — c0c3ab8

#### Manual

- [x] 2.4 `token-source.md` lists all six values with their contrast numbers, and the numbers match a re-run of the contrast computation — c0c3ab8

### Phase 3: Dashboard view on the contract

#### Automated

- [x] 3.1 Type check passes: `npx astro check`
- [x] 3.2 Lint passes: `npm run lint`
- [x] 3.3 `grep -nE "bg-primary/[0-9]+|rounded-lg border[^\"]*bg-card" src/pages/dashboard.astro src/components/dashboard/RankingTable.tsx` returns nothing
- [x] 3.4 A Node one-off run of `computeDashboardStats` on the Phase 3 §5 example returns `reviewTarget` = report B

#### Manual

- [x] 3.5 On real data in both themes, the three rule colours are distinguishable in the legend, the trend bars and the ranking bars
- [x] 3.6 Tabbing through the page shows the ring on "Wszystkie" and on each recent-report row
- [x] 3.7 At a 390px-wide window the header controls wrap and the page does not scroll horizontally
- [x] 3.8 "Przejdź do listy" opens a report whose visits fall in the selected period

### Phase 4: States and visual gate

#### Automated

- [ ] 4.1 Type check passes: `npx astro check`
- [ ] 4.2 Lint passes: `npm run lint`
- [ ] 4.3 `/dev/kitchen-sink/dashboard` returns HTTP 200 from the dev server
- [ ] 4.4 Both screenshot files exist in `context/changes/dashboard-ui-tokens/screenshots/`
- [ ] 4.5 Hardcoded-value scan on `dashboard.astro`, `DashboardView.astro`, `RankingTable.tsx`, `DashboardExport.tsx` reports 0 colour literals and no `primary/NN` series classes

#### Manual

- [ ] 4.6 The screenshots show all 7 states in both themes, with N/A frames explaining why
- [ ] 4.7 `/dashboard` on real data renders identically to before the extraction (same numbers, same sections)

### Phase 5: Guard

#### Automated

- [ ] 5.1 `npm run check:ui-tokens` exits 0 on the finished view
- [ ] 5.2 `npm run check:ui-tokens` exits non-zero when a `bg-primary/25` class is temporarily added to `RankingTable.tsx` (revert after)
- [ ] 5.3 Lint passes: `npm run lint`

#### Manual

- [ ] 5.4 The `CLAUDE.md` bullet reads correctly and points at files that exist
