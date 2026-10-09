# Phase 2 — kompletny i poprawny zapis wgranego raportu: plan wdrożenia

## Overview

Rollout Phase 2 z `context/foundation/test-plan.md` (ryzyka #3, #4, #5). Testy integracyjne na lokalnym Supabase, uruchamiane w CI w jobie `smoke`, mają dowieść trzech rzeczy:

- wgranie zapisuje wszystko albo nic (#3),
- wynik w bazie zgadza się wiersz po wierszu z wyrocznią fixture'ów (#4),
- serwer sam odrzuca błędne pliki z właściwym kodem, bez polegania na przeglądarce (#5).

Faza zawiera jedną małą poprawkę produkcyjną: dwa spreparowane żądania kończą się dziś 500 zamiast kodem błędu.

## Current State Analysis

- **Zapis bez transakcji.** `src/pages/api/reports/upload.ts:71-181` wykonuje `reports` insert (L71-79), potem `visits` insert z `.select()` (L113), potem `deviations` insert (L154). Po błędzie wizyt (L125) albo odstępstw (L166) działa kompensujący `rollbackReport()` (L96-106), a kaskada FK (`supabase/migrations/20260925120000_create_report_schema.sql:34,48`) usuwa wizyty i odstępstwa. Licznik `deviation_count` (L173-179) świadomie nie wycofuje zapisu (`count_failed`). Błąd samego rollbacku jest tylko logowany (`rollback_failed`), a raport zostaje osierocony.
- **Błędu `deviations` nie da się wywołać treścią pliku.** Schemat nie ma `check` ani `unique` poza PK, a parser przepuszcza tylko wartości zgodne z typami kolumn (research §#3). Błąd trzeba wstrzyknąć w bazie.
- **Wyrocznia #4.** Literały w `src/lib/services/deviation-rules.test.ts:55-110` dla CSV i XLSX. Mapowanie wiersz → `visited_client` → reguły jest w research (tabela §#4): 15 wizyt, 15 odstępstw (7 `missing_gps`, 5 `phone_instead_of_visit`, 3 `route_deviation`), bez odstępstw wiersze {A, D, P, R, T5}. `detectRouteDeviations` ufa kolejności tablicy (`deviation-rules.ts:79-81`), a w produkcji dostaje ją z `insert().select()` (`upload.ts:113,145`). Test jednostkowy podaje wiersze w kolejności pliku. Tabela `deviations` nie ma `unique (visit_id, rule)`.
- **Walidacja #5.** Serwer: `no_file` (L37), `too_large` dla `> 5 MiB` (L10, L45), `bad_type` dla niepustego MIME spoza listy (L15-20, L50), parser → `invalid_file` + `detail` (L55-66). `detail` ma rozróżniający token tylko w dwóch rodzajach błędów: nazwy brakujących kolumn (`report-parser.ts:133`) oraz `Wiersz N` z nazwą kolumny (L156-171). Trzy gałęzie mają samą prozę: rozszerzenie (L78), uszkodzony plik (L81), pusty plik lub sam nagłówek (L87/101/138).
- **Dwie ścieżki 500.** `formData()` nie jest w try/catch (L36), więc ciało nie-multipart rzuca wyjątek. Gdy `report_file` jest tekstem, wołane jest `fileExtension(undefined)` (`src/lib/app-events.ts:104`), a `.lastIndexOf` na `undefined` rzuca TypeError.
- **Harness z Phase 1.** `HttpClient` (`tests/integration/helpers/http.ts`, obsługuje `multipart.fields`, `multipart.file` i `json`), `clientAs` (`helpers/db.ts`), `account("a"|"b"|"c")`, `uploadSampleReport` (tylko CSV, `helpers/seed.ts`). Pliki testowe biegną sekwencyjnie (`vitest.integration.config.ts:17`). Obowiązuje najwyżej jedno logowanie przez aplikację na konto na plik.
- **Środowisko.** W czasie planowania (2026-10-09) Docker był wyłączony, więc `npx supabase db query --local` nie został sprawdzony ani lokalnie, ani w CI. CI uruchamia Supabase bez `postgres-meta` i `supavisor` (`.github/workflows/ci.yml:48`).

## Desired End State

- `npm run test:integration` ma trzy nowe pliki (`upload-oracle`, `upload-validation`, `upload-compensation`) i helper do wstrzykiwania błędów w bazie. Wszystkie są zielone lokalnie i w CI (job `smoke`).
- Każdy test sprawdza stan bazy odczytany jako właściciel, nie tylko przekierowanie.
- `POST /api/reports/upload` odpowiada `302 → /reports?error=no_file` na ciało nie-multipart i na `report_file` jako tekst, a nie 500.
- Każdy test ma udokumentowaną kontrolę czułości (celowe zepsucie → czerwony wynik).
- Test-plan: §6.2 i §6.4 opisują wzorce, §6.5 ma notatkę Phase 2, §2 ma korekty z research, a §3 status fazy.

### Key Discoveries:

- Klucz asercji per wizyta to `visited_client`, unikalny w obu fixture'ach (`test-data/sample-report.csv:2-16`). `visits` nie ma kolumny numeru wiersza.
- Kolejność `RETURNING` decyduje, która wizyta Marka/Tomasza dostaje flagę trasy (research §#4, P→Q ≈ 2.56 km, próg ≈ 3.84 km). Asercja per wizyta złapie jej zmianę, asercja per reguła nie.
- 5 MiB + `bad_type` to tani dowód granicy. Rozmiar jest sprawdzany przed typem (`upload.ts:45-53`), więc plik z dokładnie 5 242 880 B i MIME spoza listy musi dostać `bad_type`, czyli przejść kontrolę rozmiaru. Nie trzeba przy tym parsować 5 MB CSV ani wstawiać tysięcy wizyt.
- `rowNumber` w komunikatach parsera to 1-bazowy indeks wiersza danych, bez nagłówka (`report-parser.ts:151`).
- Phase 1 porównuje stan A przed i po w obrębie jednego testu (`route-access.int.test.ts:124-128`), więc dodatkowe raporty A z nowych plików jej nie psują. Mimo to każdy nowy test sprząta po sobie.

## What We're NOT Doing

- Strukturalny `kind` błędu parsera (`&reason=`). Wybraliśmy tokeny + asercję negatywną. Znana luka: test nie odróżni „pusty plik” od „uszkodzony plik” od „złe rozszerzenie”. Wszystkie trzy mają `invalid_file` bez tokenu kolumny ani wiersza.
- Zmiany w treści komunikatów parsera i `REPORT_ERROR_MESSAGES` (kontrakt Claude Design, słowo w słowo).
- Jawne sortowanie wizyt w `detectRouteDeviations` lub w trasie. Test przypina dzisiejszą kolejność, ale nie dowodzi gwarancji Postgresa. Zmiana produktu poza tą fazą (research OQ6).
- `max_rows = 1000` i obcinanie dużych raportów (research OQ5). To kandydat na nowe ryzyko w test-planie, nie test tej fazy.
- `unique (visit_id, rule)` w schemacie. Test wykrywa duplikaty multizbiorem, nie zmieniamy migracji.
- Testy E2E i komponentu `ReportUpload.tsx` (przeglądarka jest tylko źródłem listy „co odrzuca klient”).
- Ponowne testowanie funkcji reguł (to robi `deviation-rules.test.ts`).
- Parsowanie HTML strony szczegółów (wyspa React, grupy zwinięte). Wystarczy status 200 i to samo zapytanie co strona.
- AI-native: brak narzędzi AI w tej fazie (sprawdzone 2026-10-09).

## Implementation Approach

Warstwa jest jedna: HTTP przez prawdziwą trasę na zbudowanej aplikacji, a potem odczyt bazy klientem właściciela (`clientAs`). Bez mocków bazy: błędy wstrzykujemy prawdziwymi triggerami Postgresa, żeby przeszły przez prawdziwe gałęzie `visitsError`/`deviationsError` i prawdziwą kaskadę.

Każdy trigger jest zawężony do unikalnego markera w `original_filename` (prefiks per rodzaj błędu + UUID). Inne pliki i testy nie mogą go więc trafić. Zakładamy go w `beforeAll`, zdejmujemy w `afterAll` (idempotentnie, także po przerwanym przebiegu).

Kolejność faz: najpierw spike mechanizmu (ma najwięcej niewiadomych, a CI daje czas na fallback), potem tanie testy #4 i #5, potem #3 na sprawdzonym mechanizmie, na końcu dokumentacja.

Każdy test przechodzi kontrolę czułości: tymczasowe zepsucie kodu lub danych daje czerwony wynik i jest cofane przed commitem. Bez Dockera lokalnie robimy to na tymczasowym PR, zamykanym bez scalania (wzorzec z §6.5 Phase 1).

## Critical Implementation Details

- **Uprawnienia triggerów.** Funkcja triggera odczytuje `reports.original_filename` (dla `deviations` przez `visits → reports`) w kontekście roli `authenticated` z RLS. Zrób ją `security definer` z `set search_path = public`, żeby lookup nie zależał od polityk. SQL wykonuje rola `postgres` przez CLI, nie konto testowe. Klucz service-role nadal nie trafia do testów.
- **Kolejność sprzątania w `rollback_failed`.** Trigger `BEFORE DELETE ON reports` blokuje także sprzątanie testu. Najpierw zdejmij trigger, potem usuń osierocony raport jako właściciel. `afterAll` robi to samo awaryjnie.
- **Windows i CI.** Helper woła CLI tak jak `env.ts` (`execSync("npx supabase …")`). SQL przekazuj plikiem (`-f`, plik tymczasowy), a nie argumentem: cudzysłowy i `$$` w powłoce Windows i bash różnią się.

---

## Faza 1: Spike — wstrzyknięcie błędu w bazie (lokalnie i w CI)

### Overview

Sprawdzić, że test może wykonać dowolny SQL na lokalnej bazie przez CLI, lokalnie i w CI. Kończy się helperem i testem-sondą: trigger zawężony do markera zrywa wgranie z markerem, a nie rusza wgrania bez markera.

### Changes Required:

#### 1. Helper SQL dla lokalnej bazy

**File**: `tests/integration/helpers/db-fault.ts` (nowy)

**Intent**: Jedno miejsce, które wykonuje SQL jako `postgres` na **lokalnym** Supabase i zakłada albo zdejmuje trigger rzucający wyjątek dla wierszy raportu z danym prefiksem nazwy pliku. Testy nie piszą SQL-a samodzielnie.

**Contract**:
- `runLocalSql(sql: string): void`: zapis do pliku tymczasowego, potem `npx supabase db query --local -f <plik>`. Błąd CLI rzuca wyjątek z `stderr`. Gdy spike pokaże, że `--local` nie działa w CI, używamy kolejno: `--db-url` z `DB_URL` z `npx supabase status -o env` (parsowanie jak w `env.ts`), potem dev-zależności `pg` z tym samym `DB_URL`. Wybrany wariant zapisz w komentarzu helpera i w §6.2.
- `installFault(kind, markerPrefix)` / `removeFault(kind)`, gdzie `kind ∈ { "visits_insert", "deviations_insert", "reports_update", "reports_delete" }`. Każdy `kind` ma stałą nazwę funkcji i triggera (`it_fault_<kind>`). Instalacja to `create or replace function` + `drop trigger if exists` + `create trigger`, usunięcie to `drop trigger if exists` + `drop function if exists`. Obie operacje są idempotentne.
- Warunek triggera: `original_filename like '<markerPrefix>%'` raportu, do którego należy wiersz (`NEW.report_id` dla `visits`, `NEW.visit_id → visits.report_id` dla `deviations`, `OLD`/`NEW` dla `reports`). `raise exception 'it_fault_<kind>'`.
- Helper sprawdza, że `markerPrefix` pasuje do `^it-fault-[a-z_]+-[0-9a-f-]{36}$`. Zbyt szeroki wzorzec mógłby trafić w dane innych testów.

#### 2. Uogólnione wgrywanie pliku

**File**: `tests/integration/helpers/seed.ts`

**Intent**: Fazy 2–4 potrzebują wgrać dowolną treść, nazwę, typ i fixture XLSX, a następnie odczytać `Location`.

**Contract**:
- Nowe `uploadFile(http, { name, content, type }): Promise<HttpResponse>` (surowa odpowiedź).
- Nowe `readFixture("csv" | "xlsx")`.
- Nowe `reportIdFromLocation(location)` (ten sam regex co dziś).
- Nowe `errorFromLocation(location): { error: string | null; detail: string | null }` (parsowanie przez `URLSearchParams`).
- `uploadSampleReport` zachowuje sygnaturę i działa na nowych helperach. Phase 1 nie zmienia się.

#### 3. Test-sonda mechanizmu

**File**: `tests/integration/upload-compensation.int.test.ts` (nowy; w Fazie 4 rozbudowany o właściwe testy)

**Intent**: Dowieść samego mechanizmu, zanim oprzemy na nim #3.

**Contract**: Jeden `describe` z `beforeAll`: logowanie A przez aplikację (jedyne w pliku), `installFault("visits_insert", marker)`. `afterAll`: `removeFault`. Test „sonda”: wgranie z nazwą `<marker>.csv` → `302 /reports?error=upload_failed`; wgranie z nazwą bez markera → `302 /reports/<id>`. Sprzątanie: usunięcie raportu kontrolnego jako A.

### Success Criteria:

#### Automated Verification:

- Lint i typy: `npm run lint`, `npx astro check`
- `npm run test:integration` zielony lokalnie (jeśli Docker działa), w tym test-sonda
- Job `smoke` w CI zielony na PR z tą zmianą (`gh pr checks`), w tym test-sonda
- Po przebiegu w bazie nie zostaje żaden trigger `it_fault_%`: zapytanie `select tgname from pg_trigger where tgname like 'it_fault_%'` przez `runLocalSql` zwraca 0 wierszy (asercja w `afterAll`)

#### Manual Verification:

- Kontrola czułości sondy: z zakomentowanym `installFault` sonda jest czerwona (wgranie z markerem kończy się sukcesem). Zmianę cofnięto.
- Wybrany wariant uruchamiania SQL (`--local` / `--db-url` / `pg`) jest zapisany w komentarzu helpera

**Implementation Note**: Jeśli żaden z trzech wariantów nie działa w CI, zatrzymaj się i wróć do planu. Fazy 2–3 nie zależą od mechanizmu i mogą iść dalej, Faza 4 nie.

---

## Faza 2: #4 — wynik w bazie zgodny z wyrocznią, per wizyta

### Overview

Po wgraniu `sample-report.csv` i `sample-report.xlsx` baza, odczytana tym samym zapytaniem co strona szczegółów, ma dokładnie oczekiwany multizbiór (wizyta, reguła).

- **Asercja zachowania:** 15 wizyt (`row_count` = 15 = liczba wizyt raportu) oraz multizbiór `visited_client → posortowana lista reguł` równy literałom z tabeli research §#4, łącznie z 5 wizytami o pustej liście. Odstępstwa `phone_instead_of_visit` i `route_deviation` mają niepusty `detail`, a `missing_gps` ma `detail = null`. Strona `/reports/<id>` odpowiada 200. Wszystkie odstępstwa mają `status = 'new'`.
- **Złapana regresja:**
  - flaga trasy przeniesiona na inną wizytę (zmiana kolejności `RETURNING` albo przejście na `upsert`);
  - zgubiona reguła przy zapisie (np. zły warunek `if (deviationsToInsert.length > 0)`);
  - duplikat tej samej reguły (brak `unique`);
  - fałszywy alarm na poprawnej wizycie;
  - różnica ścieżki XLSX vs CSV w zapisie;
  - `row_count` niezgodny z liczbą zapisanych wizyt.
- **Źródło:** research §#4 (wyrocznia, mapowanie, ryzyko kolejności), test-plan §2 #4.
- **Przypadek brzegowy:** wizyty bez odstępstw (asercja „pusto”, nie pominięcie), wizyty z dwiema regułami (Klient F, S, T2–T4), pierwsza wizyta dnia, która nie jest sprawdzana pod kątem dystansu.
- **Unikany anty-wzorzec:** oczekiwane wartości liczone kodem reguł (literały wpisane ręcznie, z komentarzem wskazującym na `deviation-rules.test.ts:55-110` i research); asercja tylko na liczebności per reguła; ponowne testowanie funkcji reguł; `deviation_count` jako dowód kompletności (sprawdzany tylko dodatkowo, = 15).

### Changes Required:

#### 1. Test wyroczni zapisu

**File**: `tests/integration/upload-oracle.int.test.ts` (nowy)

**Intent**: `describe.each` po `csv` i `xlsx`. W każdym wariancie: wgranie przez trasę jako A (jedno logowanie A w pliku, w `beforeAll` na poziomie pliku), odczyt jako A, porównanie z literałem `EXPECTED_RULES_BY_CLIENT`, a w `afterAll` usunięcie raportu jako A.

**Contract**:
- Literał `EXPECTED_RULES_BY_CLIENT: Record<string, string[]>` z 15 kluczami (listy posortowane), przepisany z tabeli research §#4. Nie wolno go generować z kodu reguł ani z fixture'u.
- Odczyt: `clientAs(env, A).from("visits").select("*, deviations(*)").eq("report_id", id)`, czyli dosłownie zapytanie z `src/pages/reports/[id].astro:33`.
- Porównanie `toEqual` na obiekcie zbudowanym z wyniku (`visited_client → deviations.map(d => d.rule).sort()`). Do tego asercja, że liczba wizyt = 15 i każdy `visited_client` występuje raz. `toEqual` na pełnym obiekcie łapie zarówno brak, jak i nadmiar.
- Typ pliku: `text/csv` / `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Nazwa: `oracle-<uuid>.<ext>`.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npx astro check`
- `npm run test:integration` zielony: 2 warianty (CSV, XLSX) w `upload-oracle.int.test.ts`
- Job `smoke` w CI zielony

#### Manual Verification:

- Kontrola czułości 1: tymczasowe `.reverse()` na `insertedVisits` przed `detectRouteDeviations` w `upload.ts` (symulacja innej kolejności `RETURNING`) daje czerwony test z diffem na kliencie Marka lub Tomasza. Cofnięte.
- Kontrola czułości 2: tymczasowe podwojenie `routeDeviations` w `deviationsToInsert` daje czerwony test (duplikat reguły). Cofnięte.

---

## Faza 3: #5 — serwer sam odrzuca to, co odrzuca przeglądarka (+ poprawka 500)

### Overview

Każdy błędny, pusty lub spreparowany plik kończy się `302 → /reports?error=<kod>`, przypadki parsera mają rozróżniający token w `detail`, a odrzucenie nie zostawia w bazie raportu. Dwa spreparowane żądania najpierw dają czerwony test (500), potem trasa dostaje poprawkę.

- **Asercja zachowania:** przy każdym przypadku status 302, `error` z `Location` równy oczekiwanemu kodowi, dla `invalid_file` oczekiwany token w `detail` albo jego brak (tabela niżej) i **0 raportów A z tą nazwą pliku** w bazie (kontrola: w tym samym pliku poprawne wgranie z unikalną nazwą jest widoczne dla A i potem sprzątane).
- **Złapana regresja:**
  - przesunięta granica rozmiaru (`>=` zamiast `>`, MB zamiast MiB);
  - poluzowana lista MIME;
  - parser zgłaszający „pusty plik” zamiast brakujących kolumn (lub odwrotnie);
  - zgubiony numer wiersza;
  - trasa, która zapisuje raport mimo błędu walidacji;
  - powrót 500 dla spreparowanych żądań.
- **Źródło:** research §#5 (tabela przeglądarka/serwer, ścieżki 500, korekta guidance), test-plan §2 #5.
- **Przypadek brzegowy:** dokładnie 5 242 880 B vs 5 242 881 B; pusty MIME przepuszczany do parsera; 0 B; sam nagłówek; ciało JSON; `report_file` jako pole tekstowe.
- **Unikany anty-wzorzec:** testowanie tylko komponentu w przeglądarce; asercja na treści komunikatu (porównywanie całego zdania jest zakazane); akceptacja dowolnego `invalid_file` bez tokenu; asercja tylko na kodzie odpowiedzi bez stanu bazy.

Przypadki (nazwa pliku `invalid-<uuid>.<ext>`, chyba że wskazano inaczej):

| # | Przypadek | Wejście | Oczekiwane `error` | `detail` |
| - | --- | --- | --- | --- |
| 1 | granica rozmiaru — przechodzi | `.csv`, 5 242 880 B, `application/pdf` | `bad_type` (dowód, że rozmiar przeszedł) | brak |
| 2 | granica rozmiaru — +1 B | `.csv`, 5 242 881 B, `text/csv` | `too_large` | brak |
| 3 | zły MIME, dobre rozszerzenie | `.csv` z treścią fixture'u, `application/octet-stream` | `bad_type` | brak |
| 4 | PDF | `.pdf`, `application/pdf` | `bad_type` | brak |
| 5 | złe rozszerzenie, dozwolony MIME | `.txt` z treścią fixture'u, `text/csv` | `invalid_file` | bez tokenu kolumny ani `Wiersz` |
| 6 | brak dwóch wymaganych kolumn | CSV bez `gps_wlaczony` i `odwiedzony_klient` | `invalid_file` | zawiera `gps_wlaczony` i `odwiedzony_klient`, nie zawiera `przedstawiciel` ani `data_wizyty` |
| 7 | pusty plik | `.csv`, 0 B, `text/csv` | `invalid_file` | bez tokenu kolumny ani `Wiersz` |
| 8 | sam nagłówek | `.csv`, tylko wiersz nagłówka, `text/csv` | `invalid_file` | bez tokenu kolumny ani `Wiersz` |
| 9 | uszkodzony XLSX | `.xlsx`, ucięty ZIP (nagłówek `PK\x03\x04` + śmieci), MIME XLSX | `invalid_file` | bez tokenu kolumny ani `Wiersz` |
| 10 | zła data w wierszu 3 | fixture z `data_wizyty` = `04.09.2026` w 3. wierszu danych | `invalid_file` | zawiera `Wiersz 3` i `data_wizyty` |
| 11 | zła wartość GPS w wierszu 2 | fixture z `gps_wlaczony` = `MOŻE` w 2. wierszu danych | `invalid_file` | zawiera `Wiersz 2` i `gps_wlaczony` |
| 12 | brak pliku | multipart bez `report_file` | `no_file` | brak |
| 13 | ciało nie-multipart | `json: { report_file: "x" }` | `no_file` (dziś 500 — najpierw czerwony) | brak |
| 14 | `report_file` jako tekst | `multipart.fields: { report_file: "raport.csv" }` | `no_file` (dziś 500 — najpierw czerwony) | brak |

„Bez tokenu” oznacza, że `detail` jest niepusty i nie zawiera żadnej z 10 nazw nagłówków z `report-parser.ts` ani wzorca `/Wiersz \d+/`. Przypadek 9: jeśli SheetJS zinterpretuje bajty jako CSV i zgłosi brakujące kolumny (research: niepewne), test jest czerwony. To znalezisko, nie powód do poluzowania asercji: zatrzymaj się i zgłoś. Przypadek 7 (0 B): research nie potwierdził, czy pusty `Blob` dociera jako plik (`no_file` vs `invalid_file`). Pierwszy przebieg to rozstrzyga. Jeśli wynikiem jest `no_file`, wpisz go jako oczekiwany z komentarzem (oba kody są czytelną odmową).

### Changes Required:

#### 1. Test walidacji serwera

**File**: `tests/integration/upload-validation.int.test.ts` (nowy)

**Intent**: Tabela przypadków jako `it.each`, jedno logowanie A w pliku, wspólna asercja „kod + token + brak raportu w bazie”. Przypadki 13–14 lądują najpierw jako czerwone (commit testu przed poprawką albo jeden commit, ale z czerwonym przebiegiem odnotowanym w Progress).

**Contract**:
- Treści budowane w teście z fixture'u CSV: usunięcie kolumn z nagłówka i wierszy (6), podmiana jednej komórki (10, 11) oraz wypełnienie do dokładnego rozmiaru bajtami spacji lub komentarza (1, 2). Dla 1–2 liczy się tylko `file.size`, treść nie jest parsowana.
- Stan bazy: `clientAs(env, A).from("reports").select("id").eq("original_filename", name)` → `[]`.
- Kontrola właściciela: jedno poprawne wgranie (`uploadFile` z fixture'em) widoczne dla A pod swoją nazwą, a potem usunięte.

#### 2. Poprawka ścieżek 500

**File**: `src/pages/api/reports/upload.ts`

**Intent**: Spreparowane żądanie bez pliku ma dostać ten sam kod co brak pliku, zamiast wyjątku.

**Contract**:
- `context.request.formData()` w try/catch: wyjątek → `logAppEvent({ event: "report.upload.rejected", code: "no_file", stage: "validate", userId })` → `redirect(reportErrorUrl("no_file"))`.
- Wartość pola sprawdzana przez `instanceof File` zamiast rzutowania `as File | null`: string lub `null` → ta sama gałąź `no_file`.
- Bez nowych kodów błędów, bez zmian komunikatów.
- `fileExtension` zostaje bez zmian (wołane tylko z prawdziwym `File`).

### Success Criteria:

#### Automated Verification:

- Przed poprawką: przypadki 13 i 14 czerwone (status 500), pozostałe zielone. Odnotowane w opisie commitu lub PR.
- Po poprawce: `npm run test:integration` zielony, 14 przypadków w `upload-validation.int.test.ts`
- `npm test` zielony (parser bez zmian)
- `npm run lint`, `npx astro check`
- Job `smoke` w CI zielony

#### Manual Verification:

- Kontrola czułości 1: tymczasowa zmiana `>` na `>=` w `upload.ts:45` daje czerwony przypadek 1. Cofnięte.
- Kontrola czułości 2: tymczasowe usunięcie `missingColumns.join` z komunikatu parsera (`Brak wymaganych kolumn.`) daje czerwony przypadek 6. Cofnięte.
- Przegląd: poprawka nie zmienia żadnego komunikatu ani kodu widocznego dla użytkownika

---

## Faza 4: #3 — wszystko albo nic przy wymuszonych błędach zapisu

### Overview

Na mechanizmie z Fazy 1: błąd insertu wizyt i błąd insertu odstępstw nie zostawiają raportu, błąd licznika zostawia pełny, poprawny raport, a błąd rollbacku zostawia udokumentowanego sierotę i odpowiada `upload_failed`.

- **Asercja zachowania:**
  - (a) `visits_insert`: 302 → `/reports?error=upload_failed`, 0 raportów A o tej nazwie, a więc 0 wizyt i 0 odstępstw (kaskada FK; `report_id not null`). Kontrola: wgranie bez markera w tym samym `describe` jest widoczne dla A.
  - (b) `deviations_insert`: jak (a). Wizyty zostały już zapisane w bazie, więc ten przypadek dowodzi kompensacji **z kaskadą**. Id raportu nie wraca w odpowiedzi, więc dodatkowo, przez `runLocalSql` (rola `postgres`, bez RLS), sprawdzamy, że `count(*)` raportów, wizyt i odstępstw powiązanych z raportami z markerem wynosi 0.
  - (c) `reports_update` (`count_failed`): 302 → `/reports/<id>`, `row_count` = 15, 15 wizyt, multizbiór odstępstw równy wyroczni (ten sam literał co w Fazie 2, wyniesiony do wspólnego modułu), `deviation_count` = `null`.
  - (d) `deviations_insert` + `reports_delete` (`rollback_failed`): 302 → `/reports?error=upload_failed` (nie 500, nie sukces), raport z markerem **istnieje** z 15 wizytami i 0 odstępstw (udokumentowany sierota). Sprzątanie: zdjęcie triggera, potem usunięcie jako A.
- **Złapana regresja:**
  - usunięty lub przestawiony `rollbackReport()` w którejś gałęzi;
  - zmiana kaskady FK;
  - zmiana insertu wizyt na wiele żądań (część zapisana);
  - dodanie wycofania przy `count_failed` (zniszczyłoby kompletne dane);
  - trasa zgłaszająca sukces mimo nieudanego zapisu odstępstw;
  - 500 lub sukces przy nieudanym rollbacku.
- **Źródło:** research §#3 (sekwencja L71-181, kaskada, mechanizm wstrzyknięcia, `rollback_failed`), test-plan §2 #3; decyzja planu: `count_failed` i `rollback_failed` w zakresie.
- **Przypadek brzegowy:** błąd w środku zapisu po zatwierdzeniu wizyt (b); błąd po pełnym zapisie (c); błąd samej kompensacji (d).
- **Unikany anty-wzorzec:** asercja tylko na przekierowaniu; mockowanie bazy (prawdziwy błąd Postgresa); `deviation_count` jako jedyny dowód kompletności (w (c) jest `null`, a kompletność dowodzi multizbiór).

### Changes Required:

#### 1. Testy kompensacji

**File**: `tests/integration/upload-compensation.int.test.ts` (sonda z Fazy 1 zostaje jako przypadek (a) albo obok niego)

**Intent**: Cztery `describe`, każdy z własnym `installFault` / `removeFault` i własnym prefiksem markera. Jedno logowanie A w pliku. Wszystkie wgrania używają fixture'u CSV (XLSX tylko w Fazie 2).

**Contract**: Asercje z listy wyżej. Asercja „nic nie zostało” pyta jako A po nazwie pliku **oraz** przez `runLocalSql` po prefiksie markera, bo pusty wynik pod RLS mógłby też znaczyć brak dostępu. Wariant `runLocalSql` zwracający wynik zapytania dodaj do helpera, jeśli Faza 1 dała tylko wykonanie.

#### 2. Wspólna wyrocznia

**File**: `tests/integration/helpers/oracle.ts` (nowy)

**Intent**: Faza 2 i (c) porównują z tym samym literałem i tą samą funkcją budującą multizbiór z wyniku zapytania strony.

**Contract**: `EXPECTED_RULES_BY_CLIENT` (przeniesiony z Fazy 2) i `rulesByClient(visitsWithDeviations)`. Literał zostaje literałem.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` zielony: 4 przypadki w `upload-compensation.int.test.ts` + Faza 2 nadal zielona po przeniesieniu wyroczni
- Po przebiegu 0 triggerów `it_fault_%` i 0 raportów z prefiksem `it-fault-` (asercja w `afterAll`)
- `npm run lint`, `npx astro check`
- Job `smoke` w CI zielony

#### Manual Verification:

- Kontrola czułości 1: tymczasowo zakomentowane `await rollbackReport()` w gałęzi `deviationsError` (`upload.ts:166`) daje czerwony przypadek (b) (raport z wizytami zostaje). Cofnięte.
- Kontrola czułości 2: tymczasowe `await rollbackReport()` dodane w gałęzi `countError` daje czerwony przypadek (c). Cofnięte.

---

## Faza 5: Cookbook §6 i backport do test-planu

### Overview

Zapisać w `context/foundation/test-plan.md` wzorce, które ta faza faktycznie wdrożyła, i korekty z research. Aktualizować tylko o to, co weszło do kodu.

### Changes Required:

#### 1. Cookbook

**File**: `context/foundation/test-plan.md` §6

**Intent**: Następna osoba dodająca test zapisu albo reguły ma gotowy wzorzec.

**Contract**:
- §6.2: nowa podsekcja „Wymuszony błąd zapisu w bazie”: `helpers/db-fault.ts`, wybrany wariant uruchamiania SQL, marker `it-fault-<kind>-<uuid>`, `security definer`, idempotentne zakładanie i zdejmowanie, asercja „nic nie zostało” jako właściciel + jako `postgres`, kolejność sprzątania przy triggerze na DELETE. Reference test: `upload-compensation.int.test.ts`.
- §6.3: „Endpoint z walidacją wejścia”: tabela przypadków `it.each`, kod z `Location` + token w `detail` + 0 wierszy w bazie, granica rozmiaru przez kod następnej kontroli. Reference: `upload-validation.int.test.ts`.
- §6.4: „Persisted result” zamiast „TBD”. Nowa lub zmieniona reguła → zaktualizuj `EXPECTED_RULES_BY_CLIENT` w `helpers/oracle.ts` ręcznie, równolegle z wyrocznią jednostkową (literały, nie wynik kodu). Asercja per wizyta.
- §6.5: notatka Phase 2 (2–3 linie): wynik spike'a, wyniki kontroli czułości, poprawka 500, znana luka tokenów.

#### 2. Backport korekt z research

**File**: `context/foundation/test-plan.md` §2, §3, §4, §8

**Intent**: Strategia ma odpowiadać temu, co ustalił research i co zostało zrobione.

**Contract**:
- §2 Risk Response Guidance: doprecyzowania z research „Correction candidates” 1–3, o ile nie są już wpisane (część jest: sprawdź przed edycją). W kolumnie „Must challenge” #5 zaznacz, że ścieżki 500 są naprawione.
- §3: status Phase 2 → `complete` dopiero po zielonym CI. Do tego czasu `implementing`.
- §4: wiersz integration z datą `checked: <data>` i informacją o mechanizmie SQL (jeśli `pg` → nowa dev-zależność).
- §8: „Stack versions last verified”.
- §7: w razie potrzeby dopisać „kolejność `RETURNING` przypięta, nie gwarantowana” i `max_rows` jako kandydata na ryzyko.

### Success Criteria:

#### Automated Verification:

- `npx prettier --check context/foundation/test-plan.md` zielony
- `grep -n "TBD — see §3 Phase 2" context/foundation/test-plan.md` nic nie zwraca

#### Manual Verification:

- §6 opisuje tylko wzorce, które istnieją w `tests/integration/` (każda ścieżka pliku w §6 istnieje)
- Notatka §6.5 Phase 2 zawiera wyniki kontroli czułości z Faz 1–4

---

## Testing Strategy

### Unit Tests:

- Bez nowych. `npm test` ma pozostać zielony (parser i reguły bez zmian).

### Integration Tests:

- `upload-oracle.int.test.ts`: #4, CSV i XLSX, multizbiór per `visited_client`.
- `upload-validation.int.test.ts`: #5, 14 przypadków.
- `upload-compensation.int.test.ts`: #3, 4 wstrzyknięte błędy (+ sonda).
- Budżet logowań: +3 logowania A przez aplikację na przebieg (jedno na plik). Razem ok. 13 z 30 na 5 min.

### Manual Testing Steps:

1. Kontrole czułości z Faz 1–4 (każda cofnięta przed commitem; bez Dockera na tymczasowym PR zamykanym bez scalania).
2. Po Fazie 3: ręczne `curl -i -X POST -H "Origin: …" -H "Content-Type: application/json" --data '{}'` na zalogowanej sesji daje 302 `no_file`.

## Performance Considerations

Każdy przebieg dodaje kilka wgrań 15-wierszowych i dwa pliki po ok. 5 MiB wysyłane tylko do kontroli rozmiaru i typu. Pomijalne wobec timeoutu 30 s. Wywołanie CLI na każdą operację triggera to kilka sekund w `beforeAll`/`afterAll` (`hookTimeout` 60 s).

## Migration Notes

Brak migracji. Triggery testowe istnieją tylko w czasie przebiegu, na lokalnej bazie, i nie trafiają do `supabase/migrations/`.

## References

- Research: `context/changes/testing-report-save-integrity/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (#3–#5), §3 Phase 2, §6
- Trasa: `src/pages/api/reports/upload.ts:24-182`
- Wyrocznia jednostkowa: `src/lib/services/deviation-rules.test.ts:55-110`
- Parser: `src/lib/services/report-parser.ts:68-171`
- Harness Phase 1: `tests/integration/helpers/{http,db,seed,env}.ts`, `tests/integration/global-setup.ts`
- Wzorzec czerwonego testu przed poprawką: `context/archive/2026-10-08-testing-data-isolation-access/` (endpoint przeglądu)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Spike — wstrzyknięcie błędu w bazie (lokalnie i w CI)

#### Automated

- [x] 1.1 Lint i typy: `npm run lint`, `npx astro check` — de98ffe
- [x] 1.2 `npm run test:integration` zielony lokalnie (jeśli Docker działa), w tym test-sonda — de98ffe
- [x] 1.3 Job `smoke` w CI zielony na PR z tą zmianą (`gh pr checks`), w tym test-sonda — de98ffe
- [x] 1.4 Po przebiegu w bazie nie zostaje żaden trigger `it_fault_%` — de98ffe

#### Manual

- [x] 1.5 Kontrola czułości sondy: z zakomentowanym `installFault` sonda jest czerwona — de98ffe
- [x] 1.6 Wybrany wariant uruchamiania SQL (`--local` / `--db-url` / `pg`) jest zapisany w komentarzu helpera — de98ffe

### Phase 2: #4 — wynik w bazie zgodny z wyrocznią, per wizyta

#### Automated

- [x] 2.1 `npm run lint`, `npx astro check`
- [x] 2.2 `npm run test:integration` zielony: 2 warianty (CSV, XLSX) w `upload-oracle.int.test.ts`
- [ ] 2.3 Job `smoke` w CI zielony

#### Manual

- [x] 2.4 Kontrola czułości 1: `.reverse()` na `insertedVisits` daje czerwony test
- [x] 2.5 Kontrola czułości 2: podwojenie `routeDeviations` daje czerwony test

### Phase 3: #5 — serwer sam odrzuca to, co odrzuca przeglądarka (+ poprawka 500)

#### Automated

- [ ] 3.1 Przed poprawką: przypadki 13 i 14 czerwone (status 500), pozostałe zielone
- [ ] 3.2 Po poprawce: `npm run test:integration` zielony, 14 przypadków w `upload-validation.int.test.ts`
- [ ] 3.3 `npm test` zielony (parser bez zmian)
- [ ] 3.4 `npm run lint`, `npx astro check`
- [ ] 3.5 Job `smoke` w CI zielony

#### Manual

- [ ] 3.6 Kontrola czułości 1: `>=` zamiast `>` daje czerwony przypadek 1
- [ ] 3.7 Kontrola czułości 2: komunikat bez nazw kolumn daje czerwony przypadek 6
- [ ] 3.8 Przegląd: poprawka nie zmienia żadnego komunikatu ani kodu widocznego dla użytkownika

### Phase 4: #3 — wszystko albo nic przy wymuszonych błędach zapisu

#### Automated

- [ ] 4.1 `npm run test:integration` zielony: 4 przypadki w `upload-compensation.int.test.ts` + Faza 2 nadal zielona
- [ ] 4.2 Po przebiegu 0 triggerów `it_fault_%` i 0 raportów z prefiksem `it-fault-`
- [ ] 4.3 `npm run lint`, `npx astro check`
- [ ] 4.4 Job `smoke` w CI zielony

#### Manual

- [ ] 4.5 Kontrola czułości 1: bez `rollbackReport()` w gałęzi `deviationsError` przypadek (b) jest czerwony
- [ ] 4.6 Kontrola czułości 2: `rollbackReport()` w gałęzi `countError` daje czerwony przypadek (c)

### Phase 5: Cookbook §6 i backport do test-planu

#### Automated

- [ ] 5.1 `npx prettier --check context/foundation/test-plan.md` zielony
- [ ] 5.2 `grep -n "TBD — see §3 Phase 2" context/foundation/test-plan.md` nic nie zwraca

#### Manual

- [ ] 5.3 §6 opisuje tylko wzorce, które istnieją w `tests/integration/`
- [ ] 5.4 Notatka §6.5 Phase 2 zawiera wyniki kontroli czułości z Faz 1–4
