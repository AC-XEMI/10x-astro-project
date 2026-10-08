---
date: 2026-10-08T12:51:00+02:00
researcher: Claude (Opus 5.5) for aciszewski
git_commit: 1d70c4e
branch: dev
repository: 10x-astro-project
topic: "Ugruntowanie fazy 1 test-plan.md: izolacja danych (#1) i dostęp bez sesji (#2)"
tags: [research, testing, rls, auth, middleware, integration, ci]
status: complete
last_updated: 2026-10-08
last_updated_by: Claude (Opus 5.5)
---

# Research: Faza 1 — Izolacja danych i dostęp w CI

**Date**: 2026-10-08T12:51:00+02:00
**Researcher**: Claude (Opus 5.5) for aciszewski
**Git Commit**: 1d70c4e (working tree: zmodyfikowany `context/foundation/roadmap.md`, nowy `test-plan.md` — kod `src/` bez zmian)
**Branch**: dev
**Repository**: 10x-astro-project

## Research Question

Ugruntować fazę 1 z `context/foundation/test-plan.md` („Izolacja danych i dostęp w CI”), ryzyka #1 i #2:

- **#1** — dowieść, że użytkownik B dostaje „nie znaleziono”/odmowę przy każdym odczycie i każdej operacji na raportach, wizytach i odstępstwach A (strony, API z cudzym id, zapytania bezpośrednio do bazy), a dane A pozostają nietknięte; podważyć „polityki RLS istnieją, więc izolują” i „usunięcie bez błędu, więc nic nie zrobiło”.
- **#2** — dowieść, że bez sesji każda chroniona strona przekierowuje do logowania, każde chronione API odmawia, a sesja po wylogowaniu niczego nie odblokowuje; podważyć „smoke loguje się, więc ochrona tras działa”.

Dla każdego ryzyka: realna ścieżka awarii w kodzie, weryfikacja/korekta wytycznych, istniejące testy, najtańsza użyteczna warstwa, ryzyka spekulatywne i mylące sygnały z hot-spotów.

## Summary

1. **Izolacja (#1) opiera się wyłącznie na RLS.** Żadne zapytanie serwerowe do `reports`/`visits`/`deviations` w 6 inspekcjonowanych plikach (tabela poniżej) nie filtruje po `user_id` (wyjątek: INSERT raportu w upload ustawia `user_id` z sesji); wszystkie używają klienta z kluczem anon + ciasteczkiem sesji tworzonego per żądanie (`src/lib/supabase.ts:10`). W `src/` nie ma klucza service-role ani klienta Supabase po stronie przeglądarki. Polityki RLS istnieją dla wszystkich 4 operacji na wszystkich 3 tabelach, z `WITH CHECK` na UPDATE (`supabase/migrations/20260925120100_report_schema_rls.sql:12-124`). Wniosek: test na poziomie bazy (dwa konta, supabase-js) daje główny sygnał; test HTTP potwierdza, że trasy poprawnie tłumaczą „0 wierszy” na odmowę.
2. **Znaleziona realna luka na poziomie endpointu:** `POST /api/deviations/review` z cudzymi id zwraca **HTTP 200 `{ updated: [] }`** (`src/pages/api/deviations/review.ts:35-45`) — serwer nie odróżnia odmowy od sukcesu; wykrywa to tylko klient (`DeviationsList.tsx:344`). Ponadto `review.ts:42` zwraca surowy `error.message` Supabase (łamie regułę „kod, nie tekst”), a id nie są walidowane jako UUID (zniekształcone id → błąd bazy → 500). Dane A pozostają nietknięte (RLS), więc to luka sygnalizacji, nie wycieku — ale test musi ustalić oczekiwany kontrakt (decyzja dla `/10x-plan`).
3. **Usuwanie wykrywa „0 wierszy”:** `delete.ts` robi `.delete().eq("id", id).select()` i przy `data.length === 0` przekierowuje z kodem `report_not_found` (`src/pages/api/reports/[id]/delete.ts:34,48-56`). Strona `/reports/[id]` dla cudzego id zwraca 404 (`src/pages/reports/[id].astro:17,32,43`). Oba zachowania nie mają testu automatycznego.
4. **Ochrona tras (#2):** middleware chroni prefiksami `["/dashboard", "/reports", "/api/reports", "/api/deviations"]` (`src/middleware.ts:4,18`), użytkownika rozwiązuje przez `getUser()` (walidacja po stronie serwera Auth, `:12`), a brak konfiguracji Supabase kończy się `user = null` → przekierowanie (fail-closed, `:14-15`). Wszystkie 3 API danych mają dodatkowo własny check w handlerze. **Każde nieuwierzytelnione żądanie do chronionego API dostaje 302 → `/auth/signin`, nie 401** (middleware działa przed handlerem; 401 w `review.ts:14` jest nieosiągalne przez normalny routing).
5. **Wylogowanie** wywołuje `supabase.auth.signOut()` bez argumentu scope i bez obsługi błędu (`src/pages/api/auth/signout.ts:9`). Czy stare ciasteczko odtworzone po wylogowaniu jest odrzucane przez `getUser()`, **nie zostało zweryfikowane** — smoke tego nie sprawdza, bo jego słoik ciasteczek kasuje je po `max-age=0`.
6. **Istniejące testy:** `verify-rls.mjs` (w CI, job `smoke`, `.github/workflows/ci.yml:61`) sprawdza tylko część macierzy, bez ponownego odczytu stanu bazy po odmowie i bez INSERT/HTTP; `smoke.mjs` sprawdza tylko `/reports` bez sesji i po wylogowaniu. Szczegóły i luki poniżej.
7. **Najtańsza warstwa:** integracja z lokalnym Supabase w istniejącym jobie `smoke` (Supabase i preview już tam działają, `ci.yml:46-61`). Testy integracyjne **nie mogą** trafić do domyślnego `include` Vitest (`src/**/*.test.ts`, `vitest.config.ts:13`), bo `npm test` w jobie `ci` i Stryker działają bez Supabase.

## Detailed Findings

### Ryzyko #1 — ścieżki dostępu do danych

| Ścieżka | Zapytanie | Filtr własności | Cudze id → wynik |
|---|---|---|---|
| `GET /reports/[id]` | `src/pages/reports/[id].astro:32` `from("reports").select("*").eq("id", id).maybeSingle()`; `:33` visits z `deviations(*)` | tylko RLS; regex UUID przed zapytaniem (`:17`) | raport `null` → `not_found` (`:43`) → 404 |
| `GET /reports` | `src/pages/reports/index.astro:33-37`, `:41-43` | tylko RLS | n/d (lista) |
| `GET /dashboard` | `src/pages/dashboard.astro:32,33,46-51,66-70` | tylko RLS | n/d (agregaty) |
| `POST /api/reports/upload` | `src/pages/api/reports/upload.ts:72-79` (report z `user_id: user.id`), `:113`, `:154`, `:174-177`, rollback `:97` | `user_id` z sesji; `report_id`/`visit_id` ustawia serwer (`:110`, `:126`) | brak id od klienta |
| `POST /api/reports/[id]/delete` | `src/pages/api/reports/[id]/delete.ts:34` `.delete().eq("id", id).select()` | tylko RLS | `data.length === 0` → redirect `report_not_found` + `logAppEvent` (`:48-56`) |
| `POST /api/deviations/review` | `src/pages/api/deviations/review.ts:35-39` `.update(...).in("id", ids).select()` | tylko RLS | **200 `{ updated: [] }`** (`:45`) |

- Klient per żądanie: `createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, { cookies })` (`src/lib/supabase.ts:10`). Brak klucza service-role w `src/` (jedyne wystąpienie: artefakt CLI w `supabase/.temp/`). Brak importu `@supabase` w plikach `.tsx`; przegląd idzie przez `fetch("/api/deviations/review")` (`src/components/reports/DeviationsList.tsx:319`).
- Polityki RLS (`supabase/migrations/20260925120100_report_schema_rls.sql`): `reports` — `auth.uid() = user_id` dla SELECT `:12`, INSERT `:17`, UPDATE `:22` (USING + WITH CHECK), DELETE `:29`; `visits` — `EXISTS` do `reports` (`:39,48,57,72`); `deviations` — `EXISTS` przez `visits JOIN reports` (`:87,97,107,124`). FK z `on delete cascade` (`20260925120000_create_report_schema.sql:25,34,48`). Późniejsze migracje (`20260929…`, `20261006…`) nie zmieniają RLS i nie dodają funkcji `SECURITY DEFINER` (wg inspekcji subagenta).
- Odczyt polityk wskazuje, że B nie może wstawić wizyty/odstępstwa pod raport/wizytę A (INSERT z `EXISTS` na rodzica) — **to wniosek z czytania SQL, nie test**.
- Dashboard: agregaty (`dashboard.astro:32,46-51,66-70`) bez filtra `user_id`; regresja polityki SELECT na `visits` po cichu wmieszałaby cudze dane do statystyk — bez błędu. To uzasadnia asercję „pulpit B nie zawiera danych A”.

**Weryfikacja wytycznych #1:** potwierdzone. Korekta: „usunięcie bez błędu” jest już obsłużone w `delete.ts` (sprawdzenie `data.length`), ale **review nie ma odpowiednika** — to tam anty-wzorzec „brak błędu ⇒ sukces” jest dziś w kodzie. Asercja na stan bazy po odmowie (status odstępstwa A nadal `unreviewed`, raport A istnieje) jest konieczna, bo sam kod odpowiedzi review nic nie mówi.

### Ryzyko #2 — ochrona tras i sesja

Middleware (`src/middleware.ts`):

```ts
4  const PROTECTED_ROUTES = ["/dashboard", "/reports", "/api/reports", "/api/deviations"];
12     } = await supabase.auth.getUser();
18   if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
19     if (!context.locals.user) {
20       return context.redirect("/auth/signin");
```

Tabela tras (wszystkie pliki w `src/pages/**`):

| Trasa | Klasyfikacja |
|---|---|
| `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email` | publiczne z założenia |
| `POST /api/auth/{signin,signup,resend-confirmation,signout}` | publiczne z założenia |
| `/dashboard`, `/reports`, `/reports/[id]` | middleware |
| `POST /api/reports/upload` | middleware + `upload.ts:31-33` (redirect) |
| `POST /api/reports/[id]/delete` | middleware + `delete.ts:19-21` (redirect) |
| `POST /api/deviations/review` | middleware + `review.ts:12-14` (401, w praktyce nieosiągalne) |
| `/dev/kitchen-sink/{dashboard,landing,report-details,reports-list}` | **publiczne także w produkcji** (brak guardu `import.meta.env.DEV`); renderują wyłącznie fixtures, bez `createClient` — brak wycieku danych |

- Dopasowanie: prefiks `startsWith`, wrażliwy na wielkość liter, na surowym `pathname`. Nadmiarowe dopasowania (`/reportsX`) są bezpieczne. Czy router Astro rozwiązuje `/Reports` lub `/%72eports` do strony z pominięciem guardu — **niezweryfikowane**; tani przypadek do dorzucenia w teście HTTP.
- Fail-closed: brak env → `createClient` zwraca `null` (`src/lib/supabase.ts:7-9`) → `locals.user = null` (`middleware.ts:15`) → redirect. Wyjątek z `getUser()` nie jest łapany (prawdopodobnie 500 — też nie przepuszcza).
- Wylogowanie: `src/pages/api/auth/signout.ts:7-11` — `signOut()` bez scope (domyślnie w supabase-js: `global`), wynik ignorowany, ciasteczka czyszczone przez `setAll` (`supabase.ts:15-18`), redirect `/`. Tylko `POST`.
- Odtworzenie starego ciasteczka po wylogowaniu: `jwt_expiry = 3600` (`supabase/config.toml:158`). Czy `getUser()` odrzuca token z unieważnioną sesją (GoTrue sprawdza `session_id`) — **zależne od wersji, niezweryfikowane**; to dokładnie to, co test #2 ma rozstrzygnąć. Bezpośrednie wywołania PostgREST ze starym JWT pozostają ważne do wygaśnięcia (RLS sprawdza tylko podpis i `exp`) — poza zasięgiem middleware aplikacji; do decyzji, czy faza to obejmuje (patrz Open Questions).
- Open redirect: brak — przekierowania na stałe ścieżki (`signin.ts:24`, `signup.ts:24`, `resend-confirmation.ts:29`); jedyna wartość od użytkownika (`page` w `delete.ts:27`) jest kodowana w query stałej ścieżki `/reports`.
- `src/components/auth/*` — tylko walidacja formularzy po stronie klienta, brak logiki ochrony.

**Weryfikacja wytycznych #2:** potwierdzone, z korektą oczekiwania: chronione **API odpowiadają 302 → `/auth/signin`, nie 401/403**. Test powinien asertować brak 2xx i `Location` na `/auth/signin` oraz brak zmiany stanu bazy — nie konkretnie 401. Lista chronionych tras pokrywa dziś wszystkie trasy danych; ryzyko to przyszła trasa poza prefiksami (test powinien wyliczać trasy z listy, a nowa trasa API wymaga dopisania).

### Istniejące testy i ich zakres

`scripts/verify-rls.mjs` (194 linie, supabase-js, bez HTTP; w CI `ci.yml:61`):
- Użytkownicy przez `signUp` kluczem anon, unikalne e-maile z `Date.now()` (`:44-57`); brak sprzątania kont.
- Jako B: SELECT całych tabel i sprawdzenie, że id A nie występuje (`:100-110`); UPDATE `deviations.status` (`:132-139`), UPDATE `reports.original_filename` (`:141-147`), DELETE `reports` (`:149-151`) — asercja „0 zwróconych wierszy”.
- Pozytywnie: A aktualizuje swoje odstępstwo (`:123-130`), A usuwa raport → 1 wiersz + kaskada (`:155-178`).
- **Luki:** brak ponownego odczytu stanu po odmowie (np. czy `original_filename` ≠ `hacked.csv`, czy status nadal `unreviewed`); brak INSERT jako B pod rodzica A; brak UPDATE/DELETE na `visits` i DELETE na `deviations`; brak klienta anon (bez sesji); brak SELECT po konkretnym cudzym id; brak ścieżek HTTP.

`scripts/smoke.mjs` (75 linii, `fetch` z `redirect:"manual"`, ręczny słoik ciasteczek `:13-21`):
- Kroki `:38-59`: `/` 200; `/reports` bez sesji → 302 signin; signup; zły signin; poprawny signin → `/reports`; `/reports` 200; signout → `/`; `/reports` po signout → 302 signin.
- **Luki:** tylko jedna strona (`/reports`) bez sesji; zero API bez sesji; brak `/reports/[id]`, `/dashboard`; brak cudzych id; po wylogowaniu słoik usuwa ciasteczka, więc test **nie dowodzi**, że serwer unieważnił sesję — tylko że przeglądarka by je wyrzuciła.

### Infrastruktura i miejsce wpięcia

- Job `smoke` (`.github/workflows/ci.yml:28-63`): `supabase start -x …mailpit…` (`:48`), eksport tylko `API_URL|ANON_KEY` (`:49`), `.env`/`.dev.vars` (`:52-54`), build, `npm run preview` + smoke (`:58-60`), `verify:rls` (`:61`), `supabase stop` w `always()`. Nowy krok wpina się po `:60/:61`, gdy preview i Supabase działają. Klucz service-role wymagałby rozszerzenia `grep` w `:49`.
- `supabase/config.toml`: `enable_confirmations = false` (`:209`, signUp zwraca sesję), `sign_in_sign_ups = 30` na 5 min na IP (`:190`) — smoke + verify-rls zużywają ~5; większa suita HTTP z wieloma logowaniami powinna liczyć żądania lub tworzyć konta raz na przebieg. `seed.sql` skonfigurowany (`:60-65`), ale plik nie istnieje (CI przechodzi, więc tolerowane).
- Vitest: `include: ["src/**/*.test.ts"]`, `environment: "node"` (`vitest.config.ts:13-14`); Stryker mutuje tylko `report-parser.ts`, `deviation-rules.ts`, `geo.ts` z runnerem vitest. Integracja w `src/**/*.test.ts` zepsułaby `npm test` w jobie `ci` (brak Supabase) i Strykera. Opcje: osobny katalog/sufiks poza include + osobny config/skrypt, albo kontynuacja wzorca bezzależnościowych skryptów `.mjs`.

## Code References

- `src/lib/supabase.ts:7-18` — klient per żądanie, `null` bez env, `setAll` z `sameSite: "lax"`
- `src/middleware.ts:4,12,14-15,18-20` — lista prefiksów, `getUser()`, fail-closed, redirect
- `src/pages/reports/[id].astro:17,32-33,43` — regex UUID, zapytania, 404 dla cudzego id
- `src/pages/reports/index.astro:33-43` — lista raportów (tylko RLS)
- `src/pages/dashboard.astro:32-33,46-51,66-70` — agregaty pulpitu (tylko RLS)
- `src/pages/api/reports/upload.ts:31-33,72-79,97,110,113,126,154,174-177` — auth, zapisy, rollback
- `src/pages/api/reports/[id]/delete.ts:19-21,29-31,34,36-46,48-56` — auth, UUID, delete z `.select()`, wykrycie 0 wierszy
- `src/pages/api/deviations/review.ts:7-15,26-31,35-45` — 503/401, walidacja bez UUID, update, surowy `error.message`, 200 z `updated: []`
- `src/pages/api/auth/signout.ts:6-12` — `signOut()` bez scope i bez obsługi błędu
- `src/components/reports/DeviationsList.tsx:319,344` — fetch review, wykrycie częściowej aktualizacji po stronie klienta
- `supabase/migrations/20260925120100_report_schema_rls.sql:12-124` — 12 polityk RLS
- `supabase/config.toml:60-65,158,164,167,190,209` — seed, JWT, rotacja tokenów, limity, potwierdzenia
- `scripts/verify-rls.mjs:4-6,15,22-23,38-57,72-96,100-110,123-178` — obecna weryfikacja RLS
- `scripts/smoke.mjs:13-31,38-59,66` — obecny smoke
- `.github/workflows/ci.yml:10-26,28-63` — joby `ci` i `smoke`
- `vitest.config.ts:13-14`, `stryker.config.json` — zakres testów jednostkowych/mutacyjnych

## Architecture Insights

- **Jedna linia obrony dla danych:** autoryzacja = RLS; aplikacja dokłada tylko uwierzytelnienie (middleware) i tłumaczenie „0 wierszy” na kody błędów. Dlatego test bazy jest tańszy i silniejszy dla #1, a test HTTP ma sens tylko dla tłumaczenia wyniku (404 / `report_not_found` / kontrakt review) i dla #2.
- **Wzorzec skryptów bez zależności** (`smoke.mjs`, `verify-rls.mjs`) jest świadomą decyzją repo (archiwum, patrz niżej); wprowadzenie Vitest dla integracji to zmiana konwencji — do jawnej decyzji w planie.
- **API odpowiadają przekierowaniami, nie statusami** (middleware i handlery) — kontrakt testu musi to przyjąć.

## Historical Context (from prior changes)

- `context/archive/2026-09-25-report-data-schema/plan-brief.md:27` — automatyczny skrypt `verify-rls.mjs` wybrany, bo „izolacja danych to PRD guardrail” — **nadal aktualne**; `:48` i `plan.md:207,232` — uruchamiany w jobie `smoke` bez nowego joba CI — **aktualne** (`ci.yml:61`). Stwierdzenie, że to „jedyny automatyczny dowód poprawności RLS” — **aktualne**, ale jego zakres jest częściowy (luki wyżej).
- `context/archive/2026-10-01-delete-uploaded-report/plan.md:12` — „verify-rls JUŻ dowodzi, że B nie może usunąć raportu A” — **częściowo**: dowodzi 0 zwróconych wierszy, a przetrwanie raportu tylko pośrednio (późniejszy delete A zwraca 1 wiersz, `verify-rls.mjs:155-162`).
- `context/archive/2026-10-01-mark-deviation-reviewed/plan-brief.md:28` — polityka UPDATE na `deviations` dodana do weryfikacji wtedy — **aktualne** (`verify-rls.mjs:132-139`), ale endpoint review nigdy nie był testowany z cudzym id.
- `context/archive/2026-09-29-route-deviation-detection/reviews/impl-review.md:69` — „repo nie ma frameworka testów integracyjnych DB z założenia (wzorzec skryptów bez zależności)” — **aktualne**; faza 1 musi świadomie wybrać, czy go kontynuować.
- `context/archive/2026-09-24-deployment/reviews/impl-review.md:30` — job `smoke` przywrócony i bramkuje deploy (`c9ace44`) — **aktualne**.

## Related Research

- `context/archive/2026-09-25-report-data-schema/` — projekt RLS przez podzapytania (źródło ryzyka #1 w test-plan §2).

## Open Questions

1. **Kontrakt `POST /api/deviations/review` dla cudzych/nieistniejących id** — zostawić 200 `{ updated: [] }` i asertować brak zmiany w bazie, czy zmienić na odmowę (404/403) + kod błędu zamiast surowego `error.message` + walidacja UUID? Zmiana kodu produkcyjnego wykracza poza „tylko testy” — decyzja dla `/10x-plan`/użytkownika.
2. **Narzędzie dla integracji:** rozszerzyć bezzależnościowe skrypty (`verify-rls.mjs`, `smoke.mjs`) czy wprowadzić osobny projekt/config Vitest (np. `tests/integration/**`, osobny skrypt npm) uruchamiany tylko w jobie `smoke`? Oba wykonalne; trzeba uszanować pin Vitest 4.1 i nie wciągnąć testów do `npm test`/Strykera.
3. **Sesja po wylogowaniu:** czy `getUser()` w aktualnej wersji lokalnego GoTrue odrzuca odtworzone ciasteczko po `signOut()` — rozstrzygnie dopiero test. Jeśli nie odrzuca, to realne znalezisko dla #2 (ważność do `jwt_expiry` = 1 h). Czy faza obejmuje też bezpośrednie wywołania PostgREST ze starym JWT, czy tylko trasy aplikacji?
4. **Ścieżki z inną wielkością liter / kodowaniem procentowym** (`/Reports`, `/%72eports`) — niezweryfikowane, czy omijają guard; tani przypadek w teście HTTP.
5. **Strony `/dev/kitchen-sink/*` publiczne w produkcji** — nie ujawniają danych (tylko fixtures), więc poza ryzykiem #2; ewentualnie do §7 negative-space lub osobnej zmiany.
6. **Limit `sign_in_sign_ups = 30`/5 min** — przy wielu logowaniach w suicie HTTP w jednym jobie z smoke i verify-rls; plan powinien tworzyć konta raz na przebieg.
