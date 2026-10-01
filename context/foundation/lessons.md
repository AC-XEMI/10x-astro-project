# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## CLAUDE.md wymaga `prerender = false` w API routes, ale żaden endpoint tego nie robi

**Context:** Wszystkie dotychczasowe API routes (`src/pages/api/auth/{signin,signup,signout}.ts`, `src/pages/api/reports/upload.ts`, `src/pages/api/reports/[id]/delete.ts`) — żaden nie eksportuje `const prerender = false`.

**Problem:** CLAUDE.md jawnie mówi "API routes must export `const prerender = false`", ale żaden istniejący endpoint tego nie robi. Funkcjonalnie bez znaczenia dziś, bo `astro.config.mjs` ma globalne `output: "server"` (wszystkie trasy są domyślnie server-rendered) — ale zapisana reguła i rzeczywisty kod są rozbieżne.

**Rule:** Każdy nowy API route (`src/pages/api/**`) musi jawnie eksportować `export const prerender = false;`, nawet gdy `astro.config.mjs` ma globalne `output: "server"` — dokumentacja i kod mają się zgadzać, a jawna deklaracja chroni przed cichą regresją, gdyby `output` kiedyś się zmieniło.

**Applies to:** Wszystkie pliki pod `src/pages/api/**`; sprawdzać przy review nowych endpointów.
