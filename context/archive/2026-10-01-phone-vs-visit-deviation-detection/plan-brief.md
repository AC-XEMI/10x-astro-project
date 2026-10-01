# Wykrywanie telefonu zamiast wizyty w wgranym raporcie — Plan Brief

> Pełny plan: `context/changes/phone-vs-visit-deviation-detection/plan.md`

## Co i po co

Trzecia reguła detekcji odstępstw (roadmap S-03, PRD FR-010): kierownik widzi na liście odstępstw aktywności oznaczone jako "telefon zamiast wizyty" — wprost z pola typu aktywności, albo (gdy ta wizyta nie ma rozpoznawalnej wartości "wizyta"/"telefon") na podstawie braku GPS i zerowego/brakującego czasu na miejscu.

## Punkt wyjścia

Wszystkie potrzebne pola (`activity_type`, `gps_enabled`, `time_on_site_minutes`) istnieją od S-01, enum ma `phone_instead_of_visit` od F-01, a generyczna kolumna `deviations.detail` i jej renderowanie w UI istnieją od S-02. Ta reguła to czysta logika + integracja — zero migracji, zero nowych kolumn pliku, zero zmian UI.

## Pożądany stan końcowy

Aktywność z `typ_aktywnosci=telefon` (niezależnie od GPS/czasu) oraz aktywność bez rozpoznawalnej wartości "wizyta"/"telefon" przy wyłączonym GPS i zerowym/brakującym czasie na miejscu pojawiają się na liście z regułą `phone_instead_of_visit` i `detail` wyjaśniającym przyczynę. Może współwystępować z `missing_gps` na tej samej wizycie.

## Kluczowe decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) |
| --- | --- | --- |
| Granularność "braku pola" | Per-wiersz (pusta wartość), nie poziom pliku | Spójne z istniejącym wzorcem opcjonalnych pól per-wiersz z S-02 |
| Próg "bardzo krótkiego" czasu | Dokładnie 0 minut | Najbardziej jednoznaczna interpretacja, minimalne ryzyko fałszywego alarmu |
| Nierozpoznana wartość `typ_aktywnosci` (np. literówka) | Traktowana jak brak pola → heurystyka | Łapie literówki i nieoczekiwane wartości zamiast cicho je ignorować |
| Nakładanie z `missing_gps` | Obie reguły niezależnie, bez zmian w `detectMissingGps` | Zero ryzyka regresji na już wdrożonej logice z S-01; zgodne z US-01 (wiele reguł na jednej wizycie) |
| Pole `detail` | Tak, zapisuj konkretną przyczynę (wprost / heurystyka) | Spójne z wzorcem z S-02; kierownik widzi DLACZEGO, zgodnie z FR-006 |
| Brak wartości czasu na miejscu | Traktuj jak zero | Najmocniejszy sygnał braku realnej wizyty, zgodnie z intencją FR-010 |

## Zakres

**W zakresie:**
- Nowa funkcja `detectPhoneInsteadOfVisit(visit)` w `deviation-rules.ts` (per-wizyta, z `detail`)
- Integracja z istniejącą pętlą per-wizyta w `upload.ts` (obok `detectMissingGps`)
- Rozszerzenie fixture'a i skryptu weryfikacji o 6 nowych przypadków (4 pozytywne, 2 negatywne)

**Poza zakresem:**
- Jakiekolwiek zmiany w `detectMissingGps`, `report-parser.ts`, schemacie bazy, czy `DeviationsList.tsx`
- Rozróżnianie braku kolumny od pustej wartości w wierszu
- Konfigurowalny próg czasu w UI
- S-04 (usuwanie raportu), S-05 (oznaczanie jako sprawdzone)

## Architektura / Podejście

`detectPhoneInsteadOfVisit` to trzeci kształt kontraktu reguły w tym projekcie — per-wizyta jak `detectMissingGps`, ale z `detail` jak `detectRouteDeviations`. Ponieważ jest per-wizyta, dołącza do TEJ SAMEJ pętli `flatMap` w `upload.ts`, która dziś obsługuje `detectMissingGps` — nie potrzeba osobnego wywołania jak dla reguły trasy (która z natury wymaga całego zbioru wizyt naraz).

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Rdzeń logiki | `detectPhoneInsteadOfVisit` — obie ścieżki FR-010 | Pomieszanie semantyki "braku pola" z inną już istniejącą regułą (`detectRouteDeviations`) |
| 2. Endpoint uploadu | Integracja z istniejącą pętlą per-wizyta | Przypadkowa zmiana zachowania `detectMissingGps` przy refaktorze pętli |
| 3. Fixture + skrypt | 6 nowych przypadków testowych (4 pozytywne, 2 negatywne) | Brak pokrycia kierunku negatywnego (fałszywe alarmy) |

**Wymagania wstępne:** F-01 (schemat) i S-01 (pola źródłowe) ukończone i zarchiwizowane; S-02 (`deviations.detail` i generyczne UI) ukończone i zarchiwizowane — wszystkie spełnione.
**Szacowany wysiłek:** ~1-2 sesje po godzinach, 3 fazy (najmniejszy z trzech wycinków reguł).

## Open Risks & Assumptions

- Próg 0 minut i reguła "nierozpoznana wartość → heurystyka" to decyzje z wywiadu bez danych referencyjnych z realnych raportów — mogą wymagać korekty po pierwszych prawdziwych przypadkach.
- Reguła celowo nie rozróżnia "brak kolumny w pliku" od "pusta wartość w wierszu" — jeśli w przyszłości pojawi się potrzeba takiego rozróżnienia, to osobna decyzja projektowa.

## Kryteria sukcesu (podsumowanie)

- Aktywność z `typ_aktywnosci=telefon` jest oznaczana jako `phone_instead_of_visit` niezależnie od GPS/czasu.
- Aktywność bez rozpoznawalnej wartości, z wyłączonym GPS i zerowym/brakującym czasem, jest oznaczana tą samą regułą (i niezależnie może dostać `missing_gps`).
- Żadna wizyta z włączonym GPS lub wystarczająco długim czasem na miejscu nie jest błędnie oznaczana `phone_instead_of_visit` (brak fałszywych alarmów, guardrail PRD).
