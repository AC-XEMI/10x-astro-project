<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the two M3L4 skills in this order:**

1. **`/10x-e2e-setup`** — one-time setup: Playwright config (`webServer`,
   auth `setup` project, `storageState`), a green seed test, and `context/foundation/test-stack.md`.
2. **`/10x-e2e`** — the per-risk loop: risk → explore the running app with
   `playwright-cli` → generate → review against the five anti-patterns →
   re-prompt by name → verify with a deliberate break.

The skills' `references/` carry the full rules, anti-patterns, seed pattern, and
prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toHaveScreenshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **A red test is a signal, not a chore.** A changed selector → update the
  locator in a reviewed diff. A changed business behavior → the test caught a
  bug; never edit the assertion to match it. Fixing failing tests is Lesson 5.

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
- `npm run test:integration` — Vitest with `vitest.integration.config.ts` over `tests/integration/**/*.int.test.ts`: proves per-user data isolation (RLS on every table and operation, and the HTTP routes) against a **local** Supabase (reads connection info from `npx supabase status -o env`, not `.env`/`.dev.vars`). Requires `npx supabase start` and the app running at `BASE_URL` (default `http://localhost:4321`) connected to that local Supabase — e.g. `.dev.vars` with `SUPABASE_URL`/`SUPABASE_KEY` set to `API_URL`/`ANON_KEY` from `npx supabase status -o env`. CI runs it in the `smoke` job after `npm run smoke`.
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
- Account activation: email confirmation is required (`enable_confirmations = true` in `supabase/config.toml`; "Confirm email" must also be on in the hosted project). The activation link targets `src/pages/auth/confirm.ts` — `?token_hash=&type=email` via `verifyOtp` (template `supabase/templates/confirmation.html`, works on any device) or `?code=` via `exchangeCodeForSession` (Supabase's default template, same browser only); success signs in and redirects to `/reports`, any failure becomes `confirmation_link_invalid`. Locally the email lands in Mailpit (`http://127.0.0.1:54324`); `npm run smoke` reads the link from there, and integration `globalSetup` creates pre-confirmed accounts with the local service-role key.
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
- **API routes**: use uppercase `GET`, `POST` exports. No validation library is wired in yet (`zod` is not a direct dependency, only a transitive one via Astro) — handlers read `formData.get(...)`/`request.json()` directly; don't assume zod exists. JSON endpoints answer failures as `{ error: <code> }`, never a raw Supabase message: `POST /api/deviations/review` returns 400 `invalid_request` (ids must be a non-empty array of UUIDs, checked before the query), 404 `not_found` when the update touched no row (RLS hides foreign ids — "no error" is not success), 500 `update_failed`; a partial update stays 200 with only the changed rows. Without a session the middleware answers every protected page and API with 302 → `/auth/signin`, not 401.
- **Logging server-side failures**: use `logAppEvent` from `src/lib/app-events.ts`, never `console.error` with a raw error object. It writes one plain object per entry (Workers Logs indexes its fields; a string prefix or second argument turns it into unsearchable text), whitelists the fields — only `error.code` from a Supabase error, ids only when UUID-shaped, file extension never the filename, parser `detail` only for `invalid_file` — and derives `error`/`warn` from the event name. Add a new event name or field in that module, not at the call site. Every error redirect in `src/pages/api/reports/upload.ts` and `[id]/delete.ts` logs one entry, including a failed compensating rollback (`report.upload.rollback_failed`). Entries are kept by Cloudflare Workers Logs (`observability.logs.enabled` in `wrangler.jsonc`) and queried in the dashboard (Workers → the worker → Logs) by `event`; `invocation_logs` also records one entry per request (method, path, status). Retention per Cloudflare docs: 3 days on Workers Free (this project, see `infrastructure.md`), 7 days on Paid — check entries within that window.
- **Supabase migrations**: live in `supabase/migrations/`, named `YYYYMMDDHHmmss_short_description.sql`. Every table enables RLS with granular per-operation policies from the start (see the pipeline section above for the ownership pattern). After adding/editing a migration, run `npm run db:types` to regenerate `src/types.ts`.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/hooks/` (matches the `@/hooks` alias in `components.json`; no hooks extracted yet).
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic, e.g. `report-parser.ts`, `deviation-rules.ts`, `geo.ts`).
- **Shared types**: `src/types.ts` is generated output (`npm run db:types`), not hand-written — don't edit it directly, edit the migration and regenerate.
- **`xlsx`**: the dependency named `xlsx` in `package.json` resolves to the `@e965/xlsx` npm mirror (the original `xlsx` package stopped receiving security patches after 0.18.5). Used both server-side (parsing uploads) and client-side (exporting the deviations list) — same package, two call sites.
- **Tests**: Vitest unit tests co-located as `src/**/*.test.ts` next to the module (pure modules only — no Astro runtime, no Supabase, no DOM). Changes to `report-parser.ts` or `deviation-rules.ts` must keep `report-parser.test.ts` and `deviation-rules.test.ts` green. `npm run smoke` stays a dependency-free script outside Vitest (it needs a running server); integration tests that need local Supabase live in `tests/integration/*.int.test.ts` (`npm run test:integration`, `vitest.integration.config.ts`), outside `npm test` and Stryker. `globalSetup` creates three accounts per run (A and B for isolation, C only for the sign-out test — `signOut()` is global) and fails loudly if the app at `BASE_URL` is not connected to the local Supabase; reuse `tests/integration/helpers/` (`clientAs`/`anonClient`, `HttpClient` with `Origin` + cookie jar, `signInViaApp`, `uploadSampleReport`). Every denial asserts the database state re-read as the owner (and a control that the owner does see the row), never only a status code; at most one app sign-in per account per file (auth rate limit 30/5 min, shared with smoke). A new route under `src/pages` must be added to `PROTECTED_REQUESTS` or `PUBLIC_ROUTES` in `route-access.int.test.ts` — the inventory test fails otherwise. How-to: `context/foundation/test-plan.md` §6.2–§6.3.
- Dependency versions are intentionally bleeding-edge: TypeScript `^6.0.3`, ESLint `^10.10.0`, `lucide-react` `^1.14.0` — don't "fix" these thinking they're typos. The one deliberate exception is `vitest` `^4.1.10`: `@stryker-mutator/vitest-runner` 10 is built against Vitest 4.1, and on Vitest 5 it silently never activates mutants (every mutant "survives", exit 0) — don't bump it until the runner supports 5 and `npm run test:mutation` still kills mutants. `eslint-plugin-react` is wrapped with `fixupPluginRules` in `eslint.config.js` since it doesn't yet natively support ESLint 10's context API.

#### Environment

- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev)
- Both vars are declared `optional: true` in the `astro:env` schema — the app degrades gracefully (see `src/lib/config-status.ts`) rather than hard-failing when unset.
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth)

### CI

GitHub Actions workflow (`.github/workflows/ci.yml`) has two jobs on every push/PR to master: `ci` (`npx astro sync` → `npm run lint` → `npm test` → `npx astro check` → `npm run build`, using `SUPABASE_URL`/`SUPABASE_KEY` repo secrets) and `smoke` (spins up local Supabase via CLI, builds, `npm run preview`, then `npm run smoke` and `npm run test:integration` — no secrets needed).
