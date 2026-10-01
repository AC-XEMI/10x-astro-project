<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Pierwsze wdrożenie Kontroli Trasówek na Cloudflare Workers

- **Plan**: context/changes/deployment/deployment-plan.md
- **Scope**: Full plan (unstructured — no `## Phase N` / `## Progress` sections in this plan; reviewed as a single unit)
- **Reviewed phases**: none (plan has no phase structure)
- **Date**: 2026-09-28
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Git scope used for this review

Plan baseline: 2026-09-24 (date the plan file first appears in git history, commit `5d95b00`). Commits touching deployment-relevant files from that date forward:

- `4f2afaa` (2026-09-24) — Rename Worker to kontrola-trasowek, fix nodejs_compat SSR bug
- `31efb44` (2026-09-24) — Push Supabase credentials as Workers runtime secrets on deploy
- `5d95b00` (2026-09-24) — Obsługa deploymentu (adds the plan file + 108 unrelated files, including committed build artifacts)
- `c4cb786` (2026-09-25) — Restore dist/ and .astro/ to .gitignore, untrack build artifacts
- `c9ace44` (2026-09-25) — fix(ci): re-enable smoke job and gate deploy on it

Current repo state (wrangler.jsonc, ci.yml, tech-stack.md) verified directly by reading the files, not just the diffs.

## Findings

### F1 — Build artifacts committed alongside the deploy commit, breaking CI lint

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — already self-corrected; nothing left to fix in code
- **Dimension**: Safety & Quality
- **Location**: commit `5d95b00` (fixed by commit `c4cb786`)
- **Detail**: The commit that added the deployment plan to the repo ("Obsługa deploymentu") also removed `dist/` and `.astro/` from `.gitignore` and committed ~90 generated files (`dist/server/chunks/*.mjs`, `dist/client/_astro/*`, `.astro/*.d.ts`) alongside unrelated skill/foundation files — 109 files, 69,566 insertions in one commit. This broke CI's lint step (ESLint's `includeIgnoreFile()` started linting generated files) and had to be fixed the next day by a dedicated revert commit. The current repo state is fine — `.gitignore` has `dist/` and `.astro/` again and neither is tracked — but the plan's own step 4 ("Commit zmian w wrangler.jsonc — jedyny realnie śledzony przez git plik") explicitly expected only `wrangler.jsonc` to be committed, not a 109-file sweep.
- **Fix**: No further code action needed — already fixed in `c4cb786`. Worth recording as a recurring rule via `/10x-lesson` (e.g. "before a broad commit, run `git status` and confirm `.gitignore` still covers build output — don't let an unrelated file sweep piggyback on a deploy commit").
- **Decision**: FIXED — already resolved in `c4cb786`; no further code action taken during triage.

### F2 — Plan's premise about tech-stack.md being gitignored was wrong; file is now tracked

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — outcome is harmless, but the plan's stated fact was incorrect
- **Dimension**: Plan Adherence
- **Location**: context/foundation/tech-stack.md
- **Detail**: The plan states: "Ten plik jest w .gitignore — zmiana lokalna, nie trafi do commita" (this file is gitignored, the change stays local and won't be committed). `.gitignore` has no entry for `context/`, and `tech-stack.md` was in fact added to git for the first time as part of the `5d95b00` sweep commit, already containing the corrected `deployment_target: cloudflare-workers` value. The value itself is correct (matches plan step 3's intent), but the plan's assumption about tracking status was false, and the file ended up committed via an unrelated bulk commit rather than a deliberate one.
- **Fix**: No corrective action needed — a tracked, correct foundation doc is arguably better than an untracked one. If the plan is amended, correct the "won't be committed" claim so future reviews don't rely on it.
- **Decision**: ACCEPTED — outcome (tracked, correct file) accepted as-is; no code/plan edit made.

### F3 — Two deploy-pipeline changes made without being documented in the plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; both changes affect production deploy behavior
- **Dimension**: Scope Discipline
- **Location**: `.github/workflows/ci.yml` (commits `31efb44`, `c9ace44`)
- **Detail**: The plan's "Kroki automatyczne" section lists exactly 4 steps (rename Worker, add `disable_nodejs_process_v2`, fix tech-stack.md, commit). Two further changes landed in the same window but aren't in the plan: (a) `31efb44` added a `secrets:` block to the `wrangler-action` deploy step to push `SUPABASE_URL`/`SUPABASE_KEY` as Workers runtime secrets — this fixes a real bug (Astro.locals.runtime.env never received the vars, so the live app would have served "Supabase is not configured"); (b) `c9ace44` re-enabled the previously-commented `smoke` job and changed `deploy`'s `needs` from `[ci]` to `[ci, smoke]`, gating production deploy on a passing local-Supabase smoke test. Both are good, well-scoped, well-explained (in their commit messages) changes — but neither is reflected in `deployment-plan.md`, so a reader of the plan alone would think the deploy job still only pushes build-time env vars and only depends on `ci`.
- **Fix A ⭐ Recommended**: Add an addendum section to `deployment-plan.md` documenting both changes and linking the two commits/rationale.
  - Strength: Keeps the plan as an accurate source of truth for `/10x-status` and future reviews; the rationale is already well-written in the commit messages, so transcription is low-effort.
  - Tradeoff: Requires editing a plan that otherwise reads as "done."
  - Confidence: HIGH — this repo already uses the addendum pattern for discovered scope.
  - Blind spot: Haven't verified against a live Cloudflare API token that `Workers Scripts:Edit` scope (per the plan's manual-gate step 1) is sufficient for `wrangler secret put` — if it isn't, the deploy job would fail at the secrets-push step and this addendum should note the actual required scope.
- **Fix B**: Leave undocumented since the commit messages already explain the rationale.
  - Strength: Zero additional effort.
  - Tradeoff: Plan keeps drifting from reality; anyone using the plan (not `git log`) as ground truth stays misinformed about what the deploy job actually does.
  - Confidence: MEDIUM.
  - Blind spot: None significant.
- **Decision**: FIXED — Applied Fix A. Addendum added to deployment-plan.md documenting commits 31efb44 and c9ace44.

### F4 — This change has no change.md and the plan has no Phase/Progress structure

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Success Criteria
- **Location**: context/changes/deployment/
- **Detail**: Every other change in this repo (e.g. `context/archive/2026-09-25-report-data-schema/`) has a `change.md` with frontmatter (`change_id`, `title`, `status`, `created`, `updated`) and a plan with `## Phase N` headings plus a `## Progress` checklist. `deployment-plan.md` has neither — it's a flat list of steps and manual gates. This is likely why it was never routed through `/10x-new` / `/10x-plan`. It doesn't block this review, but it means `/10x-status` couldn't see this change until now.
- **Fix**: A minimal `change.md` has been backfilled during this review (`status: impl_reviewed`, `created: 2026-09-24`) so tooling can track it going forward. For future infra/deploy changes, consider running them through `/10x-new` so they get the standard structure.
- **Decision**: FIXED — `change.md` backfilled during this review's Step 4.

### F5 — No recorded evidence that the plan's end-to-end verification was actually run

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Success Criteria
- **Location**: N/A (plan's "Weryfikacja end-to-end" section, 5 items)
- **Detail**: The plan's final section calls for confirming the GitHub Actions `deploy` run succeeded, reading the live `*.workers.dev` URL, manually checking signin/dashboard render against real Supabase, and running `npm run smoke` against the live URL. Nothing in the repo (no change.md notes, no linked run URL) records whether these happened. `gh` CLI is unavailable in this environment, so this review could not independently re-check the Actions run history either.
- **Fix**: Confirm manually (or have the user confirm) that the `deploy` job has run successfully at least once post-merge and that the live smoke test passed; note the resulting `*.workers.dev` URL in `change.md` for future reference.
- **Decision**: ACCEPTED — user will verify manually outside this session (deploy run success, live URL, smoke test).
