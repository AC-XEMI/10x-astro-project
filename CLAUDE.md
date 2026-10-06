<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 5 (10xDevs 4.0 UI)

**For UI work on a view that already renders, use `/10x-ui`.** It runs the visual
change through the same chain as any other change (`/10x-new` → `/10x-research` →
`/10x-plan` → `/10x-implement` → `/10x-impl-review`) and carries the rules:
when to start and which view, the audit into charges, the design-system contract as
this repo realises it, the component states, the screenshot gate, and the rule that
keeps the next agent on the contract. Its `references/` hold the quality checklist.

Building a view for the first time is not a `/10x-ui` job — build it through the
ordinary chain, then come back to it with `/10x-ui`.

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
