<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 1

Open Module 3 by producing a **durable, risk-first quality contract** before any test is written — then drive each rollout phase through the standard change chain.

```
PRD + roadmap + archive
        │
        ▼
   /10x-test-plan  ──►  context/foundation/test-plan.md  (strategy §1–§5 frozen + cookbook §6 grows)
        │
        ▼  (one rollout phase at a time, /clear between handoffs)
   /10x-new ──► /10x-research ──► /10x-plan ──► /10x-implement
```

`/10x-test-plan` is a **stateful orchestrator**, not a one-shot generator. On first run it writes the phased rollout to `context/foundation/test-plan.md`. On every subsequent run it re-derives state from on-disk artifacts and presents the next handoff. The lesson focus is **strategy and rollout sequencing, not configuration**. Hooks, MCP servers, and CI YAML are configured in later lessons of this module.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Quality strategy as a rules-file (lesson focus)** | |
| `/10x-test-plan` | You have a PRD (and ideally a roadmap and a few archived slices) and you are about to write the project's first tests, or you noticed that AI-generated tests are landing on helpers while critical flows go uncovered. First invocation runs discovery (PRD + roadmap + archive + hot-spot scan), a 5-question user interview, and a synthesis pass with a mandatory challenger check, then writes `test-plan.md` in `context/foundation/` with a risk map (5–7 failure scenarios), a phased rollout table, a stack table, a quality-gates table, a cookbook section (`§6`, fills in as phases ship), and a negative-space section (what we deliberately don't test). Subsequent invocations advance the rollout one handoff at a time. |
| `/10x-test-plan --status` | A `test-plan.md` already exists and you want a compact snapshot of where the rollout stands — which phases are `not started`, `change opened`, `researched`, `planned`, `implementing`, or `complete`, and what the next action is. Does no work; safe to run any time. |
| `/10x-test-plan --refresh` | A `test-plan.md` already exists and one of: a new top-3 risk surfaced from the roadmap or archive, a tool's `checked:` date is older than three months, the project's tech stack changed, or §7 negative-space no longer matches what the team believes. Opens a new `test-plan-refresh-<YYYY-MM-DD>` change folder rather than editing the guide in place. |

### Rollout chain — what happens after the guide is written

The guide's §3 *Phased Rollout* table is the orchestrator's state. For each non-`complete` row the orchestrator selects the next handoff based on which artifacts exist in `context/changes/<change-id>/`:

| State on disk | Next handoff | Status transitions to |
| --- | --- | --- |
| change folder missing | `/10x-new <change-id>` | `change opened` |
| `change.md` only | `/10x-research` (with a risks-to-verify brief) | `researched` |
| `+ research.md` | `/10x-plan` (with cost × signal + cookbook-update constraints) | `planned` |
| `+ plan.md` with pending `## Progress` items | `/10x-implement <change-id> phase <N>` | `implementing` / `complete` |
| `+ plan.md` fully `[x]` | Mark §3 row `complete`; loop to next pending row | — |

Each handoff is a **STOP point**. The orchestrator copies the next command to the clipboard, asks the user to `/clear` and run it, then exits. Re-invoke `/10x-test-plan` (no arguments) to advance.

### Risk-first prioritization rules

- Risks are **failure scenarios in user / business terms**, not test names. "Logged-out user reaches paid content via stale token" is a risk; "test the login form" is not.
- 5 to 7 risks. Fewer is too coarse; more makes prioritization useless.
- Impact and likelihood are user/business ratings, not technical complexity.
- Every risk traces to a source: PRD section, archived slice, roadmap entry, Phase 2 interview question, hot-spot **directory** with churn count, or a tech-stack constraint. No invented risks.
- **Signal, not knowledge.** §2 cites *evidence that raised the risk*, never a file as "where the failure lives." File:line anchors, function names, schema names, and module names are forbidden in §2 — they belong in `/10x-research`'s output, produced per rollout phase against current code. The plan is a QA spec; it is not a code audit.
- Coverage is not the metric. **Risk coverage** is the metric.

### Dual-layer mapping rules

- Classic layer first: the cheapest test that gives a real signal wins. Promote to e2e only when no cheaper layer covers the risk.
- AI-native layer second, and only where it adds signal classic tests do not give cheaply.
- Every AI-native row has a **"When NOT to use"** line. If you cannot write one, drop the row.
- Every tool name carries a `checked: <YYYY-MM-DD>` date. Tool names are examples of the category, not endorsements.
- Both layers must be non-empty in the final guide if the project warrants them. Classic-only is a 2020 plan; AI-native-only is hype. AI-native phases are not mandatory — include them only when the brief justified them under cost × signal.

### Quality gates rules

- Required gates (lint, typecheck, unit+integration, e2e on critical flows) must map to actual CI steps. If a required gate is not yet wired, mark it as `required after §3 Phase <N>` and let the named rollout phase wire it.
- Post-edit hook is **recommended local**, not a CI substitute.
- Multimodal visual review is **selective**, applied to 1–3 critical screens, not to every page.
- Vision-driven fallback (Anthropic Computer Use or OpenAI CUA) is reserved for DOM-unreachable surfaces; expensive per action.

### Cookbook patterns (§6) — fills in over time

`test-plan.md` is both a phased strategy and a **growing cookbook**. §6 starts as placeholders (`TBD — see §3 Phase <N>`) and fills in incrementally — each rollout phase's plan ends with a sub-phase that updates the relevant §6 entry (location, naming, reference test, run command). After Module 3 completes, §6 becomes the canonical answer to "how do I add a test for X in this project?" — and is what `/10x-tdd` reads in Lesson 2.

### Lesson boundaries

- Do not write test code. That is Lesson 2 (`/10x-tdd` and unit-test authoring).
- Do not configure hooks, hook lifecycle, or debugging hooks. That is Lesson 3.
- Do not configure MCP servers, Playwright API, e2e code, or multimodal scenario code. That is Lesson 4.
- Do not run the bug-to-fix-to-regression-test workflow. That is Lesson 5.
- Do not author CI/CD pipelines from scratch or write GitHub Actions YAML. The guide names gates; configuration is owned by Module 1 Lesson 5 and Module 2 Lesson 5.
- Do not benchmark multimodal models. Cite criteria (cost, latency, agent-friendliness), never a ranking.
- Do not read the codebase for knowledge (call graphs, schemas, "which file owns this failure"). That is `/10x-research`'s job, per rollout phase.

### Paths used by this lesson

- `context/foundation/test-plan.md` — the quality contract produced and maintained by `/10x-test-plan`
- `context/foundation/prd.md` — primary risk source
- `context/foundation/roadmap.md` — likelihood weighting
- `context/foundation/tech-stack.md` — stack input (when present)
- `context/archive/<change-id>/plan.md` — implemented risk surface
- `context/changes/<change-id>/` — per-rollout-phase change folder (one per row in §3)

<!-- END @przeprogramowani/10x-cli -->

## Project: Kontrola Trasówek (10x Astro Starter)

Scaffolded via `/10x-bootstrapper` from the `10x-astro-starter` template
(Astro + Supabase + Cloudflare). This section carries the project-specific
guidance the starter shipped with — merged in by hand after the scaffold's
own `CLAUDE.md.scaffold` was reviewed, since it did not overwrite the toolkit
block above.

### Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)
- `npm run smoke` — dependency-free auth-flow smoke test (`scripts/smoke.mjs`) against a running server, `BASE_URL` env (default `http://localhost:4321`). Run after dependency upgrades; CI runs it against the production preview with a local Supabase.
- `npm run test:integration` — Vitest with `vitest.integration.config.ts` over `tests/integration/**/*.int.test.ts`: proves per-user data isolation (RLS on every table and operation, and the HTTP routes) against a **local** Supabase (reads connection info from `npx supabase status -o env`, not `.env`/`.dev.vars`). Requires `npx supabase start` and the app running at `BASE_URL` (default `http://localhost:4321`) connected to that local Supabase — e.g. `.dev.vars` with `API_URL`/`ANON_KEY` from `npx supabase status -o env`. CI runs it in the `smoke` job after `npm run smoke`.
- `npm test` — Vitest unit tests (`src/**/*.test.ts`, config in `vitest.config.ts`). `report-parser.test.ts` and `deviation-rules.test.ts` hold the detection oracle on `test-data/sample-report.{csv,xlsx}` (which row indexes each rule flags) plus parser error branches and rule boundaries. Run after touching parsing or detection logic; CI runs it on every push.
- `npm run test:mutation` — Stryker mutation testing (`stryker.config.json`) over `report-parser.ts`, `deviation-rules.ts` and `geo.ts`; HTML report in `reports/mutation/`. Local only (not in CI), no `break` threshold.
- `npm run db:types` — regenerates `src/types.ts` from the **local** Supabase schema (`supabase gen types typescript --local`). Run after adding/editing a migration.

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

### Architecture

**Astro 7 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

#### Rendering mode

Full server-side rendering (`output: "server"` in astro.config.mjs). All pages are server-rendered by default. API routes must export `const prerender = false`.

#### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout,resend-confirmation}.ts`. Failures redirect with a **code** in `?error=` (`authErrorUrl` / `authErrorCode` in `src/lib/auth-errors.ts`), never free text; the auth pages render only `authErrorMessage(code)` (unknown code → generic message), and raw Supabase messages go to `console.error` only.
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected pages: `src/pages/reports/{index,[id]}.astro` (the starter's `dashboard.astro` stub was removed once real protected pages existed)

#### Report upload & deviation detection pipeline

This is the core product flow and spans several files — read all of them before changing any one:

1. `src/pages/reports/index.astro` — upload form, posts `multipart/form-data` to the API below.
2. `src/pages/api/reports/upload.ts` — validates size (5 MB) and MIME type, then runs the steps below inside one request. Uses **compensating deletes** instead of a DB transaction (Supabase JS has no multi-table transaction API): if inserting visits or deviations fails after the report row is committed, it deletes the report (cascades to visits/deviations) rather than leaving an orphan.
3. `src/lib/services/report-parser.ts` — turns the uploaded CSV/XLSX into `ExtractedVisit[]`. Expects fixed, lower-cased Polish column headers (`przedstawiciel`, `data_wizyty`, `gps_wlaczony`, `odwiedzony_klient` are required; `typ_aktywnosci`, `dystans_km`, `czas_na_miejscu_min`, `planowana_trasa`, `szerokosc`, `dlugosc` are optional) — changing a header name here is a breaking change for any existing report fixtures/scripts.
4. `src/lib/services/deviation-rules.ts` — three independent rule functions run against the parsed rows: `detectMissingGps` (per-visit), `detectPhoneInsteadOfVisit` (per-visit, explicit `"telefon"` type or a no-GPS + no-time heuristic), `detectRouteDeviations` (whole-report: groups consecutive visits per representative/day and flags using `src/lib/services/geo.ts`'s haversine distance against a 1.5x-of-straight-line threshold). All three treat an unrecognized/blank `activity_type` as "not a confirmed visit" — keep that consistent if you add a fourth rule.
5. Rows land in Supabase tables `reports` → `visits` → `deviations` (per-row RLS, see below), then `src/pages/reports/[id].astro` re-fetches `visits` with a joined `deviations(*)` select and passes them to `DeviationsList.tsx`.
6. `src/components/reports/DeviationsList.tsx` does filtering/sorting and CSV/XLSX export **client-side** over the already-fetched rows — there's no server-side query-param filtering. Export reuses the same `xlsx` package as parsing (see below) and guards against CSV formula injection on free-text fields (`csvField()`).

**RLS pattern** (`supabase/migrations/20260925120100_report_schema_rls.sql`): `reports.user_id = auth.uid()` is the only direct ownership check; `visits` and `deviations` have no `user_id` column and instead use `EXISTS` subqueries joining up to `reports` (two levels deep for `deviations`). Follow this same join-up pattern for any new child table instead of denormalizing a `user_id` onto it.

#### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **Design tokens over literals**: color tokens live in `src/styles/global.css` (`@theme inline`). Before styling a view, check `src/components/ui/` for an existing shared component rather than building a one-off control; add missing primitives with `npx shadcn@latest add [name]`. Do not use literal Tailwind palette colors (`slate-*`, `indigo-*`, etc.) or raw hex values in views — reference a token by role (e.g. `bg-primary`, `text-muted-foreground`) instead. `--primary` carries the app's brand color, promoted from the historical `indigo-600` literal (see `context/archive/2026-10-06-reports-list-ui-tokens/token-source.md`); a future rebrand color change belongs in `global.css`, not scattered literals. See `src/pages/dev/kitchen-sink/reports-list.astro` for a reference render of the reports list across its 7 component states.
- **Surface roles**: `bg-background` is the page only — in light it is tinted neutral-50 (`oklch(0.985 0 0)`) while `--card` / `--popover` stay white. Anything that sits on the page as a surface (cards, panels, bands, dialogs, outline controls) uses `bg-card` or `bg-popover`, never `bg-background` (the `outline` button and `DialogContent` were re-pointed for this). Do not put `text-muted-foreground` on a band or panel darker than the page: it is 4.53:1 on the page and 4.34:1 on `--muted`. Values and measurements: `context/archive/2026-10-08-light-surface-tokens/token-source.md`.
- **Dashboard (Pulpit) contract**: containers are `Card` from `src/components/ui/card.tsx` (density tightened on purpose — don't reset it to shadcn's `py-6/px-6`). Deviation-rule series (legend, chart segments, ranking bar) use the `--rule-gps` / `--rule-phone` / `--rule-route` tokens via `RULE_SERIES` / `RULE_SERIES_ORDER` in `src/lib/rule-series.ts` — never `primary/NN` opacity steps or palette classes (values and contrast: `context/archive/2026-10-07-dashboard-ui-tokens/token-source.md`). The page fetches; `src/components/dashboard/DashboardView.astro` renders, so `src/pages/dev/kitchen-sink/dashboard.astro` shows all 7 states in light and dark from fixtures. Run `npm run check:ui-tokens` after touching dashboard files (allow-listed arbitrary values live in `scripts/check-ui-tokens.mjs`). Two traps: `npx shadcn add` resolved the `utils` alias to the unrelated npm package `cn` once — check `git diff package.json` and the import after every add; and Astro drops a whitespace-only text node between `{a} {b}` passed as children to a React component (e.g. `CardFooter`) — use `{" "}` or one template string.
- **Reports list (Raporty) contract**: in-page messages on this view use `Alert` from `src/components/ui/alert.tsx` (`default` / `destructive` / `success`; pass `role="status"` for success). `Banner.astro` is only the full-bleed strip (config warning in `Layout.astro`); every in-page message (reports, report details, dashboard, confirm-email) uses `Alert`. Report upload/delete failures travel to `/reports` as a code from `src/lib/report-errors.ts` (`reportErrorUrl` / `reportErrorMessage`), never as free text; raw Supabase messages are never shown — upload/delete failures are logged with `logAppEvent` (code only, see "Logging server-side failures"), and the page never renders `?detail` (only `ReportUpload` reads it from the XHR redirect). Upload timestamps (list, delete dialog, report details header, dashboard) go through `formatDateTime` in `src/lib/format-date.ts` (Europe/Warsaw, `DD.MM.YYYY, HH:MM`); use it for any new user-facing timestamp instead of `getHours()` (`DeviationsList.tsx` review dates included; visit dates are date-only strings and stay on `formatVisitDate`). States are rendered from real components in `src/pages/dev/kitchen-sink/reports-list.astro` (light + dark; open delete dialog on `?dialog=1`); capture with `node scripts/kitchen-sink-shot.mjs <url> <width> <out.png>` (CDP device emulation — plain Chrome headless ignores widths under ~485px). `npm run check:ui-tokens` covers this view too; new reviewed values go into its allow-lists with a comment.
- **Claude Design views keep their user-facing information**: styles, colours, components and display logic of views implemented from Claude Design (Raporty, Dialogi i błędy, Szczegóły raportu, Pulpit, Strona startowa, auth pages) may be refined, but the wording of messages, labels and hints — and the detail they carry (e.g. the missing-columns card's per-column table and near-miss hints) — must stay word for word unless the user approves a change.
- **Landing page & brand-colour contrast**: `src/components/Welcome.astro` uses `Card` with the Claude Design dimensions as explicit overrides, the token focus ring on every link, and below `md` hides the section and auth links behind the header menu button (`data-landing-menu-toggle`, Esc/link-click/resize close it). It takes dev-only props `user` and `menuOpen`, used by `src/pages/dev/kitchen-sink/landing.astro` (capture the 390px view with `?compact=1`). Text on or in `--primary` must stay ≥ 4.5:1 in both themes: the dark theme pairs a light `--primary` (indigo-400) with a dark `--primary-foreground` — values and measurements in `context/archive/2026-10-07-landing-ui-contract/token-source.md`; re-measure before changing either token. `npm run check:ui-tokens` covers `Welcome.astro`.
- **Report details (Szczegóły raportu) contract**: `src/pages/reports/[id].astro` renders load failures through `src/components/reports/ReportLoadError.astro` with kinds, messages and HTTP statuses from `src/lib/report-load-errors.ts` — `not_found` 404 (missing, foreign or malformed id, checked by a UUID regex before any query), `not_configured` 503, `load_failed` 500 (raw Supabase message to `console.error` only); never report a database failure as "not found". In `DeviationsList.tsx` review/export failures set one `Alert variant="destructive"` under the toolbar (cleared when a new attempt of the same kind starts, never on success — an overlapping success must not hide a failure) — no silent `console.error`-only failures. The visit date is the expand control (`<button aria-expanded aria-controls>`); the row click is a mouse convenience only, don't move expansion back onto the `<tr>`. Containers are `Card` with explicit design overrides; below `md` the Klient and Status columns are hidden and the status block (`statusContent`) renders under the deviations so the table fits 390px; representative groups start collapsed; group progress counts fully reviewed visits, not deviations. Dev-only props (`initialExpandedReps`, `initialOpenVisitIds`, `initialFilters`, `initialPendingIds`, `initialActionError`) exist for `src/pages/dev/kitchen-sink/report-details.astro` (7 states, light + dark, plus the three page errors). Rule labels/counts stay `text-destructive` here (a rule is a problem to check, not a `--rule-*` data series). `npm run check:ui-tokens` covers the page, the island and `ReportLoadError.astro`.
- **API routes**: use uppercase `GET`, `POST` exports. No validation library is wired in yet (`zod` is not a direct dependency, only a transitive one via Astro) — handlers read `formData.get(...)`/`request.json()` directly; don't assume zod exists.
- **Logging server-side failures**: use `logAppEvent` from `src/lib/app-events.ts`, never `console.error` with a raw error object. It writes one plain object per entry (Workers Logs indexes its fields; a string prefix or second argument turns it into unsearchable text), whitelists the fields — only `error.code` from a Supabase error, ids only when UUID-shaped, file extension never the filename, parser `detail` only for `invalid_file` — and derives `error`/`warn` from the event name. Add a new event name or field in that module, not at the call site. Every error redirect in `src/pages/api/reports/upload.ts` and `[id]/delete.ts` logs one entry, including a failed compensating rollback (`report.upload.rollback_failed`). Entries are kept by Cloudflare Workers Logs (`observability.logs.enabled` in `wrangler.jsonc`) and queried in the dashboard (Workers → the worker → Logs) by `event`; `invocation_logs` also records one entry per request (method, path, status). Retention per Cloudflare docs: 3 days on Workers Free (this project, see `infrastructure.md`), 7 days on Paid — check entries within that window.
- **Supabase migrations**: live in `supabase/migrations/`, named `YYYYMMDDHHmmss_short_description.sql`. Every table enables RLS with granular per-operation policies from the start (see the pipeline section above for the ownership pattern). After adding/editing a migration, run `npm run db:types` to regenerate `src/types.ts`.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/hooks/` (matches the `@/hooks` alias in `components.json`; no hooks extracted yet).
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic, e.g. `report-parser.ts`, `deviation-rules.ts`, `geo.ts`).
- **Shared types**: `src/types.ts` is generated output (`npm run db:types`), not hand-written — don't edit it directly, edit the migration and regenerate.
- **`xlsx`**: the dependency named `xlsx` in `package.json` resolves to the `@e965/xlsx` npm mirror (the original `xlsx` package stopped receiving security patches after 0.18.5). Used both server-side (parsing uploads) and client-side (exporting the deviations list) — same package, two call sites.
- **Tests**: Vitest, co-located as `*.test.ts` next to the module (pure modules only so far — no Astro runtime, no Supabase, no DOM). Changes to `report-parser.ts` or `deviation-rules.ts` must keep `report-parser.test.ts` and `deviation-rules.test.ts` green. `npm run smoke` stays a dependency-free script outside Vitest (it needs a running server); integration tests that need local Supabase live in `tests/integration/` (`npm run test:integration`), outside `npm test`.
- Dependency versions are intentionally bleeding-edge: TypeScript `^6.0.3`, ESLint `^10.10.0`, `lucide-react` `^1.14.0` — don't "fix" these thinking they're typos. The one deliberate exception is `vitest` `^4.1.10`: `@stryker-mutator/vitest-runner` 10 is built against Vitest 4.1, and on Vitest 5 it silently never activates mutants (every mutant "survives", exit 0) — don't bump it until the runner supports 5 and `npm run test:mutation` still kills mutants. `eslint-plugin-react` is wrapped with `fixupPluginRules` in `eslint.config.js` since it doesn't yet natively support ESLint 10's context API.

#### Environment

- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev)
- Both vars are declared `optional: true` in the `astro:env` schema — the app degrades gracefully (see `src/lib/config-status.ts`) rather than hard-failing when unset.
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth)

### CI

GitHub Actions workflow (`.github/workflows/ci.yml`) has two jobs on every push/PR to master: `ci` (`npx astro sync` → `npm run lint` → `npm test` → `npx astro check` → `npm run build`, using `SUPABASE_URL`/`SUPABASE_KEY` repo secrets) and `smoke` (spins up local Supabase via CLI, builds, `npm run preview`, then `npm run smoke` and `npm run test:integration` — no secrets needed).
