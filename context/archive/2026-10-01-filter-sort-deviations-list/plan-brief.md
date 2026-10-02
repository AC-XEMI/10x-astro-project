# Filtrowanie i sortowanie listy odstępstw — Plan Brief

> Full plan: `context/changes/filter-sort-deviations-list/plan.md`

## What & Why

PRD (FR-007, nice-to-have) chce, żeby kierownik mógł filtrować i sortować listę odstępstw zamiast przewijać ją ręcznie. To S-06 z milestone'u M-2 roadmapy — druga transza tego samego PRD, po zamknięciu MVP (M-1).

## Starting Point

Lista odstępstw istnieje dziś tylko per-raport (`/reports/[id]`, komponent `DeviationsList.tsx`), renderuje w pamięci wszystkie wizyty pobrane jednym zapytaniem server-side. Zero logiki filtra/sortu dziś istnieje — jedyna istniejąca operacja to ukrycie wizyt bez odstępstw.

## Desired End State

Nad tabelą odstępstw w `/reports/[id]` pojawia się panel filtra (przedstawiciel, zakres dat, reguła, status) i przełącznik sortu. Zmiany działają natychmiast, bez przeładowania strony. Pusty wynik filtra ma odrębny komunikat z przyciskiem czyszczącym.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Zakres | Per-raport, czysto klienckie | Lista jest już w pamięci komponentu, zero nowych tras/zapytań | Plan |
| Pola filtra | Przedstawiciel, data, reguła, status | Wszystkie 4 wybrane przez użytkownika (PRD podawał tylko przykłady) | Plan |
| Multi-select | Tak dla reguły i statusu | Naturalne dla enumów o 2-3 wartościach, pozwala na OR w obrębie wymiaru | Plan |
| Semantyka reguła+status | AND na TYM SAMYM odstępstwie | Zapobiega myleniu "wizyta ma gdzieś X" z "wizyta ma X i Y naraz" | Plan |
| Sort | Data malejąco (domyślnie) + przełącznik na przedstawiciela A-Z | Najnowsze odstępstwa zwykle najpilniejsze; PRD wymienia też sort wg przedstawiciela | Plan |
| Pusty wynik filtra | Odrębny komunikat + "Wyczyść filtry" | Odróżnia "filtr ukrył wszystko" od "raport jest czysty" | Plan |
| Trwałość stanu | Reset przy przeładowaniu (tylko React) | Spójne z istniejącym wzorcem (`expandedIds`, `pendingIds`) | Plan |
| Etykiety reguł w UI | Polskie etykiety tylko w kontrolkach filtra | Checkboxy potrzebują czytelnych nazw; nie zmieniamy istniejącego renderu wiersza | Plan |

## Scope

**In scope:**
- Stan filtra/sortu i logika filtrująco-sortująca w `DeviationsList.tsx`
- Kontrolki: checkboxy reguła/status (multi-select), wybór przedstawiciela, zakres dat, przełącznik sortu
- Komunikat + przycisk czyszczący przy pustym wyniku filtra
- Polskie etykiety reguł/statusów w nowych kontrolkach filtra

**Out of scope:**
- Globalny widok odstępstw ze wszystkich raportów
- Trwałość filtra w URL/localStorage
- Zmiana istniejącego renderowania `deviation.rule` w wierszu/szczegółach wizyty
- Nowe API route lub zmiana zapytania server-side w `[id].astro`
- Eksport listy (FR-008 — osobny slice S-07)

## Architecture / Approach

Czysto kliencka zmiana w jednym komponencie React. Stan filtra/sortu żyje w `useState`; funkcja czysta wyprowadza `visibleVisits` z `flaggedVisits` + stanu filtra przy każdym renderze (bez memoizacji — lista jest mała). Filtry `representative`/`date` działają na poziomie wizyty; `rule`/`status` wymagają istnienia JEDNEGO odstępstwa spełniającego oba naraz (gdy aktywne). Sort działa na przefiltrowanej liście.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Filtrowanie i sortowanie — logika i stan | Działająca logika filtra/sortu + minimalne funkcjonalne kontrolki | Semantyka AND reguła+status na tym samym odstępstwie — łatwo pomylić z niezależnym dopasowaniem |
| 2. Kontrolki UI filtra/sortu — stylowanie i etykiety | Wizualne dopracowanie panelu + polskie etykiety | Konflikt kliknięcia w kontrolkę filtra z `onClick` rozwijającym wiersz tabeli |

**Prerequisites:** F-01, S-01 (oba `done`, zarchiwizowane) — schemat danych i podstawowa lista odstępstw już istnieją.
**Estimated effort:** Mała zmiana jednokomponentowa, 2 fazy.

## Open Risks & Assumptions

- Zakładamy, że lista wizyt w pojedynczym raporcie jest na tyle mała, że filtrowanie/sortowanie bez memoizacji przy każdym renderze jest wystarczające (zgodne z Baseline roadmapy — brak paginacji server-side dla tego widoku).
- Zakładamy brak potrzeby testów automatycznych poza lint/typecheck/build — w repo nie ma skonfigurowanego frameworka testowego (CLAUDE.md).

## Success Criteria (Summary)

- Kierownik może zawęzić listę odstępstw wg przedstawiciela, daty, reguły i statusu, pojedynczo i w kombinacji, z poprawną semantyką dla wizyt z wieloma odstępstwami.
- Kierownik może przełączyć sortowanie między datą a przedstawicielem.
- Pusty wynik filtra jest jednoznacznie odróżnialny od raportu bez żadnych odstępstw.
