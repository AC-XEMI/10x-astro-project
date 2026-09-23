# Repository Guidelines

Astro 7 SSR app (Cloudflare Workers adapter) with React 19 islands, Tailwind 4, and Supabase auth. `@CLAUDE.md` holds the full project convention set; this file is a terser, tool-agnostic distillation.

## Hard Rules

- `zod` is not a dependency — auth API routes (`src/pages/api/auth/*.ts`) read `formData.get(...)` directly with no validation library. Don't assume one exists.
- No test framework is configured. `npm run smoke` (`scripts/smoke.mjs`) is a dependency-free sanity script, not a substitute for real tests.
- No `supabase/migrations/` exist — this starter uses only Supabase Auth's built-in `auth.users` table. Enable RLS with granular per-operation, per-role policies on any new table from the start.
- `SUPABASE_URL`/`SUPABASE_KEY` are `optional: true` in the `astro:env` schema (`astro.config.mjs`) — code must degrade gracefully (`src/lib/config-status.ts`), not assume they're set.
- TypeScript `^6`, ESLint `^10`, and `lucide-react` `^1.14` are intentional bleeding-edge pins, not typos.

## Project Structure

`src/components/` (`auth/` = React sign-in/up forms, `ui/` = shadcn "new-york" components), `src/layouts/`, `src/lib/`, `src/middleware.ts` (route protection), `src/pages/api/auth/`, `src/pages/auth/`. See `@CLAUDE.md` for the full auth-flow file map.

## Build, Test, and Development Commands

`npm run dev` (Cloudflare workerd dev server), `npm run build` / `preview`, `npm run lint` / `lint:fix` (type-checked ESLint), `npm run format` (Prettier + Tailwind class sorting), `npm run smoke` (auth-flow check against `BASE_URL`, default `http://localhost:4321`).

## Coding Style & Naming

`@/*` aliases to `./src/*`; shadcn's hooks alias is `@/hooks` (`components.json`) though `src/hooks/` doesn't exist yet. Merge Tailwind classes with `cn()` from `@/lib/utils` — never concatenate class strings. shadcn components live in `src/components/ui/`, add via `npx shadcn@latest add [name]`. Lint/format rules are enforced by `@eslint.config.js` / `@.prettierrc.json`, not restated here.

## Testing Guidelines

No test framework configured. `npm run smoke` walks sign-up → sign-in → protected page → sign-out over HTTP; needs a reachable Supabase instance with email confirmation disabled.

## Commit & Pull Request Guidelines

Repo has a single commit — no established message convention yet. CI (`@.github/workflows/ci.yml`) runs on every push/PR to `master`: `ci` (lint, `astro check`, build; needs `SUPABASE_URL`/`SUPABASE_KEY` secrets) and `smoke` (local Supabase → preview → `npm run smoke`, no secrets).

## Security & Configuration

Copy `.env.example` to `.env` (Node) and `.dev.vars` (Cloudflare local dev, gitignored). Local Supabase via `npx supabase start` (Docker). Deploy with `npx wrangler deploy`; set secrets via `wrangler secret put`.
