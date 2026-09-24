---
starter_id: 10x-astro-starter
package_manager: npm
project_name: kontrola-trasowek
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
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
---

## Why this stack

Solo, po godzinach, 6-tygodniowe MVP dla web-app z logowaniem (FR-001) i
regułami wykrywania odstępstw działającymi na wgranych plikach raportów.
10x Astro Starter jest rekomendowanym domyślnym wyborem dla (web, js) i
pokrywa auth + bazę danych + wdrożenie na brzegu sieci od razu, bez
dodatkowego montowania — dokładnie to, czego potrzebuje mały zespół z
krótkim budżetem czasu. Wdrożenie na Cloudflare Pages to domyślny cel
startera. CI działa na GitHub Actions z auto-deployem po scaleniu do main —
zgodnie z tym, co starter ma wbudowane.
