<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Light surface tokens

- **Plan**: context/changes/light-surface-tokens/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Automated criteria re-run on HEAD `f80f652`: lint 0 errors, `astro check` 0 errors / 0 warnings, build OK, `check:ui-tokens` OK, contrast on the new `--background` ≥ 4.53 for every text pair. Manual rows 1.6, 1.7 and 2.3–2.5 were confirmed by the user in-session, with the screenshots in `screenshots/` as evidence. The diff touches exactly the planned files plus `token-source.md`, the screenshots and one CLAUDE.md line. The only remaining `bg-background` uses outside kitchen-sinks are page roots (`Welcome.astro:136`, `AuthLayout.astro:16`) and the planned dark override in `dialog.tsx:51`.

## Findings

### F1 — New "Surface roles" rule is already contradicted by confirm-email

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/auth/confirm-email.astro:63
- **Detail**: The rule added to CLAUDE.md:150 forbids `text-muted-foreground` on a panel darker than the page. The confirm-email hint box is `bg-muted … text-muted-foreground`, which measures 4.34:1 (< 4.5). This is pre-existing (it was 4.34 before this change too), but the documentation and the code now disagree, which is the kind of drift lessons.md entry 1 warns about.
- **Fix**: Change the box text to `text-foreground` (wording unchanged; only colour), so the hint reads ≥ 4.5 and matches the rule.
- **Decision**: FIXED

### F2 — Comment and rule point at an archive path that does not exist yet

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/styles/global.css:8, CLAUDE.md:150
- **Detail**: Both reference `context/archive/2026-10-08-light-surface-tokens/token-source.md`. That path is only correct if `/10x-archive` runs today (2026-10-08). Earlier changes repointed such comments in a follow-up commit after archiving (`c71e918`, `a384e67`).
- **Fix**: Archive today, or repoint both references after archiving if the date differs.
- **Decision**: FIXED — no code change; archive on 2026-10-08, otherwise repoint global.css:8 and CLAUDE.md:150 after archiving

### F3 — Plan and brief still describe the landing bands as `bg-muted`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/light-surface-tokens/plan.md (Phase 1, change 4), plan-brief.md (Key Decisions)
- **Detail**: In Phase 1 the user-approved deviation switched the bands to `bg-card` (`muted-foreground` on `--muted` is 4.34). That deviation is recorded only in `token-source.md`; the plan and brief, which archive with the change, still say `bg-muted`. In dark mode the practical effect is nil: `muted/50` over 0.145 ≈ 0.207 versus `--card` 0.205.
- **Fix**: Add a one-line addendum under Phase 1 change 4 and update the brief's "Landing bands" row to `bg-card`, with the reason.
- **Decision**: FIXED — addendum under Phase 1 change 4 in plan.md; brief Key Decisions and risk rows updated
