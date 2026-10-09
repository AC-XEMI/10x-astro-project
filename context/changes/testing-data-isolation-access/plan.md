# Izolacja danych i dostęp w CI — plan wdrożenia (test-plan, faza 1)

## Overview

Wprowadzamy warstwę testów integracyjnych (osobny config Vitest, `tests/integration/`) uruchamianą w jobie CI `smoke` na lokalnym Supabase i zbudowanej aplikacji. Testy dowodzą dwóch ryzyk z `context/foundation/test-plan.md` §2:

- **#1:** użytkownik B nie odczyta, nie oznaczy, nie wstawi ani nie usunie danych A żadną drogą — ani przez bazę, ani przez HTTP. Po każdej odmowie test ponownie czyta stan danych A.
- **#2:** bez sesji i po wylogowaniu każda chroniona trasa (strony i API) odmawia.

Przy okazji `POST /api/deviations/review` przestaje zwracać „sukces bez skutku” dla cudzych id, a `scripts/verify-rls.mjs` zostaje wchłonięty przez nową suitę.

## Current State Analysis

Źródło: `context/changes/testing-data-isolation-access/research.md`.

**Izolacja (#1)**
- Izolacja opiera się wyłącznie na RLS. Żadne zapytanie w trasach nie filtruje po `user_id`, a klient bazy powstaje per żądanie z kluczem anon i ciasteczkiem sesji (`src/lib/supabase.ts:10`).
- Polityki istnieją dla 4 operacji na 3 tabelach, z `WITH CHECK` na UPDATE (`supabase/migrations/20260925120100_report_schema_rls.sql:12-124`). Nikt nie testował INSERT pod cudzego rodzica ani UPDATE/DELETE na `visits`.
- `GET /reports/[id]` dla cudzego id zwraca 404 (`src/pages/reports/[id].astro:17,32,43`). Delete wykrywa 0 usuniętych wierszy (`src/pages/api/reports/[id]/delete.ts:34,48-56`). Żadne z tych zachowań nie ma testu.
- `POST /api/deviations/review` dla cudzych id zwraca **200 `{ updated: [] }`** (`src/pages/api/deviations/review.ts:35-45`). Przy błędzie bazy zwraca surowy `error.message` (`:42`) i nie sprawdza, czy id mają format UUID (`:26`).
  - Klient traktuje każdą odpowiedź `!response.ok` jako błąd (`src/components/reports/DeviationsList.tsx:326-330`), a brakujące wiersze wykrywa po `updated.length < ids.length` (`:344`).

**Dostęp (#2)**
- Middleware chroni prefiksy `["/dashboard", "/reports", "/api/reports", "/api/deviations"]` przez `startsWith` na surowym `pathname` (`src/middleware.ts:4,18`) i wywołuje `getUser()` (`:12`).
- Brak konfiguracji kończy się odmową dostępu (`:14-15`). Chronione API dostają **302 → `/auth/signin`, nie 401**.
- Wylogowanie wywołuje `signOut()` bez scope i bez obsługi błędu (`src/pages/api/auth/signout.ts:9`). Nikt nie sprawdzał, czy stare ciasteczko odtworzone po wylogowaniu zostanie odrzucone.

**Istniejące testy**
- `scripts/verify-rls.mjs` (w CI, `.github/workflows/ci.yml:61`) robi tylko SELECT całych tabel oraz UPDATE/DELETE na `reports` i UPDATE na `deviations`. Nie czyta ponownie stanu bazy, nie testuje INSERT, klienta anon ani HTTP.
- `scripts/smoke.mjs:38-59` sprawdza bez sesji tylko `/reports`, a po wylogowaniu usuwa ciasteczka ze słoika, więc nie dowodzi unieważnienia sesji po stronie serwera.

**Infrastruktura**
- Job `smoke` startuje lokalny Supabase, buduje aplikację z jego `API_URL`/`ANON_KEY`, uruchamia `npm run preview` w tle i odpala smoke (`ci.yml:46-61`).
- Workflow uruchamia się tylko na push/PR do `master` (`ci.yml:3-7`).
- `vitest.config.ts:13` ma `include: ["src/**/*.test.ts"]`. Stryker korzysta z tego configu, więc `tests/integration/**` będzie poza `npm test` i Strykerem.
- Lokalnie Docker nie działa (stan na 2026-10-08), więc testy integracyjne zweryfikujemy w CI (PR `dev` → `master`), chyba że Docker zostanie uruchomiony.

## Desired End State

- `npm run test:integration` uruchamia Vitest z `vitest.integration.config.ts` na `tests/integration/**/*.int.test.ts` przeciw lokalnemu Supabase (`npx supabase status -o env`) i działającej aplikacji pod `BASE_URL`. Job `smoke` uruchamia go na każdym push/PR do `master`, a porażka blokuje deploy.
- Suita dowodzi ryzyka #1 na dwóch poziomach, za każdym razem z kontrolą po stronie A (A widzi swój wiersz) i ponownym odczytem stanu po odmowie:
  - **baza:** pełna macierz operacji B→A oraz klienta anon,
  - **HTTP:** strona szczegółów, delete, review, lista i pulpit.
- Suita dowodzi ryzyka #2:
  - każda chroniona strona i każde chronione API bez sesji odmawia, a stan bazy się nie zmienia;
  - warianty ścieżki (wielkość liter, kodowanie, ukośnik) nie omijają ochrony;
  - test inwentarza pada, gdy w `src/pages` pojawi się niesklasyfikowana trasa;
  - ciasteczka sprzed wylogowania niczego nie odblokowują.
- `POST /api/deviations/review` zwraca kody błędów w JSON:
  - 0 zmienionych wierszy → 404 `not_found`,
  - id spoza UUID lub zły body → 400 `invalid_request`,
  - błąd bazy → 500 `update_failed`, bez surowego komunikatu.
  
  Odmowy i błędy logowane są przez `logAppEvent`. Częściowy sukces zostaje 200 i należy do fazy 3 planu testów.
- `scripts/verify-rls.mjs`, `npm run verify:rls` i jego krok CI nie istnieją. CLAUDE.md i `test-plan.md` (§4, §5, §6.2, §6.3, §6.5, §7) opisują nową warstwę.

### Key Discoveries:

- `src/pages/api/deviations/review.ts:45` — `Response.json({ updated: data })` bez sprawdzenia długości; to jedyna trasa danych, która dziś przy cudzych id zwraca sukces.
- `src/components/reports/DeviationsList.tsx:326-330` — `!response.ok` → `setActionError("review")`, więc 404 nie wymaga zmian w kliencie.
- `scripts/smoke.mjs:23-36` — wzorzec klienta HTTP: `redirect: "manual"`, nagłówek `Origin: BASE_URL` (wymagany przez domyślny `checkOrigin` Astro dla POST-ów formularzy), słoik ciasteczek. Nowy helper go powtarza.
- `scripts/verify-rls.mjs:12-31` — wzorzec odczytu env lokalnego Supabase z `npx supabase status -o env`, a nie z `.env` (lokalny `.env` wskazuje projekt w chmurze).
- `src/pages/api/reports/upload.ts:181` — sukces kończy się redirectem `/reports/<id>`, więc test HTTP odczyta id raportu A z `Location`.
- `src/lib/app-events.ts:12-19,37` — lista zdarzeń i pole `code?: ReportErrorCode`; nowe zdarzenia i kody przeglądu dodaje się tylko tutaj.
- `supabase/config.toml:190,209` — limit `sign_in_sign_ups = 30`/5 min na IP, `enable_confirmations = false` (signUp od razu zwraca sesję).

## What We're NOT Doing

- **Częściowy sukces przeglądu** (część id własnych, część cudzych lub usuniętych) — ryzyko #6, faza 3 planu testów. Kontrakt 200 z niepełnym `updated` zostaje.
- **Bezpośrednie wywołania PostgREST ze starym JWT po wylogowaniu** — JWT jest bezstanowy do `jwt_expiry` (1 h, `supabase/config.toml:158`). Trafia do §7 jako świadomie nietestowane.
- **Zmiany w `scripts/smoke.mjs`** — zostaje jako szybki test przepływu logowania. Nowa suita go uzupełnia, nie zastępuje.
- **Ochrona `/dev/kitchen-sink/*`** — strony pokazują tylko fixtures; są już w §7 test-planu. Test inwentarza klasyfikuje je jako publiczne.
- **Zmiana statusu 302 → 401 dla API bez sesji** — testy przyjmują obecny kontrakt (302 na `/auth/signin`).
- **Backport korekt do test-plan §2** (302 zamiast 401, review) — należy do `/10x-test-plan`, nie do tej zmiany.
- **Sprzątanie kont testowych** — lokalny Supabase jest efemeryczny (`supabase stop --no-backup` w CI). Lokalnie konta mają unikalne e-maile per przebieg.
- **Testy e2e w przeglądarce i mockowanie bazy.**

## Implementation Approach

Najpierw szkielet: config, helpery, krok CI i jeden test pozytywny dowodzący, że suita widzi bazę i aplikację. Potem testy ryzyk w kolejności priorytetu: #1, potem #2.

Poprawkę `review.ts` robimy test-first: test HTTP jest najpierw czerwony na obecnym 200, dopiero potem zmieniamy endpoint. Jeśli test ścieżek lub wylogowania w fazie 3 okaże się czerwony, to jest znalezisko:
- warianty ścieżki naprawiamy w middleware (decyzja z planowania),
- przyjęcie starej sesji po wylogowaniu zatrzymuje fazę i wraca do użytkownika.

Każdy test spełnia te same zasady przeciw anty-wzorcom z test-plan §2:
- asercje na stan bazy, nie tylko na kod odpowiedzi;
- kontrola po stronie A (wiersz istnieje i A go widzi), żeby „pusto dla B” nie znaczyło „pusto w ogóle”;
- bez mocków middleware i bazy.

## Critical Implementation Details

- **Konta i limit logowań:** `globalSetup` zakłada 3 konta raz na przebieg (A i B do izolacji, C wyłącznie do testu wylogowania) przez `signUp` kluczem anon i przekazuje dane logowania do testów przez `provide`/`inject` Vitest. Konto C jest osobne, bo `signOut()` bez scope jest globalne i unieważniłoby sesje A w innych plikach. Logowań przez trasę aplikacji ma być minimum, bo smoke w tym samym jobie zużywa już 3 z 30 na 5 min.
- **Zgodność aplikacji i bazy:** `globalSetup` loguje A przez `POST /api/auth/signin`. Jeśli nie dostanie redirectu na `/reports`, przerywa z czytelnym błędem („aplikacja pod BASE_URL nie jest podłączona do lokalnego Supabase”), bo lokalnie `.env` wskazuje chmurę. Nie pomija testów po cichu.
- **Kolejność i równoległość:** `fileParallelism: false` — pliki dzielą konta i dane A. W CI suita uruchamia się w tym samym kroku co smoke, po nim, bo `npm run preview` działa w tle tego kroku.

## Faza 1: Szkielet suity integracyjnej i krok CI

### Overview

Konfiguracja, helpery i podpięcie do joba `smoke`, plus jeden test pozytywny dowodzący, że suita rozmawia z lokalnym Supabase i z aplikacją podłączoną do tej samej bazy.

### Changes Required:

#### 1. Konfiguracja Vitest dla integracji

**File**: `vitest.integration.config.ts` (nowy)

**Intent**: Osobny config, żeby testy wymagające Supabase nie trafiły do `npm test` (job `ci` bez bazy) ani do Strykera.

**Contract**:
- `include: ["tests/integration/**/*.int.test.ts"]`, `environment: "node"`, alias `@` jak w `vitest.config.ts`.
- `globalSetup: tests/integration/global-setup.ts`, `fileParallelism: false`, `testTimeout` ≥ 30 s.
- `vitest.config.ts` zostaje bez zmian.

#### 2. Skrypt npm

**File**: `package.json`

**Intent**: Jedno polecenie dla CI i lokalnie.

**Contract**: `"test:integration": "vitest run --config vitest.integration.config.ts"`. Bez nowych zależności, Vitest zostaje na `^4.1.10`.

#### 3. Global setup i helpery

**File**: `tests/integration/global-setup.ts`, `tests/integration/helpers/*.ts` (nowe)

**Intent**: Wspólne narzędzia dla faz 1–3 tej zmiany i kolejnych faz planu testów.

**Contract**:
- **env:** `API_URL`/`ANON_KEY` z `npx supabase status -o env` (wzorzec `verify-rls.mjs:12-31`); `BASE_URL` z env, domyślnie `http://localhost:4321`. Brak lokalnego Supabase lub aplikacji to głośna porażka.
- **konta:** tworzy A, B i C z unikalnymi e-mailami (`<rola>-<runId>@example.com`) i udostępnia je przez `provide`. Sprawdza zgodność aplikacji z bazą (patrz Critical Implementation Details).
- **klient bazy:** fabryka klienta supabase-js zalogowanego jako dany użytkownik oraz klient anon (`persistSession: false, autoRefreshToken: false`).
- **klient HTTP:** `fetch` z `redirect: "manual"`, nagłówek `Origin`, słoik ciasteczek z możliwością zrobienia i odtworzenia kopii. Obsługuje form-urlencoded, multipart (plik CSV) i JSON. Zwraca status, `Location` i opcjonalnie treść.
- **seed:** wgranie `test-data/sample-report.csv` przez `POST /api/reports/upload` z unikalną nazwą pliku; id raportu odczytane z `Location: /reports/<id>`.

#### 4. Test pozytywny szkieletu

**File**: `tests/integration/harness.int.test.ts` (nowy)

**Intent**: Dowód, że suita widzi aplikację i bazę. Bez niego zielone testy odmów mogłyby znaczyć „nic nie działa”.

**Contract**:
- A po zalogowaniu przez aplikację dostaje 200 na `/reports`.
- A przez supabase-js widzi raport wgrany przez HTTP, a jego wizyty i odstępstwa istnieją.

#### 5. Krok CI

**File**: `.github/workflows/ci.yml`

**Intent**: Bramka „integration” z test-plan §5 staje się wymagana.

**Contract**:
- W kroku „Run smoke test against production preview” (`ci.yml:56-60`) po `npm run smoke` dodać `BASE_URL=http://localhost:4321 npm run test:integration`; zmienić nazwę kroku tak, by mówiła o obu.
- Krok `verify:rls` zostaje do fazy 2.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi (z nowymi plikami w `tests/`)
- `npx astro check` przechodzi
- `npm test` przechodzi i nie uruchamia plików `*.int.test.ts`
- Job `smoke` w CI (PR `dev` → `master`) przechodzi z krokiem `npm run test:integration` i testem szkieletu

#### Manual Verification:

- Log CI pokazuje, że `test:integration` faktycznie uruchomił `harness.int.test.ts` (liczba testów > 0)

**Implementation Note**: Weryfikacja wymaga pushu i PR do `master` — potwierdź z użytkownikiem przed pushem. Po zielonym CI zatrzymaj się na potwierdzenie ręczne.

---

## Faza 2: Izolacja danych między kontami (ryzyko #1)

### Overview

Pełna macierz odmów B→A na poziomie bazy i HTTP. Poprawka kontraktu `review.ts` (test-first). Wchłonięcie i usunięcie `verify-rls.mjs`.

### Changes Required:

#### 1. Izolacja na poziomie bazy

**File**: `tests/integration/rls-isolation.int.test.ts` (nowy)

**Intent**: Zastępuje i rozszerza `verify-rls.mjs`. Dowodzi, że RLS odmawia każdej operacji B na danych A, a stan A pozostaje niezmieniony.

**Contract**:
- **Asertowane zachowanie:** A zasiewa raport, wizytę i odstępstwo (`unreviewed`). Następnie:
  - **SELECT:** B po konkretnym id na każdej z 3 tabel dostaje pusto; A ten sam wiersz widzi (kontrola).
  - **INSERT:** B nie wstawi raportu z `user_id` A, wizyty pod raport A ani odstępstwa pod wizytę A. Oczekiwany błąd RLS; liczba wierszy A się nie zmienia.
  - **UPDATE:** B na każdej z 3 tabel dostaje 0 wierszy, a A po ponownym odczycie widzi niezmienione wartości (nazwa pliku, pola wizyty, status odstępstwa).
  - **Przepięcie:** B nie przepnie własnej wizyty pod raport A (`WITH CHECK`).
  - **DELETE:** B na każdej z 3 tabel dostaje 0 wierszy; wiersze A nadal istnieją.
  - **Anon:** klient anon dostaje pusto przy SELECT na 3 tabelach i błąd przy INSERT.
  - **Ścieżka pozytywna z `verify-rls`:** A aktualizuje swoje odstępstwo; A usuwa swój raport (1 wiersz) z kaskadą na wizytę i odstępstwo.
- **Łapana regresja:** zła lub usunięta polityka na dowolnej tabeli lub operacji, w tym podzapytanie dwupoziomowe dla `deviations`.
- **Źródło:** research „Ryzyko #1”, polityki `report_schema_rls.sql:12-124`.
- **Przypadek brzegowy:** INSERT pod cudzego rodzica i przepięcie przez UPDATE — nigdy wcześniej nietestowane.
- **Unikany anty-wzorzec:** asercja tylko na brak błędu lub 0 wierszy bez ponownego odczytu stanu; test na jednym koncie.

#### 2. Izolacja przez HTTP

**File**: `tests/integration/http-isolation.int.test.ts` (nowy)

**Intent**: Dowodzi, że trasy aplikacji tłumaczą odmowę RLS na „nie znaleziono” lub odmowę i nie zmieniają danych A.

**Contract**:
- **Asertowane zachowanie:** A wgrywa `sample-report.csv` przez HTTP (kontrola: A dostaje 200 na `/reports/<id>`). Następnie B:
  - `GET /reports/<id A>` → 404.
  - `POST /api/reports/<id A>/delete` → 302 z `Location` zawierającym kod `report_not_found`; A nadal ma raport z tą samą liczbą wizyt.
  - `POST /api/deviations/review` z id odstępstw A → 404 `{ error: "not_found" }`; odstępstwa A w bazie nadal `unreviewed` z `reviewed_at = null`.
  - `GET /reports` i `GET /dashboard` → 200, a HTML nie zawiera id raportu A ani jego unikalnej nazwy pliku.
  - `POST /api/deviations/review` z id spoza UUID → 400 `invalid_request`; z pustą tablicą → 400.
- **Łapana regresja:** trasa, która zgłasza sukces lub zmienia stan przy cudzym id; wyciek danych A na liście lub pulpicie (np. przez regresję polityki SELECT na `visits`).
- **Źródło:** research „Ryzyko #1 — ścieżki dostępu do danych”, `review.ts:35-45`, `delete.ts:48-56`, `[id].astro:43`.
- **Przypadek brzegowy:** zniekształcone id w review (dziś błąd bazy → 500 z surowym komunikatem).
- **Unikany anty-wzorzec:** sprawdzanie tylko kodu odpowiedzi bez stanu bazy; asercja na treści komunikatu zamiast na kodzie.

Test review jest pisany i uruchamiany (CI czerwone na 200) **przed** zmianą nr 3.

#### 3. Kontrakt odmowy w endpoincie przeglądu

**File**: `src/pages/api/deviations/review.ts`

**Intent**: Serwer ma jawnie odmawiać, gdy żadne podane id nie należy do użytkownika, i nie ujawniać surowych komunikatów Supabase (reguła „kod, nie tekst” z CLAUDE.md).

**Contract**:
- Odpowiedzi JSON `{ error: <kod> }`:
  - 503 `not_configured`
  - 401 `unauthorized`
  - 400 `invalid_request` — body nie jest niepustą tablicą stringów w formacie UUID lub status jest nieznany; walidacja przed zapytaniem
  - 500 `update_failed`
  - 404 `not_found` — `data.length === 0`
- Sukces bez zmian: 200 `{ updated }`, także przy częściowym (faza 3).
- Odmowa 404 loguje `deviation.review.rejected` (warn), błąd bazy `deviation.review.failed` (error) przez `logAppEvent` z `userId` i `dbError`.
- Klient (`DeviationsList.tsx`) bez zmian, bo już traktuje `!ok` jako błąd.

#### 4. Zdarzenia przeglądu

**File**: `src/lib/app-events.ts`, `src/lib/app-events.test.ts`

**Intent**: Nowe zdarzenia i kody dodaje się w module, nie w miejscu wywołania (CLAUDE.md, „Logging server-side failures”).

**Contract**:
- `EVENT_LEVELS` dostaje `deviation.review.rejected: "warn"` i `deviation.review.failed: "error"`.
- `AppEventStage` dostaje `review`.
- Typ pola `code` przyjmuje kody przeglądu (`not_found`, `update_failed`) obok `ReportErrorCode`.
- Biała lista pól bez zmian; test jednostkowy pokrywa poziom nowych zdarzeń.

#### 5. Usunięcie `verify-rls`

**File**: `scripts/verify-rls.mjs` (usunięty), `package.json` (`verify:rls` usunięty), `.github/workflows/ci.yml` (krok `npm run verify:rls` usunięty), `CLAUDE.md` (sekcja Commands: usunięty wpis `verify:rls`, dodany `test:integration`)

**Intent**: Jedno źródło prawdy o izolacji. Usuwamy dopiero, gdy `rls-isolation.int.test.ts` pokrywa każde sprawdzenie skryptu (lista z research, „Istniejące testy”).

**Contract**: Żadne odwołanie do `verify:rls` / `verify-rls` w `package.json`, `ci.yml`, `CLAUDE.md`, `eslint.config.js`. Archiwum zostaje nietknięte.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npx astro check` i `npm test` (w tym `app-events.test.ts`) przechodzą
- Job `smoke` w CI przechodzi z `rls-isolation.int.test.ts` i `http-isolation.int.test.ts`
- CI przed zmianą `review.ts` pokazuje czerwony test review (404 oczekiwane, 200 otrzymane), po zmianie zielony
- `grep -rn "verify-rls\|verify:rls" package.json .github CLAUDE.md scripts` nic nie zwraca

#### Manual Verification:

- Na stronie szczegółów raportu oznaczenie i cofnięcie odstępstwa nadal działa (dev server lub preview na lokalnym/chmurowym Supabase)
- Kontrola czułości: tymczasowa zmiana polityki SELECT na `visits` na `using (true)` (lokalnie z Dockerem lub na odrzuconym commicie w PR) sprawia, że suita jest czerwona; zmiana zostaje cofnięta

**Implementation Note**: Po zielonym CI zatrzymaj się na potwierdzenie ręczne przed fazą 3.

---

## Faza 3: Dostęp bez sesji i po wylogowaniu (ryzyko #2)

### Overview

Każda chroniona trasa bez sesji odmawia, a stan danych się nie zmienia. Warianty ścieżki nie omijają ochrony. Inwentarz tras pilnuje nowych plików. Stara sesja po wylogowaniu nic nie odblokowuje.

### Changes Required:

#### 1. Odmowa bez sesji i inwentarz tras

**File**: `tests/integration/route-access.int.test.ts` (nowy)

**Intent**: Dowód dla każdej chronionej strony i każdego API, nie tylko dla `/reports` jak w smoke.

**Contract**:
- **Asertowane zachowanie:**
  - Lista `PROTECTED_REQUESTS` obejmuje `GET /dashboard`, `GET /reports`, `GET /reports/<losowy UUID>`, `GET /reports/<id A>`, `POST /api/reports/upload` (multipart CSV), `POST /api/reports/<id A>/delete`, `POST /api/deviations/review` (id odstępstw A). Bez ciasteczek każde żądanie → 302 z `Location` zaczynającym się od `/auth/signin`.
  - Po żądaniach POST A nadal ma ten sam zbiór raportów, a jego odstępstwa są `unreviewed`.
  - Warianty `/Reports`, `/REPORTS/<id A>`, `/%72eports`, `/reports/`, `/dashboard/`, `/API/deviations/review` bez sesji nie zwracają 2xx.
  - Test inwentarza czyta pliki w `src/pages/**` (`.astro`, `.ts`), mapuje je na wzorce tras i pada, jeśli któraś trasa nie jest ani na liście `PUBLIC_ROUTES` (`/`, `/auth/*`, `/api/auth/*`, `/dev/kitchen-sink/*`), ani pokryta przez `PROTECTED_REQUESTS`.
- **Łapana regresja:** nowa trasa danych poza prefiksami middleware; usunięty prefiks; ominięcie ochrony przez wielkość liter lub kodowanie; handler zmieniający stan przed sprawdzeniem sesji.
- **Źródło:** research „Ryzyko #2 — ochrona tras i sesja”, `middleware.ts:4,18-20`.
- **Przypadek brzegowy:** warianty ścieżki (niezweryfikowane w researchu); upload bez sesji z prawidłowym plikiem.
- **Unikany anty-wzorzec:** mockowanie middleware; testowanie tylko stron bez tras API; oczekiwanie 401 tam, gdzie kontrakt to 302.

Jeśli warianty ścieżki są czerwone, naprawa wchodzi do tej fazy: middleware porównuje znormalizowaną ścieżkę (zdekodowaną i w małych literach) z `PROTECTED_ROUTES` (`src/middleware.ts:18`). Test pozostaje bez zmian.

#### 2. Sesja po wylogowaniu

**File**: `tests/integration/signout.int.test.ts` (nowy)

**Intent**: Dowód, że serwer unieważnia sesję. Smoke dowodzi tylko, że przeglądarka by ją wyrzuciła.

**Contract**:
- **Asertowane zachowanie:** konto C loguje się przez aplikację; robimy kopię ciasteczek; kontrola: `GET /reports` → 200. Następnie `POST /api/auth/signout` → 302 `/`. Po odtworzeniu starej kopii ciasteczek:
  - `GET /reports`, `GET /dashboard`, `GET /reports/<id raportu C>` → 302 `/auth/signin`;
  - `POST /api/deviations/review` z id odstępstw C → 302 `/auth/signin`, a odstępstwa C w bazie bez zmian.
- **Łapana regresja:** `signOut()` przestaje unieważniać sesję po stronie serwera (np. zmiana scope, wyjątek ignorowany przez `signout.ts:9`), middleware przechodzi na `getSession()`.
- **Źródło:** research „Wylogowanie” i Open Question 3; `signout.ts:7-11`, `config.toml:158`.
- **Przypadek brzegowy:** token dostępu w ciasteczku jest jeszcze ważny czasowo (`jwt_expiry` 3600 s).
- **Unikany anty-wzorzec:** „smoke loguje się i wylogowuje, więc sesja jest unieważniona” (słoik usuwa ciasteczka); mockowanie `getUser()`.

Jeśli ten test jest czerwony (serwer przyjmuje stare ciasteczko), **zatrzymaj fazę** i wróć do użytkownika z wynikiem i opcjami. Naprawa nie jest z góry zdecydowana.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npx astro check` i `npm test` przechodzą
- Job `smoke` w CI przechodzi z `route-access.int.test.ts` i `signout.int.test.ts`

#### Manual Verification:

- Test inwentarza pada po dodaniu tymczasowej trasy `src/pages/api/probe.ts` (lokalnie z Supabase albo na odrzuconym commicie w PR) — sprawdzone i cofnięte
- Wynik testu wariantów ścieżki i testu wylogowania odnotowany w `§6.5` test-planu (zielone od razu czy po poprawce middleware)

**Implementation Note**: Po zielonym CI zatrzymaj się na potwierdzenie ręczne przed fazą 4.

---

## Faza 4: Dokumentacja i cookbook

### Overview

CLAUDE.md i `context/foundation/test-plan.md` opisują nową warstwę, żeby następna faza planu testów (zapis raportu) dodała testy według wzorca, a nie od zera.

### Changes Required:

#### 1. CLAUDE.md

**File**: `CLAUDE.md`

**Intent**: Projektowe zasady zgodne z kodem.

**Contract**:
- **Commands:** `npm run test:integration` — co wymaga (`npx supabase start`, aplikacja pod `BASE_URL` podłączona do **lokalnego** Supabase, np. `.dev.vars` z wartościami z `npx supabase status -o env`) i kiedy uruchamiać.
- **„Tests” (Key conventions):** integracja w `tests/integration/*.int.test.ts`, osobny config, poza `npm test` i Strykerem; trzy konta z `globalSetup`; asercja na stan bazy i kontrola po stronie A.
- **CI:** job `smoke` uruchamia `test:integration` po smoke.
- **Reports list contract / API routes:** jedno zdanie o kodach błędów `review.ts`.

#### 2. test-plan.md

**File**: `context/foundation/test-plan.md`

**Intent**: Cookbook §6 rośnie wraz z fazami (zasada test-planu). §4 i §5 zgadzają się z CI.

**Contract**:
- **§4:**
  - wiersz `integration`: Vitest 4.1.10, `vitest.integration.config.ts`, `tests/integration/`, `checked: <data>`;
  - wiersz `sanity scripts`: tylko `smoke`, a `verify:rls` wchłonięty (prostuje też błędne „ręcznie” — skrypt był w CI).
- **§5:** gate integration → `required`, CI job `smoke`.
- **§6.2** (lokalizacja, nazewnictwo, test referencyjny `rls-isolation.int.test.ts`, polecenie, reguły: dwa konta, kontrola po stronie A, ponowny odczyt stanu).
- **§6.3** (wzorzec żądania HTTP przez helper, asercja na kodzie i stanie bazy, test referencyjny `http-isolation.int.test.ts`, dopisanie nowej trasy do `PROTECTED_REQUESTS` lub `PUBLIC_ROUTES`).
- **§6.5:** 2–3 linie notatek z fazy.
- **§7:** nowy punkt „stary JWT bezpośrednio do PostgREST po wylogowaniu (ważny do `jwt_expiry`)” z powodem i warunkiem ponownej oceny.
- §1–§3 bez zmian; status w §3 aktualizuje `/10x-test-plan`.

### Success Criteria:

#### Automated Verification:

- `npx prettier --check CLAUDE.md context/foundation/test-plan.md` przechodzi
- `grep -n "TBD — see §3 Phase 1" context/foundation/test-plan.md` nie zwraca §6.2 (§6.3 może zostać częściowo TBD dla fazy 2 planu testów)

#### Manual Verification:

- §6.2 i §6.3 wystarczą, żeby dodać nowy test integracyjny bez czytania kodu helperów od zera
- Treść CLAUDE.md zgadza się z faktycznymi poleceniami i krokami CI

**Implementation Note**: Po tej fazie uruchom `/10x-test-plan`, żeby oznaczyć fazę 1 jako `complete` i rozważyć backport korekt §2.

---

## Testing Strategy

### Unit Tests:

- `src/lib/app-events.test.ts` — poziomy nowych zdarzeń `deviation.review.*` i niezmieniona biała lista pól.

### Integration Tests:

- `harness.int.test.ts` — suita widzi aplikację i bazę (faza 1).
- `rls-isolation.int.test.ts` — macierz B→A i anon na 3 tabelach z ponownym odczytem stanu (faza 2).
- `http-isolation.int.test.ts` — strona szczegółów, delete, review, lista, pulpit dla cudzego id (faza 2).
- `route-access.int.test.ts` — odmowa bez sesji dla każdej chronionej trasy, warianty ścieżki, inwentarz (faza 3).
- `signout.int.test.ts` — odtworzone ciasteczka po wylogowaniu (faza 3).

### Manual Testing Steps:

1. Na stronie szczegółów raportu oznaczyć odstępstwo jako przejrzane i cofnąć; oba działają bez komunikatu błędu.
2. Kontrola czułości: tymczasowo osłabić politykę SELECT na `visits` i potwierdzić czerwoną suitę; cofnąć.
3. Kontrola inwentarza: tymczasowa trasa w `src/pages/api/` → test inwentarza czerwony; cofnąć.

## Performance Considerations

Suita dokłada do joba `smoke` kilka do kilkunastu sekund (jedno wgranie CSV, kilkadziesiąt żądań HTTP i zapytań). Logowania: 3 signUp + kilka signIn, w limicie 30/5 min razem ze smoke.

## Migration Notes

Brak migracji bazy. Zmiana kontraktu `review.ts` dla 0 wierszy (200 → 404) jest zgodna z jedynym klientem (`DeviationsList.tsx:326`).

## References

- Research: `context/changes/testing-data-isolation-access/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (#1, #2), §5, §6.2, §6.3, §7
- Wzorzec klienta HTTP: `scripts/smoke.mjs:9-36`
- Wzorzec env lokalnego Supabase: `scripts/verify-rls.mjs:12-41`
- Wzorzec kodów i logowania odmowy: `src/pages/api/reports/[id]/delete.ts:29-56`, `src/lib/app-events.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Szkielet suity integracyjnej i krok CI

#### Automated

- [x] 1.1 `npm run lint` przechodzi (z nowymi plikami w `tests/`) — c49004e
- [x] 1.2 `npx astro check` przechodzi — c49004e
- [x] 1.3 `npm test` przechodzi i nie uruchamia plików `*.int.test.ts` — c49004e
- [x] 1.4 Job `smoke` w CI (PR `dev` → `master`) przechodzi z krokiem `npm run test:integration` i testem szkieletu — c49004e

#### Manual

- [x] 1.5 Log CI pokazuje, że `test:integration` faktycznie uruchomił `harness.int.test.ts` (liczba testów > 0) — c49004e

### Phase 2: Izolacja danych między kontami (ryzyko #1)

#### Automated

- [x] 2.1 `npm run lint`, `npx astro check` i `npm test` (w tym `app-events.test.ts`) przechodzą — 38bb175
- [x] 2.2 Job `smoke` w CI przechodzi z `rls-isolation.int.test.ts` i `http-isolation.int.test.ts` — 38bb175
- [x] 2.3 CI przed zmianą `review.ts` pokazuje czerwony test review (404 oczekiwane, 200 otrzymane), po zmianie zielony — 38bb175
- [x] 2.4 `grep -rn "verify-rls\|verify:rls" package.json .github CLAUDE.md scripts` nic nie zwraca — 38bb175

#### Manual

- [x] 2.5 Na stronie szczegółów raportu oznaczenie i cofnięcie odstępstwa nadal działa — 38bb175
- [x] 2.6 Kontrola czułości: osłabiona polityka SELECT na `visits` daje czerwoną suitę; zmiana cofnięta — 38bb175

### Phase 3: Dostęp bez sesji i po wylogowaniu (ryzyko #2)

#### Automated

- [ ] 3.1 `npm run lint`, `npx astro check` i `npm test` przechodzą
- [ ] 3.2 Job `smoke` w CI przechodzi z `route-access.int.test.ts` i `signout.int.test.ts`

#### Manual

- [ ] 3.3 Test inwentarza pada po dodaniu tymczasowej trasy `src/pages/api/probe.ts` — sprawdzone i cofnięte
- [ ] 3.4 Wynik testu wariantów ścieżki i testu wylogowania odnotowany w §6.5 test-planu

### Phase 4: Dokumentacja i cookbook

#### Automated

- [ ] 4.1 `npx prettier --check CLAUDE.md context/foundation/test-plan.md` przechodzi
- [ ] 4.2 `grep -n "TBD — see §3 Phase 1" context/foundation/test-plan.md` nie zwraca §6.2

#### Manual

- [ ] 4.3 §6.2 i §6.3 wystarczą, żeby dodać nowy test integracyjny bez czytania kodu helperów od zera
- [ ] 4.4 Treść CLAUDE.md zgadza się z faktycznymi poleceniami i krokami CI
