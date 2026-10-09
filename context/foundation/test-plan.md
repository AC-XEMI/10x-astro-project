# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-09

## 1. Strategy

Testy w tym projekcie trzymają się trzech zasad, od których nie ma wyjątków:

1. **Koszt × sygnał.** Wygrywa najtańszy test, który daje prawdziwy sygnał
   dla danego ryzyka. Nie przenoś testu na e2e tylko dlatego, że e2e
   „wydaje się bezpieczniejsze”. Nie kładź modelu wizyjnego na
   deterministycznym diffie, który i tak łapie regresję.
2. **Obawy zespołu są pełnoprawnym dowodem.** Ryzyko oparte na „zespół boi
   się X, a awaria ujawniłaby się gdzieś w obszarze Y” waży tyle samo co
   linia z PRD czy dane o częstotliwości zmian.
3. **Ryzyka to scenariusze, nie miejsca w kodzie.** Ten plan opisuje, _co
   może zawieść_ i _dlaczego uważamy to za prawdopodobne_, na podstawie
   dokumentów, wywiadu i _sygnałów_ z kodu (częstotliwość zmian, struktura,
   istniejące testy). NIE twierdzi, że wie, która linia odpowiada za awarię.
   Tę wiedzę wytwarza `/10x-research` w każdej fazie wdrażania. Jeśli plan i
   research różnią się co do miejsca awarii, rację ma research.

Zakres skanu zmian użyty do oceny prawdopodobieństwa: `src/` (bez
wygenerowanego `src/types.ts`) i `supabase/migrations/`, ostatnie 30 dni,
80 commitów.

## 2. Risk Map

Najważniejsze scenariusze porażki, przed którymi projekt musi się chronić,
w kolejności ryzyko = skutek × prawdopodobieństwo. Ryzyka to scenariusze w
języku użytkownika i biznesu, nie nazwy testów. Kolumna Source podaje
_dowód, który wyniósł ryzyko na listę_ — nigdy konkretny plik jako „miejsce
awarii” (to zadanie researchu, zob. §1 zasada 3).

| #   | Risk (failure scenario)                                                                                                                                                                          | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Kierownik widzi, oznacza lub usuwa raport, wizyty lub odstępstwa innego kierownika, np. podając cudzy identyfikator w adresie; kontrola sprawdza, że ktoś jest zalogowany, a nie że dane są jego | High   | Medium     | PRD: Guardrails (izolacja danych), NFR 2, Access Control; interview Q1, Q4; archive `2026-09-25-report-data-schema` (RLS przez podzapytania, dwa poziomy); hot-spot dir `src/pages/api` (30 zmian/30 dni)                                                                                                            |
| 2   | Niezalogowany użytkownik dostaje się do chronionej strony lub API albo sesja działa dalej po wylogowaniu                                                                                         | High   | Medium     | PRD FR-001, Access Control; `tech-stack.md`: `has_auth: true`; hot-spot dirs `src/components/auth` (24/30 dni — tylko walidacja formularzy w przeglądarce, słaby dowód dla ochrony tras), `src/pages/auth` (14/30 dni)                                                                                               |
| 3   | Wgranie zapisuje raport częściowo (raport bez wizyt, wizyty bez odstępstw) albo kończy się „sukcesem” bez kompletnych danych                                                                     | High   | Medium     | interview Q1; archive `2026-09-28-missing-gps-deviation-detection` (zapis do trzech tabel bez transakcji), `2026-10-08-upload-error-visibility` (kompensujące usuwanie); hot-spot dir `src/pages/api` (30/30 dni)                                                                                                    |
| 4   | Po zmianie parsera lub reguł lista na stronie pokazuje odstępstwa niezgodne z regułami — brakujące albo fałszywe alarmy na poprawnych wizytach                                                   | High   | Medium     | PRD: Guardrails (poprawność wykrywania), US-01 Acceptance Criteria; interview Q1; hot-spot dir `src/lib/services` (20/30 dni); archive `2026-10-08-vitest-mutation-baseline` (chronione tylko same funkcje)                                                                                                          |
| 5   | Błędny lub pusty plik kończy się pustą listą bez wyjaśnienia albo serwer przyjmuje plik, który kontrola w przeglądarce by odrzuciła (serwer ufa klientowi)                                       | Medium | Medium     | PRD US-01 Acceptance Criteria; hot-spot dir `src/pages/api` (30/30 dni — tu żyje walidacja serwera; poprawione po researchu Phase 2); hot-spot dir `src/components/reports` (40/30 dni — tylko źródło tego, co odrzuca przeglądarka); archive `2026-10-07-reports-list-ui-contract` (kontrola kolumn w przeglądarce) |
| 6   | Status przeglądu nie utrwala się, trafia na inne odstępstwa albo zmienia tylko część zaznaczonych bez komunikatu                                                                                 | Medium | Medium     | PRD US-03 Acceptance Criteria, FR-012; hot-spot dir `src/components/reports` (40/30 dni); archive `2026-10-01-mark-deviation-reviewed`                                                                                                                                                                               |

Poza mapą świadomie: wyciek danych osobowych do logów i komunikatów błędów
(chroniony już testami białej listy pól wpisów zdarzeń; logowanie po stronie
auth to roadmap S-18) oraz nadużycie zasobów masowymi wgraniami
(`target_scale: small`, limit 5 MB sprawdzany na serwerze — temat dla
monitoringu, nie testu).

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                                   | Must challenge                                                                                                                                                                                                                                                                                    | Context `/10x-research` must ground                                                                                                                                                                                                   | Likely cheapest layer                                                                                           | Anti-pattern to avoid                                                                                                                                                                                                       |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1   | Użytkownik B dostaje „nie znaleziono” lub odmowę przy każdym odczycie i każdej operacji na danych A — strony, API z cudzym id, zapytania bezpośrednio do bazy — a dane A pozostają nietknięte | „Polityki RLS istnieją, więc izolują”; „zmiana lub usunięcie zwróciły brak błędu, więc odmowa zadziałała” (0 zmienionych wierszy bez błędu to odmowa RLS — trasa musi ją zgłosić, nie odpowiedzieć sukcesem)                                                                                      | wszystkie trasy i zapytania dotykające raportów, wizyt i odstępstw; sposób tworzenia klienta bazy per żądanie; obecny skrypt weryfikacji RLS i co dokładnie sprawdza                                                                  | integracja z lokalnym Supabase, dwa konta                                                                       | test na jednym koncie (happy path); sprawdzanie tylko kodu odpowiedzi bez stanu bazy                                                                                                                                        |
| #2   | Bez sesji każda chroniona strona przekierowuje do logowania, a każde chronione API odmawia (kontrakt: 302 na `/auth/signin`, nie 401/403); po wylogowaniu stara sesja niczego nie odblokowuje | „Smoke loguje się, więc ochrona tras działa”                                                                                                                                                                                                                                                      | lista chronionych tras i to, czy obejmuje wszystkie trasy API; zachowanie po wylogowaniu (ciasteczka sesji)                                                                                                                           | integracja przez HTTP na zbudowanej aplikacji                                                                   | mockowanie middleware; testowanie tylko stron bez tras API                                                                                                                                                                  |
| #3   | Wymuszony błąd w środku zapisu nie zostawia osieroconego raportu ani wizyt; sukces oznacza komplet wizyt i odstępstw zgodny z liczbą wierszy pliku                                            | „Przekierowanie na stronę raportu oznacza, że dane są kompletne”; „błąd zapisu da się wywołać treścią pliku” (po researchu: dane, które przejdą parser, nie łamią schematu odstępstw — błąd trzeba wstrzyknąć w bazie)                                                                            | kolejność zapisów, kompensujące usuwanie i jego kaskada, możliwość wymuszenia błędu zapisu w teście; brak zapisanego licznika odstępstw po pełnym zapisie to świadomie akceptowany sukces, więc licznik nie jest dowodem kompletności | integracja z lokalnym Supabase i wstrzyknięciem błędu w bazie (np. tymczasowy trigger zawężony do danych testu) | sprawdzanie tylko przekierowania; mockowanie bazy tak, że kompensacja „działa” z definicji; licznik w raporcie jako jedyny dowód kompletności                                                                               |
| #4   | Po wgraniu fixture'ów w bazie (i na liście) są dokładnie te odstępstwa, które wynikają z PRD i wyroczni fixture'ów — nic więcej, nic mniej                                                    | „Testy jednostkowe reguł wystarczą, więc zapis i odczyt nie mogą zgubić wyniku” (po researchu: reguła trasy w produkcji dostaje wizyty w kolejności zwróconej przez bazę po zapisie, a test jednostkowy — w kolejności pliku)                                                                     | wyrocznia fixture'ów w testach jednostkowych, sposób zapisu reguły i szczegółu, zapytanie strony szczegółów, kolejność wizyt po zapisie                                                                                               | integracja: wgranie → baza → zapytanie strony                                                                   | oczekiwane wartości przepisane z kodu reguł (problem wyroczni); ponowne testowanie samych funkcji reguł; asercja tylko na liczebności per reguła zamiast per wizyta (zamiana flagi między wizytami przechodzi niezauważona) |
| #5   | Każdy błędny, pusty lub źle zbudowany plik kończy się czytelnym kodem błędu; serwer sam odrzuca to, co odrzuca przeglądarka (rozmiar, typ, brak kolumn)                                       | „Przeglądarka i tak tego nie wyśle” (po researchu: spreparowane żądanie bez pliku albo nie-formularz kończyło się błędem serwera zamiast kodu — naprawione i przypięte testem w Phase 2); „jeden kod błędu wystarczy do rozróżnienia przypadku” (jeden kod obejmuje wiele różnych błędów parsera) | walidacja w trasie wgrywania vs walidacja w przeglądarce; mapowanie kodów błędów na komunikaty; czym serwer rozróżnia błędy parsera pod wspólnym kodem                                                                                | integracja trasy wgrywania (żądanie HTTP bez przeglądarki)                                                      | testowanie tylko komponentu w przeglądarce; asercja na treści komunikatu zamiast na kodzie; asercja na samym wspólnym kodzie bez rozróżniającego tokenu (nazwa brakującej kolumny, numer wiersza) — pełne zdanie nadal nie  |
| #6   | Oznaczenie i cofnięcie przeżywają ponowne wczytanie, dotyczą tylko wskazanych odstępstw, a częściowy sukces jest zgłaszany użytkownikowi                                                      | „UI pokazuje zmianę, więc jest zapisana”                                                                                                                                                                                                                                                          | endpoint przeglądu: wejście, zwrot przy częściowej aktualizacji, kontrola własności                                                                                                                                                   | integracja endpointu przeglądu z lokalnym Supabase                                                              | asercja na stanie komponentu zamiast na bazie; test tylko pojedynczego oznaczenia                                                                                                                                           |

## 3. Phased Rollout

Każdy wiersz to osobna faza wdrażania, która otworzy własny folder zmiany
przez `/10x-new`. Status przesuwa się w prawo przez wartości poniżej;
orkiestrator aktualizuje go, gdy na dysku pojawiają się artefakty.

| #   | Phase name                                  | Goal (one line)                                                                                                                                          | Risks covered | Test types  | Status       | Change folder                                             |
| --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------- | ------------ | --------------------------------------------------------- |
| 1   | Izolacja danych i dostęp w CI               | Dowieść na dwóch kontach, że cudze dane są niedostępne każdą drogą, a brak sesji to brak dostępu — testy uruchamiane w CI na lokalnym Supabase           | #1, #2        | integration | complete     | context/archive/2026-10-08-testing-data-isolation-access/ |
| 2   | Kompletny i poprawny zapis wgranego raportu | Dowieść, że wgranie zapisuje wszystko albo nic, wynik w bazie zgadza się z wyrocznią, a błędne pliki dostają kod błędu także bez kontroli w przeglądarce | #3, #4, #5    | integration | implementing | context/changes/testing-report-save-integrity/            |
| 3   | Status przeglądu                            | Dowieść, że oznaczenie i cofnięcie są trwałe, trafiają tylko we wskazane odstępstwa, a częściowy sukces jest widoczny                                    | #6            | integration | not started  | —                                                         |

Warstwy e2e i AI-native są świadomie pominięte: domena jest
deterministyczna, produkt nie ma funkcji AI, a dla każdego ryzyka najtańszy
prawdziwy sygnał daje integracja z lokalnym Supabase. Każda faza sama
podpina swoje testy do CI (§5), bez osobnej fazy na bramki.

## 4. Stack

| Layer          | Tool                                                  | Version | Notes                                                                                                                                                                                                                                                                                                                          |
| -------------- | ----------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| unit           | Vitest                                                | 4.1.10  | `npm test`, `src/**/*.test.ts`; celowo 4.x — runner Strykera nie aktywuje mutantów na Vitest 5 (`CLAUDE.md`)                                                                                                                                                                                                                   |
| mutation       | Stryker + vitest-runner                               | 10.0.0  | `npm run test:mutation`, lokalnie; wynik bazowy 88.54% dla parsera, reguł i `geo`                                                                                                                                                                                                                                              |
| integration    | Vitest (osobny config `vitest.integration.config.ts`) | 4.1.10  | `npm run test:integration`, `tests/integration/**/*.int.test.ts`, poza `npm test` i Strykerem; baza: lokalny Supabase przez CLI (`supabase` ^2.23.4; w CI `supabase/setup-cli`, job `smoke`); wstrzykiwanie błędów w bazie przez `npx supabase db query --local` (CLI 2.117.0, bez dodatkowej zależności); checked: 2026-10-09 |
| API mocking    | none — świadomie                                      | —       | integracja uderza w prawdziwy lokalny Supabase; mockowanie tylko na zewnętrznej krawędzi, jeśli się pojawi                                                                                                                                                                                                                     |
| e2e            | none — świadomie                                      | —       | zob. §3; przepływ logowania sprawdza już skrypt `smoke` na zbudowanej aplikacji                                                                                                                                                                                                                                                |
| sanity scripts | `smoke`                                               | —       | bez zależności, w CI (job `smoke`); dawny `verify:rls` (też był w CI, nie ręcznie) wchłonięty przez `tests/integration/rls-isolation.int.test.ts` w Phase 1                                                                                                                                                                    |

**Stack grounding tools (current session):**

- Docs: none — Context7 ani MCP z dokumentacją frameworków nie są dostępne w tej sesji; wersje sprawdzone w lokalnym `node_modules` i `package.json`; checked: 2026-10-08
- Search: none — Exa.ai niedostępne w tej sesji (dostępne tylko ogólne WebSearch/WebFetch, nieużyte); checked: 2026-10-08
- Runtime/browser: none — Playwright MCP niedostępny w tej sesji; zrzuty widoków robi `scripts/kitchen-sink-shot.mjs`; checked: 2026-10-08
- Provider/platform: GitHub CLI (`gh`) — odczyt przebiegów CI do potwierdzania bramek; Cloudflare Workers Logs przez panel (wpisy zdarzeń z S-16); checked: 2026-10-08

## 5. Quality Gates

| Gate                                                       | Where                                                 | Required? | Catches                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| lint + typecheck (`npm run lint`, `npx astro check`)       | local + CI (job `ci`)                                 | required  | błędy składni i typów                                                             |
| unit (`npm test`)                                          | local + CI (job `ci`)                                 | required  | regresje w parserze, regułach, `geo`, wpisach zdarzeń                             |
| integration (`npm run test:integration`, lokalny Supabase) | CI (job `smoke`, po `npm run smoke`; bramkuje deploy) | required  | izolacja danych, dostęp (od Phase 1); zapis raportu, status przeglądu (Phase 2–3) |
| pre-prod smoke (`npm run smoke`)                           | CI (job `smoke`) przed wdrożeniem                     | required  | zepsuty przepływ logowania na zbudowanej aplikacji                                |
| mutation (`npm run test:mutation`)                         | local                                                 | optional  | testy jednostkowe, które przestały cokolwiek chronić                              |
| UI tokens (`npm run check:ui-tokens`)                      | local                                                 | optional  | literały kolorów w widokach z kontraktem UI                                       |

## 6. Cookbook Patterns

Jak dodawać nowe testy w tym projekcie. Każda podsekcja wypełnia się, gdy
odpowiednia faza wdrażania zostanie zakończona; do tego czasu brzmi „TBD —
see §3 Phase <N>”.

### 6.1 Adding a unit test

- **Location**: obok testowanego modułu, `src/**/<module>.test.ts` (Vitest `include: ["src/**/*.test.ts"]`).
- **Naming**: `<module>.test.ts`.
- **Reference test**: `src/lib/services/report-parser.test.ts`, `src/lib/app-events.test.ts`.
- **Run locally**: `npm test` (pojedynczy plik: `npx vitest run <path>`).
- **Rule**: kod produkcyjny wołaj tylko wewnątrz `it()` — wywołania w ciele `describe` są dla Strykera „statyczne” i ich mutanty nigdy się nie aktywują.

### 6.2 Adding an integration test (local Supabase)

- **Location**: `tests/integration/<obszar>.int.test.ts` (config `vitest.integration.config.ts`, `include: ["tests/integration/**/*.int.test.ts"]`); helpery w `tests/integration/helpers/`.
- **Naming**: `<obszar>.int.test.ts` — sufiks `.int` trzyma plik poza `npm test` i Strykerem.
- **Reference test**: `tests/integration/rls-isolation.int.test.ts` (macierz operacji B→A i anon na poziomie bazy).
- **Run locally**: `npx supabase start`, aplikacja pod `BASE_URL` (domyślnie `http://localhost:4321`) podłączona do **lokalnego** Supabase (`.dev.vars` z wartościami z `npx supabase status -o env`), potem `npm run test:integration`. W CI: job `smoke`, osobny krok po `npm run smoke`. Jeden przebieg zużywa ok. 10 z 30 logowań/rejestracji na 5 min (limit lokalnego Supabase na IP); przy trzecim uruchomieniu z rzędu `globalSetup` zgłasza limit — odczekaj albo zrestartuj Supabase.
- **Accounts**: `account("a" | "b" | "c")` z `globalSetup` (jedno `signUp` na konto na przebieg); klient bazy `clientAs(supabaseEnv(), account)` lub `anonClient`. Konto C tylko do testów, które się wylogowują (`signOut()` jest globalne).
- **Rules**:
  - każda odmowa = asercja na stan bazy odczytany ponownie jako właściciel **plus** kontrola, że właściciel ten wiersz widzi (inaczej „pusto” może znaczyć „nie istnieje”);
  - INSERT pod cudzego rodzica: oczekuj błędu RLS (`42501`) i niezmienionej liczby wierszy właściciela;
  - najwyżej jedno logowanie przez aplikację na konto na plik (limit 30/5 min na IP, wspólny ze smoke);
  - nowa tabela potomna (wzorzec `EXISTS` do `reports`) → dopisz ją do macierzy SELECT/INSERT/UPDATE/DELETE.
- **Wymuszony błąd zapisu w bazie** (reference: `tests/integration/upload-compensation.int.test.ts`):
  - `tests/integration/helpers/db-fault.ts` wykonuje SQL jako `postgres` przez `npx supabase db query --local --agent no --output-format json -f <plik>`. Działa lokalnie i w CI (CLI 2.117.0 z `package-lock.json`); fallback to `--db-url` z `DB_URL` w `connectionArgs()`. CLI przyjmuje jedną instrukcję na wywołanie, dlatego DDL jest w jednym bloku `do $it$ … $it$`. Testy nie piszą SQL-a samodzielnie.
  - `installFault(kind, faultMarker(kind))` zakłada trigger `BEFORE` (`visits_insert`, `deviations_insert`, `reports_update`, `reports_delete`), który rzuca wyjątek tylko dla raportów z `original_filename` zaczynającym się od markera `it-fault-<kind>-<uuid>` (sprawdzanego regexem). Funkcja jest `security definer`, żeby lookup nie zależał od RLS. Zakładanie i zdejmowanie (`removeFault`) są idempotentne; zdejmuj w `afterAll` w `finally`.
  - Asercja „nic nie zostało” = pusto jako właściciel **oraz** `markerRowCounts(marker)` = 0 jako `postgres` (pusty wynik pod RLS mógłby znaczyć brak dostępu) **plus** kontrolne wgranie bez markera widoczne dla właściciela.
  - Trigger na `DELETE` blokuje też sprzątanie: najpierw `removeFault("reports_delete")`, potem usuwanie. Na końcu pliku `installedFaultTriggers()` = `[]` i `faultReportCount()` = 0.
  - `execSync` blokuje pętlę zdarzeń na kilka sekund, dlatego `HttpClient` wysyła `Connection: close` (inaczej POST trafia w martwe gniazdo keep-alive: „other side closed”).
- **Kod produkcyjny a preview**: testy idą na zbudowanej aplikacji, więc kontrola czułości w `src/**` wymaga `npm run build` i restartu preview. Na Windowsie działający preview blokuje `dist/` i build pada na `rmdirSync`: najpierw zatrzymaj preview.

### 6.3 Adding a test for a new API endpoint

- **Location / reference test**: `tests/integration/http-isolation.int.test.ts` (cudze id przez HTTP), `tests/integration/route-access.int.test.ts` (bez sesji, warianty ścieżki, inwentarz tras), `tests/integration/signout.int.test.ts` (stara sesja).
- **Pattern**: `HttpClient` (bez śledzenia przekierowań, nagłówek `Origin` wymagany przez `checkOrigin` Astro dla formularzy, słoik ciasteczek z `snapshotCookies`/`restoreCookies`); zaloguj przez `signInViaApp`, zasiej dane przez `uploadSampleReport`.
- **Assert**: kod (status + `Location` z kodem z `reportErrorUrl(...)` albo JSON `{ error: <kod> }`) i stan bazy, nigdy treść komunikatu. Bez sesji chronione API odpowiadają 302 → `/auth/signin`, nie 401.
- **New route**: dopisz konkretne żądanie do `PROTECTED_REQUESTS` (albo wzorzec do `PUBLIC_ROUTES`) w `route-access.int.test.ts` — test inwentarza pada na niesklasyfikowanej trasie w `src/pages`.
- **Endpoint z zapisem**: test „cudze id → odmowa, dane właściciela bez zmian” piszemy przed kodem; „0 zmienionych wierszy bez błędu” to w tym repo odmowa RLS, nie sukces.
- **Endpoint z walidacją wejścia** (reference: `tests/integration/upload-validation.int.test.ts`):
  - tabela przypadków jako `it.each`; każdy przypadek sprawdza status 302, kod z `errorFromLocation(location).error`, token w `detail` i **0 wierszy** pod nazwą pliku przypadku (żądania bez nazwy pliku: niezmieniona liczba wierszy właściciela);
  - błędy pod wspólnym kodem (`invalid_file`) rozróżniaj tokenem nieprozatorskim (nazwa brakującej kolumny, `/Wiersz N(?!\d)/`), nigdy pełnym zdaniem; gałęzie bez tokenu sprawdzaj negatywnie (żadnej nazwy nagłówka, żadnego `Wiersz N`), a nazwy nagłówków trzymaj jako literał w teście;
  - granicę rozmiaru dowodzi kod **następnej** kontroli: dokładnie limit + MIME spoza listy → `bad_type`, limit + 1 B → `too_large` (bez parsowania 5 MB);
  - spreparowane żądania, których przeglądarka nie wyśle (ciało JSON, pole pliku jako tekst), też dostają kod, nie 500.
- **Helpery wgrywania**: `uploadFile(http, { name, content, type })` (surowa odpowiedź), `readFixture("csv" | "xlsx")`, `reportIdFromLocation`, `errorFromLocation` w `tests/integration/helpers/seed.ts`.

### 6.4 Adding a test for a new or changed deviation rule

- **Unit**: rozszerz wyrocznię w `src/lib/services/deviation-rules.test.ts` (indeksy wierszy fixture'ów z `test-data/`) i dodaj przypadki graniczne na danych inline.
- **Mutation check**: `npm run test:mutation`; ocalałe mutanty w logice zabij testem albo opisz jako równoważne (wzór: `context/archive/2026-10-08-vitest-mutation-baseline/mutation-baseline.md`).
- **Persisted result**: zaktualizuj ręcznie `EXPECTED_RULES_BY_CLIENT` w `tests/integration/helpers/oracle.ts` równolegle z wyrocznią jednostkową (literały per `visited_client`, nigdy wynik kodu reguł). `tests/integration/upload-oracle.int.test.ts` wgrywa CSV i XLSX i porównuje `rulesByClient(...)` z wynikiem zapytania strony szczegółów (`visits.select("*, deviations(*)")`) — per wizyta, nie liczebność per reguła; brak `unique (visit_id, rule)`, więc duplikat też musi wyjść w diffie. Status nowego odstępstwa to `unreviewed`.

### 6.5 Per-rollout-phase notes

(Uzupełniane po każdej fazie: 2–3 linie o tym, czego faza nauczyła.)

- **Phase 1 (izolacja i dostęp, `testing-data-isolation-access`)**:
  - Jedyna realna luka była w endpoincie przeglądu. Przy cudzych id zwracał 200 `{ updated: [] }`, a dziś zwraca 404 `not_found`. Test powstał najpierw i był czerwony w CI.
  - Kontrola czułości: polityka SELECT na `visits` osłabiona do `using (true)` dała czerwony wynik tylko w testach bazy (2 testy), a testy HTTP pulpitu zostały zielone. Główny sygnał dla RLS daje więc warstwa bazy, a HTTP tylko potwierdza tłumaczenie odmowy.
  - Warianty ścieżki nie omijają ochrony. `/Reports` i `/API/...` dają 404, bo router rozróżnia wielkość liter. `/%72eports`, `/reports/` i `/dashboard/` dają 302 na `/auth/signin`.
  - Ciasteczka odtworzone po `signOut()` dostają 302, bo `getUser()` odrzuca unieważnioną sesję.
  - Bez Dockera lokalnie pętla testów integracyjnych idzie przez CI (PR do `master`). Kontrole czułości robimy na tymczasowym PR, który potem zamykamy bez scalania.
- **Phase 2 (zapis raportu, `testing-report-save-integrity`)**:
  - Realny błąd był w trasie wgrywania: ciało nie-multipart i `report_file` jako tekst dawały 500. Testy #13–#14 powstały najpierw jako czerwone, a teraz oba przypadki dostają `no_file` (try/catch wokół `formData()` + `instanceof File`).
  - Kontrole czułości (wszystkie czerwone, cofnięte): odwrócona kolejność wizyt przed regułą trasy przeniosła flagę Q→P i S→R (asercja per klient, nie per reguła); podwojone flagi trasy; `>=` w limicie rozmiaru; komunikat parsera bez nazw kolumn; brak `rollbackReport()` po błędzie odstępstw; wycofanie przy `count_failed`.
  - `supabase db query --local` działa w CI mimo wyłączonych `postgres-meta`/`supavisor`. Znana luka: pusty plik, uszkodzony plik i złe rozszerzenie dają ten sam `invalid_file` bez tokenu — test ich nie rozróżnia. Kolejność `RETURNING` jest przypięta testem, nie gwarantowana.

## 7. What We Deliberately Don't Test

- **Strony kitchen-sink (`/dev/*`)** — narzędzia deweloperskie, nie produkt. Re-evaluate, jeśli któraś zacznie być używana poza developmentem. (Source: Phase 2 interview Q5.)
- **Strona startowa i wygląd widoków** — pilnują ich `check:ui-tokens` i zrzuty kitchen-sinków. Re-evaluate, jeśli wygląd zacznie się psuć mimo tych kontroli. (Source: Phase 2 interview Q5.)
- **Stary JWT użyty bezpośrednio wobec PostgREST po wylogowaniu**. Token dostępu jest bezstanowy i ważny do `jwt_expiry` (3600 s). Trasy aplikacji odrzucają starą sesję, co sprawdza `signout.int.test.ts`, ale wywołanie bazy z pominięciem aplikacji przejdzie do wygaśnięcia tokenu. To zachowanie platformy, nie kodu aplikacji. Ocenić ponownie, jeśli pojawi się wymóg natychmiastowego odcięcia (np. utrata urządzenia); wtedy rozważyć krótszy `jwt_expiry`. (Source: `testing-data-isolation-access` research, Open Question 3.)
- **Gwarancja kolejności wizyt zwracanych przez bazę po zapisie**. Reguła trasy porównuje kolejne wizyty w kolejności z `insert().select()`; `upload-oracle.int.test.ts` przypina dzisiejszą kolejność (zgodną z plikiem), ale Postgres jej formalnie nie gwarantuje. Ocenić ponownie, jeśli test zacznie migać albo zmieni się sposób zapisu wizyt; wtedy rozważyć jawne sortowanie w trasie (zmiana produktu). (Source: `testing-report-save-integrity` research, Open Question 6.)
- **Raporty powyżej `max_rows = 1000`** (`supabase/config.toml`). Strona szczegółów po cichu obcięłaby wizyty dużego raportu — wariant ryzyka #3 („sukces bez kompletnych danych”), niezbadany w Phase 2. Kandydat na nowe ryzyko przy `/10x-test-plan --refresh`. (Source: `testing-report-save-integrity` research, Open Question 5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-08
- Stack versions last verified: 2026-10-09 (warstwa integration po Phase 2; `supabase db query` z CLI 2.117.0)
- AI-native tool references last verified: 2026-10-08 (none in use)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
