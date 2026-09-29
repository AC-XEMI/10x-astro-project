# Wykrywanie nieoptymalnej trasy w wgranym raporcie Implementation Plan

## Overview

Druga reguła detekcji odstępstw (roadmap S-02, FR-009): wizyta jest oznaczana jako odstępstwo, gdy przedstawiciel odwiedził klienta spoza zaplanowanej listy/trasy, lub gdy zgłoszony dystans przejazdu przekracza próg wynikający z najkrótszej (prostoliniowej) odległości od poprzedniej wizyty tego samego dnia. To pierwsza reguła w repo, która porównuje wizyty między sobą zamiast oceniać każdą z osobna.

## Current State Analysis

- Enum `deviation_rule` już ma wartość `route_deviation` (`supabase/migrations/20260925120000_create_report_schema.sql:12`) — F-01 przewidziało tę regułę, nie trzeba migrować enuma.
- `visits` ma już `distance_km` i `planned_route_raw` (tamże, linie 39-41) — `planned_route_raw` to lista nazw klientów (bez współrzędnych), zapisywana przez `report-parser.ts:165-174`. Nie ma jednak żadnej kolumny mówiącej, KTÓREGO klienta faktycznie odwiedzono w danym wierszu — bez tego nie da się porównać "plan" z "rzeczywistością".
- `deviation-rules.ts:11` (`detectMissingGps`) operuje na pojedynczej wizycie w izolacji. Reguła trasy jest inna z natury — musi porównywać kolejne wizyty tego samego przedstawiciela i dnia, więc potrzebuje całego zbioru wizyt raportu naraz, nie jednej sztuki.
- `report-parser.ts:129-133` ustala wzorzec dla opcjonalnych kolumn: `columnIndex.get(header)` + `!== undefined` check, wartość `null` gdy nagłówek nieobecny. Nowe kolumny geo pójdą tym samym wzorcem.
- `upload.ts:76-79` buduje `deviationsToInsert` przez `insertedVisits.flatMap(visit => detectMissingGps(visit) ? [...] : [])` — per-wizyta. Reguła trasy potrzebuje osobnego wywołania na całej tablicy `insertedVisits`, którego wynik trzeba dołączyć do tej samej listy przed jednym `INSERT`.
- `DeviationsList.tsx:60-75` już renderuje opcjonalne pola wzorcem `?? "—"` w `<dl>` — nowe pola (odwiedzony klient, współrzędne, przyczyna) idą tym samym wzorcem.
- RLS (`supabase/migrations/20260925120100_report_schema_rls.sql`) na `visits`/`deviations` nie odwołuje się do konkretnych kolumn (tylko `EXISTS` przez `report_id`/`visit_id`) — nowe kolumny nie wymagają żadnych zmian RLS.
- Brak frameworka testowego w repo — `scripts/verify-report-detection.mjs` (S-01) to jedyny automatyczny dowód poprawności detekcji, do rozszerzenia o nową regułę.
- GitHub issue #3 (powiązany z S-02) potwierdza, że źródło współrzędnych, metoda liczenia dystansu i próg są świadomie odłożone do etapu planowania — nie ma dodatkowych ograniczeń poza PRD i tym, co ustalono w wywiadzie.

## Desired End State

Po wgraniu pliku CSV/XLSX zgodnego z rozszerzonym kontraktem kolumn, wizyty, które odwiedziły klienta spoza zaplanowanej listy LUB przejechały dystans przekraczający 50% ponad linię prostą od poprzedniej wizyty tego samego dnia, pojawiają się na liście odstępstw z regułą `route_deviation` i czytelnym opisem konkretnej przyczyny w rozwiniętym wierszu. Wizyta może jednocześnie złamać tę i inne reguły (np. `missing_gps`) — lista pokazuje wszystkie.

Weryfikacja: `npm run verify:report-detection` kończy się kodem 0 z asercjami pokrywającymi nową regułę dla obu formatów; ręczne wgranie rozszerzonego fixture w przeglądarce pokazuje oczekiwane odstępstwa trasy z poprawnym `detail`.

### Key Discoveries:

- Wzorzec API/parsera/UI z S-01 (patrz Current State Analysis) jest w pełni ponownie użyty — ten plan rozszerza istniejące moduły, nie tworzy nowej architektury.
- `report_id`/`visit_id` FK z `on delete cascade` i RLS przez `EXISTS` (nie kolumnowe polityki) oznaczają, że dodanie kolumn do `visits`/`deviations` jest czysto addytywne na poziomie bezpieczeństwa danych.
- Supabase CLI aplikuje wszystkie pliki z `supabase/migrations/` sekwencyjnie i automatycznie — plik "down" umieszczony w tym katalogu zostałby wykonany zaraz po migracji "up", kasując dopiero co dodane kolumny (patrz "Critical Implementation Details").

## What We're NOT Doing

- Pełna optymalizacja trasy dnia (problem komiwojażera po wszystkich przystankach) — odrzucone w wywiadzie na rzecz modelu punkt-do-punktu (poprzednia wizyta → bieżąca wizyta).
- Rzeczywisty routing drogowy przez zewnętrzne API (OSRM, Google Directions) — odrzucone; odległość liczona wzorem Haversine (linia prosta), zero nowych zależności zewnętrznych.
- Stały punkt startowy dnia (adres biura/depot) — pierwsza wizyta dnia dla danego przedstawiciela nie jest oceniana pod kątem nadmiarowego dystansu (brak punktu odniesienia).
- Osobne pole "czas przejazdu" — FR-009 realizowane wyłącznie przez porównanie dystansu; `czas_na_miejscu_min` to inna metryka (czas spędzony na miejscu, nie w drodze) i pozostaje niezmieniona.
- Reguła telefon-zamiast-wizyty (FR-010) — to `S-03`.
- Usuwanie wgranego raportu (FR-011) — to `S-04`.
- Oznaczanie odstępstwa jako sprawdzone/fałszywy alarm (FR-012) — to `S-05`.
- Konfigurowalny próg procentowy w UI — sztywna wartość 50% w kodzie, analogicznie do sztywnego limitu 5 MB z S-01.
- Automatyczne cofanie migracji — skrypt rollback to osobny plik referencyjny uruchamiany wyłącznie ręcznie, nigdy przez Supabase CLI.
- Częściowy import pliku / walidacja nowych pól na poziomie całość-albo-nic — `odwiedzony_klient` to wymagany nagłówek, ale pusta wartość w wierszu nie odrzuca pliku (patrz "Critical Implementation Details").

## Implementation Approach

Reguła trasy żyje jako czysta funkcja w `deviation-rules.ts`, tak jak `detectMissingGps`, ale z innym kształtem sygnatury — przyjmuje CAŁY zbiór wizyt raportu (nie jedną wizytę), bo z natury porównuje wizyty między sobą. Nowy moduł `geo.ts` izoluje matematykę (Haversine) od logiki biznesowej reguły, żeby była testowalna i czytelna osobno. Endpoint uploadu (Faza 3) woła tę funkcję RAZ, po wstawieniu wszystkich wizyt (potrzebuje ich `id` i pełnego zbioru do grupowania), i łączy jej wynik z istniejącym wynikiem `detectMissingGps` przed jednym zbiorczym `INSERT` do `deviations`. Nowe kolumny (Faza 1) są czysto addytywne, z osobnym, ręcznie uruchamianym skryptem rollback — decyzja z wywiadu, żeby nie polegać wyłącznie na kierunku "do przodu" jak w F-01/S-01.

## Critical Implementation Details

**`odwiedzony_klient` to wymagany nagłówek, ale opcjonalna wartość** — inaczej niż `przedstawiciel`/`data_wizyty`/`gps_wlaczony`, gdzie brak wartości w wierszu odrzuca cały plik, pusta wartość w kolumnie `odwiedzony_klient` NIE odrzuca pliku. Oznacza tylko, że reguła trasy nie ma zastosowania do tego konkretnego wiersza (tak samo jak brak `szerokosc`/`dlugosc` lub brak nagłówka `planowana_trasa`). To jedyne pole w kontrakcie kolumn z takim mieszanym statusem — Faza 2 musi to jawnie odróżnić od istniejącej logiki trzech w pełni wymaganych pól, nie kopiować jej wprost.

**Rollback musi żyć poza `supabase/migrations/`** — Supabase CLI aplikuje sekwencyjnie i automatycznie wszystkie pliki z tego katalogu przy `db reset`/`migration up`. Plik "down" umieszczony tam zostałby wykonany zaraz po migracji "up" w tym samym przebiegu, kasując dopiero co dodane kolumny. Dlatego skrypt cofający trafia do nowego katalogu `supabase/rollbacks/`, nigdy automatycznie odpalanego.

**`detectRouteDeviations` ma inny kontrakt niż `detectMissingGps`** — operuje na całym zbiorze wizyt raportu (potrzebuje grupowania po przedstawicielu+dacie i dostępu do `id` wstawionych rekordów), więc wywołanie w `upload.ts` musi nastąpić PO wstawieniu wszystkich wizyt, jako osobny krok, a nie w tej samej pętli `flatMap`, która dziś obsługuje `detectMissingGps`.

**Kolejność wizyt w dniu = kolejność wierszy w pliku** — reguła zakłada, że kolejność, w jakiej Supabase zwraca wstawione wiersze (`insert().select()`), odpowiada kolejności `VALUES` w oryginalnym zapytaniu (typowe, powszechnie polegane zachowanie PostgreSQL dla pojedynczego `INSERT ... RETURNING`, ale nieudokumentowane jako twarda gwarancja). Patrz "Open Risks" w brief — świadomie zaakceptowane ryzyko, bez dodawania osobnej kolumny sekwencji.

## Phase 1: Migracja schematu — nowe kolumny i skrypt rollback

### Overview

Addytywna migracja dodająca kolumny wymagane przez regułę trasy, plus osobny, ręcznie uruchamiany skrypt cofający (decyzja z wywiadu).

### Changes Required:

#### 1. Migracja "up"

**File**: `supabase/migrations/20260929120000_add_route_deviation_columns.sql` (nowy)

**Intent**: Dodać kolumny na odwiedzonego klienta, jego współrzędne i przyczynę odstępstwa — jedyna zmiana schematu w tym wycinku.

**Contract**:

```sql
alter table visits add column visited_client text;
alter table visits add column visited_latitude numeric;
alter table visits add column visited_longitude numeric;
alter table deviations add column detail text;
```

Wszystkie kolumny nullable — brak potrzeby wartości domyślnej ani backfillu (dane testowe, brak ruchu produkcyjnego).

#### 2. Skrypt rollback (poza katalogiem migracji)

**File**: `supabase/rollbacks/20260929120000_add_route_deviation_columns_down.sql` (nowy)

**Intent**: Ręcznie uruchamiany skrypt cofający migrację "up" — patrz "Critical Implementation Details" dlaczego nie może żyć w `supabase/migrations/`.

**Contract**:

```sql
alter table deviations drop column if exists detail;
alter table visits drop column if exists visited_longitude;
alter table visits drop column if exists visited_latitude;
alter table visits drop column if exists visited_client;
```

Uruchomienie ręczne przeciw lokalnej/docelowej bazie przez `psql` wewnątrz kontenera Docker Supabase — `docker exec -i supabase_db_<project> psql -U postgres -d postgres < supabase/rollbacks/20260929120000_add_route_deviation_columns_down.sql` — nigdy automatycznie przez `supabase migration up`/`db reset`. (Zweryfikowano podczas implementacji: `supabase db execute` nie istnieje w tej wersji CLI, a `supabase db query -f` odrzuca pliki z wieloma poleceniami SQL — "cannot insert multiple commands into a prepared statement" — stąd `psql` w kontenerze jako jedyna działająca droga.)

#### 3. Regeneracja typów

**File**: `src/types.ts` (regenerowany)

**Intent**: Zsynchronizować wygenerowane typy Supabase z nowymi kolumnami, żeby Fazy 2-4 miały poprawne typowanie.

**Contract**: `npm run db:types` (wymaga `npx supabase start` lokalnie).

### Success Criteria:

#### Automated Verification:

- Migracja aplikuje się czysto lokalnie: `npx supabase db reset`
- `npm run db:types` kończy się sukcesem, a `src/types.ts` zawiera `visited_client`, `visited_latitude`, `visited_longitude` (na `visits`) i `detail` (na `deviations`)
- `npm run lint` przechodzi
- `npx astro check` przechodzi

#### Manual Verification:

- Ręczne uruchomienie skryptu rollback na lokalnej bazie usuwa nowe kolumny bez błędu; ponowne zastosowanie migracji "up" przywraca je w niezmienionym kształcie

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Rdzeń logiki — rozszerzenie parsera i reguła trasy

### Overview

Rozszerzenie kontraktu kolumn o nowe pola, nowy moduł matematyczny (Haversine) i nowa reguła detekcji operująca na całym zbiorze wizyt raportu.

### Changes Required:

#### 1. Rozszerzenie parsera

**File**: `src/lib/services/report-parser.ts`

**Intent**: Wyodrębnić nowe pola potrzebne regule trasy, zachowując istniejący wzorzec obsługi kolumn opcjonalnych.

**Contract**:

- Nowe rozpoznawane nagłówki (case-insensitive): `odwiedzony_klient` (nagłówek wymagany — brak kolumny w pliku odrzuca cały plik, tak jak `przedstawiciel`), `szerokosc`, `dlugosc` (oba opcjonalne, numeryczne, parsowane przez istniejący `parseOptionalNumber`).
- `odwiedzony_klient`: nagłówek wymagany, ale WARTOŚĆ w danym wierszu może być pusta — pusta wartość nie odrzuca pliku (patrz "Critical Implementation Details").
- `szerokosc`/`dlugosc`: brak nagłówka, pusta wartość, lub obecność tylko jednej z dwóch współrzędnych → obie traktowane jako nieobecne dla tego wiersza (brak częściowych współrzędnych).
- `ExtractedVisit` rozszerzony o `visited_client: string | null`, `visited_latitude: number | null`, `visited_longitude: number | null`.

#### 2. Moduł geograficzny

**File**: `src/lib/services/geo.ts` (nowy)

**Intent**: Czysta funkcja matematyczna, jedyne jądro liczące odległość — oddzielona od logiki reguły, żeby była samodzielnie czytelna i testowalna.

**Contract**: `export function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number`, standardowy wzór Haversine z promieniem Ziemi 6371 km.

#### 3. Reguła detekcji trasy

**File**: `src/lib/services/deviation-rules.ts`

**Intent**: Druga reguła detekcji (FR-009) — w przeciwieństwie do `detectMissingGps` (per-wizyta), operuje na całym zbiorze wizyt raportu, bo porównuje kolejne wizyty tego samego przedstawiciela i dnia.

**Contract**:

```ts
export interface RouteDeviationFlag {
  visit_id: string;
  detail: string;
}

export function detectRouteDeviations(visits: Tables<"visits">[]): RouteDeviationFlag[];
```

- Filtruje do wierszy z `activity_type` równym `null` lub `"wizyta"` (case-insensitive) — `"telefon"` jest pomijane całkowicie (nie zajmuje nawet miejsca w sekwencji "poprzedni punkt").
- Grupuje pozostałe wiersze po (`representative_name`, `visit_date`), zachowując kolejność występowania w przekazanej tablicy (= kolejność wierszy w oryginalnym pliku — patrz "Critical Implementation Details").
- W każdej grupie iteruje sekwencyjnie, śledząc `poprzedni punkt` (współrzędne ostatniej wizyty w grupie, która miała komplet `visited_latitude`/`visited_longitude`). Pierwsza wizyta w grupie nie ma poprzedniego punktu — nie jest oceniana pod kątem dystansu (brak stałego punktu startowego, ustalone w wywiadzie).
- Dla każdej wizyty sprawdza niezależnie dwa warunki, łącząc trafienia w jeden `detail` (rozdzielone `"; "`), gdy oba zadziałały jednocześnie:
  - **poza planem**: `visited_client` niepuste i `planned_route_raw` to niepusta tablica, a `visited_client` (trim, lowercase) nie występuje w liście (trim, lowercase) → `"poza zaplanowaną trasą"`.
  - **nadmiarowy dystans**: istnieje poprzedni punkt, bieżąca wizyta ma komplet współrzędnych i niepuste `distance_km`, a `distance_km > haversineDistanceKm(poprzedni, bieżący) * 1.5` → `"nadmiarowy dystans: zgłoszono {distance_km} km, linia prosta {lineKm.toFixed(1)} km"`.
- Zwraca wpis wyłącznie dla wizyt, które złamały co najmniej jeden warunek.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi

#### Manual Verification:

- Ręczny przegląd `detectRouteDeviations` potwierdza dokładnie logikę ustaloną w wywiadzie: grupowanie po przedstawicielu+dacie, kolejność wierszy jako sygnał sekwencji, pomijanie aktywności telefonicznych, brak oceny dystansu dla pierwszej wizyty dnia, próg 50%

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Integracja z endpointem uploadu

### Overview

Dołączenie wyniku nowej reguły do istniejącego zapisu `deviations`, bez zmiany kolejności zapisu `reports` → `visits` → `deviations` ani wzorca kompensacyjnego rollbacku.

### Changes Required:

#### 1. Endpoint uploadu

**File**: `src/pages/api/reports/upload.ts`

**Intent**: Wywołać nową regułę PO wstawieniu wszystkich wizyt i połączyć jej wynik z istniejącym wynikiem `detectMissingGps` przed jednym zbiorczym `INSERT` do `deviations`.

**Contract**:

- Po istniejącej pętli budującej `deviationsToInsert` z `detectMissingGps`, doliczyć `detectRouteDeviations(insertedVisits)`, mapując każdy `RouteDeviationFlag` na `{ visit_id: flag.visit_id, rule: "route_deviation", detail: flag.detail }`.
- Połączona tablica (ta sama wizyta może mieć wpis `missing_gps` i osobny wpis `route_deviation`) trafia do jednego `INSERT` do `deviations`, zachowując istniejący wzorzec kompensacyjnego rollbacku (`delete` z `reports` przy błędzie zapisu).
- Wpisy z `detectMissingGps` nadal nie mają `detail` (pozostaje `null`/pominięte przy insert) — bez zmian w tej części.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi

#### Manual Verification:

- Wgranie pliku z wizytą poza planowaną listą kończy się zapisanym wpisem `route_deviation` z poprawnym `detail` w Supabase Studio
- Wgranie pliku z wizytą o dystansie przekraczającym próg względem poprzedniej wizyty tego dnia daje analogiczny wynik
- Wizyta łamiąca jednocześnie `missing_gps` i regułę trasy ma oba wpisy w `deviations` dla tego samego `visit_id`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: UI — rozszerzony kontekst wizyty

### Overview

Pokazanie nowych danych wizyty i konkretnej przyczyny odstępstwa trasy w rozwiniętym wierszu (FR-006), bez zmiany widoku listy zbiorczej.

### Changes Required:

#### 1. Rozwinięty wiersz listy

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Uzupełnić istniejący blok "pełny kontekst wizyty" o nowe pola i sekcję z konkretną przyczyną (przyczynami) odstępstwa.

**Contract**:

- W istniejącym `<dl>` dodać: "Odwiedzony klient" (`visit.visited_client ?? "—"`), "Współrzędne" (gdy `visited_latitude`/`visited_longitude` oba obecne: `${lat}, ${lng}`, inaczej `"—"`) — ten sam wzorzec `?? "—"` co pozostałe pola.
- Pod istniejącym `<dl>` dodać listę `<ul>` "Szczegóły odstępstw": `visit.deviations.filter(d => d.detail).map(d => d.detail)`; sekcja całkowicie pominięta (nie renderowana), gdy żadna deviation danej wizyty nie ma `detail` (np. sam `missing_gps`).

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi
- `npm run build` kończy się bez błędów

#### Manual Verification:

- Rozwinięcie wiersza z odstępstwem trasy pokazuje odwiedzonego klienta, współrzędne i konkretną przyczynę (`detail`)
- Wizyta tylko z `missing_gps` (bez `detail`) nadal renderuje się poprawnie, bez pustej lub błędnej sekcji "Szczegóły odstępstw"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Fixture testowy i rozszerzenie skryptu weryfikacji

### Overview

Rozszerzenie istniejącego fixture (ten sam zestaw danych, oba formaty) i skryptu weryfikacji o przypadki pokrywające nową regułę, bez naruszania istniejących asercji `missing_gps`.

### Changes Required:

#### 1. Rozszerzone fixture'y

**File**: `test-data/sample-report.csv`, `test-data/sample-report.xlsx`

**Intent**: Dodać kolumny i wiersze pokrywające wszystkie gałęzie logiki `detectRouteDeviations` ustalone w Fazie 2, plus jawne pokrycie acceptance criteria US-01 (jedna wizyta łamiąca więcej niż jedną regułę).

**Contract**: Dodać kolumny `odwiedzony_klient`, `szerokosc`, `dlugosc` do wszystkich istniejących wierszy (sensowne wartości, zgodne z istniejącym `planowana_trasa`), plus nowe wiersze pokrywające:

- Wizytę spoza planowanej listy → `route_deviation` z `detail` zawierającym "poza zaplanowaną trasą".
- Wizytę z dystansem przekraczającym próg 50% względem linii prostej od poprzedniej wizyty tego samego dnia → `route_deviation` z `detail` o nadmiarowym dystansie.
- Wizytę łamiącą jednocześnie `missing_gps` i regułę trasy (dla tego samego wiersza).
- Aktywność typu `telefon` z celowo wypełnionymi danymi geo — potwierdzenie, że reguła trasy ją pomija.
- Pierwszą wizytę dnia dla przedstawiciela z wieloma wizytami tego dnia, ze współrzędnymi obecnymi — potwierdzenie braku oceny dystansu (brak poprzedniego punktu), mimo dostępnych danych.

#### 2. Rozszerzenie skryptu weryfikacji

**File**: `scripts/verify-report-detection.mjs`

**Intent**: Dodać asercje dla `detectRouteDeviations`, analogicznie do istniejących asercji `detectMissingGps`.

**Contract**: Wywołać `detectRouteDeviations` na sparsowanych wierszach (uwaga: operuje na całym zbiorze, nie pojedynczej wizycie — wymaga struktury zbliżonej do `Tables<"visits">`, więc skrypt symuluje pola `id`/`visit_id` lokalnie zamiast czytać je z bazy) i potwierdzić dokładną liczbę, tożsamość oraz treść `detail` dla każdego z pięciu nowych przypadków, dla obu formatów (CSV i XLSX).

### Success Criteria:

#### Automated Verification:

- `npm run verify:report-detection` kończy się kodem 0 (rozszerzone asercje obejmują `route_deviation`)

#### Manual Verification:

- Przegląd logu skryptu pokazuje jawne, nazwane asercje dla wszystkich pięciu nowych przypadków testowych, dla obu formatów

---

## Testing Strategy

### Unit Tests:

Brak frameworka testowego (CLAUDE.md) — `haversineDistanceKm` i `detectRouteDeviations` to czyste funkcje, testowane przez `scripts/verify-report-detection.mjs` (Faza 5), tak jak `detectMissingGps` w S-01.

### Integration Tests:

`scripts/verify-report-detection.mjs` — jedyny automatyczny dowód poprawności parsowania i obu reguł detekcji łącznie.

### Manual Testing Steps:

1. Zalogować się jako testowy kierownik, wgrać rozszerzony `test-data/sample-report.csv`.
2. Potwierdzić, że wizyta poza planowaną listą pojawia się z `route_deviation` i poprawnym `detail`.
3. Potwierdzić, że wizyta z nadmiarowym dystansem pojawia się z `route_deviation` i poprawnym `detail`.
4. Potwierdzić, że wizyta łamiąca dwie reguły naraz pokazuje obie na liście.
5. Potwierdzić, że aktywność telefoniczna z wypełnionymi danymi geo NIE jest oznaczona regułą trasy.
6. Potwierdzić, że pierwsza wizyta dnia (mimo współrzędnych) nie jest oceniana pod kątem dystansu.
7. Powtórzyć dla `test-data/sample-report.xlsx`, potwierdzić identyczny wynik.

## Performance Considerations

Haversine to stała liczba operacji arytmetycznych na parę punktów; grupowanie i sekwencyjne przejście po wizytach raportu to złożoność liniowa względem liczby wizyt. Brak ryzyka wydajnościowego przy `target_scale: small` z PRD — NFR "wynik w ciągu kilku sekund" pozostaje spełniony bez dodatkowych optymalizacji.

## Migration Notes

Migracja z Fazy 1 jest czysto addytywna (nowe nullable kolumny, brak backfillu) — bezpieczna do zastosowania na dowolnym etapie, bez wpływu na istniejące wiersze `visits`/`deviations` z S-01. Rollback (decyzja z wywiadu) to osobny, ręcznie uruchamiany skrypt w `supabase/rollbacks/` — patrz "Critical Implementation Details" dlaczego nie może żyć w katalogu migracji Supabase.

## References

- `context/foundation/prd.md` (v2) — FR-009, US-01 (acceptance criteria: wiele reguł na jednej wizycie)
- `context/foundation/roadmap.md` — S-02 (ten change), Prerequisites: F-01, S-01
- GitHub issue #3 — potwierdza brak dodatkowych ustaleń poza tym, co zdecydowano w wywiadzie
- `context/archive/2026-09-28-missing-gps-deviation-detection/plan.md` — wzorzec architektury (parser/reguła/endpoint/UI/fixture) rozszerzany w tym planie
- `src/lib/services/report-parser.ts`, `src/lib/services/deviation-rules.ts`, `src/pages/api/reports/upload.ts`, `src/components/reports/DeviationsList.tsx` — moduły rozszerzane
- `supabase/migrations/20260925120000_create_report_schema.sql`, `supabase/migrations/20260925120100_report_schema_rls.sql` — istniejący schemat i RLS

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Migracja schematu — nowe kolumny i skrypt rollback

#### Automated

- [x] 1.1 Migracja aplikuje się czysto lokalnie: `npx supabase db reset` — 9a311de
- [x] 1.2 `npm run db:types` kończy się sukcesem i zawiera nowe kolumny — 9a311de
- [x] 1.3 `npm run lint` przechodzi — 9a311de
- [x] 1.4 `npx astro check` przechodzi — 9a311de

#### Manual

- [x] 1.5 Skrypt rollback usuwa kolumny bez błędu; ponowna migracja "up" je przywraca — 9a311de

### Phase 2: Rdzeń logiki — rozszerzenie parsera i reguła trasy

#### Automated

- [x] 2.1 `npm run lint` przechodzi — 6532937
- [x] 2.2 `npx astro check` przechodzi — 6532937

#### Manual

- [x] 2.3 Ręczny przegląd `detectRouteDeviations` potwierdza logikę z wywiadu — 6532937

### Phase 3: Integracja z endpointem uploadu

#### Automated

- [x] 3.1 `npm run lint` przechodzi — 840c123
- [x] 3.2 `npx astro check` przechodzi — 840c123

#### Manual

- [x] 3.3 Wizyta poza planowaną listą zapisuje `route_deviation` z poprawnym `detail` — 840c123
- [x] 3.4 Wizyta z nadmiarowym dystansem zapisuje `route_deviation` z poprawnym `detail` — 840c123
- [x] 3.5 Wizyta łamiąca dwie reguły naraz ma oba wpisy w `deviations` — 840c123

### Phase 4: UI — rozszerzony kontekst wizyty

#### Automated

- [x] 4.1 `npm run lint` przechodzi — d95a372
- [x] 4.2 `npx astro check` przechodzi — d95a372
- [x] 4.3 `npm run build` kończy się bez błędów — d95a372

#### Manual

- [x] 4.4 Rozwinięty wiersz pokazuje odwiedzonego klienta, współrzędne i przyczynę odstępstwa — d95a372
- [x] 4.5 Wizyta tylko z `missing_gps` renderuje się poprawnie bez pustej sekcji szczegółów — d95a372

### Phase 5: Fixture testowy i rozszerzenie skryptu weryfikacji

#### Automated

- [x] 5.1 `npm run verify:report-detection` kończy się kodem 0

#### Manual

- [x] 5.2 Log skryptu pokazuje jawne asercje dla wszystkich pięciu nowych przypadków, dla obu formatów
