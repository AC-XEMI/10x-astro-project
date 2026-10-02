# Eksport listy odstępstw do pliku — Implementation Plan

## Overview

Dodajemy eksport listy odstępstw do pliku (CSV lub XLS) z widoku pojedynczego raportu (`/reports/[id]`), zgodnie z FR-008 (PRD, Priority: nice-to-have). Eksport działa na **bieżącym widoku** — dokładnie na tym, co kierownik aktualnie widzi po zastosowaniu filtrów, sortowania i przełącznika "Wyświetl odstępstwa" z S-06. Format wybiera się z dropdownu "Eksportuj".

## Current State Analysis

- `DeviationsList.tsx` ma już cały stan potrzebny eksportowi: `filters` (reguła/status/przedstawiciel/zakres dat), `sortMode`, `showOnlyDeviations`, oraz wyprowadzoną listę `visibleVisits` (`DeviationsList.tsx:257`) — dokładnie to, co jest renderowane w tabeli.
- Brak jakiejkolwiek logiki eksportu/CSV/pobierania pliku w repo — potwierdzone w baseline roadmapy (S-07) i brak zmiany od tego czasu.
- `xlsx` (`npm:@e965/xlsx@^0.20.3`) jest zależnością, dotąd używaną wyłącznie server-side do parsowania uploadu (`src/lib/services/report-parser.ts`, `import * as XLSX from "xlsx"`). Ten plan reużywa tę samą bibliotekę po stronie klienta do zapisu XLS — użytkownik jawnie poprosił o format XLS obok CSV podczas weryfikacji manualnej, więc korzyść (prawdziwy plik Excela, nie tylko workaround) przeważa koszt dodania `xlsx` do bundla klienckiego.
- Dane są po polsku, docelowo otwierane w polskim Excelu — przecinek jako separator kolumn CSV koliduje z przecinkiem jako separatorem dziesiętnym w polskim locale Excela, więc domyślny `,` zepsułby wygląd pliku CSV przy otwarciu (nie dotyczy formatu XLS, który ma natywne kolumny).
- `[id].astro` (`src/pages/reports/[id].astro`) ma dostęp do `id` raportu (`Astro.params.id`) już dziś, ale nie przekazuje go do `DeviationsList` — komponent dostaje tylko `visits`.
- Wizyta może mieć wiele odstępstw (`visit.deviations: Tables<"deviations">[]`) lub zero (gdy `showOnlyDeviations` jest wyłączony — patrz S-06).

### Key Discoveries:

- Cała logika eksportu mieści się w tym samym komponencie klienckim, operując na już obliczonym `visibleVisits` — zero nowego zapytania do bazy, zero nowego API route.
- Granularność "jeden wiersz na odstępstwo" wymaga jawnej decyzji dla wizyt bez odstępstw (możliwe tylko gdy `showOnlyDeviations` jest wyłączony) — patrz "Implementation Approach".
- CSV i XLS mogą współdzielić tę samą tablicę wierszy (`string[][]`) — tylko ostatni krok (serializacja do tekstu CSV vs. do binarnego skoroszytu) różni się między formatami.

## Desired End State

Kierownik klika dropdown "Eksportuj" w drugim wierszu paska filtrów (pod kontrolkami filtra, razem z "Sortuj" i "Wyczyść filtry") i wybiera CSV albo XLS. Otrzymuje plik `odstepstwa-raport-<id_raportu>.csv` lub `.xlsx` zawierający dokładnie te wizyty/odstępstwa, które są aktualnie widoczne w tabeli (po filtrach, sorcie i przełączniku "Wyświetl odstępstwa"), z pełnym zestawem kolumn (więcej niż widać na ekranie). Plik CSV otwiera się poprawnie w polskim Excelu (separator `;`, poprawne polskie znaki); plik XLS otwiera się jako natywny skoroszyt z tymi samymi danymi w kolumnach.

Weryfikacja: eksport w obu formatach przy różnych kombinacjach filtra/sortu/toggle, otwarcie plików w arkuszu kalkulacyjnym, sprawdzenie zawartości wiersz po wierszu.

## What We're NOT Doing

- Eksport pełnej listy niezależnie od filtrów — eksportujemy wyłącznie bieżący widok (decyzja z interview).
- Nowe API route lub przetwarzanie po stronie serwera — eksport jest czysto kliencki (Blob + download), tak jak filtr/sort z S-06.
- Zmiana logiki filtrowania/sortowania/`showOnlyDeviations` z S-06 — eksport tylko czyta `visibleVisits`, nic nie zmienia w tej logice.
- Zapamiętywanie ostatnio wybranego formatu eksportu — dropdown zawsze pokazuje oba formaty, bez domyślnego "ostatnio użytego".
- Formaty inne niż CSV/XLS (np. PDF) — poza zakresem FR-008.

## Implementation Approach

Budowanie wierszy eksportu to jedna czysta funkcja `buildExportRows(visits: VisitWithDeviations[]): string[][]`, współdzielona przez oba formaty. Dwie dalsze funkcje serializują te same wiersze do docelowego formatu: `buildCsv(rows): string` (tekst CSV z separatorem `;` i BOM) i `buildXlsx(rows): ArrayBuffer` (skoroszyt przez `XLSX.utils.aoa_to_sheet` + `XLSX.write`, reużywając bibliotekę `xlsx` już obecną w projekcie). Wywoływane dopiero w momencie wyboru formatu w dropdownie (nie przeliczane na każdy render).

**Granularność wierszy** (decyzja z interview): jeden wiersz na odstępstwo. Dla wizyty z N odstępstwami — N wierszy, każdy z tymi samymi danymi wizyty i jednym odstępstwem. Dla wizyty z **zero** odstępstw (możliwe tylko gdy `showOnlyDeviations` jest wyłączony, więc taka wizyta jest częścią bieżącego widoku) — **jeden** wiersz z danymi wizyty i pustymi kolumnami Reguła/Status/Szczegół (`—`), żeby żadna widoczna na ekranie wizyta nie zniknęła bezśladowo z eksportu. Dotyczy obu formatów jednakowo.

**Kolumny** (decyzja z interview, pełny zestaw — więcej niż na ekranie): Przedstawiciel, Data wizyty, Reguła, Status, Szczegół, GPS włączony, Typ aktywności, Dystans (km), Czas na miejscu (min). Wartości tekstowe (Reguła, Status, Typ aktywności, GPS) używają tych samych etykiet PL co UI (`RULE_LABELS`, `STATUS_LABELS`, `formatActivityType`, `TAK`/`NIE`) — spójność z tym, co kierownik już widzi na ekranie.

**Format CSV**: separator `;` (nie `,` — polski Excel używa przecinka jako separatora dziesiętnego), z BOM (`String.fromCharCode(0xfeff)` — **nie literalny znak BOM w kodzie źródłowym**, bo to wywołuje regułę lint `no-irregular-whitespace`) na początku pliku dla poprawnego rozpoznania UTF-8 przez Excela. Pola zawierające `;`, cudzysłów lub znak nowej linii są cytowane w podwójnym cudzysłowie, z podwojeniem wewnętrznych cudzysłowów (standardowe escapowanie CSV).

**Format XLS**: `XLSX.utils.aoa_to_sheet(rows)` → `XLSX.utils.book_new()` + `XLSX.utils.book_append_sheet()` → `XLSX.write(workbook, { type: "array", bookType: "xlsx" })`, wynik opakowany w `Blob` z typem `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

**Wybór formatu**: dropdown "Eksportuj" (wzorowany na `MultiSelectDropdown` z S-06, ale jako jednorazowe menu akcji — kliknięcie opcji od razu wykonuje eksport i zamyka menu, bez trwałego zaznaczenia) z dwiema opcjami: CSV, XLS.

**Nazwa pliku**: `odstepstwa-raport-<reportId>.csv` lub `.xlsx` zależnie od wybranego formatu, gdzie `reportId` to nowy prop przekazywany z `[id].astro` (już ma dostęp do `id` w `Astro.params.id` — żadne nowe zapytanie do bazy).

**Pobranie pliku**: `Blob` + tymczasowy `<a download>` + `URL.createObjectURL`/`revokeObjectURL` — standardowy wzorzec przeglądarkowy, współdzielony przez oba formaty.

**Layout paska filtrów**: pasek dzieli się na dwa wiersze (`<div className="space-y-2">` z dwoma wewnętrznymi `flex flex-wrap` kontenerami) — pierwszy wiersz z kontrolkami filtra (checkbox "Wyświetl odstępstwa", dropdowny Reguła/Status/Przedstawiciel, pola dat), drugi wiersz z akcjami (Sortuj, Wyczyść filtry, Eksportuj) — zamiast jednego wspólnego kontenera, żeby akcje zawsze były wizualnie oddzielone od filtrów, niezależnie od szerokości ekranu.

## Phase 1: Eksport bieżącego widoku do pliku (CSV/XLS)

### Overview

Dodajemy funkcję budującą wiersze eksportu z `visibleVisits`, dwie funkcje serializujące (CSV, XLS), dropdown "Eksportuj" z wyborem formatu w drugim wierszu paska filtrów (razem z "Sortuj"/"Wyczyść filtry") i mechanizm pobrania pliku. Nowy prop `reportId` na `DeviationsList`, przekazywany z `[id].astro`.

### Changes Required:

#### 1. Prop `reportId` i funkcje budujące eksport

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Rozszerzyć `Props` o `reportId: string`. Dodać `import * as XLSX from "xlsx"` (ten sam pakiet co w `report-parser.ts`). Dodać czystą funkcję `buildExportRows(visits: VisitWithDeviations[]): string[][]`, która dla każdej wizyty emituje jeden wiersz na odstępstwo (lub jeden pusty wiersz, gdy wizyta nie ma odstępstw), z pełnym zestawem kolumn opisanym w "Implementation Approach". Dodać `buildCsv(rows: string[][]): string` i `buildXlsx(rows: string[][]): ArrayBuffer`, obie operujące na wyniku `buildExportRows`.

**Contract**: `Props` zyskuje pole `reportId: string`. Funkcje i helper do escapowania pola CSV są lokalne w pliku komponentu, obok istniejących `toDateOnly`/`formatActivityType`. Funkcja escapująca pole CSV:

```ts
function csvField(value: string) {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
```

BOM dla CSV budowany przez `String.fromCharCode(0xfeff)`, nie literalny znak w źródle (patrz lekcja o `no-irregular-whitespace` w Implementation Approach).

#### 2. Dropdown "Eksportuj" i pobranie pliku

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Dodać komponent `ExportMenu` — zamknięty domyślnie dropdown (wzorowany na `MultiSelectDropdown`, ten sam styl ciemnego motywu), ale jako jednorazowe menu akcji: kliknięcie opcji ("CSV" / "XLS") od razu wywołuje eksport w tym formacie i zamyka menu (bez trwałego zaznaczenia jak w filtrach). Wyłączony (`disabled`), gdy `visibleVisits.length === 0` (nic do eksportu). Funkcja `exportList(format: "csv" | "xlsx")` buduje wiersze przez `buildExportRows(visibleVisits)`, serializuje odpowiednią funkcją, tworzy `Blob` z właściwym typem MIME, pobiera przez tymczasowy `<a download="odstepstwa-raport-<reportId>.<rozszerzenie>">`, zwalnia `URL.createObjectURL` po kliknięciu.

**Contract**: Jedyna nowa zależność to już obecny w projekcie pakiet `xlsx` (brak nowych pakietów npm). Brak zmian w logice filtrowania/sortowania/`showOnlyDeviations`.

#### 3. Dwuwierszowy layout paska filtrów

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Rozdzielić dotychczasowy jeden `flex flex-wrap` kontener paska filtrów na dwa wiersze: pierwszy z kontrolkami filtra (checkbox, 3× dropdown, 2× pole daty), drugi z akcjami ("Sortuj", warunkowo "Wyczyść filtry", "Eksportuj"). Oba wiersze we wspólnym kontenerze z pionowym odstępem.

**Contract**: Czysto wizualna/strukturalna zmiana JSX — żadna logika się nie zmienia, tylko pogrupowanie istniejących elementów w dwa `<div className="flex flex-wrap items-center gap-3">` zamiast jednego.

#### 4. Przekazanie `reportId` z poziomu strony

**File**: `src/pages/reports/[id].astro`

**Intent**: Przekazać istniejące `Astro.params.id` jako prop `reportId` do `<DeviationsList>`.

**Contract**: `<DeviationsList visits={visits} reportId={id ?? ""} client:load />` — `id` już istnieje w zakresie frontmatter tej strony, żadne nowe zapytanie.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Type-check przechodzi: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Eksport CSV przy braku aktywnych filtrów (pełna widoczna lista, `showOnlyDeviations` włączony) daje plik z jednym wierszem na każde odstępstwo; wizyta z 2 odstępstwami daje 2 wiersze z tymi samymi danymi wizyty.
- Eksport XLS przy tych samych warunkach daje ten sam zestaw wierszy co CSV, w natywnym skoroszycie.
- Eksport (oba formaty) z aktywnymi filtrami (np. reguła=brak GPS) zawiera tylko wiersze pasujące do bieżącego widoku.
- Eksport (oba formaty) z wyłączonym `showOnlyDeviations` zawiera dla wizyty bez odstępstw jeden wiersz z pustymi kolumnami Reguła/Status/Szczegół.
- Plik CSV otwiera się poprawnie w arkuszu kalkulacyjnym (separator `;`, nie w jednej komórce; polskie znaki poprawne, nie krzaki).
- Plik XLS otwiera się poprawnie jako skoroszyt (kolumny natywnie rozdzielone, polskie znaki poprawne).
- Nazwa pobranego pliku to `odstepstwa-raport-<id_raportu>.csv` lub `.xlsx` zależnie od wybranego formatu.
- Dropdown "Eksportuj" jest wyłączony (`disabled`), gdy bieżący widok jest pusty.
- Wybór formatu w dropdownie zamyka menu i nie wymaga dodatkowego potwierdzenia.
- Pasek filtrów ma dwa wizualnie oddzielone wiersze: filtry w pierwszym, "Sortuj"/"Wyczyść filtry"/"Eksportuj" w drugim — spójny ciemny styl w obu wierszach.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

Brak frameworka testowego w repo (patrz CLAUDE.md — "No test framework is configured"). Weryfikacja wyłącznie przez Automated/Manual Verification powyżej.

### Integration Tests:

N/A — brak frameworka; `npm run smoke` nie pokrywa eksportu.

### Manual Testing Steps:

1. Na raporcie z wizytami mającymi różną liczbę odstępstw (0, 1, 2+) wyeksportuj CSV przy domyślnych ustawieniach (toggle włączony, brak filtrów) — sprawdź liczbę wierszy i ich zawartość.
2. Powtórz to samo dla formatu XLS — porównaj zawartość z eksportem CSV.
3. Ustaw filtr (np. status=nieprzejrzane) i wyeksportuj (dowolny format) — sprawdź, że plik zawiera tylko to, co jest widoczne w tabeli.
4. Wyłącz "Wyświetl odstępstwa" i wyeksportuj — sprawdź, że wizyty bez odstępstw mają jeden wiersz z pustymi kolumnami odstępstwa.
5. Otwórz oba wyeksportowane pliki w Excelu/LibreOffice/Google Sheets — sprawdź separator/kolumny i polskie znaki.
6. Sprawdź nazwę pobranego pliku dla obu formatów.
7. Ustaw filtr dający zero wyników — sprawdź, że dropdown eksportu jest wyłączony.
8. Sprawdź wizualnie dwuwierszowy układ paska filtrów na pełnej szerokości i na wąskim viewport.

## Performance Considerations

Brak — lista per-raport jest mała (dane wgrywane ręcznie przez jednego kierownika), budowanie eksportu w pamięci przy kliknięciu jest wystarczające dla obu formatów.

## Migration Notes

Brak zmian w schemacie bazy ani w danych — funkcja czysto kliencka na istniejących polach.

## References

- Roadmap: `context/foundation/roadmap.md` — S-07 (milestone M-2)
- PRD: `context/foundation/prd.md` — FR-008
- Stan filtra/sortu/toggle do eksportu: `src/components/reports/DeviationsList.tsx:257` (`visibleVisits`)
- Wzorzec dropdownu filtra (bazowy dla `ExportMenu`): `src/components/reports/DeviationsList.tsx` (`MultiSelectDropdown`, S-06)
- Istniejące użycie `xlsx` server-side: `src/lib/services/report-parser.ts`
- Istniejący dostęp do `id` raportu: `src/pages/reports/[id].astro` (`Astro.params.id`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Eksport bieżącego widoku do pliku (CSV/XLS)

#### Automated

- [x] 1.1 Lint przechodzi
- [x] 1.2 Type-check przechodzi
- [x] 1.3 Build przechodzi

#### Manual

- [x] 1.4 Eksport CSV bez filtrów: jeden wiersz na odstępstwo, wizyta z 2 odstępstwami daje 2 wiersze
- [x] 1.5 Eksport XLS przy tych samych warunkach daje ten sam zestaw wierszy co CSV
- [x] 1.6 Eksport (oba formaty) z aktywnym filtrem zawiera tylko wiersze z bieżącego widoku
- [x] 1.7 Eksport (oba formaty) z wyłączonym "Wyświetl odstępstwa": wizyta bez odstępstw ma jeden wiersz z pustymi kolumnami
- [x] 1.8 Plik CSV otwiera się poprawnie w arkuszu kalkulacyjnym (separator, polskie znaki)
- [x] 1.9 Plik XLS otwiera się poprawnie jako natywny skoroszyt
- [x] 1.10 Nazwa pliku poprawna dla obu formatów (odstepstwa-raport-<id_raportu>.csv / .xlsx)
- [x] 1.11 Dropdown eksportu wyłączony przy pustym bieżącym widoku
- [x] 1.12 Dwuwierszowy układ paska filtrów: filtry osobno, akcje (Sortuj/Wyczyść/Eksportuj) osobno, spójny styl
