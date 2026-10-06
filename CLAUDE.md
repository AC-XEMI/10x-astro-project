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
- `npm run verify:rls` — `scripts/verify-rls.mjs`, proves the RLS policies actually isolate per-user data (not just that they exist) against a **local** Supabase instance (reads connection info from `npx supabase status -o env`, not `.env`/`.dev.vars`). Requires `npx supabase start` first.
- `npm run verify:report-detection` — `scripts/verify-report-detection.mjs`, runs `report-parser.ts` + `deviation-rules.ts` directly against fixture CSV/XLSX files (no Supabase needed) and asserts which row indexes get flagged by each rule. Run this after touching parsing or detection logic.
- `npm run db:types` — regenerates `src/types.ts` from the **local** Supabase schema (`supabase gen types typescript --local`). Run after adding/editing a migration.

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

### Architecture

**Astro 7 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

#### Rendering mode

Full server-side rendering (`output: "server"` in astro.config.mjs). All pages are server-rendered by default. API routes must export `const prerender = false`.

#### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
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
- **API routes**: use uppercase `GET`, `POST` exports. No validation library is wired in yet (`zod` is not a direct dependency, only a transitive one via Astro) — handlers read `formData.get(...)`/`request.json()` directly; don't assume zod exists.
- **Supabase migrations**: live in `supabase/migrations/`, named `YYYYMMDDHHmmss_short_description.sql`. Every table enables RLS with granular per-operation policies from the start (see the pipeline section above for the ownership pattern). After adding/editing a migration, run `npm run db:types` to regenerate `src/types.ts`.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/hooks/` (matches the `@/hooks` alias in `components.json`; no hooks extracted yet).
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic, e.g. `report-parser.ts`, `deviation-rules.ts`, `geo.ts`).
- **Shared types**: `src/types.ts` is generated output (`npm run db:types`), not hand-written — don't edit it directly, edit the migration and regenerate.
- **`xlsx`**: the dependency named `xlsx` in `package.json` resolves to the `@e965/xlsx` npm mirror (the original `xlsx` package stopped receiving security patches after 0.18.5). Used both server-side (parsing uploads) and client-side (exporting the deviations list) — same package, two call sites.
- No test framework is configured (no vitest/jest/playwright). `npm run smoke`, `npm run verify:rls`, and `npm run verify:report-detection` are dependency-free sanity scripts, not a substitute for real tests — add a framework deliberately when needed.
- Dependency versions are intentionally bleeding-edge: TypeScript `^6.0.3`, ESLint `^10.10.0`, `lucide-react` `^1.14.0` — don't "fix" these thinking they're typos. `eslint-plugin-react` is wrapped with `fixupPluginRules` in `eslint.config.js` since it doesn't yet natively support ESLint 10's context API.

#### Environment

- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev)
- Both vars are declared `optional: true` in the `astro:env` schema — the app degrades gracefully (see `src/lib/config-status.ts`) rather than hard-failing when unset.
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth)

### CI

GitHub Actions workflow (`.github/workflows/ci.yml`) has two jobs on every push/PR to master: `ci` (`npx astro sync` → `npm run lint` → `npx astro check` → `npm run build`, using `SUPABASE_URL`/`SUPABASE_KEY` repo secrets) and `smoke` (spins up local Supabase via CLI, builds, `npm run preview`, then `npm run smoke` — no secrets needed).
