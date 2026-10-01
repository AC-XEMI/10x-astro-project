---
bootstrapped_at: 2026-09-22T12:12:51Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: kontrola-trasowek
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: kontrola-trasowek
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

**Why this stack** (verbatim from hand-off body):

Solo, po godzinach, 6-tygodniowe MVP dla web-app z logowaniem (FR-001) i
regułami wykrywania odstępstw działającymi na wgranych plikach raportów.
10x Astro Starter jest rekomendowanym domyślnym wyborem dla (web, js) i
pokrywa auth + bazę danych + wdrożenie na brzegu sieci od razu, bez
dodatkowego montowania — dokładnie to, czego potrzebuje mały zespół z
krótkim budżetem czasu. Wdrożenie na Cloudflare Pages to domyślny cel
startera. CI działa na GitHub Actions z auto-deployem po scaleniu do main —
zgodnie z tym, co starter ma wbudowane.

## Pre-scaffold verification

| Signal      | Value                                                     | Severity | Notes                                                              |
| ----------- | ---------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| npm package | not run                                                     | n/a      | `cmd_template` starts with `git clone`; no npm package to derive     |
| GitHub repo | not run                                                     | n/a      | network call to GitHub API unavailable in this environment (no `gh` CLI, curl fetch failed) |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 22 top-level paths (including `node_modules/` and `src/` subtrees) moved from `.bootstrap-scaffold/` into cwd
**Conflicts (.scaffold siblings)**: CLAUDE.md.scaffold (cwd already had a `CLAUDE.md` from the 10x-cli toolkit scaffold; existing file won, starter's version sidelined)
**.gitignore handling**: moved silently (cwd had no pre-existing `.gitignore`)
**.bootstrap-scaffold cleanup**: deleted (including cloned `.git/`, removed before move-up)

Notes: `npm install` emitted `EBADENGINE` warnings — the starter's `astro-eslint-parser`, `eslint-plugin-astro`, and `undici` packages prefer Node `^22.22.3 || ^24.16.0 || >=26.3.0`; the environment ran Node `v22.17.0`. Install completed successfully despite the warnings (648 packages added, 0 vulnerabilities reported by npm at install time).

## Post-scaffold audit

**Tool**: npm audit --json
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW
**Direct vs transitive**: not applicable — 0 findings (804 total dependencies: 377 prod, 269 dev, 167 optional, 0 peer)

Clean tree — no advisories at scaffold time.

## Hints recorded but not acted on

| Hint                     | Value            |
| ------------------------ | ----------------- |
| bootstrapper_confidence  | first-class        |
| quality_override         | false               |
| path_taken               | standard            |
| self_check_answers       | null                 |
| team_size                | solo                  |
| deployment_target        | cloudflare-pages       |
| ci_provider              | github-actions          |
| ci_default_flow          | auto-deploy-on-merge     |
| has_auth                 | true                      |
| has_payments             | false                      |
| has_realtime              | false                       |
| has_ai                   | false                        |
| has_background_jobs      | false                         |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review the `CLAUDE.md.scaffold` sibling and decide whether to merge any starter-provided agent guidance into the existing `CLAUDE.md`.
- Address the Node engine mismatch (`v22.17.0` installed vs `^22.22.3 || ^24.16.0 || >=26.3.0` required by some dependencies) before relying on those packages' dev tooling.
- Set up Supabase credentials (`.env.example` → `.env`) before running the app — the starter's auth/database features require it.
