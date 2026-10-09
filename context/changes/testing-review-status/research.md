---
date: 2026-10-09T13:14:44+02:00
researcher: Claude (Opus 5.5)
git_commit: 42db7d6
branch: dev
repository: 10x-astro-project
topic: "Ugruntowanie Phase 3 test-planu (Status przeglądu) — ryzyko #6"
tags: [research, testing, integration, deviations, review, DeviationsList]
status: complete
last_updated: 2026-10-09
last_updated_by: Claude (Opus 5.5)
---

# Research: Ugruntowanie Phase 3 test-planu — ryzyko #6 (status przeglądu)

**Date**: 2026-10-09T13:14:44+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 42db7d6 (drzewo robocze z niezacommitowanymi zmianami poza zakresem: manifest, roadmapa, nowe skille E2E)
**Branch**: dev
**Repository**: 10x-astro-project

## Research Question

Ugruntować rollout Phase 3 z `context/foundation/test-plan.md` dla ryzyka #6 („status przeglądu nie utrwala się, trafia na inne odstępstwa albo zmienia tylko część zaznaczonych bez komunikatu”). Zweryfikować — nie przyjmować na wiarę — intencję: oznaczenie i cofnięcie przeżywają ponowne wczytanie, dotyczą tylko wskazanych odstępstw, a częściowy sukces jest zgłaszany użytkownikowi; zakwestionować „UI pokazuje zmianę, więc jest zapisana”; unikać asercji na stanie komponentu i testu tylko pojedynczego oznaczenia. Znaleźć ścieżkę awarii w kodzie, istniejące testy i najtańszą użyteczną warstwę testu.

## Summary

1. **Trwałość i zakres zapisu** zależą wyłącznie od jednego zapytania w `src/pages/api/deviations/review.ts:45-49` (`update({ status, reviewed_at }).in("id", ids).select()`), zawężonego przez politykę RLS `deviations_update_own` (`supabase/migrations/20260925120100_report_schema_rls.sql:107-120`). Test integracyjny endpointu z ponownym odczytem bazy jest tu właściwą i najtańszą warstwą — intencja test-planu się potwierdza.
2. **Pozytywna ścieżka endpointu przez HTTP nie ma dziś żadnego testu.** W przejrzanych plikach `tests/integration/*.int.test.ts` wszystkie wywołania `/api/deviations/review` są odmowami: cudze id → 404 (`http-isolation.int.test.ts:87-99`), `"not-a-uuid"` i `[]` → 400 (`:102-118`), bez sesji (`route-access.int.test.ts:51-67`), stara sesja (`signout.int.test.ts:71`). Jedyne pozytywne oznaczenie to pojedynczy `UPDATE` bezpośrednio w bazie, z pominięciem endpointu (`rls-isolation.int.test.ts:301-308`). Nie ma testu cofnięcia (`unreviewed` → `reviewed_at: null`), oznaczenia zbiorczego, „nie dotyka sąsiadów” ani zbioru mieszanego (własne + obce/nieistniejące id).
3. **Korekta intencji: „częściowy sukces jest zgłaszany użytkownikowi” nie jest osiągalny testem integracyjnym.** Endpoint przy częściowej aktualizacji odpowiada 200 tylko ze zmienionymi wierszami (`review.ts:62-69`) — to można i trzeba przypiąć integracyjnie. Ale sam komunikat dla użytkownika powstaje wyłącznie w kliencie: `DeviationsList.tsx:343-347` (`if (updated.length < ids.length) { … setActionError("review"); }`), renderowany jako `Alert` (`:756-758`, tekst `:38`). Test-plan §3 przewiduje dla Phase 3 tylko `integration`, a §4 ma `e2e: none — świadomie` — ta gałąź zostałaby nieprzetestowana. Najtańsza warstwa: wydzielić scalanie odpowiedzi do czystej funkcji w `src/lib/` i pokryć ją testem jednostkowym (szczegóły i alternatywy w „Open Questions”).
4. **Fixture wystarcza do testów wielokrotnych.** `test-data/sample-report.csv` daje po wgraniu 15 odstępstw na 10 wizytach, w tym 5 wizyt z dwoma odstępstwami (Klient F, S, T2, T3, T4) — wg `tests/integration/helpers/oracle.ts:6-22`. Jest więc na czym sprawdzić „zbiorczo cała wizyta” oraz „jedno z dwóch na tej samej wizycie, sąsiad nietknięty”.

## Detailed Findings

### Ścieżka zapisu (endpoint)

- Walidacja przed zapytaniem: `ids` musi być niepustą tablicą stringów pasujących do `UUID_RE`, `status` ∈ {`reviewed`, `unreviewed`} — inaczej 400 `invalid_request` (`review.ts:32-41`).
- `reviewed_at` = `new Date().toISOString()` dla `reviewed`, `null` dla `unreviewed` (`review.ts:43`). Ponowne oznaczenie już sprawdzonego odstępstwa nadpisuje `reviewed_at` nowym czasem (to samo zapytanie, brak warunku na bieżący status) — zachowanie obserwowane w kodzie, nie wymaganie PRD.
- Błąd Supabase → 500 `update_failed` z `logAppEvent` (`review.ts:51-60`).
- `data.length === 0` → 404 `not_found` (`review.ts:64-67`); komentarz `:62-63` deklaruje, że częściowa aktualizacja daje 200 z samymi zmienionymi wierszami. Ta deklaracja nie ma dziś testu.
- Gałąź 401 (`review.ts:19-22`) jest w praktyce nieosiągalna przez HTTP: middleware odpowiada wcześniej 302 → `/auth/signin` (CLAUDE.md, potwierdzone testem `route-access.int.test.ts:51-53`).
- Endpoint nie deduplikuje `ids`. Dla `[x, x]` Postgres zaktualizuje jeden wiersz, a klient (gdyby wysłał duplikat) zgłosiłby fałszywy częściowy błąd. Klient wysyła jednak tylko `visit.deviations.map(d => d.id)` lub `[deviation.id]` (`DeviationsList.tsx:391, 413, 528, 541, 596`), więc w przejrzanych wywołaniach duplikaty nie powstają — ryzyko spekulatywne, poza zakresem.

### RLS

- `deviations_update_own` (`20260925120100_report_schema_rls.sql:107-120`): `using` i `with check` z `EXISTS` przez `visits` → `reports.user_id = auth.uid()`. Obce i nieistniejące id są dla zapytania nierozróżnialne — oba po prostu nie trafiają do `data`.
- Kolumna `reports.deviation_count` nie zależy od statusu przeglądu (`20261006120000_add_report_deviation_count.sql:6-7`), więc test przeglądu nie musi jej sprawdzać.

### Klient (`DeviationsList.tsx`)

- `updateDeviationStatus` (`:311-358`): przy `!response.ok` lub odpowiedzi nie-JSON → `setActionError("review")` bez zmiany stanu (`:325-330`); przy sukcesie scala do lokalnego stanu tylko wiersze z `updated`, dopasowując po `id` (`:334-342`); przy `updated.length < ids.length` → `setActionError("review")` (`:344-347`); wyjątek sieciowy → to samo (`:348-350`).
- Nowa próba czyści wcześniejszy błąd `review` na starcie (`:315`), sukces go nie czyści — zgodnie z kontraktem w CLAUDE.md. Konsekwencja: częściowy błąd na wizycie X znika, gdy użytkownik kliknie wizytę Y. To jest udokumentowana decyzja, nie błąd.
- Komunikat jest ogólny (`:38`, „Nie udało się zapisać zmiany statusu…”) i nie wskazuje, których odstępstw dotyczy. Odstępstwa niezaktualizowane zostają wizualnie bez zmian, bo scalane są tylko wiersze z `updated`.
- Logika jest zamknięta w komponencie `.tsx`. `vitest.config.ts` obejmuje tylko `src/**/*.test.ts` w środowisku `node`, a CLAUDE.md dopuszcza testy jednostkowe „pure modules only — no DOM”. Komponentu nie da się więc przetestować jednostkowo bez wydzielenia logiki.

### „Reload” = zapytanie strony szczegółów

- Strona `/reports/[id]` pobiera `supabase.from("visits").select("*, deviations(*)").eq("report_id", id)` (`src/pages/reports/[id].astro:33`). Uczciwym odpowiednikiem „ponownego wczytania” jest nowe zapytanie tym samym kształtem jako właściciel (`clientAs`), tak jak robi to `upload-oracle.int.test.ts` (wg `test-plan.md` §6.4). Parsowanie HTML/propsów wyspy byłoby kruche i nic nie dodaje — dane strony pochodzą z tego zapytania.

### Istniejąca infrastruktura do ponownego użycia

- `signInViaApp`, `HttpClient` (`tests/integration/helpers/http.ts`), `uploadSampleReport` (`helpers/seed.ts:45-56`), `clientAs` (`helpers/db.ts`), wzór odczytu odstępstw raportu `deviationsOfA()` (`http-isolation.int.test.ts:28-36`).
- Obce odstępstwo bez logowania B przez aplikację: wzorzec `seedAs(dbB, …)` wstawiający raport/wizytę/odstępstwo bezpośrednio pod RLS (`rls-isolation.int.test.ts:23-42`) — nie zużywa limitu logowań (30/5 min, `test-plan.md` §6.2).
- `db-fault.ts` ma tylko triggery `visits_insert`, `deviations_insert`, `reports_update`, `reports_delete` (`helpers/db-fault.ts:25`) — brak `deviations_update`. Gałąź 500 `update_failed` wymagałaby nowego rodzaju usterki; to opcjonalne, bo klient traktuje 500 tak samo jak każdy `!ok` (`DeviationsList.tsx:326`).

## Weryfikacja intencji ryzyka #6

| Element intencji                                    | Werdykt                                | Uzasadnienie                                                                                                                                                                                       |
| --------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oznaczenie i cofnięcie przeżywają ponowne wczytanie | **potwierdzone, warstwa: integracja**  | Zapis tylko w `review.ts:45-49`; dowód = ponowny odczyt bazy kształtem strony (`[id].astro:33`). Brak dziś testu cofnięcia.                                                                        |
| Dotyczą tylko wskazanych odstępstw                  | **potwierdzone, warstwa: integracja**  | `.in("id", ids)` (`review.ts:48`) to jedyny filtr poza RLS. Usunięcie go zaktualizowałoby wszystkie odstępstwa właściciela — wykryje to tylko asercja na sąsiadach (ta sama wizyta i inne wizyty). |
| Częściowy sukces zgłaszany użytkownikowi            | **częściowo — wymaga korekty warstwy** | Kontrakt API (200 + podzbiór) → integracja. Sam komunikat → `DeviationsList.tsx:344-347`, nieosiągalny integracyjnie. Zob. Open Questions Q1.                                                      |
| Zakwestionować „UI pokazuje zmianę, więc zapisana”  | **zasadne**                            | UI scala `updated` z odpowiedzi (`:334-342`), nie odczytuje bazy ponownie — zielony UI dowodzi tylko treści odpowiedzi.                                                                            |
| Nie testować tylko pojedynczego oznaczenia          | **zasadne i wykonalne**                | 5 wizyt z dwoma odstępstwami w fixture (`oracle.ts:10,15,17-19`).                                                                                                                                  |

## Proponowane przypadki (dla /10x-plan, nie decyzja)

Nowy plik, np. `tests/integration/deviation-review.int.test.ts`, konto A, jedno logowanie, jeden `uploadSampleReport`:

1. Zbiorczo: oba odstępstwa wizyty z dwoma odstępstwami → `reviewed`; odpowiedź 200 z dokładnie tymi id; ponowny odczyt: obie `reviewed` z `reviewed_at` ≠ null; **wszystkie pozostałe 13 odstępstw** bez zmian.
2. Pojedynczo w obrębie wielokrotnej wizyty: jedno z dwóch → `reviewed`; sąsiad na tej samej wizycie nadal `unreviewed`/`null`.
3. Cofnięcie: `unreviewed` na oznaczonych → ponowny odczyt `unreviewed` + `reviewed_at: null`; pozostałe bez zmian. Opcjonalnie ponowne oznaczenie (cykl mark → unmark → mark).
4. Zbiór mieszany: własne id + obce (z `seedAs` jako B) i/lub losowy nieistniejący UUID → 200, `updated` = tylko własne; własne zmienione, obce bez zmian odczytane jako B (plus kontrola, że B je widzi).
5. Asercje zawsze na stanie bazy odczytanym od nowa, porównywanym ze **snapshotem sprzed akcji** dla wszystkich odstępstw raportu (nie tylko dotkniętych).

Kontrole czułości (wzór Phase 1/2): usunąć `.in("id", ids)`; ustawić `reviewedAt` zawsze na `null`; zwrócić 404 przy `data.length < ids.length`; po stronie klienta — usunąć gałąź `:344-347` (wykryje to tylko test z Q1).

## Code References

- `src/pages/api/deviations/review.ts:32-41` — walidacja wejścia
- `src/pages/api/deviations/review.ts:43-49` — jedyny zapis (status + `reviewed_at`)
- `src/pages/api/deviations/review.ts:62-69` — 404 przy 0 wierszy, 200 z podzbiorem przy częściowej
- `supabase/migrations/20260925120100_report_schema_rls.sql:107-120` — `deviations_update_own`
- `src/components/reports/DeviationsList.tsx:311-358` — `updateDeviationStatus`
- `src/components/reports/DeviationsList.tsx:344-347` — wykrycie częściowego sukcesu → `Alert`
- `src/components/reports/DeviationsList.tsx:413, 528, 541, 596` — wywołania: zbiorcze oznacz/cofnij, pojedynczy przełącznik
- `src/pages/reports/[id].astro:33` — zapytanie strony szczegółów („reload”)
- `tests/integration/http-isolation.int.test.ts:86-118` — istniejące odmowy endpointu
- `tests/integration/rls-isolation.int.test.ts:23-42, 205-216, 301-308` — seed pod RLS, odmowa i jedno pozytywne `UPDATE` w bazie
- `tests/integration/helpers/oracle.ts:6-22` — reguły per klient w fixture
- `tests/integration/helpers/db-fault.ts:25` — dostępne rodzaje usterek (bez `deviations_update`)

## Architecture Insights

- „0 zmienionych wierszy bez błędu” = odmowa RLS; endpoint to tłumaczy na 404 dopiero od Phase 1. Ten sam mechanizm przy zbiorze mieszanym daje „cichy” podzbiór — jedyną ochroną przed „bez komunikatu” jest porównanie długości po stronie klienta.
- Odpowiedzialność jest rozdzielona: serwer gwarantuje zakres i trwałość, klient — zgłoszenie częściowego wyniku. Test jednej warstwy nie pokrywa drugiej.

## Historical Context (from prior changes)

- `context/archive/2026-10-01-mark-deviation-reviewed/plan.md:80` — „`data` to dokładnie te wiersze, które faktycznie się zaktualizowały (może być mniej niż `ids.length`…)” — **nadal prawdziwe** (`review.ts:69`).
- `…/plan.md:92` i Progress `1.4` — „cudze odstępstwo zwraca 200 z pustą tablicą `updated`” — **nieaktualne**: od Phase 1 jest 404 `not_found` (`review.ts:64-67`, `test-plan.md` §6.5 Phase 1).
- `…/plan.md:115` — „przy błędzie `console.error(...)`, bez zmiany stanu” — **częściowo nieaktualne**: stan się nie zmienia (prawda), ale błąd jest teraz pokazywany w `Alert` (`DeviationsList.tsx:328, 756-758`), a częściowy sukces wykrywany (`:344-347`, wprowadzone w `3dcbf91`).
- `…/plan.md:117` — zbiorczy przycisk przełącza „Cofnij oznaczenie”/„Oznacz wszystkie” — **zgodne co do zachowania** (`DeviationsList.tsx:521-545`).
- `…/plan.md:172` — „Brak frameworka testowego” — **nieaktualne** (Vitest jednostkowy i integracyjny istnieją).
- Hot-spot `src/components/reports` (test-plan §2): trafny co do komponentu klienta, ale ryzyko trwałości/zakresu leży w endpoincie i RLS, poza tym katalogiem.

## Related Research

- `context/archive/2026-10-08-testing-data-isolation-access/` i `context/archive/2026-10-09-testing-report-save-integrity/` — fazy 1–2, źródło wzorców harnessu (§6.2–§6.5 test-planu).

## Open Questions

- **Q1 (decyzja dla planu): jak dowieść, że częściowy sukces jest zgłaszany?**
  - (a) **Rekomendowane:** wydzielić z `updateDeviationStatus` czystą funkcję (np. `applyReviewResult(visits, ids, updated) → { visits, partial }`) do `src/lib/`, test jednostkowy `*.test.ts`. Najtańsze, zgodne z konwencją „pure modules”, wymaga małej zmiany produkcyjnej w komponencie objętym kontraktem UI (wygląd i teksty bez zmian).
  - (b) E2E (Playwright) — w repo pojawiły się niezacommitowane skille `/10x-e2e-setup`, `/10x-e2e`, ale test-plan §4 mówi `e2e: none — świadomie`; to zmiana strategii, wymaga backportu do test-planu.
  - (c) Zawęzić intencję do kontraktu API i zapisać lukę w §6.5 / §7.
    W każdym wariancie test-plan §3 (typy testów dla Phase 3) trzeba zaktualizować, jeśli dochodzi warstwa unit/e2e.
- **Q2:** czy przypinać `reviewed_at` przy ponownym oznaczeniu (nadpisanie czasu) — zachowanie obecne, nieokreślone w PRD; raczej poza zakresem ryzyka #6.
- **Q3:** czy dodać rodzaj usterki `deviations_update` do `db-fault.ts` dla 500 `update_failed` — niski zysk, bo klient traktuje każde `!ok` tak samo.
