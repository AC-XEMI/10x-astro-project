<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 2

Lesson 2 is about **writing tests that actually protect code** — not just maximise coverage. The oracle problem and vibe-testing anti-patterns explain why LLM-generated tests fail on real code; the risk-first quality contract from Lesson 1 is the fix.

```
context/foundation/test-plan.md (§3 Phased Rollout)
        │
        ▼  (one rollout phase at a time)
   /10x-research  ──►  research.md  (oracle source: what code should do, not what it does)
        │
        ▼
   /10x-plan  ──►  plan.md  (cost × signal, two-layer strategy, ordered phases)
        │
        ▼
   /10x-implement  or  /10x-tdd   ──►  working tests + §6 cookbook update
```

`/10x-tdd` is an **optional test-first mode**, not a replacement for the chain. It reads the same `plan.md`, writes to the same `## Progress` section, and covers the same phases as `/10x-implement`. Use it only when you can name the first failing assertion before writing any code.

### Task Router — Where to start

| Skill / Prompt | Use it when |
| --- | --- |
| `/10x-research` | Before writing any test for a risk. Research produces the oracle — what behaviour a test must prove — from sources (PRD, tech-stack, docs), not from the implementation shape. Also reveals whether a risk is already covered or has two separate faces (one safe, one real). |
| `/10x-plan` | Research is done. Plan decomposes the risk into ordered phases: environment setup first, then rules that depend on it, then hermetic stubs for failures that real infra cannot trigger, then cookbook update. Each phase names the behaviour it asserts and the regression it catches. |
| `/10x-implement` | Default executor for plan phases. Use for environment setup, existing code, scaffolding, and any phase where you cannot define a red test before writing code. |
| `/10x-tdd` | Optional. Use instead of `/10x-implement` for a phase where you can name the first red test in one sentence. Agent writes the failing test first, then the minimal code to green it, then refactors. Stops at the assertion before touching the implementation — that pause is the point. |
| `m3l2-ad-hoc-testing` prompt | You have a single file and want tests now, without the full research→plan→implement cycle. The prompt forces oracle-from-sources (reads PRD + TECH_STACK before asserting), behavioural assertions, edge cases from risk, and a regression table. Use it knowing you are trading depth for speed. |

### When to use `/10x-tdd` vs `/10x-implement`

The deciding question: *Can you name the first red test in one sentence?*

Good conditions for `/10x-tdd`:
- "promuje wyłącznie drafty w stanie `accepted`, a `pending`/`rejected` nigdy nie trafiają do talii"
- "zwraca `ok: true` i loguje `orphan_review_state`, gdy upsert stanu powtórek padnie w trakcie zapisu"
- "zwraca 401, gdy użytkownik nie ma dostępu do kursu"
- "resetuje interwał powtórki do jednego dnia, gdy ocena wynosi 0"

Each of these names an observable outcome, not an internal detail. If you cannot produce a sentence like this, stay on `/10x-implement` or return to `/10x-research`.

`/10x-tdd` is **not suited** for: environment setup, CI/CD config, documentation, thin wiring where the test would just rewrite the implementation, or a spike where you are still discovering the contract.

You can mix both modes in one plan:

```
/10x-implement <change-id> phase 1   # environment
/10x-tdd       <change-id> phase 2   # contract (new code)
/10x-tdd       <change-id> phase 3   # contract (API endpoint)
/10x-implement <change-id> phase 4   # cookbook + plan sync
```

Both write progress to the same `## Progress` section in `plan.md`.

### Two-layer test strategy (cost × signal)

For each risk, pick the **cheapest test that gives a real signal**. Do not default to e2e "because it's safest", and do not chase coverage percentage.

| Layer | When to use | When NOT to use |
| --- | --- | --- |
| Integration (real DB / real infra) | The rule involves DB constraints, cascades, real SQL, or unique constraints that a mock would lie about. | Auth flows gated by RLS that belong to a separate phase; anything where setup cost exceeds signal value. |
| Hermetic (stub client) | Partial failures that real infra cannot trigger easily (e.g. second operation in a sequence fails). | Rules that depend on actual DB state — a stub will lie about constraint violations and cascades. |

A non-atomic save sequence (multiple independent operations without a transaction) means: write hermetic tests for partial-failure branches, not integration tests that force a mid-sequence error.

### Oracle rules

- The oracle — what the code *should* do — must come from sources: PRD, docs, tech-stack constraints, domain knowledge. It must **not** come from reading the implementation.
- If the implementation has a bug, copying its output as the expected value produces a mirror test that passes against the bug.
- When sources do not resolve the expected behaviour unambiguously, **stop and ask** rather than guessing.
- Research's job is to surface the oracle before any test is written.

### Vibe-testing anti-patterns to avoid

| Anti-pattern | How it looks | What to do instead |
| --- | --- | --- |
| Mirror implementation | Assertion computes the expected value with the same logic as the tested code. | Assert against a value derived from the oracle (PRD / domain rule), not from the implementation. |
| Happy paths only | Tests only pass valid inputs; edge cases absent. | Add at least one edge case per risk: `null`, empty, dependency error, invalid input. |
| Redundant copies | Six nearly identical tests checking the same absence of a sentinel. | One parameterised test (`it.each`) per property; each test catches a different regression. |

### Mutation testing (Stryker) — selective quality gate

Coverage says "this line was executed". Mutation score says "would a test fail if I broke this line?" Use Stryker as a **selective gate** after a risk phase, not as a CI gate on every commit.

Workflow:
1. Tests pass for the risk phase.
2. Run `npx stryker run --mutate "path/to/file.ts"` (narrow scope to the changed module).
3. Open the HTML report; find survived mutants.
4. For each survived mutant ask: "Would this change hurt a user or the business?"
   - Yes → add an assertion that kills the mutant.
   - No (equivalent mutant or cosmetic change) → ignore consciously.
5. Do not chase 100% mutation score. A test that pins implementation details to kill a cosmetic mutant is itself a vibe test.

The integration gate can stay **ad hoc** (not on every commit) when running local infra is expensive. Mark it accordingly in `test-plan.md §4`.

### Lesson boundaries

- Do not configure hooks, hook lifecycle, or debugging hooks. That is Lesson 3.
- Do not configure MCP servers, Playwright API, e2e code, or multimodal scenario code. That is Lesson 4.
- Do not run the bug-to-fix-to-regression-test workflow. That is Lesson 5.
- Do not author CI/CD pipelines from scratch. That is Module 1 Lesson 5 / Module 2 Lesson 5.
- Do not run `/10x-test-plan` to change the risk strategy. That is Lesson 1. Use `/10x-test-plan --status` to read current state.
- Do not write tests without a research step unless using the ad-hoc prompt with full awareness of its trade-offs.

### Paths used by this lesson

- `context/foundation/test-plan.md` — §3 rollout state; §6 cookbook (filled in as phases ship)
- `context/changes/<change-id>/research.md` — oracle source per rollout phase
- `context/changes/<change-id>/plan.md` — ordered phases with `## Progress` as execution state
- `.claude/prompts/m3l2-ad-hoc-testing.md` — ad-hoc file-level testing prompt

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
- **Dashboard (Pulpit) contract**: containers are `Card` from `src/components/ui/card.tsx` (density tightened on purpose — don't reset it to shadcn's `py-6/px-6`). Deviation-rule series (legend, chart segments, ranking bar) use the `--rule-gps` / `--rule-phone` / `--rule-route` tokens via `RULE_SERIES` / `RULE_SERIES_ORDER` in `src/lib/rule-series.ts` — never `primary/NN` opacity steps or palette classes (values and contrast: `context/archive/2026-10-07-dashboard-ui-tokens/token-source.md`). The page fetches; `src/components/dashboard/DashboardView.astro` renders, so `src/pages/dev/kitchen-sink/dashboard.astro` shows all 7 states in light and dark from fixtures. Run `npm run check:ui-tokens` after touching dashboard files (allow-listed arbitrary values live in `scripts/check-ui-tokens.mjs`). Two traps: `npx shadcn add` resolved the `utils` alias to the unrelated npm package `cn` once — check `git diff package.json` and the import after every add; and Astro drops a whitespace-only text node between `{a} {b}` passed as children to a React component (e.g. `CardFooter`) — use `{" "}` or one template string.
- **Reports list (Raporty) contract**: in-page messages on this view use `Alert` from `src/components/ui/alert.tsx` (`default` / `destructive` / `success`; pass `role="status"` for success). `Banner.astro` is only the full-bleed strip (config warning in `Layout.astro`); every in-page message (reports, report details, dashboard, confirm-email) uses `Alert`. Report upload/delete failures travel to `/reports` as a code from `src/lib/report-errors.ts` (`reportErrorUrl` / `reportErrorMessage`), never as free text; raw Supabase messages go to `console.error` only, and the page never renders `?detail` (only `ReportUpload` reads it from the XHR redirect). Upload timestamps (list, delete dialog, report details header, dashboard) go through `formatDateTime` in `src/lib/format-date.ts` (Europe/Warsaw, `DD.MM.YYYY, HH:MM`); use it for any new user-facing timestamp instead of `getHours()` (`DeviationsList.tsx` review dates included; visit dates are date-only strings and stay on `formatVisitDate`). States are rendered from real components in `src/pages/dev/kitchen-sink/reports-list.astro` (light + dark; open delete dialog on `?dialog=1`); capture with `node scripts/kitchen-sink-shot.mjs <url> <width> <out.png>` (CDP device emulation — plain Chrome headless ignores widths under ~485px). `npm run check:ui-tokens` covers this view too; new reviewed values go into its allow-lists with a comment.
- **Claude Design views keep their user-facing information**: styles, colours, components and display logic of views implemented from Claude Design (Raporty, Dialogi i błędy, Szczegóły raportu, Pulpit, Strona startowa, auth pages) may be refined, but the wording of messages, labels and hints — and the detail they carry (e.g. the missing-columns card's per-column table and near-miss hints) — must stay word for word unless the user approves a change.
- **Landing page & brand-colour contrast**: `src/components/Welcome.astro` uses `Card` with the Claude Design dimensions as explicit overrides, the token focus ring on every link, and below `md` hides the section and auth links behind the header menu button (`data-landing-menu-toggle`, Esc/link-click/resize close it). It takes dev-only props `user` and `menuOpen`, used by `src/pages/dev/kitchen-sink/landing.astro` (capture the 390px view with `?compact=1`). Text on or in `--primary` must stay ≥ 4.5:1 in both themes: the dark theme pairs a light `--primary` (indigo-400) with a dark `--primary-foreground` — values and measurements in `context/archive/2026-10-07-landing-ui-contract/token-source.md`; re-measure before changing either token. `npm run check:ui-tokens` covers `Welcome.astro`.
- **Report details (Szczegóły raportu) contract**: `src/pages/reports/[id].astro` renders load failures through `src/components/reports/ReportLoadError.astro` with kinds, messages and HTTP statuses from `src/lib/report-load-errors.ts` — `not_found` 404 (missing, foreign or malformed id, checked by a UUID regex before any query), `not_configured` 503, `load_failed` 500 (raw Supabase message to `console.error` only); never report a database failure as "not found". In `DeviationsList.tsx` review/export failures set one `Alert variant="destructive"` under the toolbar (cleared when a new attempt of the same kind starts, never on success — an overlapping success must not hide a failure) — no silent `console.error`-only failures. The visit date is the expand control (`<button aria-expanded aria-controls>`); the row click is a mouse convenience only, don't move expansion back onto the `<tr>`. Containers are `Card` with explicit design overrides; below `md` the Klient and Status columns are hidden and the status block (`statusContent`) renders under the deviations so the table fits 390px; representative groups start collapsed; group progress counts fully reviewed visits, not deviations. Dev-only props (`initialExpandedReps`, `initialOpenVisitIds`, `initialFilters`, `initialPendingIds`, `initialActionError`) exist for `src/pages/dev/kitchen-sink/report-details.astro` (7 states, light + dark, plus the three page errors). Rule labels/counts stay `text-destructive` here (a rule is a problem to check, not a `--rule-*` data series). `npm run check:ui-tokens` covers the page, the island and `ReportLoadError.astro`.
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
