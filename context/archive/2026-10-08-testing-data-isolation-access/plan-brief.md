# Izolacja danych i dostęp w CI — Plan Brief

> Full plan: `context/changes/testing-data-isolation-access/plan.md`
> Research: `context/changes/testing-data-isolation-access/research.md`

## What & Why

Faza 1 planu testów (`context/foundation/test-plan.md`) dotyczy dwóch najwyższych ryzyk:

- **#1:** kierownik widzi, oznacza lub usuwa dane innego kierownika;
- **#2:** niezalogowany użytkownik albo stara sesja dostaje się do chronionej strony lub API.

Izolacja danych w aplikacji opiera się wyłącznie na RLS, a ochrona tras na liście prefiksów w middleware. Dziś nic nie dowodzi, że oba mechanizmy działają dla każdej drogi dostępu.

## Starting Point

- `verify-rls.mjs` (w CI) sprawdza tylko część operacji, bez ponownego odczytu stanu i bez HTTP.
- `smoke.mjs` sprawdza bez sesji tylko `/reports`.
- `POST /api/deviations/review` dla cudzych id zwraca 200 `{ updated: [] }` i przy błędzie bazy ujawnia surowy komunikat Supabase.
- Repo nie ma warstwy testów integracyjnych. Vitest obejmuje tylko czyste moduły w `src/`.

## Desired End State

- `npm run test:integration` (osobny config Vitest, `tests/integration/`) działa w jobie CI `smoke` na lokalnym Supabase i zbudowanej aplikacji, blokując deploy.
- Suita dowodzi na trzech kontach testowych:
  - B nie odczyta, nie wstawi, nie zmieni i nie usunie danych A ani przez bazę, ani przez HTTP;
  - bez sesji i po wylogowaniu każda chroniona trasa odmawia.
- Review jawnie odmawia (404 z kodem).
- `verify-rls.mjs` zniknął, a cookbook §6.2/§6.3 opisuje wzorzec dla kolejnych faz.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Najtańsza warstwa | Integracja z lokalnym Supabase + HTTP na zbudowanej aplikacji | Autoryzacja to tylko RLS, więc test bazy daje główny sygnał, a HTTP sprawdza tłumaczenie odmowy | Research |
| Kontrakt review dla cudzych id | 404 `not_found`, 400 dla id spoza UUID, 500 `update_failed` bez surowego komunikatu, `logAppEvent` | Spełnia „odmowę” z ryzyka #1 i regułę „kod, nie tekst”; klient już traktuje `!ok` jako błąd | Plan |
| Narzędzie | Osobny `vitest.integration.config.ts`, `*.int.test.ts`, `npm run test:integration` | Wspólne helpery dla faz 2–3 planu testów, poza `npm test` i Strykerem | Plan |
| `verify-rls.mjs` | Wchłonąć do suity i usunąć (skrypt, npm, CI) | Jedno źródło prawdy o izolacji | Plan |
| Zakres wylogowania | Odtworzone ciasteczka na trasach aplikacji; stary JWT bezpośrednio do PostgREST → §7 | Aplikacja kontroluje swoje trasy; JWT jest bezstanowy do `jwt_expiry` | Plan |
| API bez sesji | Test akceptuje 302 → `/auth/signin` (nie 401) | Taki jest kontrakt middleware, który działa przed handlerem | Research |
| Wariant ścieżki omija ochronę | Naprawa w middleware (normalizacja ścieżki) w tej fazie | Bezpośrednio ryzyko #2, mała zmiana | Plan |
| Stara sesja przyjęta po wylogowaniu | Stop i decyzja użytkownika | Naprawa zależy od Supabase, nie jest oczywista | Plan |

## Scope

**In scope:**
- config, helpery i krok CI;
- macierz izolacji B→A i anon na 3 tabelach (baza);
- HTTP dla szczegółów, delete, review, listy i pulpitu;
- poprawka `review.ts` i zdarzenia w `app-events.ts`;
- odmowa bez sesji dla każdej chronionej trasy, warianty ścieżki, inwentarz tras, odtworzenie sesji po wylogowaniu;
- CLAUDE.md i test-plan §4/§5/§6/§7.

**Out of scope:**
- częściowy sukces review (faza 3 planu testów);
- stary JWT bezpośrednio do PostgREST;
- zmiany w `smoke.mjs`;
- ochrona `/dev/kitchen-sink/*`;
- zmiana 302 → 401;
- backport §2 (należy do `/10x-test-plan`);
- e2e i mocki.

## Architecture / Approach

`globalSetup` czyta env lokalnego Supabase (`npx supabase status -o env`) i zakłada konta A, B i C. Sprawdza też, że aplikacja pod `BASE_URL` jest podłączona do tej samej bazy. Testy używają dwóch klientów:
- supabase-js jako dany użytkownik lub anon — macierz RLS;
- HTTP z `redirect: "manual"`, nagłówkiem `Origin` i słoikiem ciasteczek z kopią — trasy aplikacji.

Każda odmowa jest weryfikowana ponownym odczytem stanu A, z kontrolą, że A swój wiersz widzi. W CI suita działa w kroku smoke, po `npm run smoke`, gdy preview i Supabase już działają.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Szkielet suity i CI | Config, helpery, test pozytywny, krok w jobie `smoke` | Brak Dockera lokalnie, więc pierwsza pętla przez CI (PR do `master`) |
| 2. Izolacja (#1) | Macierz RLS i HTTP, review 404 test-first, usunięty `verify-rls` | Seed przez upload zależy od fixture'a `sample-report.csv` |
| 3. Dostęp (#2) | Odmowa bez sesji dla każdej trasy, warianty ścieżki, inwentarz, wylogowanie | Czerwony test wylogowania zatrzymuje fazę |
| 4. Dokumentacja | CLAUDE.md, test-plan §4/§5/§6.2/§6.3/§6.5/§7 | Rozjazd dokumentacji z CI |

**Prerequisites:** lokalny Supabase (Docker) albo weryfikacja przez CI na PR `dev` → `master` (push za zgodą użytkownika).
**Estimated effort:** ~3–4 sesje `/10x-implement`, po jednej na fazę; fazy 2–3 mogą wymagać 2 przebiegów CI.

## Open Risks & Assumptions

- Lokalnie Docker nie działa, więc każda iteracja testów integracyjnych to przebieg CI (kilka minut).
- GoTrue w aktualnej wersji może przyjąć stare ciasteczko po `signOut()`. Wtedy faza 3 staje do decyzji.
- Limit `sign_in_sign_ups` 30/5 min jest wspólny ze smoke. Plan zakłada kilka logowań na przebieg.

## Success Criteria (Summary)

- Zła lub usunięta polityka RLS, nowa niechroniona trasa albo endpoint zgłaszający sukces przy cudzym id daje czerwony job `smoke` i blokuje deploy.
- Nowy test integracyjny w fazie 2 planu testów powstaje według §6.2/§6.3, bez wymyślania infrastruktury od zera.
