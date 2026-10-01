# Wykrywanie telefonu zamiast wizyty w wgranym raporcie Implementation Plan

## Overview

Trzecia reguła detekcji odstępstw (roadmap S-03, FR-010): aktywność jest oznaczana jako odstępstwo `phone_instead_of_visit`, gdy pole typu aktywności wprost wskazuje "telefon", lub — gdy ta wizyta nie ma rozpoznawalnej wartości "wizyta"/"telefon" — gdy współwystępuje brak GPS i zerowy/brakujący czas na miejscu. W przeciwieństwie do S-02, ta reguła nie wymaga żadnej migracji, nowych kolumn pliku ani zmian UI — wszystkie potrzebne pola i mechanizmy (`detail`, generyczne renderowanie reguł) już istnieją.

## Current State Analysis

- Enum `deviation_rule` już ma wartość `phone_instead_of_visit` (`supabase/migrations/20260925120000_create_report_schema.sql:12`) — F-01 przewidziało tę regułę, nie trzeba migrować enuma.
- Wszystkie potrzebne pola już istnieją w `visits` od S-01: `activity_type` (tekst, opcjonalny nagłówek `typ_aktywnosci`), `gps_enabled`, `time_on_site_minutes` — zero zmian schematu.
- Kolumna `deviations.detail` już istnieje (dodana w S-02, nullable, generyczna dla każdej reguły) — nowa reguła może jej użyć bez migracji.
- `deviation-rules.ts` ma dwa wzorce funkcji: `detectMissingGps(visit: ExtractedVisit): DeviationRule | null` (per-wizyta, bez `detail`) i `detectRouteDeviations(visits: Tables<"visits">[]): RouteDeviationFlag[]` (całe raport naraz, z `detail`). Nowa reguła jest per-wizyta jak pierwsza, ale z `detail` jak druga — nowy, trzeci kształt kontraktu.
- `upload.ts:79-82` buduje `missingGpsDeviations` przez `insertedVisits.flatMap(visit => detectMissingGps(visit) ? [...] : [])`. Nowa reguła jest też per-wizyta, więc naturalnie dołącza do TEJ SAMEJ pętli, zamiast dodawać osobne wywołanie jak `detectRouteDeviations` (`upload.ts:84-88`).
- `DeviationsList.tsx` (rozszerzony w S-02) już renderuje dowolną nazwę reguły w wierszu podsumowania (`visit.deviations.map(d => d.rule).join(", ")`) i dowolny niepusty `detail` w sekcji "Szczegóły odstępstw" — **zero zmian UI potrzebnych dla tej reguły**.
- `report-parser.ts` już ekstrahuje `activity_type` jako opcjonalne pole (`typAktywnosciIndex`, linia ~136-137 w obecnej wersji) — `null`, gdy komórka pusta lub nagłówek nieobecny.
- Istniejący filtr w `detectRouteDeviations` (`deviation-rules.ts`) traktuje `activity_type === null` jako RÓWNOWAŻNE "wizyta" (włączone do grupowania tras), ale każdą INNĄ, niepustą wartość różną od "wizyta" jako wykluczenie z grupowania. Nowa reguła telefonu ma ODWROTNĄ semantykę dla wartości null/nierozpoznanych (patrz "Critical Implementation Details") — to nie jest błąd, to dwie niezależne reguły odpowiadające na różne pytania, ale implementer nie powinien zakładać współdzielonej logiki.
- GitHub issue #4 (powiązany z S-03) potwierdza, że — mimo iż roadmapa nazwała tę regułę "w pełni sprecyzowaną" — dwie rzeczy pozostały nierozstrzygnięte: granularność "braku pola" (kolumna vs wartość w wierszu) i konkretny próg minut dla "bardzo krótkiego" czasu. Oba rozstrzygnięte w wywiadzie planistycznym.

## Desired End State

Po wgraniu pliku, aktywność z `typ_aktywnosci=telefon` (dowolny GPS/czas) ORAZ aktywność bez rozpoznawalnej wartości "wizyta"/"telefon" ALE z wyłączonym GPS i zerowym/brakującym czasem na miejscu, pojawiają się na liście odstępstw z regułą `phone_instead_of_visit` i czytelnym `detail` wyjaśniającym, którą ścieżką wykryto (wprost z pola, czy heurystyka). Wizyta może złamać tę regułę razem z `missing_gps` jednocześnie (reguły niezależne, bez zmian w `detectMissingGps`).

Weryfikacja: `npm run verify:report-detection` kończy się kodem 0 z asercjami pokrywającymi obie ścieżki detekcji i oba kierunki negatywne (brak fałszywych alarmów), dla obu formatów.

### Key Discoveries:

- Brak potrzeby migracji — wszystkie pola (`activity_type`, `gps_enabled`, `time_on_site_minutes`, `deviations.detail`) już istnieją.
- Brak potrzeby zmian UI — `DeviationsList.tsx` renderuje reguły i `detail` generycznie od S-02.
- Reguła jest per-wizyta (jak `detectMissingGps`), nie wymaga grupowania ani kolejności wierszy jak `detectRouteDeviations` — najprostsza z trzech reguł pod względem integracji.

## What We're NOT Doing

- Zmiana `detectMissingGps` — reguła pozostaje całkowicie niezmieniona; wizyta sklasyfikowana jako `phone_instead_of_visit` może nadal niezależnie dostać `missing_gps`, jeśli GPS był wyłączony (ustalone w wywiadzie: obie reguły niezależne, zero ryzyka regresji na już wdrożonej logice z S-01).
- Rozróżnianie "brak całej kolumny w pliku" od "pusta wartość w wierszu" — oba przypadki traktowane identycznie, per-wiersz (ustalone w wywiadzie).
- Konfigurowalny próg czasu w UI — sztywna wartość 0 minut w kodzie, analogicznie do sztywnych wartości inżynierskich z S-01/S-02.
- Walidacja/odrzucanie pliku z powodu nierozpoznanej wartości `typ_aktywnosci` — nierozpoznana wartość jest cichym sygnałem do heurystyki, nie błędem parsowania.
- Usuwanie raportu (FR-011, S-04) i oznaczanie odstępstwa jako sprawdzone (FR-012, S-05) — osobne wycinki.
- Jakiekolwiek zmiany w `report-parser.ts`, schemacie bazy, czy `DeviationsList.tsx` — ten plan dotyka wyłącznie `deviation-rules.ts` i `upload.ts` (plus fixture/testy).

## Implementation Approach

Nowa funkcja `detectPhoneInsteadOfVisit` żyje w `deviation-rules.ts` obok dwóch istniejących reguł, jako czysta funkcja per-wizyta zwracająca `detail` (trzeci kształt kontraktu — łączy prostotę `detectMissingGps` z `detail` znanym z `detectRouteDeviations`). Endpoint uploadu (Faza 2) woła ją w TEJ SAMEJ pętli `flatMap`, która dziś obsługuje `detectMissingGps` — obie reguły są per-wizyta, więc nie ma powodu ich rozdzielać jak w przypadku `detectRouteDeviations` (który z natury wymaga całego zbioru).

## Critical Implementation Details

**Semantyka "braku/nierozpoznanej wartości" różni się między regułami i jest celowa** — `detectRouteDeviations` traktuje `activity_type === null` jako równoważne "wizyta" (wizyta bez podanego typu nadal podlega sprawdzeniu trasy), ale każdą inną, jawną wartość różną od "wizyta" jako wykluczenie z grupowania tras. `detectPhoneInsteadOfVisit` traktuje ZARÓWNO `null`, JAK I każdą wartość różną od dokładnie "wizyta"/"telefon" jako sygnał do uruchomienia heurystyki (ustalone w wywiadzie: literówki/nieznane wartości mają być łapane, nie cicho ignorowane). To są dwie niezależne, świadomie różne interpretacje tego samego pola dla dwóch różnych pytań biznesowych — nie ujednolicać.

## Phase 1: Rdzeń logiki — reguła detekcji telefonu

### Overview

Nowa czysta funkcja per-wizyta implementująca obie ścieżki FR-010 (wprost i heurystyka), z `detail` wyjaśniającym przyczynę.

### Changes Required:

#### 1. Reguła detekcji telefonu

**File**: `src/lib/services/deviation-rules.ts`

**Intent**: Trzecia reguła detekcji (FR-010) — per-wizyta jak `detectMissingGps`, ale z `detail` jak `detectRouteDeviations`.

**Contract**:

```ts
export interface PhoneInsteadOfVisitResult {
  detail: string;
}

export function detectPhoneInsteadOfVisit(visit: ExtractedVisit): PhoneInsteadOfVisitResult | null;
```

- Normalizuje `activity_type` (trim, lowercase; `null` → pusty string).
- Wartość dokładnie `"telefon"` → zwraca `{ detail: "typ aktywności: telefon" }`, niezależnie od GPS/czasu (ścieżka "wprost" ignoruje pozostałe pola — ustalone w wywiadzie).
- Wartość dokładnie `"wizyta"` → zwraca `null` (reguła się nie stosuje).
- Każda inna wartość (w tym `null`/puste i nierozpoznane, np. literówki) → ścieżka heurystyczna: jeśli `gps_enabled === false` ORAZ (`time_on_site_minutes === null` LUB `time_on_site_minutes <= 0`) → zwraca `{ detail: "brak GPS i czas na miejscu {X} min (pole typ_aktywnosci puste lub nierozpoznane)" }` (gdzie `{X}` to `time_on_site_minutes ?? 0`); inaczej `null`.
- `detectMissingGps` pozostaje bez zmian (patrz "Critical Implementation Details" i "What We're NOT Doing").

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi

#### Manual Verification:

- Ręczny przegląd `detectPhoneInsteadOfVisit` potwierdza dokładnie trzy gałęzie logiki ustalone w wywiadzie (wprost "telefon" ignoruje GPS/czas, jawna "wizyta" wyklucza regułę, wszystko inne idzie do heurystyki z progiem 0 minut)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Integracja z endpointem uploadu

### Overview

Dołączenie nowej reguły do istniejącej pętli per-wizyta w endpointzie uploadu, bez zmiany kolejności zapisu ani wzorca kompensacyjnego rollbacku.

### Changes Required:

#### 1. Endpoint uploadu

**File**: `src/pages/api/reports/upload.ts`

**Intent**: Rozszerzyć istniejącą pętlę `flatMap` (dziś obsługującą tylko `detectMissingGps`) o drugą, niezależną regułę per-wizyta.

**Contract**:

- W istniejącym `insertedVisits.flatMap(...)` (linie 79-82), obok `detectMissingGps(visit)`, wywołać też `detectPhoneInsteadOfVisit(visit)`; jeśli zwróci wynik, dodać do tej samej listy wpisów dla danej wizyty wpis `{ visit_id: visit.id, rule: "phone_instead_of_visit", detail: result.detail }`. Jedna wizyta może więc dodać do wynikowej tablicy 0, 1 (sama `missing_gps` LUB sama `phone_instead_of_visit`) lub 2 wpisy (obie reguły).
- Zmienna `missingGpsDeviations` może zostać przemianowana (np. `perVisitDeviations`), żeby odzwierciedlić że obsługuje teraz dwie reguły — czysto kosmetyczna zmiana nazwy, bez wpływu na resztę pliku.
- Reszta funkcji (kolejność zapisu `reports`→`visits`→`deviations`, konkatenacja z `routeDeviations`, kompensacyjny rollback przy błędzie) pozostaje bez zmian.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi

#### Manual Verification:

- Wgranie pliku z aktywnością `typ_aktywnosci=telefon` (GPS włączony, długi czas) kończy się zapisanym wpisem `phone_instead_of_visit` z `detail` "wprost", bez `missing_gps`
- Wgranie pliku z pustym `typ_aktywnosci`, wyłączonym GPS i zerowym czasem kończy się zapisanymi OBOMA wpisami (`missing_gps` i `phone_instead_of_visit`) dla tej samej wizyty
- Wgranie pliku z pustym `typ_aktywnosci`, wyłączonym GPS, ale czasem na miejscu powyżej 0 minut, kończy się TYLKO wpisem `missing_gps`, bez `phone_instead_of_visit`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Fixture testowy i rozszerzenie skryptu weryfikacji

### Overview

Rozszerzenie istniejącego fixture i skryptu weryfikacji o przypadki pokrywające obie ścieżki nowej reguły oraz oba kierunki negatywne, bez naruszania istniejących asercji `missing_gps`/`route_deviation`.

### Changes Required:

#### 1. Rozszerzone fixture'y

**File**: `test-data/sample-report.csv`, `test-data/sample-report.xlsx`

**Intent**: Dodać nowe wiersze pokrywające wszystkie gałęzie `detectPhoneInsteadOfVisit` ustalone w Fazie 1, bez modyfikowania istniejących 9 wierszy z S-01/S-02.

**Contract**: Dodać 6 nowych wierszy (nowi przedstawiciele, żeby nie kolidować z istniejącymi grupami przedstawiciel+data; `odwiedzony_klient` zgodny z `planowana_trasa` w każdym, żeby nie wprowadzać przypadkowych `route_deviation`):

- **Wprost, GPS włączony** (dowód niezależności od GPS/czasu): `typ_aktywnosci=telefon`, `gps_wlaczony=TAK`, długi czas → `phone_instead_of_visit` ("wprost"), BEZ `missing_gps`.
- **Heurystyka, czas=0**: `typ_aktywnosci` puste, `gps_wlaczony=NIE`, `czas_na_miejscu_min=0` → `phone_instead_of_visit` (heurystyka) ORAZ `missing_gps`.
- **Heurystyka, czas brakujący**: `typ_aktywnosci` puste, `gps_wlaczony=NIE`, `czas_na_miejscu_min` puste → `phone_instead_of_visit` (heurystyka, brak traktowany jak zero) ORAZ `missing_gps`.
- **Heurystyka, nierozpoznana wartość**: `typ_aktywnosci=spotkanie` (literówka/nieznana wartość), `gps_wlaczony=NIE`, `czas_na_miejscu_min=0` → `phone_instead_of_visit` (heurystyka) ORAZ `missing_gps`.
- **Negatyw — GPS włączony**: `typ_aktywnosci` puste, `gps_wlaczony=TAK`, `czas_na_miejscu_min=0` → BRAK `phone_instead_of_visit` (heurystyka wymaga obu warunków), BRAK `missing_gps`.
- **Negatyw — czas za długi**: `typ_aktywnosci` puste, `gps_wlaczony=NIE`, `czas_na_miejscu_min=15` → BRAK `phone_instead_of_visit`, ale OBECNY `missing_gps` (niezależna reguła nadal się stosuje).

#### 2. Rozszerzenie skryptu weryfikacji

**File**: `scripts/verify-report-detection.mjs`

**Intent**: Dodać asercje dla `detectPhoneInsteadOfVisit`, wywoływanej per-wizyta (prościej niż `detectRouteDeviations` — nie wymaga syntetycznych `id`/grupowania).

**Contract**: Dla każdego z 6 nowych wierszy, wywołać `detectPhoneInsteadOfVisit` bezpośrednio na sparsowanym wierszu i potwierdzić obecność/brak wyniku oraz treść `detail` (substring "telefon" dla ścieżki wprost, "brak GPS" dla heurystyki), dla obu formatów (CSV i XLSX). Potwierdzić też, że istniejące asercje `missing_gps`/`route_deviation` nadal przechodzą niezmienione (nowe wiersze nie powinny zaburzyć indeksów istniejących 9 wierszy, bo są dopisane na końcu).

### Success Criteria:

#### Automated Verification:

- `npm run verify:report-detection` kończy się kodem 0 (rozszerzone asercje obejmują `phone_instead_of_visit`, istniejące asercje nadal przechodzą)

#### Manual Verification:

- Przegląd logu skryptu pokazuje jawne, nazwane asercje dla wszystkich sześciu nowych przypadków testowych (4 pozytywne, 2 negatywne), dla obu formatów

---

## Testing Strategy

### Unit Tests:

Brak frameworka testowego (CLAUDE.md) — `detectPhoneInsteadOfVisit` to czysta funkcja, testowana przez `scripts/verify-report-detection.mjs` (Faza 3), tak jak pozostałe dwie reguły.

### Integration Tests:

`scripts/verify-report-detection.mjs` — jedyny automatyczny dowód poprawności wszystkich trzech reguł detekcji łącznie.

### Manual Testing Steps:

1. Zalogować się jako testowy kierownik, wgrać rozszerzony `test-data/sample-report.csv`.
2. Potwierdzić, że aktywność `typ_aktywnosci=telefon` z włączonym GPS pokazuje `phone_instead_of_visit` bez `missing_gps`.
3. Potwierdzić, że pusty `typ_aktywnosci` z wyłączonym GPS i zerowym czasem pokazuje OBIE reguły naraz.
4. Potwierdzić, że pusty `typ_aktywnosci` z włączonym GPS NIE pokazuje `phone_instead_of_visit`.
5. Potwierdzić, że pusty `typ_aktywnosci` z wyłączonym GPS, ale dłuższym czasem, pokazuje tylko `missing_gps`.
6. Powtórzyć dla `test-data/sample-report.xlsx`, potwierdzić identyczny wynik.

## Performance Considerations

Brak wpływu — funkcja per-wizyta, stała liczba porównań tekstowych i liczbowych na wiersz, ta sama złożoność co istniejące `detectMissingGps`.

## Migration Notes

Brak — ten plan nie zmienia schematu bazy; wszystkie potrzebne kolumny już istnieją z S-01 (`activity_type`, `gps_enabled`, `time_on_site_minutes`) i S-02 (`deviations.detail`).

## References

- `context/foundation/prd.md` (v2) — FR-010, US-01
- `context/foundation/roadmap.md` — S-03 (ten change), Prerequisites: F-01, S-01
- GitHub issue #4 — potwierdza dwie luki (granularność "braku pola", próg czasu) rozstrzygnięte w wywiadzie
- `context/archive/2026-09-29-route-deviation-detection/plan.md` — wzorzec reguły z `detail` i integracji w `upload.ts`, rozszerzany w tym planie
- `src/lib/services/deviation-rules.ts`, `src/pages/api/reports/upload.ts` — moduły rozszerzane
- `src/lib/services/report-parser.ts` — źródło `activity_type`/`gps_enabled`/`time_on_site_minutes` (bez zmian)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Rdzeń logiki — reguła detekcji telefonu

#### Automated

- [x] 1.1 `npm run lint` przechodzi — f585e25
- [x] 1.2 `npx astro check` przechodzi — f585e25

#### Manual

- [x] 1.3 Ręczny przegląd `detectPhoneInsteadOfVisit` potwierdza trzy gałęzie logiki z wywiadu — f585e25

### Phase 2: Integracja z endpointem uploadu

#### Automated

- [x] 2.1 `npm run lint` przechodzi — d40d395
- [x] 2.2 `npx astro check` przechodzi — d40d395

#### Manual

- [x] 2.3 Aktywność `telefon` z GPS włączonym daje `phone_instead_of_visit` bez `missing_gps` — d40d395
- [x] 2.4 Pusty typ z wyłączonym GPS i zerowym czasem daje obie reguły naraz — d40d395
- [x] 2.5 Pusty typ z wyłączonym GPS i dłuższym czasem daje tylko `missing_gps` — d40d395

### Phase 3: Fixture testowy i rozszerzenie skryptu weryfikacji

#### Automated

- [x] 3.1 `npm run verify:report-detection` kończy się kodem 0 — 65f36c9

#### Manual

- [x] 3.2 Log skryptu pokazuje jawne asercje dla wszystkich sześciu nowych przypadków, dla obu formatów — 65f36c9
