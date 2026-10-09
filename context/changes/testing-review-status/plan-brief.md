# Phase 3 — status przeglądu odstępstw — Plan Brief

> Full plan: `context/changes/testing-review-status/plan.md`
> Research: `context/changes/testing-review-status/research.md`

## What & Why

Ryzyko #6 z test-planu: status przeglądu może się nie utrwalić, trafić na inne odstępstwa albo zmienić tylko część zaznaczonych bez komunikatu. Dowodzimy, że oznaczenie i cofnięcie są trwałe w bazie, dotykają tylko wskazanych odstępstw, a częściowy sukces jest zgłaszany — bez przyjmowania „UI pokazuje zmianę, więc zapisana”.

## Starting Point

Zapis robi jedno zapytanie w `src/pages/api/deviations/review.ts:45-49` zawężone RLS. Istniejące testy endpointu sprawdzają tylko odmowy (cudze id, złe wejście, brak sesji). Wykrycie częściowego sukcesu żyje wyłącznie w komponencie `DeviationsList.tsx:344-347`, nieosiągalnym dla testów integracyjnych i jednostkowych.

## Desired End State

Nowy `tests/integration/deviation-review.int.test.ts` w CI sprawdza oznaczenie zbiorcze, pojedyncze w wizycie z dwoma odstępstwami, cofnięcie, cykl i zbiór mieszany — zawsze przez pełną migawkę bazy. Logika scalania odpowiedzi jest czystą funkcją `src/lib/review-result.ts` z testem jednostkowym, a komponent działa i wygląda jak wcześniej. Każdy nowy test raz widziany na czerwono.

## Key Decisions Made

| Decision                               | Choice                                                                 | Why (1 sentence)                                                           | Source   |
| -------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| Warstwa trwałości i zakresu            | Integracja endpointu + ponowny odczyt bazy kształtem strony szczegółów | Jedyny zapis to `review.ts`, a „reload” to zapytanie `[id].astro:33`.      | Research |
| Dowód komunikatu o częściowym sukcesie | Wydzielenie czystej funkcji do `src/lib/` + unit test                  | Najtańsza warstwa, łapie usunięcie gałęzi; E2E zmieniałoby strategię (§4). | Plan     |
| Zbiór mieszany                         | Własne + obce (B, `seedAs`, bez logowania) + losowy UUID               | Dowodzi nietykalności cudzego wiersza i podzbioru dla brakującego id.      | Plan     |
| Asercja zakresu                        | Pełna migawka wszystkich 15 odstępstw raportu                          | Tylko porównanie sąsiadów łapie brak `.in("id", ids)`.                     | Research |
| Kontrole czułości                      | Lokalnie (Docker 29.7.2), CI jako potwierdzenie                        | Szybsza pętla niż tymczasowy PR z Phase 1.                                 | Plan     |

## Scope

**In scope:**

- Testy integracyjne endpointu przeglądu (pozytywne + mieszany)
- Przeniesienie `seedAs` do helpera
- Wydzielenie `applyReviewResult` + unit test
- Backport do test-planu (§2, §3, §6.1, §6.3, §6.5)

**Out of scope:**

- E2E / render `Alert`
- Usterka `deviations_update` i test 500
- Nadpisywanie `reviewed_at` przy ponownym oznaczeniu, deduplikacja `ids`
- Zmiany wyglądu/tekstów `DeviationsList.tsx`

## Architecture / Approach

Serwer gwarantuje trwałość i zakres, klient — zgłoszenie częściowego wyniku; każda strona ma swój test. Integracja: jedno logowanie A, jedno wgranie fixture'u, przypadki na rozłącznych wizytach z migawką przed akcją. Klient: test najpierw (red), potem wydzielenie funkcji generycznej po kształcie wizyty i przepięcie `updateDeviationStatus`.

## Phases at a Glance

| Phase                         | What it delivers                                        | Key risk                                                     |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| 1. Serwer — trwałość i zakres | Zbiorczo, jedno z dwóch, cofnięcie, cykl + kontrole A/B | Asercja tylko na dotkniętych wierszach przepuściłaby mutanta |
| 2. Serwer — częściowa         | Przypadek mieszany + `seedAs` w helperze + kontrola C   | Zmiana `rls-isolation` przy przenosinach helpera             |
| 3. Klient — komunikat         | `applyReviewResult` + unit + kontrola D                 | Regresja zachowania komponentu objętego kontraktem UI        |
| 4. Test-plan                  | Backport §2/§3/§6, status po zielonym CI                | —                                                            |

**Prerequisites:** `npx supabase start`, `.dev.vars` na lokalny Supabase, aplikacja pod `BASE_URL`.
**Estimated effort:** ~1–2 sesje w 4 fazach.

## Open Risks & Assumptions

- Zakładamy brak błędu w `review.ts`; jeśli test go ujawni, poprawka to osobna decyzja.
- Kolejność wierszy w odpowiedzi nie jest gwarantowana — asercje na zbiorach id.

## Success Criteria (Summary)

- Usunięcie `.in`, `reviewed_at = null` lub 404 przy częściowym wyniku daje czerwony CI.
- Usunięcie wykrycia częściowego sukcesu w kliencie daje czerwony `npm test`.
- Kierownik nie widzi żadnej zmiany w działaniu ani wyglądzie widoku szczegółów.
