---
date: 2026-10-09T09:30:00+02:00
researcher: Claude (Opus 5.5) dla aciszewski
git_commit: 9e05298a6284bf964ecc9ae880558ae0dbe77b2a
branch: dev
repository: 10x-astro-project
topic: "Ugruntowanie rollout Phase 2 test-plan.md — kompletny i poprawny zapis wgranego raportu (ryzyka #3, #4, #5)"
tags: [research, testing, integration, upload, report-parser, deviation-rules, supabase]
status: complete
last_updated: 2026-10-09
last_updated_by: Claude (Opus 5.5)
---

# Research: Phase 2 — kompletny i poprawny zapis wgranego raportu

**Date**: 2026-10-09T09:30:00+02:00
**Researcher**: Claude (Opus 5.5) dla aciszewski
**Git Commit**: 9e05298 (drzewo robocze z niezacommitowanymi zmianami w `context/foundation/*` i `.claude/` — kod aplikacji bez zmian)
**Branch**: dev
**Repository**: 10x-astro-project

## Research Question

Ugruntować rollout Phase 2 z `context/foundation/test-plan.md` dla ryzyk #3, #4, #5: dla każdego znaleźć rzeczywistą ścieżkę awarii w kodzie, zweryfikować (nie przyjmować na wiarę) Risk Response Guidance z §2, znaleźć istniejące testy, wskazać najtańszą użyteczną warstwę testu i oznaczyć ryzyka spekulatywne albo mylące dowody z hot-spotów. Warstwa planowana: integracja (lokalny Supabase, harness `tests/integration/` z Phase 1).

## Summary

- **#3 (zapis częściowy) — ryzyko realne, guidance trafne, potrzebny mechanizm wstrzyknięcia błędu.** Trasa `src/pages/api/reports/upload.ts` zapisuje trzy tabele bez transakcji: `reports` (L71-79) → `visits` (L113) → `deviations` (L154), z kompensującym `delete` raportu po błędzie wizyt (L125) lub odstępstw (L166); kaskada FK usuwa wizyty i odstępstwa. Żadna poprawna z punktu widzenia parsera treść pliku nie wywoła błędu insertu `deviations` (schemat nie ma ograniczeń, które dane z parsera mogłyby złamać), więc test musi wstrzyknąć błąd w bazie. Najtańszy mechanizm bez mockowania: tymczasowy trigger `BEFORE INSERT` zakładany przez test poleceniem `npx supabase db query --local` (CLI 2.117 w `node_modules` ma tę komendę), zawężony do unikalnego markera w danych testu. **Niezweryfikowane na żywo** (Docker był wyłączony w czasie researchu) — patrz Open Questions.
- **#4 (wynik niezgodny z regułami) — ryzyko realne i szersze, niż zakładał plan.** Wyrocznia fixture'ów istnieje (`deviation-rules.test.ts:55-110`, ręcznie wpisane indeksy wierszy, CSV i XLSX), ale testy jednostkowe karmią reguły wierszami parsera w kolejności pliku z syntetycznymi id (`deviation-rules.test.ts:42`). W produkcji `detectRouteDeviations` dostaje wynik `insert().select()` z bazy (`upload.ts:113,145`) i ufa kolejności tablicy (`deviation-rules.ts:79-81`) — zamiana kolejności zwróconych wizyt Marka (wiersze 5/6) albo Tomasza (7/8) przeniosłaby flagę trasy na inny wiersz. Tego test jednostkowy z definicji nie złapie; integracja z asercją per `visited_client` złapie. Oczekiwany wynik obu fixture'ów: 15 wizyt, 15 odstępstw (7 `missing_gps`, 5 `phone_instead_of_visit`, 3 `route_deviation`).
- **#5 (błędny plik / serwer ufa klientowi) — ryzyko realne; guidance wymaga korekty w jednym punkcie i ujawniło dwa błędy.** Serwer sam egzekwuje rozmiar (`too_large`), typ (`bad_type` / `invalid_file`) i brak kolumn (`invalid_file`) — przeglądarka nie jest jedyną bramką. Ale: (a) kod `invalid_file` jest wspólny dla 10 różnych gałęzi parsera, a rozróżnia je tylko polski tekst w `?detail=` — „asercja na kodzie, nie na treści” nie wystarczy, by odróżnić „brak kolumn” od „pusty plik”; (b) dwa spreparowane żądania kończą się prawdopodobnie 500 zamiast kodu: ciało nie-multipart (`formData()` bez try/catch, `upload.ts:36`) i `report_file` jako niepusty tekst zamiast pliku (`fileExtension(undefined)`, `app-events.ts:104-105`).
- **Najtańsza warstwa** dla wszystkich trzech: integracja HTTP przez istniejący `HttpClient` + `clientAs` do odczytu bazy. E2E zbędne — kontrola w przeglądarce nie jest tu przedmiotem dowodu.

## Detailed Findings

### #3 — Kolejność zapisów i kompensacja

- Sekwencja w `src/pages/api/reports/upload.ts` (ścieżka po pomyślnym parsowaniu):
  1. `reports.insert(...).select().single()` (L71-79); błąd → `upload_failed`, nic nie zostało zapisane (L81-90).
  2. `visits.insert(visitsToInsert).select()` (L113) — jedno żądanie PostgREST dla wszystkich wierszy, czyli jedna instrukcja SQL: albo wszystkie wizyty, albo żadna. Błąd → `rollbackReport()` (L125) → `upload_failed`.
  3. Reguły liczone w pamięci na `insertedVisits` (L129-151).
  4. `deviations.insert(deviationsToInsert)` (L154), tylko gdy lista niepusta (L153). Błąd → `rollbackReport()` (L166) → `upload_failed`.
  5. `reports.update({ deviation_count })` (L173-176) — błąd tylko logowany (`report.upload.count_failed`, L177-179), **bez** wycofania; sukces zostaje sukcesem z `deviation_count = null`. To świadoma decyzja (komentarz L171-172), nie luka — test nie powinien tego traktować jako częściowego zapisu, ale nie może też używać `deviation_count` jako jedynego dowodu kompletności.
- `rollbackReport` (L96-106) usuwa raport klientem użytkownika (RLS `delete` na `reports`); własny błąd tylko loguje (`report.upload.rollback_failed`) i zostawia osierocony raport — trasa i tak zwraca `upload_failed`.
- Kaskada: `visits.report_id ... references reports (id) on delete cascade` (`supabase/migrations/20260925120000_create_report_schema.sql:34`), `deviations.visit_id ... references visits (id) on delete cascade` (tamże L48). Ponieważ `report_id` jest `not null` z FK, „osierocone wizyty” bez raportu są strukturalnie niemożliwe; realny stan częściowy to **raport bez wizyt** albo **raport z wizytami bez odstępstw** — dokładnie te, które kompensacja ma usuwać.
- **Wymuszenie błędu.** Sprawdzone ograniczenia schematu (`20260925120000_create_report_schema.sql:23-53`, `20260929120000_add_route_deviation_columns.sql`): brak `check`, brak `unique` poza PK; typy `timestamptz`/`numeric`/`boolean`/`text`. Parser przepuszcza tylko ścisłe `RRRR-MM-DD` (`report-parser.ts:53-58,163-167`), liczby przez `Number.isFinite` (L60-63), GPS tylko TAK/NIE/1/0 (L45-50). Wniosek dla inspected path: dane poprawne dla parsera nie łamią schematu `deviations`; insert odstępstw da się złamać tylko z zewnątrz. Możliwa „naturalna” awaria `visits`: znak NUL (`\u0000`) w polu tekstowym — `cellToText` robi tylko `trim()` (L40-42), a Postgres odrzuca NUL w `text`; **niezweryfikowane**, czy SheetJS zachowuje NUL przy CSV.
- Proponowany mechanizm (do potwierdzenia w planie/implementacji): test w `beforeAll` wykonuje `npx supabase db query --local "<SQL>"` tworzący funkcję + trigger `BEFORE INSERT ON visits` / `ON deviations`, który `raise exception` tylko gdy wiersz należy do raportu o `original_filename` z unikalnym prefiksem testu (dla `deviations` przez lookup `visits → reports`); `afterAll` robi `drop trigger`. Plusy: prawdziwy błąd PostgREST → prawdziwa gałąź `visitsError`/`deviationsError` → prawdziwa kaskada; inne pliki testowe (uruchamiane sekwencyjnie, `vitest.integration.config.ts:17`) nie są dotknięte dzięki markerowi. `supabase db query` ma flagi `--local`, `--db-url`, `-f` (sprawdzone `npx supabase db query --help`, CLI v2.117.0). CI instaluje CLI `latest` przez `supabase/setup-cli@v3` (`.github/workflows/ci.yml:36-38`) i wyłącza m.in. `postgres-meta` (L48) — nie wiadomo, czy `db query --local` z tego korzysta.
- Dowód „sukces = komplet”: po 302 → `/reports/<id>` odczyt jako właściciel (`clientAs`) — `reports.row_count`, liczba `visits` dla `report_id` = liczba wierszy pliku (15), liczba i zbiór `deviations` = wyrocznia (#4). Dowód „błąd = nic”: 302 → `/reports?error=upload_failed`, a jako właściciel brak raportu z unikalnym `original_filename` (i kontrola: ten sam klient widzi raport z udanego wgrania — wzorzec z §6.2 „denial + owner control”).
- Gałąź `rollback_failed` (trigger `BEFORE DELETE ON reports`) jest technicznie do wstrzyknięcia tym samym sposobem, ale jej oczekiwany wynik to udokumentowany osierocony raport; dowód ograniczałby się do „trasa i tak zwraca `upload_failed`”. Niski stosunek sygnału do kosztu — do decyzji w planie.

### #4 — Wyrocznia, zapis i odczyt odstępstw

- **Wyrocznia** (`src/lib/services/deviation-rules.test.ts:55-110`, `describe.each` po `sample-report.csv` i `sample-report.xlsx`; 0-indeksowane, bez nagłówka):
  - `missing_gps`: {1, 3, 8, 10, 11, 12, 14} — L58 (`[1, 3, 8]` dla wierszy < 9), L92, L99, L104-108, L81-84.
  - `route_deviation`: dokładnie {4, 6, 8} — L63; detal wiersza 4 zawiera „poza zaplanowaną trasą”, wierszy 6 i 8 „nadmiarowy dystans” (L68-70).
  - `phone_instead_of_visit`: {3, 9} jawny „telefon” (L87-91), {10, 11, 12} heurystyka „brak GPS” (L95-100); wiersze 13 i 14 — null (L103-108). Luka wyroczni: dla wierszy 0-2 i 4-8 brak asercji, że **nie** mają `phone_instead_of_visit`.
  - Wartości oczekiwane są literałami wpisanymi ręcznie (nie liczone kodem reguł); pochodzą z dawnego `scripts/verify-report-detection.mjs` (komentarz L52) i z treści fixture'ów, np. wiersz 4: Ewa odwiedza „Klient Z” przy planie „Klient X;Klient Y” (`test-data/sample-report.csv:6`).
  - Liczba wierszy: 15 (`report-parser.test.ts:34-35`). CSV i XLSX zawierają te same dane (zrzut `sheet_to_csv` z XLSX = CSV linia w linię — sprawdził sub-agent; oba pliki w tym samym `describe.each`).
- **Mapowanie wiersz → `visited_client`** (`test-data/sample-report.csv:2-16`; klient jest unikalny w obu fixture'ach, więc jest kluczem do asercji per wiersz w bazie — `visits` nie ma kolumny numeru wiersza):

  | wiersz | `visited_client` | oczekiwane reguły |
  | --- | --- | --- |
  | 0 | Klient A | — |
  | 1 | Klient C | missing_gps |
  | 2 | Klient D | — |
  | 3 | Klient F | missing_gps, phone_instead_of_visit |
  | 4 | Klient Z | route_deviation |
  | 5 | Klient P | — |
  | 6 | Klient Q | route_deviation |
  | 7 | Klient R | — |
  | 8 | Klient S | missing_gps, route_deviation |
  | 9 | Klient T1 | phone_instead_of_visit |
  | 10 | Klient T2 | missing_gps, phone_instead_of_visit |
  | 11 | Klient T3 | missing_gps, phone_instead_of_visit |
  | 12 | Klient T4 | missing_gps, phone_instead_of_visit |
  | 13 | Klient T5 | — |
  | 14 | Klient T6 | missing_gps |

  Suma: 15 wizyt, 15 odstępstw, wiersze bez odstępstw: {0, 2, 5, 7, 13}. Tabela jest złożeniem literałów wyroczni z treścią fixture'u — **nie** wynikiem uruchomienia reguł.
- **Zgodność z PRD** (`context/foundation/prd.md`): FR-004 (L122-123) „gdy GPS nie był włączony podczas wizyty”, FR-009 (L127-130) klient spoza trasy LUB dystans/czas ponad próg z najkrótszej trasy, FR-010 (L135-137) jawny „telefon” albo brak GPS + brak/bardzo krótki czas; US-01 Acceptance Criteria (`prd.md:72-77`): brak fałszywych alarmów, jedna wizyta może złamać kilka reguł. Wyrocznia jest zgodna z intencją PRD. Konkretne progi (1.5× haversine, `<= 0` min, grupowanie tylko „wizyta”, sprawdzanie tylko dystansu, nie czasu) pochodzą z archiwalnych planów (`context/archive/2026-09-29-route-deviation-detection/plan.md:34,176`), nie z PRD — to nie rozbieżność do naprawy w tej fazie, ale plan nie powinien opisywać ich jako „wymagań PRD”.
- **Zapis**: `upload.ts:132-149` — `missing_gps` bez `detail` (L134), `phone_instead_of_visit` i `route_deviation` z `detail`. Tabela `deviations` nie ma `unique (visit_id, rule)` (`20260925120000_create_report_schema.sql:46-61`), więc podwójny wpis tej samej reguły nie zostałby odrzucony przez bazę — asercja musi porównywać pełny multizbiór (wizyta, reguła), nie tylko „zawiera”.
- **Odczyt strony szczegółów**: `src/pages/reports/[id].astro:33` — `supabase.from("visits").select("*, deviations(*)").eq("report_id", id)`, bez `order`, `limit`, `range`. `supabase/config.toml:18` `max_rows = 1000` obcina większe wyniki po cichu — nieistotne dla 15 wierszy, ale to realny limit dla dużych raportów (zob. Open Questions). Najtańszy test odczytu: to samo zapytanie przez `clientAs(env, A)`; render HTML strony to wyspa React z grupami domyślnie zwiniętymi (CLAUDE.md, kontrakt Szczegółów raportu), więc parsowanie HTML byłoby kruche i nic nie dodaje ponad to zapytanie + status 200 strony.
- **Ryzyko kolejności (nowe, istotne)**: `detectRouteDeviations` grupuje i porównuje kolejne wizyty w kolejności tablicy, „never sorts” (`deviation-rules.ts:79-81`), pierwsza wizyta dnia nie jest sprawdzana pod kątem dystansu (L100), a próg to `lineKm * 1.5` (L116-117). Wejściem w produkcji jest `insertedVisits` z `insert().select()` (`upload.ts:113,145`). Dla Marka (wiersze 5 i 6, `sample-report.csv:7-8`): haversine P→Q ≈ 2.56 km, próg ≈ 3.84 km; przy kolejności 5→6 flagowany jest wiersz 6 (15 km); przy 6→5 flagowany byłby wiersz 5 (5 km > 3.84). Postgres/PostgREST nie gwarantują formalnie kolejności `RETURNING` (wiedza ogólna, nie sprawdzona w repo). Test jednostkowy nie może tego złapać (wejście z parsera, `deviation-rules.test.ts:42`); integracja z asercją per `visited_client` tak.
- **Round-trip typów**: `visit_date` wraca jako `timestamptz` (np. `2026-09-04T00:00:00+00:00`), `numeric` jako liczby JSON, `planned_route_raw` jako tablica jsonb — klucz grupowania pozostaje spójny w obrębie jednego wgrania (ustalenie sub-agenta, `deviation-rules.ts:89`, `report-parser.ts:204-208`).

### #5 — Walidacja w przeglądarce vs na serwerze

- **Przeglądarka** (`src/components/reports/ReportUpload.tsx`): rozszerzenie `.csv`/`.xlsx` (L12, L56-58), rozmiar `> 5*1024*1024` (L11, L60-61), wstępna kontrola wymaganych kolumn (L208-216 przez `checkRequiredColumns`, `src/lib/services/report-columns.ts:41-51`); `accept` na inpucie tylko filtruje okno wyboru (L278). Brak kontroli MIME, pustego pliku, samego nagłówka i wartości wierszy. Gdy nagłówków nie da się odczytać (`readHeaders` → null, L71-88), żądanie i tak idzie (L209-210). Komentarz L9-10: serwer jest autorytetem.
- **Serwer** (`upload.ts`): sesja (middleware → 302 `/auth/signin`), `no_file` (L37-40), `too_large` dla `file.size > 5 MiB` (L10, L45-48 — granica identyczna z przeglądarką: 5 242 880 B przechodzi, +1 B nie), `bad_type` gdy `file.type` niepusty i spoza listy (L15-20, L50-53; pusty typ przepuszczany), parser → `invalid_file` z `detail` (L55-66). Każdy wynik to 302 z `Location: /reports?error=<code>[&detail=…]` (`report-errors.ts:31-35`).
- **Każda kontrola przeglądarki ma odpowiednik na serwerze**, ale nie zawsze z tym samym kodem:

  | przypadek | przeglądarka | serwer (kod) |
  | --- | --- | --- |
  | brak wymaganych kolumn | karta `missing_columns`, nie wysyła | `invalid_file`, detail „Brak wymaganych kolumn: …” (`report-parser.ts:119-133`) |
  | `.txt` jako `text/csv` | `bad_format`, nie wysyła | `invalid_file` (rozszerzenie, `report-parser.ts:77-78`), **nie** `bad_type` |
  | `.pdf` jako `application/pdf` | `bad_format` | `bad_type` |
  | `.csv` jako `application/octet-stream` | przechodzi | `bad_type` |
  | > 5 MiB | `too_large`, nie wysyła | `too_large` (rozmiar sprawdzany przed typem — 6 MB `.txt` dostaje `too_large`, w przeglądarce `bad_format`) |
  | pusty plik (0 B), sam nagłówek, same puste wiersze | wysyła | `invalid_file`, „Plik nie zawiera żadnych wierszy z danymi.” (`report-parser.ts:86-87,100-101,136-138`) |
  | uszkodzony XLSX | wysyła | `invalid_file` (try/catch, `report-parser.ts:71-82`) |
  | zła data / GPS / pusty przedstawiciel w wierszu N | wysyła | `invalid_file`, detail „Wiersz N: …” (`report-parser.ts:155-171`) |

- **Korekta guidance „asercja na kodzie, nie na treści”**: `ParsedReport = { rows } | { error: string }` (`report-parser.ts:25`) — brak strukturalnego rodzaju błędu. Kod `invalid_file` pokrywa 10 gałęzi parsera (lista: sub-agent, zweryfikowane L77-138 i L155-171). Sama asercja `error=invalid_file` nie odróżni „brak kolumn” od „pusty plik” — test, który zaakceptuje dowolny `invalid_file` dla pliku bez kolumn, przejdzie także, gdy parser zacznie błędnie zgłaszać „pusty plik”. Dwie opcje do decyzji w planie: (a) asercja na kodzie + na tokenach nieprozatorskich w `detail` (nazwy brakujących kolumn — słownictwo pliku użytkownika, dozwolone wg lessons.md; numer wiersza „Wiersz N”), bez porównywania całego zdania; (b) zmiana produktu: strukturalny `kind` błędu parsera przekazywany np. jako dodatkowy parametr — poza zakresem fazy testowej, wymagałaby zgody (komunikaty Claude Design muszą zostać słowo w słowo).
- **Dwie ścieżki 500 (prawdopodobne błędy, nie zweryfikowane uruchomieniem)**:
  1. Ciało nie-multipart, np. `Content-Type: application/json` — przechodzi `checkOrigin` Astro (nie jest typem formularza; `node_modules/astro/dist/core/app/origin-check.js`), a `context.request.formData()` (`upload.ts:36`) nie jest w try/catch → wyjątek → 500.
  2. `report_file` jako niepusty **tekst** zamiast pliku — `as File | null` (L36) to tylko rzutowanie typu; `file.name` jest `undefined`, `fileExtension(undefined)` woła `.lastIndexOf` na `undefined` (`app-events.ts:104-105`) → TypeError → 500.
  Przeglądarka nigdy nie wyśle żadnego z nich (XHR z `FormData` i polem pliku, `ReportUpload.tsx:218-223`), więc dotyczy to wyłącznie spreparowanych żądań — ale to dokładnie przypadek „serwer ufa klientowi”. Po 500 przeglądarka pokazałaby `upload_failed` (`ReportUpload.tsx:233-259`), więc dla realnego użytkownika skutek jest kosmetyczny. Test przypnie to na czerwono; naprawa (try/catch + `instanceof File`) to zmiana kodu produkcyjnego — do decyzji w planie, zgodnie z CLAUDE.md („czerwony test to sygnał”).
- **Niepewne**: pusty plik z natywnego formularza (`filename=""`, zwykle `application/octet-stream`) najpewniej daje `bad_type`, nie `no_file` (obiekt File jest prawdziwy); zachowanie SheetJS dla `.csv` z bajtami ZIP i `.xlsx` z tekstem CSV; czy wiersz `,,,` liczy się jako pusty przy `blankrows: false`.
- **Istniejące testy**: `report-parser.test.ts:73-238` pokrywa gałęzie parsera na poziomie jednostkowym (rozszerzenie, uszkodzony XLSX, pusty CSV, sam nagłówek, brak każdej z 4 kolumn, walidacja wierszy). Żaden test nie sprawdza kodów błędów trasy przez HTTP (`grep invalid_file|too_large|bad_type|no_file` w `tests/`, `scripts/` — brak trafień); `uploadSampleReport` (`tests/integration/helpers/seed.ts:14-28`) to tylko ścieżka sukcesu. Brak testu jednostkowego `report-columns.ts`.

### Harness Phase 1 — co da się użyć

- `HttpClient` (`tests/integration/helpers/http.ts:27-96`): `Origin`, słoik ciasteczek, bez podążania za przekierowaniem, `multipart.file` z dowolnym `type` i treścią (`Uint8Array | string`) — wystarcza do wszystkich przypadków #5 poza ciałem JSON (opcja `json` też jest, L58-61) i polem tekstowym `report_file` (opcja `multipart.fields`, L54).
- `clientAs` / `anonClient` (`helpers/db.ts:11-20`) do odczytu bazy jako właściciel; `account("a")` itd. z `globalSetup` (`global-setup.ts:45-69`).
- `uploadSampleReport` (`helpers/seed.ts:14-28`) — wgrywa tylko CSV z losową nazwą; Phase 2 potrzebuje wariantu XLSX i własnej treści/nazwy (marker dla triggera).
- Limity: pliki testowe sekwencyjnie (`vitest.integration.config.ts:17`), timeout 30 s; najwyżej jedno logowanie w aplikacji na konto na plik (limit auth 30/5 min, `global-setup.ts:10-11`).

## Code References

- `src/pages/api/reports/upload.ts:36-66` — walidacja i parsowanie, kody `no_file`/`too_large`/`bad_type`/`invalid_file`
- `src/pages/api/reports/upload.ts:71-181` — zapis trzech tabel, `rollbackReport`, kompensacje L125 i L166, `count_failed` L177
- `src/lib/report-errors.ts:7-35` — kody i `reportErrorUrl`
- `src/lib/services/report-parser.ts:25,68-171` — typ wyniku i wszystkie gałęzie błędów
- `src/lib/services/deviation-rules.ts:75-125` — `detectRouteDeviations`, zależność od kolejności
- `src/lib/services/deviation-rules.test.ts:40-110` — wyrocznia fixture'ów
- `src/lib/app-events.ts:104-109` — `fileExtension` (ścieżka 500 przy `report_file` tekstowym)
- `src/components/reports/ReportUpload.tsx:9-12,56-88,208-259` — kontrole w przeglądarce i obsługa przekierowania
- `src/pages/reports/[id].astro:33` — zapytanie strony szczegółów
- `supabase/migrations/20260925120000_create_report_schema.sql:23-61` — schemat, kaskady, brak `unique (visit_id, rule)`
- `tests/integration/helpers/{http,db,seed}.ts`, `tests/integration/global-setup.ts` — harness Phase 1
- `test-data/sample-report.csv:1-16` — fixture (15 wierszy)

## Architecture Insights

- Kompensacja zamiast transakcji to udokumentowany wybór (CLAUDE.md, pipeline krok 2); test ma dowieść, że kompensacja działa na prawdziwej bazie, a nie zastąpić ją transakcją.
- Reguły są czyste, ale ich wejście w produkcji nie jest wyjściem parsera, tylko wierszami z bazy — granica „parser → reguły” jest testowana jednostkowo, granica „baza → reguły → baza → zapytanie strony” nie była testowana nigdzie.
- Kontrakt błędów to kod w `?error=` (strona renderuje tylko zmapowany komunikat), ale rozróżnienie błędów parsera żyje wyłącznie w wolnym tekście `?detail=` czytanym przez `ReportUpload`.

## Historical Context (from prior changes)

- `context/archive/2026-10-08-upload-error-visibility/` — wprowadziło kompensacyjne usuwanie i logowanie `logAppEvent` (źródło w §2 test-plan dla #3; zgodne z kodem L96-106, L125, L166).
- `context/archive/2026-09-28-missing-gps-deviation-detection/` — zapis do trzech tabel bez transakcji (źródło #3; nadal aktualne).
- `context/archive/2026-09-29-route-deviation-detection/plan.md:34,176` — haversine bez API routingu, próg 1.5×.
- `context/archive/2026-10-08-vitest-mutation-baseline/` — „chronione tylko same funkcje” (źródło #4; potwierdzone: wyrocznia woła funkcje bezpośrednio, `deviation-rules.test.ts:40-50`).
- `context/archive/2026-10-07-reports-list-ui-contract/` — kontrola kolumn w przeglądarce (źródło #5; potwierdzone, `ReportUpload.tsx:208-216`).
- Phase 1 (`testing-data-isolation-access`, zarchiwizowane w 9e05298) — harness i wzorce §6.2/§6.3.

## Related Research

- `context/archive/2026-10-08-testing-data-isolation-access/research.md` — harness integracyjny Phase 1 (nie czytany ponownie; wzorce wzięte z kodu `tests/integration/`).

## Correction candidates for test-plan §2 (post-research backport)

1. **#5 Risk Response Guidance** — „asercja na kodzie, nie na treści” jest niewystarczająca: `invalid_file` pokrywa 10 gałęzi parsera; dopisać „kod + rozróżniający token w `detail` (nazwy kolumn / numer wiersza), nie pełne zdanie”. Dodatkowo: spreparowane żądania (nie-multipart, `report_file` jako tekst) dają 500 zamiast kodu.
2. **#4 Risk Response Guidance** — dopisać do „must challenge”: kolejność wizyt zwracana przez bazę po zapisie wpływa na regułę trasy (`deviation-rules.ts:79-81` + `upload.ts:113,145`); asercja musi być per wizyta (`visited_client`), nie tylko liczebność per reguła.
3. **#3 Required context** — doprecyzować: błąd zapisu odstępstw nie jest osiągalny danymi pliku; wymaga wstrzyknięcia w bazie (trigger przez `supabase db query --local`); `deviation_count = null` po `count_failed` to akceptowany sukces.
4. Hot-spot `src/components/reports` (#5) jest mylącym dowodem prawdopodobieństwa w tym sensie, że ryzyko leży w trasie (`src/pages/api/reports/upload.ts`) i parserze, nie w komponencie — komponent jest tylko źródłem „co odrzuca przeglądarka”.

## Open Questions

1. **Wstrzyknięcie błędu w CI** — czy `npx supabase db query --local` działa na runnerze z wyłączonym `postgres-meta`/`supavisor` (`ci.yml:48`) i czy lokalnie (Windows, Docker Desktop) — niezweryfikowane, Docker był wyłączony. Alternatywa: `--db-url` z `DB_URL` z `supabase status -o env` (klucz istnieje w standardowym wyjściu CLI, tu niesprawdzony) albo dev-zależność `pg`. Decyzja w planie; pierwszy krok implementacji powinien to potwierdzić.
2. **Ścieżki 500 (#5)** — naprawić w tej fazie (zmiana `upload.ts`, mała) czy tylko przypiąć testem jako znany błąd? Decyzja użytkownika.
3. **Rozróżnianie błędów parsera** — opcja (a) tokeny w `detail` vs (b) strukturalny `kind` (zmiana produktu). Rekomendacja: (a) w tej fazie.
4. **Wariant XLSX** — czy integracja ma wgrywać oba fixture'y (koszt: drugie wgranie, ten sam wynik), czy CSV + XLSX tylko dla #4. Rekomendacja: oba dla #4 (różne ścieżki `XLSX.read`), tylko CSV dla #3.
5. **`max_rows = 1000`** (`supabase/config.toml:18`) — raport > 1000 wizyt byłby po cichu obcięty na stronie szczegółów (i w `insert().select()` — niesprawdzone, czy limit dotyczy `RETURNING`). Poza zakresem ryzyk #3-#5 jako sformułowanych, ale to wariant „sukces bez kompletnych danych” (#3) — warto zgłosić do test-plan jako kandydat ryzyka, nie testować w tej fazie bez decyzji.
6. **Kolejność `RETURNING`** — dziś w praktyce zgodna z kolejnością wstawiania; test integracyjny ją przypnie, ale nie udowodni gwarancji. Czy reguła powinna sortować jawnie (zmiana produktu) — poza zakresem testów.
