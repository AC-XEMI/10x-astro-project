# Phase 3 — status przeglądu odstępstw: plan wdrożenia

## Overview

Rollout Phase 3 z `context/foundation/test-plan.md` (ryzyko #6). Trzy rzeczy do udowodnienia:

1. oznaczenie i cofnięcie są trwałe — widać je w bazie odczytanej od nowa, nie tylko w odpowiedzi;
2. zmieniają tylko wskazane odstępstwa — każde inne odstępstwo raportu zostaje bajt w bajt takie samo;
3. częściowy sukces (część id nie należy do właściciela albo nie istnieje) jest zgłaszany: serwer zwraca 200 z podzbiorem, a klient wyświetla komunikat.

Punkty 1–2 i serwerową część 3 dowodzą testy integracyjne endpointu na lokalnym Supabase (job `smoke` w CI). Kliencką część 3 dowodzi test jednostkowy czystej funkcji, wydzielonej z `DeviationsList.tsx` bez zmiany wyglądu i tekstów.

## Current State Analysis

(pełne ugruntowanie: `context/changes/testing-review-status/research.md`)

- Jedyny zapis statusu: `src/pages/api/deviations/review.ts:45-49` — `update({ status, reviewed_at }).in("id", ids).select()`, zawężony RLS `deviations_update_own` (`supabase/migrations/20260925120100_report_schema_rls.sql:107-120`). 0 wierszy → 404 `not_found` (`review.ts:64-67`), podzbiór → 200 `{ updated }` (`:69`).
- Testy endpointu przez HTTP to dziś wyłącznie odmowy (`http-isolation.int.test.ts:86-118`, `route-access.int.test.ts:51-67`, `signout.int.test.ts:71`). Pozytywne oznaczenie istnieje tylko jako bezpośredni `UPDATE` w bazie (`rls-isolation.int.test.ts:301-308`). Nie ma testu cofnięcia, oznaczenia zbiorczego, nietykalności sąsiadów ani zbioru mieszanego.
- Wykrycie częściowego sukcesu żyje tylko w komponencie: `DeviationsList.tsx:334-347` (scalenie `updated` do stanu + `if (updated.length < ids.length) setActionError("review")`). Komponentu nie da się przetestować jednostkowo (Vitest `environment: "node"`, tylko `src/**/*.test.ts`).
- Fixture `test-data/sample-report.csv` po wgraniu: 15 odstępstw na 10 wizytach, 5 wizyt z dwoma odstępstwami (Klient F, S, T2, T3, T4 — `tests/integration/helpers/oracle.ts:10,15,17-19`).
- Docker działa lokalnie (29.7.2), więc pętla integracyjna i kontrole czułości mogą iść lokalnie, a CI jest potwierdzeniem.

## Desired End State

- `tests/integration/deviation-review.int.test.ts` w CI (job `smoke`) jest zielony i obejmuje: oznaczenie całej wizyty, jedno z dwóch odstępstw tej samej wizyty, cofnięcie, cykl oznacz → cofnij → oznacz oraz zbiór mieszany (własne + obce + nieistniejące id). Każdy przypadek porównuje wszystkie odstępstwa raportu z migawką sprzed akcji, odczytaną od nowa zapytaniem strony szczegółów.
- `src/lib/review-result.ts` + `src/lib/review-result.test.ts` w `npm test`; `DeviationsList.tsx` korzysta z funkcji, zachowanie i UI bez zmian.
- Każdy nowy test został raz zobaczony na czerwono w kontroli czułości (wyniki w §6.5 test-planu).
- Test-plan: §3 Phase 3 z typami `integration + unit` i statusem, §2 z korektą warstwy dla #6, §6.3 z wzorcem endpointu zapisu wielu id, §6.5 z notatką Phase 3.

### Key Discoveries:

- `.in("id", ids)` (`review.ts:48`) to jedyny filtr poza RLS — jego usunięcie zmieniłoby wszystkie odstępstwa właściciela; wykryje to tylko asercja na sąsiadach.
- `reviewed_at` jest liczony w endpoincie (`review.ts:43`) — test cofnięcia musi sprawdzać `null`, a nie tylko `status`.
- Obcy wiersz można zasiać bez logowania B przez aplikację: `clientAs` używa tokenu z `globalSetup` (`helpers/db.ts:15-20`), a wzorzec `seedAs` jest w `rls-isolation.int.test.ts:23-42`.
- Strona szczegółów czyta `visits.select("*, deviations(*)").eq("report_id", id)` (`src/pages/reports/[id].astro:33`) — to jest „reload”.

## What We're NOT Doing

- Bez testów E2E/Playwright (§4 test-planu: `e2e: none — świadomie`); renderu `Alert` nie dowodzimy, tylko flagę, która go włącza.
- Bez nowego rodzaju usterki `deviations_update` w `db-fault.ts` ani testu 500 `update_failed` (klient traktuje każde `!ok` tak samo, `DeviationsList.tsx:326`).
- Bez zmiany zachowania nadpisywania `reviewed_at` przy ponownym oznaczeniu już sprawdzonego odstępstwa (nieokreślone w PRD) — test go nie przypina.
- Bez deduplikacji `ids` w endpoincie (klient nie wysyła duplikatów — research).
- Bez zmian wyglądu, tekstów i zachowania `DeviationsList.tsx` (kontrakt Claude Design); bez zmian w `review.ts`, chyba że test ujawni błąd — wtedy osobna decyzja.
- Bez testu współbieżnych kliknięć i czyszczenia błędu przy nowej próbie (`DeviationsList.tsx:315` — udokumentowana decyzja w CLAUDE.md).

## Implementation Approach

Test najpierw, kod potem. Fazy 1–2 nie zmieniają kodu produkcyjnego, więc testy powinny być od razu zielone. Ich wartość potwierdzają kontrole czułości: celowe zepsucie `review.ts`, przebudowa, restart preview, czerwony test, cofnięcie. W fazie 3 test jednostkowy powstaje przed modułem (czerwony: brak modułu), potem następuje wydzielenie. Jeden plik integracyjny, jedno logowanie konta A przez aplikację (limit 30/5 min), jedno `uploadSampleReport`. Przypadki działają na rozłącznych wizytach, więc nie zależą od kolejności, a migawka jest brana tuż przed każdą akcją.

## Critical Implementation Details

- **Kontrole czułości wymagają przebudowy:** testy idą na zbudowanej aplikacji, więc każda zmiana w `src/**` to `npm run build` + restart preview. Na Windowsie najpierw zatrzymaj preview, bo trzyma `dist/` (test-plan §6.2).
- **Migawka = wszystkie odstępstwa raportu:** porównanie tylko dotkniętych wierszy przepuści mutant bez `.in(...)`. Przypadek porównuje pełną listę (posortowaną po `id`) z oczekiwaną: migawka z podmienionymi tylko wskazanymi wierszami.

## Faza 1: #6 / serwer — trwałość i zakres oznaczenia i cofnięcia

### Overview

Nowy plik integracyjny z przypadkami pozytywnymi przez prawdziwy endpoint; asercje wyłącznie na bazie odczytanej od nowa jako właściciel.

### Changes Required:

#### 1. Helper odczytu „jak strona szczegółów”

**File**: `tests/integration/helpers/seed.ts` (lub nowy `tests/integration/helpers/report-state.ts`, jeśli `seed.ts` ma zostać tylko HTTP)

**Intent**: Jedno miejsce, które czyta stan raportu tym samym zapytaniem co `/reports/[id]` i zwraca płaską, posortowaną po `id` listę `{ id, visit_id, visited_client, rule, status, reviewed_at }` — porównywalną z migawką.

**Contract**: `reportDeviationState(db: DbClient, reportId: string)` → posortowana tablica; zapytanie `visits.select("*, deviations(*)").eq("report_id", reportId)`; rzuca przy błędzie.

#### 2. Testy pozytywne endpointu

**File**: `tests/integration/deviation-review.int.test.ts` (nowy)

**Intent**: Dowieść trwałości i zakresu dla oznaczeń wielokrotnych i cofnięcia. `beforeAll`: `signInViaApp(httpA, A)`, `uploadSampleReport(httpA)`, kontrola wejścia (15 odstępstw, wszystkie `unreviewed`/`null`, 5 wizyt z dwoma odstępstwami). Wizyty wybierane po `visited_client` z wyroczni, każdy przypadek na innej wizycie. `afterAll`: usunięcie raportu jako A.

**Contract**: przypadki (każdy: migawka → POST → asercja odpowiedzi → ponowny odczyt → równość z oczekiwaną migawką):

- **zbiorczo** — oba id wizyty z dwoma odstępstwami, `reviewed` → 200, `updated` ma dokładnie te 2 id; w bazie oba `reviewed`, `reviewed_at` ≠ null i w granicach czasu żądania; pozostałe 13 bez zmian;
- **jedno z dwóch** — jedno id innej wizyty z dwoma odstępstwami → zmienione tylko ono; sąsiad na tej samej wizycie `unreviewed`/`null`;
- **cofnięcie** — `unreviewed` dla wizyty z przypadku „zbiorczo” → oba `unreviewed` + `reviewed_at: null`; reszta (w tym wynik „jedno z dwóch”) bez zmian;
- **cykl** — na kolejnej wizycie oznacz → cofnij → oznacz, każdy krok z ponownym odczytem; stan końcowy `reviewed`.

### Success Criteria:

#### Automated Verification:

- Nowy plik zielony lokalnie: `npx vitest run --config vitest.integration.config.ts tests/integration/deviation-review.int.test.ts`
- Cały zestaw integracyjny zielony lokalnie: `npm run test:integration`
- Lint i typy: `npm run lint`, `npx astro check`
- Kontrola czułości A: usunięcie `.in("id", ids)` w `review.ts` (build + restart preview) → czerwone przypadki „zbiorczo”/„jedno z dwóch”; cofnięte
- Kontrola czułości B: `reviewedAt` zawsze `null` → czerwone „zbiorczo” i „cykl”; cofnięte

#### Manual Verification:

- Przegląd: żadna asercja nie opiera się na samej odpowiedzi HTTP; każda kończy się porównaniem pełnej migawki z bazy

**Implementation Note**: Po zielonej automatyce zatrzymaj się na ręczne potwierdzenie przed fazą 2.

---

## Faza 2: #6 / serwer — częściowa aktualizacja przy zbiorze mieszanym

### Overview

Udowodnić kontrakt częściowego sukcesu: 200, `updated` zawiera tylko własne wiersze, obcy wiersz pozostaje nietknięty (odczyt jako jego właściciel), a nieistniejący id niczego nie tworzy.

### Changes Required:

#### 1. Zasianie obcego odstępstwa bez logowania B

**File**: `tests/integration/helpers/` (przeniesienie `seedAs` z `rls-isolation.int.test.ts:23-42` do helpera, np. `helpers/seed-db.ts`) + `tests/integration/rls-isolation.int.test.ts` (import zamiast lokalnej funkcji)

**Intent**: Jedna implementacja zasiewania raportu/wizyty/odstępstwa pod RLS, używana przez oba pliki — bez kopii.

**Contract**: `seedAs(db, userId, label)` → `{ reportId, visitId, deviationId, filename }`, zachowanie bez zmian; `rls-isolation` nadal zielony.

#### 2. Przypadek mieszany

**File**: `tests/integration/deviation-review.int.test.ts`

**Intent**: Na wizycie z dwoma odstępstwami: POST `reviewed` z `[ownId1, ownId2, foreignIdOfB, randomUUID()]` → 200, `updated` = dokładnie `{ownId1, ownId2}`; baza A: tylko te dwa zmienione, reszta = migawka; baza B (`clientAs(B)`): obce odstępstwo `unreviewed`/`null` **plus** kontrola, że B je widzi. `afterAll`: usunięcie raportu B jako B.

**Contract**: bez logowania B przez aplikację; asercja na zbiorze id w `updated`, nie tylko na długości.

### Success Criteria:

#### Automated Verification:

- Nowy przypadek i `rls-isolation.int.test.ts` zielone lokalnie: `npm run test:integration`
- Lint i typy: `npm run lint`, `npx astro check`
- Kontrola czułości C: `review.ts` zwraca 404 przy `data.length < ids.length` → przypadek mieszany czerwony; cofnięte

#### Manual Verification:

- Przegląd: obcy wiersz sprawdzany jako B z kontrolą widoczności, nie tylko „brak w `updated`”

**Implementation Note**: Po zielonej automatyce zatrzymaj się na ręczne potwierdzenie przed fazą 3.

---

## Faza 3: #6 / klient — częściowy sukces włącza komunikat

### Overview

Wydzielić scalanie odpowiedzi endpointu z `updateDeviationStatus` do czystej funkcji w `src/lib/`, najpierw ją przetestować (red), potem przepiąć komponent (green). Wygląd, teksty i obsługa błędów sieci/HTTP bez zmian.

### Changes Required:

#### 1. Test jednostkowy (najpierw)

**File**: `src/lib/review-result.test.ts` (nowy)

**Intent**: Przypiąć: tylko wiersze z `updated` zmieniają `status`/`reviewed_at`, inne odstępstwa i wizyty bez zmian (także referencyjnie nienaruszone pola); `partial = false`, gdy każdy żądany id wrócił; `partial = true`, gdy brakuje ≥ 1 (jeden z wielu, wszystkie poza jednym); id spoza żądania w `updated` niczego nie psuje. Wywołania produkcyjne tylko wewnątrz `it()` (reguła Strykera, §6.1).

**Contract**: dane inline, bez fixture'ów i DOM.

#### 2. Czysta funkcja

**File**: `src/lib/review-result.ts` (nowy)

**Intent**: Logika z `DeviationsList.tsx:334-347` w postaci czystej funkcji, generycznej po kształcie wizyty (bez importu z komponentu).

**Contract**: `applyReviewResult<V extends { deviations: D[] }, D extends { id: string; status: …; reviewed_at: string | null }>(visits: V[], requestedIds: string[], updated: Pick<D, "id" | "status" | "reviewed_at">[]) → { visits: V[]; partial: boolean }`. `partial` = któryś z `requestedIds` nie występuje w `updated` (dla unikalnych id równoważne obecnemu `updated.length < ids.length`).

#### 3. Komponent korzysta z funkcji

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: `updateDeviationStatus` woła `applyReviewResult` w `setVisits` i ustawia `setActionError("review")` (z dotychczasowym `console.error`) przy `partial`. Reszta funkcji, w tym kolejność czyszczenia błędu i `pendingIds`, bez zmian.

**Contract**: brak zmian propsów, tekstów i klas; `npm run check:ui-tokens` zielony.

### Success Criteria:

#### Automated Verification:

- Test jednostkowy czerwony przed utworzeniem modułu, zielony po: `npx vitest run src/lib/review-result.test.ts`
- Wszystkie testy jednostkowe: `npm test`
- Lint, typy, tokeny UI, build: `npm run lint`, `npx astro check`, `npm run check:ui-tokens`, `npm run build`
- Kontrola czułości D: `partial` zawsze `false` w `review-result.ts` → test jednostkowy czerwony; cofnięte
- Testy integracyjne nadal zielone: `npm run test:integration`

#### Manual Verification:

- `/reports/[id]` lokalnie: oznaczenie i cofnięcie wizyty działa jak wcześniej (status, licznik postępu, brak komunikatu błędu)
- `/dev/kitchen-sink/report-details` renderuje 7 stanów bez zmian wizualnych

**Implementation Note**: Po zielonej automatyce zatrzymaj się na ręczne potwierdzenie przed fazą 4.

---

## Faza 4: Cookbook §6 i backport do test-planu

### Overview

Zapisać w `context/foundation/test-plan.md` to, czego faza nauczyła, i zamknąć jej status.

### Changes Required:

#### 1. Test-plan

**File**: `context/foundation/test-plan.md`

**Intent**: Backport korekt z research i wyników faz 1–3.

**Contract**:

- §2 Risk Response Guidance #6: warstwa = integracja endpointu (trwałość, zakres, kontrakt podzbioru) **+ unit** czystej funkcji scalającej (komunikat); dopisek, że render `Alert` nie jest dowodzony (e2e świadomie poza).
- §3 Phase 3: typy testów `integration, unit`; status `implementing` → `complete` dopiero po zielonym CI.
- §6.3: wzorzec „endpoint zapisu po liście id” — migawka wszystkich wierszy rodzica przed akcją i pełne porównanie po; przypadek mieszany (własne + obce zasiane przez `seedAs` + nieistniejące); asercja na zbiorze id w odpowiedzi; reference `deviation-review.int.test.ts`.
- §6.1: reference `src/lib/review-result.test.ts` jako przykład logiki wydzielonej z wyspy React.
- §6.5: notatka Phase 3 (2–3 linie): wyniki kontroli czułości A–D, decyzja unit zamiast e2e, Docker lokalnie.
- §8 Freshness Ledger: wpis z datą, jeśli sekcja tego wymaga.

### Success Criteria:

#### Automated Verification:

- Formatowanie: `npx prettier --check context/foundation/test-plan.md`
- CI na PR do `master` zielone (jobs `ci` i `smoke`), w tym `deviation-review.int.test.ts` w logu kroku `npm run test:integration`

#### Manual Verification:

- Przegląd test-planu: §2, §3, §6.1, §6.3, §6.5 spójne z tym, co faktycznie powstało

---

## Testing Strategy

### Unit Tests:

- `applyReviewResult`: pełny sukces, częściowy (jeden brak, wszystkie poza jednym), nieznany id w `updated`, nienaruszone sąsiednie wizyty/odstępstwa.

### Integration Tests:

- `deviation-review.int.test.ts`: zbiorczo, jedno z dwóch, cofnięcie, cykl, mieszany — każdy z pełną migawką bazy.
- Istniejące odmowy (`http-isolation`, `route-access`, `signout`, `rls-isolation`) bez zmian, poza importem `seedAs`.

### Manual Testing Steps:

1. `npx supabase start`, `.dev.vars` na lokalny Supabase, `npm run build && npm run preview`.
2. Zalogować się, wgrać `test-data/sample-report.csv`, oznaczyć wizytę Klient F zbiorczo, odświeżyć stronę — status utrzymany; cofnąć, odświeżyć — „Do sprawdzenia”.
3. Kitchen sink `report-details` — bez zmian wizualnych.

## Performance Considerations

Jedno logowanie i jedno wgranie na plik; ok. 6 dodatkowych żądań POST — pomijalny wpływ na czas joba `smoke` i limit logowań.

## Migration Notes

Brak zmian schematu i danych.

## References

- Research: `context/changes/testing-review-status/research.md`
- Endpoint: `src/pages/api/deviations/review.ts:32-69`
- Klient: `src/components/reports/DeviationsList.tsx:311-358`
- Wzorce: `tests/integration/http-isolation.int.test.ts:28-36`, `tests/integration/rls-isolation.int.test.ts:23-42`, `tests/integration/upload-oracle.int.test.ts`
- Poprzednia faza: `context/archive/2026-10-09-testing-report-save-integrity/plan.md`
- Test-plan: `context/foundation/test-plan.md` §2, §3, §6.1–§6.5

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: #6 / serwer — trwałość i zakres oznaczenia i cofnięcia

#### Automated

- [x] 1.1 Nowy plik zielony lokalnie — fb5be06
- [x] 1.2 Cały zestaw integracyjny zielony lokalnie — fb5be06
- [x] 1.3 Lint i typy — fb5be06
- [x] 1.4 Kontrola czułości A: usunięcie `.in("id", ids)` → czerwone; cofnięte — fb5be06
- [x] 1.5 Kontrola czułości B: `reviewedAt` zawsze `null` → czerwone; cofnięte — fb5be06

#### Manual

- [x] 1.6 Przegląd: każda asercja kończy się porównaniem pełnej migawki z bazy — fb5be06

### Phase 2: #6 / serwer — częściowa aktualizacja przy zbiorze mieszanym

#### Automated

- [x] 2.1 Nowy przypadek i `rls-isolation.int.test.ts` zielone lokalnie — e979010
- [x] 2.2 Lint i typy — e979010
- [x] 2.3 Kontrola czułości C: 404 przy częściowym wyniku → czerwone; cofnięte — e979010

#### Manual

- [x] 2.4 Przegląd: obcy wiersz sprawdzany jako B z kontrolą widoczności — e979010

### Phase 3: #6 / klient — częściowy sukces włącza komunikat

#### Automated

- [x] 3.1 Test jednostkowy czerwony przed modułem, zielony po — fab9143
- [x] 3.2 Wszystkie testy jednostkowe — fab9143
- [x] 3.3 Lint, typy, tokeny UI, build — fab9143
- [x] 3.4 Kontrola czułości D: `partial` zawsze `false` → czerwone; cofnięte — fab9143
- [x] 3.5 Testy integracyjne nadal zielone — fab9143

#### Manual

- [x] 3.6 `/reports/[id]`: oznaczenie i cofnięcie działa jak wcześniej — fab9143
- [x] 3.7 Kitchen sink `report-details` bez zmian wizualnych — fab9143

### Phase 4: Cookbook §6 i backport do test-planu

#### Automated

- [x] 4.1 Formatowanie test-planu — 68a0f1b
- [x] 4.2 CI na PR do `master` zielone, z nowym plikiem w logu — 68a0f1b

#### Manual

- [x] 4.3 Przegląd test-planu: §2, §3, §6.1, §6.3, §6.5 spójne — 68a0f1b
