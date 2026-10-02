# Eksport listy odstępstw do pliku — Plan Brief

> Full plan: `context/changes/export-deviations-list/plan.md`

## What & Why

PRD (FR-008, nice-to-have) chce, żeby kierownik mógł wyeksportować listę odstępstw do pliku. To S-07 z milestone'u M-2 roadmapy — ostatni element tej transzy, po S-06 (filtrowanie/sortowanie).

## Starting Point

`DeviationsList.tsx` ma już całą logikę filtra/sortu/toggle "Wyświetl odstępstwa" (S-06) i wyprowadzoną listę `visibleVisits` — dokładnie to, co jest renderowane w tabeli. Brak jakiejkolwiek logiki eksportu w repo.

## Desired End State

Kierownik klika dropdown "Eksportuj" w drugim wierszu paska filtrów (obok "Sortuj"/"Wyczyść filtry") i wybiera CSV albo XLS. Otrzymuje plik `odstepstwa-raport-<id>.csv`/`.xlsx` z dokładnie tym, co aktualnie widzi na ekranie (po filtrach/sorcie/toggle), z szerszym zestawem kolumn niż widok tabeli.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Zakres eksportu | Bieżący widok (po filtrach/sorcie/toggle) | Intuicyjne "eksportuj to, na co patrzę"; roadmapa jawnie flagowała tę decyzję jako otwartą | Plan |
| Granulacja wiersza | Jeden wiersz na odstępstwo | Każdy wiersz ma dokładnie jedną regułę/status — łatwe filtrowanie w Excelu | Plan |
| Wizyta bez odstępstw (toggle off) | Jeden wiersz, puste kolumny Reguła/Status/Szczegół | Żadna widoczna na ekranie wizyta nie znika bezśladowo z eksportu | Plan |
| Kolumny | Pełny zestaw (9 kolumn, więcej niż na ekranie) | Eksport ma sens tylko gdy daje więcej niż widok tabeli | Plan |
| Formaty | CSV i XLS, wybór z dropdownu "Eksportuj" | Użytkownik poprosił o oba podczas weryfikacji manualnej — jeden wiersz-builder, dwie serializacje | Plan (zmienione w trakcie Fazy 1) |
| Separator CSV | Średnik `;` + UTF-8 BOM (przez `String.fromCharCode`, nie literalny znak) | Przecinek w polskim Excelu to separator dziesiętny; literalny BOM w źródle łamie lint `no-irregular-whitespace` | Plan |
| Mechanizm zapisu XLS | Reużycie już obecnego pakietu `xlsx` (dziś tylko server-side) | Prawdziwy skoroszyt zamiast workaroundu; biblioteka już jest zależnością projektu | Plan |
| Nazwa pliku | `odstepstwa-raport-<reportId>.csv`/`.xlsx` | Unikalna per raport i format, bez kolizji przy kilku eksportach tego samego dnia | Plan |
| Layout paska filtrów | Dwa wiersze: filtry osobno, akcje (Sortuj/Wyczyść/Eksportuj) osobno | Akcje zawsze wizualnie oddzielone od filtrów, niezależnie od szerokości ekranu | Plan (zmienione w trakcie Fazy 1) |

## Scope

**In scope:**
- Funkcja budująca wiersze eksportu z `visibleVisits` (1 wiersz/odstępstwo, pełny zestaw kolumn), współdzielona przez oba formaty
- Serializacja do CSV (separator `;`, BOM) i do XLS (przez `xlsx`)
- Dropdown "Eksportuj" (CSV/XLS) w drugim wierszu paska filtrów, wyłączony przy pustym widoku
- Dwuwierszowy layout paska filtrów
- Pobranie pliku przez Blob + `<a download>`
- Nowy prop `reportId` na `DeviationsList`, przekazywany z `[id].astro`

**Out of scope:**
- Eksport pełnej listy niezależnie od filtrów
- Formaty inne niż CSV/XLS (np. PDF)
- Nowe API route / przetwarzanie server-side
- Zmiana logiki filtrowania/sortowania/toggle z S-06

## Architecture / Approach

Czysto kliencka zmiana w tym samym komponencie React. `buildExportRows()` to czysta funkcja budująca wspólne wiersze; `buildCsv()`/`buildXlsx()` serializują je do finalnego formatu. Wywoływane przy wyborze formatu w dropdownie (nie na każdy render) na już obliczonym `visibleVisits`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Eksport bieżącego widoku do pliku (CSV/XLS) | Działający eksport w obu formatach respektujący filtr/sort/toggle, dwuwierszowy layout | Niespójna granulacja dla wizyt bez odstępstw — rozwiązane przez jeden pusty wiersz zamiast pominięcia |

**Prerequisites:** F-01, S-01 (oba `done`), S-06 (filtrowanie/sortowanie, `done`, zarchiwizowane) — dostarcza stan `visibleVisits`/`showOnlyDeviations`, z którego ten plan korzysta.
**Estimated effort:** Mała zmiana jednokomponentowa, 1 faza.

## Open Risks & Assumptions

- Zakładamy, że polski Excel jest głównym celem otwierania pliku CSV — stąd separator `;` zamiast `,`. XLS nie ma tego problemu (natywne kolumny).
- Dodanie `xlsx` do bundla klienckiego (dotąd tylko server-side) zwiększa rozmiar JS wysyłanego do przeglądarki — zaakceptowane świadomie na żądanie użytkownika.
- Brak testów automatycznych poza lint/typecheck/build — brak frameworka testowego w repo.

## Success Criteria (Summary)

- Kierownik może wyeksportować dokładnie to, co widzi na ekranie (po filtrach/sorcie/toggle), do poprawnie sformatowanego pliku CSV albo XLS, wybierając format z dropdownu.
- Wizyty z wieloma odstępstwami i wizyty bez odstępstw są poprawnie reprezentowane w obu formatach, bez cichej utraty danych.
- Oba pliki otwierają się poprawnie w arkuszu kalkulacyjnym (separator/kolumny, kodowanie, polskie znaki).
- Pasek filtrów ma czytelny, dwuwierszowy układ: filtry osobno, akcje osobno.
