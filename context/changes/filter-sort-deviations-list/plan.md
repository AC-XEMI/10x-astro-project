# Filtrowanie i sortowanie listy odstępstw — Implementation Plan

## Overview

Dodajemy filtrowanie i sortowanie do listy odstępstw w widoku pojedynczego raportu (`/reports/[id]`), zgodnie z FR-007 (PRD, Priority: nice-to-have). Kierownik będzie mógł zawęzić listę wg przedstawiciela, zakresu dat, reguły odstępstwa i statusu przeglądu, oraz przełączyć sortowanie między datą wizyty a nazwiskiem przedstawiciela.

## Current State Analysis

- Lista odstępstw istnieje wyłącznie **per-raport**, renderowana przez `src/components/reports/DeviationsList.tsx` (`src/pages/reports/[id].astro:37`). Nie ma żadnego globalnego widoku odstępstw ze wszystkich raportów.
- `src/pages/reports/[id].astro:16-19` pobiera server-side WSZYSTKIE wizyty danego raportu jednym zapytaniem (`select("*, deviations(*)")`), bez parametrów filtra/sortu. Cała lista trafia do komponentu klienckiego na starcie.
- `DeviationsList.tsx:18` dziś robi tylko `visits.filter((visit) => visit.deviations.length > 0)` — ukrywa wizyty bez odstępstw. Brak jakiejkolwiek logiki filtra/sortu ponad to.
- Komponent trzyma stan w pamięci (`useState`) dla `visits`, `expandedIds`, `pendingIds` — wzorzec czysto klienckiego stanu, bez synchronizacji z URL. Ten sam wzorzec przyjmujemy dla stanu filtra/sortu.
- Model danych (`src/types.ts:37-160`): `deviations.rule` (enum `missing_gps | route_deviation | phone_instead_of_visit`), `deviations.status` (enum `unreviewed | reviewed`), `visits.representative_name` (string), `visits.visit_date` (string, format daty). Jedna wizyta może mieć **wiele** powiązanych odstępstw (`visit.deviations: Tables<"deviations">[]`).
- Brak zainstalowanych komponentów shadcn poza `button`, `dialog`, `table` (`src/components/ui/`). Istniejący wzorzec dla natywnych kontrolek formularza to stylowany bezpośrednio Tailwindem `<input>` (`src/pages/reports/index.astro:48-54`) — nie każdy input idzie przez shadcn.
- `deviation.rule` jest dziś renderowane jako surowa wartość enuma (`DeviationsList.tsx:105,162`), bez tłumaczenia na polski — ten plan **nie** zmienia istniejącego renderowania wiersza/szczegółów, dodaje polskie etykiety wyłącznie w nowych kontrolkach filtra (Faza 2).

### Key Discoveries:

- Brak backendu do zaprojektowania — cała funkcja mieści się w jednym komponencie klienckim operującym na już pobranych danych (`DeviationsList.tsx`).
- Wizyta z wieloma odstępstwami o różnych `rule`/`status` wymaga precyzyjnej semantyki filtra (patrz "Implementation Approach").

## Desired End State

Kierownik otwiera `/reports/[id]` i nad tabelą odstępstw widzi panel filtra (przedstawiciel, zakres dat, reguła, status) oraz przełącznik sortu. Zmiana dowolnego filtra natychmiast (bez przeładowania strony) zawęża widoczne wiersze; zmiana sortu natychmiast przestawia ich kolejność. Gdy filtr nie pasuje do żadnej wizyty, widoczny jest komunikat odróżnialny od "brak odstępstw w raporcie", z przyciskiem czyszczącym filtry. Odświeżenie strony resetuje filtr/sort do stanu domyślnego (sort: data malejąco, brak aktywnych filtrów).

Weryfikacja: ręczne przejście przez kombinacje filtrów opisane w Testing Strategy, na raporcie testowym z wizytami o różnych przedstawicielach, datach, regułach i statusach (w tym wizytą z wieloma odstępstwami o różnych regule/statusie).

## What We're NOT Doing

- Globalny widok odstępstw ze wszystkich raportów (poza zakresem FR-007 w tej iteracji — patrz decyzja "Scope" w `plan-brief.md`).
- Trwałość filtra/sortu w URL lub localStorage — stan żyje wyłącznie w React, resetuje się przy przeładowaniu.
- Tłumaczenie `deviation.rule` na polski w istniejącym renderze wiersza/szczegółów wizyty — etykiety PL dodajemy tylko w kontrolkach filtra.
- Nowe API route lub zmiana zapytania server-side w `[id].astro` — filtr/sort jest czysto kliencki.
- Zmiana logiki/API `updateDeviationStatus` (oznaczanie jako sprawdzone) — pozostaje bez zmian, działa na `visits`, nie na przefiltrowanej liście.

## Implementation Approach

Cała logika filtra/sortu żyje jako pochodny stan (`derived state`) w `DeviationsList.tsx`, obliczany z `visits` + stanu filtrów przy każdym renderze (bez memoizacji — lista pojedynczego raportu jest mała, zgodnie z Baseline roadmapy).

Semantyka łączenia filtrów (zob. decyzje w `plan-brief.md`):

- `representative_name` i `visit_date` to pola **na poziomie wizyty** — wizyta musi spełniać oba (jeśli aktywne), niezależnie od odstępstw.
- `rule` i `status` to pola **na poziomie odstępstwa** — gdy którykolwiek z nich jest aktywny, wizyta jest widoczna tylko jeśli **istnieje odstępstwo tej wizyty, które jednocześnie** spełnia aktywny filtr reguły (jeśli ustawiony) ORAZ aktywny filtr statusu (jeśli ustawiony). To samo odstępstwo musi spełniać oba warunki — to zapobiega myleniu "wizyta ma gdzieś brak GPS" + "wizyta ma gdzieś coś nieprzejrzanego" z "wizyta ma nieprzejrzany brak GPS".
- W obrębie `rule` i `status` filtr jest multi-select (OR) — zaznaczenie kilku wartości reguły pokazuje wizyty z odstępstwem pasującym do KTÓREJKOLWIEK zaznaczonej reguły (w połączeniu z powyższym warunkiem AND między regułą a statusem).
- Pusty wybór w danym wymiarze = filtr nieaktywny (nie zawęża).

Sortowanie: dwa tryby, `date_desc` (domyślny, `visit_date` malejąco) i `representative_asc` (`representative_name` rosnąco, localeCompare). Sortowanie działa na już przefiltrowanej liście.

## Phase 1: Filtrowanie i sortowanie — logika i stan

### Overview

Dodajemy stan filtra/sortu, funkcję filtrującą/sortującą i minimalne, funkcjonalne (ale jeszcze niewypolerowane wizualnie) kontrolki — żeby logikę dało się ręcznie zweryfikować w przeglądarce przed dopracowaniem UI w Fazie 2.

### Changes Required:

#### 1. Stan i logika filtra/sortu

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Dodać stan filtrów (`selectedReps: Set<string>`, `dateFrom: string | null`, `dateTo: string | null`, `selectedRules: Set<DeviationRule>`, `selectedStatuses: Set<DeviationStatus>`, `sortMode: "date_desc" | "representative_asc"`) oraz funkcję wyprowadzającą `visibleVisits` z `flaggedVisits` zgodnie z semantyką opisaną w "Implementation Approach". Zastąpić bezpośrednie użycie `flaggedVisits` w renderze przez `visibleVisits`.

**Contract**: Nowa czysta funkcja filtrująco-sortująca przyjmuje `flaggedVisits` + obiekt stanu filtrów/sortu i zwraca nową tablicę `VisitWithDeviations[]`. Podpis orientacyjny: `getVisibleVisits(visits: VisitWithDeviations[], filters: FilterState, sortMode: SortMode): VisitWithDeviations[]`. Warunek na poziomie odstępstwa (rule+status AND na tym samym rekordzie):

```ts
const deviationMatches = (d: Tables<"deviations">) =>
  (filters.selectedRules.size === 0 || filters.selectedRules.has(d.rule)) &&
  (filters.selectedStatuses.size === 0 || filters.selectedStatuses.has(d.status));

const visitMatches = (v: VisitWithDeviations) =>
  (filters.selectedReps.size === 0 || filters.selectedReps.has(v.representative_name)) &&
  (!filters.dateFrom || v.visit_date >= filters.dateFrom) &&
  (!filters.dateTo || v.visit_date <= filters.dateTo) &&
  (filters.selectedRules.size === 0 && filters.selectedStatuses.size === 0
    ? true
    : v.deviations.some(deviationMatches));
```

Lista unikalnych przedstawicieli do wyboru w filtrze pochodzi z `flaggedVisits` (nie z całego `visits`) — wyliczona raz na render przez `[...new Set(flaggedVisits.map((v) => v.representative_name))]`.

#### 2. Minimalne kontrolki filtra/sortu i stan pustego wyniku

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Dodać nad `<Table>` minimalny, funkcjonalny panel: checkboxy dla reguł (3 wartości) i statusów (2 wartości), natywny multi-select lub lista checkboxów dla przedstawicieli, dwa pola `<input type="date">` (od/do), przycisk przełączający `sortMode`. Gdy `flaggedVisits.length > 0 && visibleVisits.length === 0`, pokazać komunikat "Brak odstępstw pasujących do filtra" + przycisk "Wyczyść filtry" (resetuje cały stan filtrów do wartości domyślnych) zamiast tabeli. Istniejący komunikat `flaggedVisits.length === 0` ("Brak wykrytych odstępstw w tym raporcie") zostaje bez zmian.

**Contract**: Brak nowych propsów komponentu — `Props` zostaje `{ visits: VisitWithDeviations[] }`. Stylowanie w tej fazie jest minimalne (podstawowe odstępy Tailwind), pełne dopasowanie do ciemnego motywu i polskie etykiety reguł — w Fazie 2.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Type-check przechodzi: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Na raporcie testowym z co najmniej: dwoma przedstawicielami, wizytami w różnych datach, wizytami z każdą z 3 reguł, wizytami sprawdzonymi i nieprzejrzanymi, oraz **jedną wizytą z dwoma odstępstwami o różnych regule/statusie** — każdy filtr z osobna zawęża listę do oczekiwanych wizyt.
- Filtr reguła+status jednocześnie: wizyta z odstępstwem A (reguła=brak GPS, status=sprawdzone) i odstępstwem B (reguła=telefon, status=nieprzejrzane) **nie** pojawia się przy filtrze reguła=brak GPS ORAZ status=nieprzejrzane (żadne pojedyncze odstępstwo nie spełnia obu naraz).
- Multi-select w obrębie reguły (zaznaczenie 2 z 3 reguł) pokazuje wizyty pasujące do KTÓREJKOLWIEK zaznaczonej reguły.
- Przełącznik sortu poprawnie zmienia kolejność wierszy (data malejąco ↔ przedstawiciel A-Z).
- Ustawienie filtra, który nie pasuje do żadnej wizyty, pokazuje komunikat "Brak odstępstw pasujących do filtra" z przyciskiem "Wyczyść filtry"; kliknięcie przycisku przywraca pełną listę.
- Raport bez żadnych odstępstw nadal pokazuje oryginalny komunikat "Brak wykrytych odstępstw w tym raporcie" (niezmieniony).
- Istniejące funkcje (rozwijanie wiersza, oznaczanie odstępstwa/wizyty jako sprawdzone/nieprzejrzane) działają bez regresji na przefiltrowanej liście.
- Odświeżenie strony resetuje filtr/sort do stanu domyślnego.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Kontrolki UI filtra/sortu — stylowanie i etykiety

### Overview

Dopracowujemy wizualnie panel filtra/sortu z Fazy 1: spójność z ciemnym motywem aplikacji, polskie etykiety dla reguł/statusów w kontrolkach filtra, czytelny layout.

### Changes Required:

#### 1. Stylowanie panelu filtra i polskie etykiety

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Zastąpić surowe kontrolki z Fazy 1 wersją stylowaną spójnie z resztą aplikacji (motyw `bg-white/10`, `backdrop-blur`, `text-blue-100/80` używany w `reports/[id].astro` i `reports/index.astro`). Dodać mapowanie `DeviationRule -> polska etykieta` (np. `missing_gps` → "Brak GPS", `route_deviation` → "Nieoptymalna trasa", `phone_instead_of_visit` → "Telefon zamiast wizyty") i `DeviationStatus -> polska etykieta` (`unreviewed` → "Nieprzejrzane", `reviewed` → "Sprawdzone"), używane WYŁĄCZNIE jako etykiety opcji filtra — nie zmieniać istniejącego renderowania `deviation.rule` w wierszu/szczegółach.

**Contract**: Czysto wizualna zmiana + dwie nowe stałe mapujące (`RULE_LABELS`, `STATUS_LABELS: Record<enum, string>`) lokalne w pliku komponentu. Układ panelu filtra: pozioma grupa kontrolek nad tabelą, zawijająca się (`flex-wrap`) na wąskich ekranach.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Panel filtra wizualnie spójny z resztą strony (ciemny motyw, zaokrąglenia, odstępy) w przeglądarce.
- Etykiety reguł/statusów w filtrze są po polsku i czytelne.
- Panel filtra nie łamie układu na wąskim viewport (np. 375px) — kontrolki zawijają się, nie wychodzą poza kontener.
- Kliknięcie w kontrolkę filtra nie wywołuje przypadkowo `toggleExpanded` wiersza (brak konfliktu z `onClick` na `<TableRow>`).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

Brak frameworka testowego w repo (patrz CLAUDE.md — "No test framework is configured"). Weryfikacja wyłącznie przez Automated/Manual Verification per fazę powyżej.

### Integration Tests:

N/A — brak frameworka; `npm run smoke` nie pokrywa UI listy odstępstw.

### Manual Testing Steps:

1. Wgraj testowy raport z wizytami pokrywającymi: ≥2 przedstawicieli, rozstrzelone daty, wszystkie 3 reguły, oba statusy, i jedną wizytą z dwoma odstępstwami o różnej regule/statusie.
2. Przejdź przez każdy filtr osobno i w kombinacji (reguła+status na tej samej vs różnych odstępstwach tej samej wizyty).
3. Przełącz sort, sprawdź kolejność.
4. Ustaw filtr dający zero wyników, sprawdź komunikat i przycisk czyszczący.
5. Sprawdź regresję: rozwijanie wiersza, oznaczanie jako sprawdzone/nieprzejrzane (pojedynczo i zbiorczo) na przefiltrowanej liście.
6. Odśwież stronę, potwierdź reset filtra/sortu.

## Performance Considerations

Brak — lista per-raport jest mała (dane wgrywane ręcznie przez jednego kierownika), filtrowanie/sortowanie w pamięci przy każdym renderze jest wystarczające (zgodnie z Baseline roadmapy, bez paginacji po stronie serwera).

## Migration Notes

Brak zmian w schemacie bazy ani w danych — funkcja czysto kliencka na istniejących polach.

## References

- Roadmap: `context/foundation/roadmap.md` — S-06 (milestone M-2)
- PRD: `context/foundation/prd.md` — FR-007
- Wzorzec stanu klienckiego: `src/components/reports/DeviationsList.tsx` (istniejące `expandedIds`/`pendingIds`)
- Wzorzec natywnego inputu stylowanego Tailwindem: `src/pages/reports/index.astro:48-54`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Filtrowanie i sortowanie — logika i stan

#### Automated

- [x] 1.1 Lint przechodzi
- [x] 1.2 Type-check przechodzi
- [x] 1.3 Build przechodzi

#### Manual

- [x] 1.4 Każdy filtr z osobna zawęża listę do oczekiwanych wizyt
- [x] 1.5 Filtr reguła+status wymaga tego samego odstępstwa (wizyta z rozdzielonymi dopasowaniami nie pojawia się)
- [x] 1.6 Multi-select w obrębie reguły działa jako OR
- [x] 1.7 Przełącznik sortu poprawnie zmienia kolejność
- [x] 1.8 Pusty wynik filtra pokazuje komunikat + przycisk "Wyczyść filtry", działający poprawnie
- [x] 1.9 Raport bez odstępstw nadal pokazuje oryginalny komunikat (niezmieniony)
- [x] 1.10 Rozwijanie wiersza i oznaczanie jako sprawdzone/nieprzejrzane działają bez regresji na przefiltrowanej liście
- [x] 1.11 Odświeżenie strony resetuje filtr/sort

### Phase 2: Kontrolki UI filtra/sortu — stylowanie i etykiety

#### Automated

- [ ] 2.1 Lint przechodzi
- [ ] 2.2 Build przechodzi

#### Manual

- [ ] 2.3 Panel filtra wizualnie spójny z ciemnym motywem aplikacji
- [ ] 2.4 Etykiety reguł/statusów są po polsku i czytelne
- [ ] 2.5 Panel filtra nie łamie układu na wąskim viewport
- [ ] 2.6 Kontrolki filtra nie wywołują przypadkowego rozwinięcia wiersza
