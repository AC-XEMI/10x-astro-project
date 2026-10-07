---
date: 2026-10-06T11:21:11+02:00
researcher: Claude (10x-research)
git_commit: e4ba00c1cc833d98c4524c8f6c4d8bb68455cd79
branch: dev
repository: 10x-astro-project
topic: "UI design-system audit of src/pages/reports/index.astro for /10x-ui"
tags: [research, codebase, ui, design-tokens, reports, tailwind, shadcn]
status: complete
last_updated: 2026-10-06
last_updated_by: Claude (10x-research)
---

# Research: UI design-system audit of reports/index.astro

**Date**: 2026-10-06T11:21:11+02:00
**Researcher**: Claude (10x-research)
**Git Commit**: e4ba00c1cc833d98c4524c8f6c4d8bb68455cd79
**Branch**: dev
**Repository**: 10x-astro-project

## Research Question

For `/10x-ui` on `src/pages/reports/index.astro` (the post-login reports list/upload
view): does this view and its rendered subcomponents use the repo's existing
shadcn/Tailwind design-token contract (`src/styles/global.css`) and shared
components (`src/components/ui/*`), or does it bypass them with literal values —
and if it bypasses them, is that a missing-tokens issue, a missing-shared-component
issue, or an accidental-architecture issue (per the `/10x-ui` three-category audit)?

## Summary

The token contract exists and works — `src/styles/global.css` defines a full
shadcn `:root`/`.dark` token set (`--primary`, `--secondary`, `--muted`,
`--accent`, `--destructive`, `--border`, `--input`, `--ring`, etc.) published via
`@theme inline`, and `src/components/ui/button.tsx` (and `dialog.tsx`, `table.tsx`)
correctly consume it (`bg-primary`, `bg-destructive`, `focus-visible:ring-ring/50`).
But across the whole `src/pages`/`src/components`/`src/layouts` tree, only 4 files
reference any token-driven class at all — the three `src/components/ui/*`
primitives plus `src/components/reports/DeviationsList.tsx` (`grep` evidence below)
— while every page-level view, including `src/pages/reports/index.astro` and its
rendered subcomponents (`ReportsList.tsx`, `Topbar.astro`, `Banner.astro`), uses
literal Tailwind palette classes (`slate-*`, `indigo-*`) or raw hex instead. This is
the "fresh starter with a dead token file" case the `/10x-ui` skill names explicitly:
the infrastructure is there, nothing on this view reads it.

No dark-mode toggle or `.dark` class application exists anywhere in `src/`
(`grep -r dark src` matches only the unused `dark:` variant classes shadcn's CLI
generated inside `button.tsx`) — so `.dark` tokens in `global.css` are currently
unreachable infrastructure, not an active, user-visible regression. Charges below
that mention dark-mode readiness are framed as a secondary/latent risk, not a bug
in production today.

Neither `CLAUDE.md` nor `AGENTS.md` contains an instruction that encourages literal
values or arbitrary Tailwind values (no "`w-[123px]` for precise designs" style
rule, per the `/10x-ui` failure-smell list). The drift is from **absence** of a
token-usage rule, not a bad rule actively pointing agents at literals — relevant to
the "Make it stick" step later: a rule needs to be *added*, not fixed.

## Detailed Findings

### Token source and shared components (works, but unread by this view)

- `src/styles/global.css:6-39` — `:root` defines the full token value set.
- `src/styles/global.css:41-73` — `.dark` redefines the same tokens; no code path
  ever applies the `.dark` class (see Architecture Insights).
- `src/styles/global.css:75-111` — `@theme inline` publishes the `--color-*`
  custom properties Tailwind utility classes like `bg-primary` resolve against.
- `src/styles/global.css:113-120` — `body { @apply bg-background text-foreground }`
  in `@layer base`, i.e. the token-driven background/foreground is the **global
  default** unless a more specific literal overrides it.
- `src/components/ui/button.tsx:7-33` — `buttonVariants` (cva) is fully
  token-driven: `default` → `bg-primary text-primary-foreground ... hover:bg-primary/90`;
  `destructive` → `bg-destructive text-white ...`; focus state →
  `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`.
  This is the contract other views should be matching.
- `src/components/ui/dialog.tsx`, `src/components/ui/table.tsx` — also
  token-driven (used correctly by `ReportsList.tsx`'s delete-confirmation dialog
  and table).

### Repo-wide token adoption (source → views direction)

`grep -rlE '\b(bg|text|border|ring)-(primary|secondary|muted|accent|destructive|background|foreground|card|popover|input)\b' src/pages src/components src/layouts` returns exactly 4 files:
`src/components/reports/DeviationsList.tsx`, `src/components/ui/button.tsx`,
`src/components/ui/dialog.tsx`, `src/components/ui/table.tsx`.

The same scope searched for literal Tailwind palette classes
(`bg|text|border|ring|from|via|to` + `slate|gray|zinc|neutral|stone|indigo|blue|red|green` + a shade number)
returns 15 files, including every `.astro` page under `src/pages/auth/` and
`src/pages/reports/`, `Topbar.astro`, `Welcome.astro`, `ui/LibBadge.astro`, all
`auth/*.tsx` form components, and `reports/ReportsList.tsx` /
`reports/DeviationsList.tsx` (the latter appears in both lists — it mixes tokens
and literals). This confirms the pattern is repo-wide, not specific to the
`reports/index.astro` view — but per `/10x-ui`'s "one view plus global tokens per
change" rule, this change's charges are scoped to `reports/index.astro` and what it
renders; the wider pattern is a known, out-of-scope observation for future changes
on other views.

### View → source: literal-value evidence on `reports/index.astro` and its subcomponents

Hardcoded-value scan (`/10x-ui`'s grep pattern) on
`src/pages/reports/index.astro`, `src/components/reports/ReportsList.tsx`,
`src/components/Topbar.astro`, `src/components/Banner.astro`, `src/layouts/Layout.astro`
returned 29 matches, all in the first four files (`Layout.astro` had none).

- `src/pages/reports/index.astro:40` — `<div class="min-h-screen bg-slate-50 p-4">`
  overrides the global `bg-background` default from `global.css:118` at the page
  root with a literal.
- `src/pages/reports/index.astro:44,65` — two card containers use
  `border-slate-200 bg-white` instead of `border-border bg-card`.
- `src/pages/reports/index.astro:45,66` — headings use `text-slate-900` instead of
  a token (e.g. `text-foreground`, already the default via `body`, so these are
  redundant literals, not even needed).
- `src/pages/reports/index.astro:54` — file input's `file:` pseudo-class styling:
  `file:bg-indigo-600 ... hover:file:bg-indigo-500`.
- `src/pages/reports/index.astro:58` — the page's only form-submit button:
  `class="w-full cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-500"`
  — a hand-built `<button>`, not the `<Button>` component already imported one
  level down in the same feature (`ReportsList.tsx:4`).
- `src/pages/reports/index.astro:71,78` — pagination links use
  `text-indigo-600 hover:underline` instead of a token/`Button variant="link"`.
- `src/components/reports/ReportsList.tsx:31` — empty state: `text-sm text-slate-500`
  instead of `text-sm text-muted-foreground`.
- `src/components/reports/ReportsList.tsx:53-60` vs `:61-73` — in the same table
  row, the "Zobacz raport" (view) action is a hand-styled `<a>` with
  `text-indigo-600 hover:bg-indigo-50`, while the adjacent "Usuń raport" (delete)
  action is a real `<Button variant="destructive">` using `bg-destructive`. Two
  different color systems sit side by side in the same row.
- `src/components/Topbar.astro:7` — `border-slate-200 bg-white` (same pattern as
  the page cards).
- `src/components/Topbar.astro:10,42` — `text-slate-500` for secondary text
  (email / "Niezalogowany") instead of `text-muted-foreground`.
- `src/components/Topbar.astro:16,24,33,46,52` — five separate nav/action links
  all repeat `text-indigo-600 ... hover:bg-indigo-50 hover:text-indigo-700`
  instead of a token or a `Button variant="ghost"`/`"link"`.
- `src/components/Banner.astro:28-42` — the three banner variants (`info`,
  `warning`, `error`) are defined with raw hex in a plain `<style>` block
  (`#dbeafe`/`#1e3a8a`/`#3b82f6`, `#fef3c7`/`#78350f`/`#f59e0b`,
  `#fee2e2`/`#7f1d1d`/`#dc2626`), entirely outside the Tailwind/token pipeline, with
  no `.dark` branch. `Banner` is the only feedback channel `reports/index.astro`
  shows after an upload error or a delete confirmation (`index.astro:46-47`).

### Agent rules check

- `CLAUDE.md` "Key conventions" instructs `cn()` for merging Tailwind classes but
  does not instruct *which* classes (token vs. literal) to use, and names no
  design-token or shared-component contract for new UI work.
- `AGENTS.md:23` repeats the same `cn()` instruction, equally silent on tokens.
- Neither file contains an "arbitrary values for precise designs" style
  instruction (the `/10x-ui` failure smell). **No bad rule was found causing the
  drift** — it is an absence of a rule, not an active one pointing agents at
  literals.

## Code References

- `src/styles/global.css:6-120` - full token definition, `.dark` overrides, `@theme inline` publication, and the `body` base-layer default.
- `src/components/ui/button.tsx:7-33` - token-correct reference implementation (the contract to match).
- `src/pages/reports/index.astro:40,44-45,54,58,65-66,71,78` - literal-value sites on the audited view.
- `src/components/reports/ReportsList.tsx:31,53-60` - literal-value sites; `:61-73` is the token-correct `Button` right next to the literal link at `:53-60`.
- `src/components/Topbar.astro:7,10,16,24,33,42,46,52` - literal-value sites, rendered on every page via this view's layout path.
- `src/components/Banner.astro:28-42` - raw hex, outside the Tailwind pipeline, no dark variant.

## Architecture Insights

- The token/component contract is real and functional (shadcn `Button`/`Dialog`/`Table`
  prove it works) — this is not a "no design system" case needing one introduced;
  it is the "dead token file" case where phase 1 of a fix is making existing views
  read what already exists, per `/10x-ui`'s contract-variant guidance.
- `.dark` is defined in `global.css` but never applied: `grep -r dark src` (case-sensitive,
  whole-word) matches only the `dark:` Tailwind variant classes inside
  `button.tsx`'s `cva` config (inert without a `.dark` ancestor class) — no
  toggle component, no `document.documentElement.classList` call, no
  `prefers-color-scheme` wiring exists in `src/`. Dark-mode charges are therefore
  latent-infrastructure risk, not a live defect.
- The literal-value pattern is repository-wide (15 of ~19 page/component files
  scanned use palette literals; only 4 use tokens), so fixing `reports/index.astro`
  alone will not make it representative of "the rest of the app" — it sets the
  pattern other views should later inherit, consistent with `/10x-ui`'s guidance to
  run this before the second or third view, not after every view has copied the
  drift (in this repo, drift already reached most existing views).

## Historical Context (from prior changes)

- `context/foundation/lessons.md` has no prior entry about design tokens, colors,
  or this view; the three existing entries concern API `prerender`, shadcn
  `TableCell` `whitespace-nowrap`, and user-facing text not containing raw column
  names — not applicable to this audit.
- No other `context/changes/**` or `context/archive/**` folders exist yet (this is
  the first `/10x-ui` change in this repository).

## Related Research

None — no other `research.md` exists under `context/changes/**` or `context/archive/**`.

## Charges

1. **Missing tokens — primary call-to-action color.**
   `src/pages/reports/index.astro:54,58` — the page's only upload/submit action
   uses literal `bg-indigo-600`/`hover:bg-indigo-500`/`file:bg-indigo-600` instead
   of the `bg-primary`/`hover:bg-primary/90` tokens `button.tsx` already encodes.
   **User impact:** the one primary action on this page is visually disconnected
   from the token system — a future brand/primary-color change (or dark mode, once
   wired) silently skips this button while every real `<Button>` elsewhere updates.

2. **Missing shared component — hand-built submit control.**
   `src/pages/reports/index.astro:49-61` — the file input and submit `<button>`
   are built from literal Tailwind classes directly in the `.astro` file, even
   though `<Button>` is already imported and used one component down
   (`ReportsList.tsx:4,61-73`).
   **User impact:** this control doesn't get `<Button>`'s built-in `focus-visible`
   ring token, disabled-state handling, or consistent hover timing — keyboard
   users get a different focus affordance here than on every other button in the
   app.

3. **Missing tokens — nav and list-row color inconsistency.**
   `src/components/Topbar.astro:7,10,16,24,33,42,46,52` and
   `src/components/reports/ReportsList.tsx:31,55` — literal `text-slate-500`,
   `border-slate-200`, `bg-white`, `text-indigo-600`, `hover:bg-indigo-50` instead
   of `text-muted-foreground`, `border-border`, `bg-card`, and a token-driven
   link/ghost treatment.
   **User impact:** concretely visible in one table row —
   `ReportsList.tsx:53-60`'s "Zobacz raport" link (literal indigo) sits directly
   beside `:61-73`'s "Usuń raport" `<Button variant="destructive">` (token-driven
   red); two unrelated color systems in the same row of the same table.

4. **Missing tokens — feedback banner outside the pipeline (latent dark-mode risk).**
   `src/components/Banner.astro:28-42` — all three banner variants hardcode hex
   values in a plain `<style>` block with no `.dark` branch, and are the only
   error/info feedback `reports/index.astro` shows after an upload failure or a
   delete (`index.astro:46-47`).
   **User impact today:** none visible (no `.dark` class is ever applied anywhere
   in the app — see Architecture Insights) — but this is still a token-contract
   violation since the component sits completely outside `global.css`'s pipeline,
   and it would silently stay light-themed the moment dark mode is wired up
   elsewhere.

5. **Accidental architecture — page root re-overrides the already-token-driven default.**
   `src/pages/reports/index.astro:40` (`bg-slate-50`) and its two card containers
   (`:44,65`, `bg-white`) override `global.css:117-119`'s
   `body { @apply bg-background text-foreground }`, which is already the
   token-driven default for every page.
   **User impact:** the literal at the page root is the top of the drift chain —
   it defeats infrastructure that requires zero extra code to use correctly, and
   is the reason the rest of the page had no token default to fall back to.

No charges were rejected or deferred — all five identified in the `/10x-ui` audit
brief were confirmed against the source and kept. A sixth potential charge — "fix
the repo-wide literal pattern across all 15 affected files" — is explicitly **out
of scope** for this change per `/10x-ui`'s "one view plus global tokens per
change" rule; it is left as a repository-level observation (see Architecture
Insights) for whichever view is audited next.

## Open Questions

None — the audit brief's five charges are all confirmed with file:line evidence
and the two required audit directions (source → views, view → source) are both
covered above.
