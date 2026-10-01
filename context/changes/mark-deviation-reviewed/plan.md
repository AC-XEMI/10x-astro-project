# Oznaczanie odstępstwa jako sprawdzone Implementation Plan

## Overview

Piąty i ostatni wycinek milestone'u M-1 (roadmap S-05, FR-012/US-03): kierownik może oznaczyć dowolne odstępstwo jako "sprawdzone" (i cofnąć to oznaczenie), odwracalnie i trwale. W przeciwieństwie do poprzednich wycinków, przełączanie statusu dzieje się bez przeładowania strony — pierwszy w tym repo endpoint JSON wywoływany przez `fetch`, bo to akcja wykonywana wielokrotnie w jednej sesji przeglądu (w przeciwieństwie do rzadkiego usuwania raportu z S-04, gdzie pełne przeładowanie było świadomym wyborem).

## Current State Analysis

- Schemat jest już w pełni gotowy od F-01: `deviations.status` (enum `deviation_review_status`: `unreviewed`/`reviewed`, domyślnie `unreviewed`) i `deviations.reviewed_at` (`timestamptz`, nullable) — **zero migracji potrzebnej**.
- RLS: `deviations_update_own` (`supabase/migrations/20260925120100_report_schema_rls.sql`) już pozwala właścicielowi na `UPDATE` własnych odstępstw przez łańcuch `visit→report`, identyczny kształt do już przetestowanej `reports_update_own` — ale nigdy nie było to jawnie sprawdzone automatycznie dla `deviations`.
- `src/middleware.ts:4` chroni dziś `["/dashboard", "/reports", "/api/reports"]` — **nie chroni `/api/deviations`**, nowy prefiks musi zostać dodany.
- `src/components/reports/DeviationsList.tsx` to jedyne miejsce renderujące odstępstwa. Wiersz podsumowania (linia 55) łączy nazwy reguł jedną wizyty w prosty string (`visit.deviations.map(d => d.rule).join(", ")`), bez żadnego rozróżnienia statusu. Rozwinięty wiersz (linie 84-95) pokazuje listę `detail` TYLKO dla odstępstw, które je mają (`filter(d => d.detail)`) — `missing_gps` nie ma `detail`, więc jest całkowicie pomijane w tej sekcji. Żeby dodać przełącznik do KAŻDEGO odstępstwa (nie tylko tych z `detail`), ta sekcja musi zostać rozszerzona na pełną listę wszystkich odstępstw wizyty.
- Wszystkie dotychczasowe API routes (`signin.ts`, `signup.ts`, `signout.ts`, `upload.ts`, `delete.ts`) to natywne formularze `POST` → `context.redirect(...)`, zero JSON. Ten plan świadomie wprowadza pierwszy wyjątek (ustalone w wywiadzie), bo częstotliwość użycia tej konkretnej akcji uzasadnia koszt nowego wzorca.
- `scripts/verify-rls.mjs` ma gotową infrastrukturę (dwóch użytkowników, zaseedowany raport+wizyta+odstępstwo) — już testuje `UPDATE`/`DELETE` na `reports`, ale nigdy na `deviations`.
- Lekcja z `context/foundation/lessons.md`: każdy nowy plik pod `src/pages/api/**` musi eksportować `export const prerender = false;` — dotyczy nowego endpointu w tym planie.

## Desired End State

Na `/reports/[id]` kierownik widzi w wierszu podsumowania każdej wizyty licznik "X/Y sprawdzone" obok nazw reguł oraz przycisk oznaczający/cofający wszystkie odstępstwa tej wizyty naraz, bez przeładowania strony. Po rozwinięciu wiersza widzi pełną listę wszystkich odstępstw (reguła, `detail` jeśli istnieje, status) z indywidualnym przyciskiem przełączania dla każdego z osobna. Zamknięcie i ponowne otwarcie raportu (przeładowanie strony) pokazuje ten sam, trwale zapisany status.

Weryfikacja: `npm run verify:rls` kończy się kodem 0 z nową asercją (właściciel może zmienić status własnego odstępstwa, cudze konto nie może); ręczne przełączenie w przeglądarce potwierdza natychmiastową aktualizację UI i trwałość po przeładowaniu strony.

### Key Discoveries:

- Zero migracji — `status`/`reviewed_at` istnieją od F-01, RLS już gotowe.
- Pierwszy endpoint JSON i pierwszy `fetch` w kliencie w tym repo — świadomy wyjątek od wzorca natywnych formularzy, uzasadniony częstotliwością akcji (patrz "Critical Implementation Details").
- Sekcja "Szczegóły odstępstw" z S-02 (filtrowana do `detail`) jest rozszerzana na pełną listę wszystkich odstępstw — nie każde odstępstwo ma `detail` (np. `missing_gps`), ale każde potrzebuje przełącznika statusu.

## What We're NOT Doing

- Filtrowanie/sortowanie listy wg statusu przeglądu — poza zakresem MVP (analogicznie do FR-007 dla listy odstępstw ogólnie).
- Wizualne wyciszanie (przygaszanie) w pełni sprawdzonych wierszy — sam licznik/odznaka wystarcza (ustalone w wywiadzie), bez dodatkowej logiki stylowania warunkowego.
- Oddzielny endpoint dla pojedynczego i zbiorczego przełączania — jeden endpoint przyjmujący tablicę `ids` obsługuje oba przypadki (ustalone w wywiadzie).
- Potwierdzenie/modal przed przełączeniem statusu — akcja jest odwracalna i niskiego ryzyka, w przeciwieństwie do nieodwracalnego usuwania z S-04; zwykły klik wystarcza.
- Ślad audytowy "kiedykolwiek sprawdzone" — `reviewed_at` jest czyszczone do `null` przy cofnięciu (ustalone w wywiadzie), nie zachowuje historii.
- Jakiekolwiek zmiany w `src/pages/api/reports/**`, `ReportsList.tsx`, czy schemacie bazy — ten plan dotyka wyłącznie nowego endpointu `/api/deviations/review`, `DeviationsList.tsx`, `middleware.ts` i `scripts/verify-rls.mjs`.

## Implementation Approach

Nowy endpoint `POST /api/deviations/review` przyjmuje `{ ids: string[], status: "reviewed" | "unreviewed" }` — jawny stan docelowy obliczony przez klienta (nie "ślepe" przełączanie po stronie serwera), bo klient i tak śledzi bieżący stan lokalnie. To jeden kontrakt dla obu przypadków: pojedyncze przełączenie (rozwinięty wiersz, `ids` z jednym elementem) i zbiorcze (wiersz podsumowania, `ids` wszystkich odstępstw tej wizyty). RLS filtruje `ids` do faktycznie należących do właściciela — endpoint zwraca tylko rzeczywiście zaktualizowane wiersze (`.select()` po `.update()`), a klient aktualizuje swój lokalny stan WYŁĄCZNIE na podstawie tego, co serwer faktycznie potwierdził, nie na podstawie żądania.

`DeviationsList.tsx` przechodzi z czysto prezentacyjnego komponentu na komponent z lokalnym stanem źródłowym (`useState` zainicjalizowany propsami) — każde udane przełączenie aktualizuje ten stan bezpośrednio, bez refetchowania całej strony. Wiersz podsumowania dostaje licznik `X/Y sprawdzone` i przycisk zbiorczy (z `stopPropagation`, żeby nie kolidował z istniejącym kliknięciem rozwijającym wiersz); rozwinięty wiersz dostaje pełną, wypunktowaną listę wszystkich odstępstw (nie tylko tych z `detail`, jak dziś) z indywidualnym przyciskiem dla każdego.

## Critical Implementation Details

**Pierwszy JSON API i pierwszy `fetch` w tym repo — świadomy, lokalny wyjątek** — każdy wcześniejszy endpoint to natywny formularz `POST` → `redirect`. Ten endpoint zwraca JSON i jest wołany przez `fetch` z komponentu React, bo przełączanie statusu przeglądu to akcja wykonywana wielokrotnie w jednej sesji (w przeciwieństwie do rzadkiego, jednorazowego usuwania raportu z S-04, gdzie pełne przeładowanie było świadomie zaakceptowane). Implementer nie powinien traktować tego jako sygnał do przepisania innych endpointów na JSON — to lokalna decyzja dla tej jednej, częstej interakcji.

**Middleware przekierowuje, nie zwraca 401 JSON, przy wygasłej sesji** — `src/middleware.ts` dla chronionych prefiksów robi `context.redirect("/auth/signin")` niezależnie od tego, czy żądanie oczekuje JSON czy HTML. Jeśli sesja kierownika wygaśnie dokładnie między załadowaniem strony a kliknięciem przełącznika, `fetch` dostanie przekierowanie (lub błąd sieciowy po przekierowaniu), nie czysty JSON 401. Klient musi to obsłużyć defensywnie (sprawdzić `response.ok` i `content-type` przed `response.json()`, nie zakładać że odpowiedź zawsze parsuje się jako JSON) — przy błędzie po prostu nie aktualizować stanu lokalnego i zalogować przez `console.error` (ten sam wzorzec co w S-04 dla błędu zapytania o listę raportów), bez dedykowanego UI błędu (brak w tym repo systemu powiadomień/toastów).

## Phase 1: Backend — endpoint przełączania statusu

### Overview

Nowy endpoint JSON obsługujący pojedyncze i zbiorcze przełączanie statusu przeglądu odstępstw, plus ochrona middleware dla nowego prefiksu.

### Changes Required:

#### 1. Ochrona middleware

**File**: `src/middleware.ts`

**Intent**: Chronić nowy endpoint tak samo jak istniejące `/api/reports`.

**Contract**: rozszerzyć `PROTECTED_ROUTES` do `["/dashboard", "/reports", "/api/reports", "/api/deviations"]`.

#### 2. Endpoint przełączania statusu

**File**: `src/pages/api/deviations/review.ts` (nowy)

**Intent**: Jedyny endpoint zmieniający status przeglądu odstępstw — obsługuje zarówno pojedyncze, jak i zbiorcze przełączanie przez jedną tablicę `ids`.

**Contract**:

- `export const prerender = false;` (zgodnie z lekcją w `context/foundation/lessons.md`).
- `export const POST: APIRoute = async (context) => {...}`; `createClient(context.request.headers, context.cookies)`; brak klienta → `Response.json({ error: "..." }, { status: 503 })`; brak zalogowanego użytkownika → `Response.json({ error: "..." }, { status: 401 })` (JSON, nie redirect — to endpoint konsumowany przez `fetch`, nie formularz).
- Parsować body: `const { ids, status } = await context.request.json();`. Walidacja ręczna (brak zod w projekcie): `ids` musi być niepustą tablicą stringów, `status` musi być dokładnie `"reviewed"` lub `"unreviewed"` — inaczej `Response.json({ error: "..." }, { status: 400 })`.
- `const reviewedAt = status === "reviewed" ? new Date().toISOString() : null;`
- `supabase.from("deviations").update({ status, reviewed_at: reviewedAt }).in("id", ids).select()` — RLS (`deviations_update_own`) filtruje do faktycznie należących do właściciela; wiersze spoza konta po prostu nie są aktualizowane (0 wpływu), nie błąd.
- Błąd Supabase → `Response.json({ error: error.message }, { status: 500 })`.
- Sukces → `Response.json({ updated: data })` (status 200 domyślny) — `data` to dokładnie te wiersze, które faktycznie się zaktualizowały (może być mniej niż `ids.length`, jeśli część nie należała do właściciela).

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi

#### Manual Verification:

- Wywołanie endpointu (np. przez UI z Fazy 2) dla własnego odstępstwa zwraca `200` z zaktualizowanym wierszem, zapisanym trwale w bazie
- Próba wywołania dla odstępstwa należącego do innego konta zwraca `200` z pustą tablicą `updated` (RLS, nie błąd)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Frontend — licznik, przełączniki i lokalny stan

### Overview

`DeviationsList.tsx` przechodzi na lokalny stan źródłowy; wiersz podsumowania dostaje licznik i przycisk zbiorczy, rozwinięty wiersz dostaje pełną listę odstępstw z indywidualnymi przełącznikami.

### Changes Required:

#### 1. Lokalny stan i wywołania endpointu

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Przenieść źródło prawdy o statusach odstępstw z propsów do lokalnego stanu, zaktualizowanego po każdym udanym wywołaniu endpointu z Fazy 1, bez przeładowania strony.

**Contract**:

- `const [visits, setVisits] = useState<VisitWithDeviations[]>(initialVisits);` (props przemianowane na `initialVisits`, żeby nie kolidowały nazwą ze stanem).
- Funkcja pomocnicza `async function updateDeviationStatus(ids: string[], status: "reviewed" | "unreviewed")`: wywołuje `fetch("/api/deviations/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, status }) })`; sprawdza `response.ok` przed `response.json()` (patrz "Critical Implementation Details"); przy sukcesie aktualizuje `visits` — dla każdego zwróconego w `updated` wiersza podmienia odpowiadające `status`/`reviewed_at` w lokalnym stanie (po `id` odstępstwa); przy błędzie `console.error(...)`, bez zmiany stanu.
- Licznik w wierszu podsumowania: `const reviewedCount = visit.deviations.filter(d => d.status === "reviewed").length; const total = visit.deviations.length;` — tekst `({reviewedCount}/{total} sprawdzone)` obok istniejącej listy nazw reguł.
- Przycisk zbiorczy w wierszu podsumowania: etykieta `reviewedCount === total ? "Cofnij oznaczenie" : "Oznacz wszystkie"`; `onClick` z `e.stopPropagation()` (żeby nie wyzwalać rozwijania wiersza) wołający `updateDeviationStatus(visit.deviations.map(d => d.id), reviewedCount === total ? "unreviewed" : "reviewed")`.
- Rozwinięty wiersz: zastąpić istniejącą, filtrowaną do `detail` listę "Szczegóły odstępstw" pełną listą WSZYSTKICH odstępstw tej wizyty (`visit.deviations.map(...)`, bez `.filter(d => d.detail)`) — każdy element pokazuje nazwę reguły, `detail` (jeśli istnieje, inaczej pominięty), aktualny status (np. "Sprawdzone"/"Nieprzejrzane") i przycisk przełączający TYLKO to jedno odstępstwo: `onClick` wołający `updateDeviationStatus([deviation.id], deviation.status === "reviewed" ? "unreviewed" : "reviewed")`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi
- `npm run build` kończy się bez błędów

#### Manual Verification:

- Wiersz podsumowania pokazuje poprawny licznik "X/Y sprawdzone" i przycisk zbiorczy z poprawną etykietą zależną od stanu
- Kliknięcie przycisku zbiorczego oznacza/cofa WSZYSTKIE odstępstwa tej wizyty bez przeładowania strony i bez rozwijania wiersza
- Rozwinięty wiersz pokazuje KAŻDE odstępstwo wizyty (także `missing_gps` bez `detail`) z indywidualnym przyciskiem
- Kliknięcie indywidualnego przycisku przełącza TYLKO to jedno odstępstwo, licznik w wierszu podsumowania aktualizuje się natychmiast
- Przeładowanie strony (`F5`) pokazuje te same statusy — trwałość potwierdzona

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Testowanie — rozszerzenie weryfikacji RLS

### Overview

Dodanie jawnej asercji dla `UPDATE` na `deviations.status` — dotąd ta polityka nigdy nie była automatycznie sprawdzona, mimo że ma identyczny kształt do już przetestowanej `reports_update_own`.

### Changes Required:

#### 1. Rozszerzenie skryptu weryfikacji RLS

**File**: `scripts/verify-rls.mjs`

**Intent**: Jawny dowód dla NOWEGO użycia polityki `UPDATE` (na `deviations`, nie tylko `reports`) — właściciel może zmienić status, cudze konto nie może.

**Contract**: W `main()`, po istniejących asercjach (w tym tych dodanych w S-04 dla usuwania raportu — uwaga: ten plan NIE zależy od kolejności względem nich, ale `report`/`visit`/`deviation` z S-04 są już usunięte na końcu tamtego bloku, więc ta nowa asercja potrzebuje WŁASNEGO, świeżo zaseedowanego odstępstwa, nie może reużyć zmiennej `deviation` z wcześniejszej sekcji, jeśli ta już została usunięta kaskadowo): zaseedować nowe odstępstwo (albo przed sekcją usuwania z S-04, albo osobnym insertem), następnie `clientA.from("deviations").update({ status: "reviewed", reviewed_at: new Date().toISOString() }).eq("id", newDeviationId).select()` → asercja dokładnie 1 zaktualizowany wiersz; `clientB.from("deviations").update({ status: "reviewed" }).eq("id", newDeviationId).select()` → asercja dokładnie 0 wierszy (cudze konto nie może).

### Success Criteria:

#### Automated Verification:

- `npm run verify:rls` kończy się kodem 0 (rozszerzone asercje obejmują UPDATE na `deviations.status`)

#### Manual Verification:

- Przegląd logu skryptu pokazuje jawne asercje dla zmiany statusu własnego odstępstwa i blokady dla cudzego konta

---

## Testing Strategy

### Unit Tests:

Brak frameworka testowego (CLAUDE.md) — logika to w całości zapytanie Supabase + RLS, objęte wzorcem `scripts/verify-rls.mjs`.

### Integration Tests:

`scripts/verify-rls.mjs` — jedyny automatyczny dowód poprawności autoryzacji zmiany statusu.

### Manual Testing Steps:

1. Zalogować się jako testowy kierownik, wejść na `/reports/[id]` z raportem mającym co najmniej jedną wizytę z dwoma różnymi odstępstwami (np. `missing_gps` + `route_deviation` na tej samej wizycie, z wcześniejszych fixture'ów testowych).
2. Potwierdzić licznik "0/2 sprawdzone" i przycisk "Oznacz wszystkie" w wierszu podsumowania.
3. Rozwinąć wiersz, potwierdzić że WIDAĆ oba odstępstwa (w tym `missing_gps` bez `detail`), każde z własnym przyciskiem.
4. Kliknąć przełącznik przy jednym odstępstwie, potwierdzić że tylko ono zmienia status, a licznik w wierszu podsumowania aktualizuje się na "1/2 sprawdzone" bez przeładowania strony.
5. Kliknąć przycisk zbiorczy "Oznacz wszystkie", potwierdzić że oba odstępstwa stają się sprawdzone, licznik "2/2", etykieta przycisku zmienia się na "Cofnij oznaczenie".
6. Kliknąć "Cofnij oznaczenie", potwierdzić że oba wracają do nieprzejrzanych.
7. Przeładować stronę (F5), potwierdzić że ostatni zapisany stan się utrzymał.

## Performance Considerations

Brak wpływu — jedno zapytanie `UPDATE ... WHERE id IN (...)` na klik, ograniczone do co najwyżej kilku id naraz (liczba odstępstw jednej wizyty); brak paginacji ani dużych list po stronie tego endpointu.

## Migration Notes

Brak — `deviations.status` i `deviations.reviewed_at` istnieją od F-01; ten plan nie zmienia schematu.

## References

- `context/foundation/prd.md` (v2) — FR-012, US-03
- `context/foundation/roadmap.md` — S-05 (ten change), Prerequisites: F-01, S-01
- `context/foundation/lessons.md` — `prerender = false` dla nowych API routes
- GitHub issue #7 — potwierdza brak makiet UI, decyzje wizualne/interakcyjne rozstrzygnięte w wywiadzie
- `context/archive/2026-09-25-report-data-schema/plan.md` — schemat `deviations.status`/`reviewed_at`, polityka `deviations_update_own`
- `context/archive/2026-10-01-delete-uploaded-report/plan.md` — precedens świadomego wyboru mechanizmu (tam: natywny formularz; tu: fetch, z uzasadnieniem różnicy)
- `src/components/reports/DeviationsList.tsx` — komponent rozszerzany
- `scripts/verify-rls.mjs` — istniejąca infrastruktura testowa, rozszerzana w Fazie 3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Backend — endpoint przełączania statusu

#### Automated

- [x] 1.1 `npm run lint` przechodzi — 6252fea
- [x] 1.2 `npx astro check` przechodzi — 6252fea

#### Manual

- [x] 1.3 Wywołanie endpointu dla własnego odstępstwa zwraca 200 z zaktualizowanym wierszem — 6252fea
- [x] 1.4 Próba dla cudzego odstępstwa zwraca 200 z pustą tablicą `updated` — 6252fea

### Phase 2: Frontend — licznik, przełączniki i lokalny stan

#### Automated

- [x] 2.1 `npm run lint` przechodzi — 5a00fe4
- [x] 2.2 `npx astro check` przechodzi — 5a00fe4
- [x] 2.3 `npm run build` kończy się bez błędów — 5a00fe4

#### Manual

- [x] 2.4 Licznik "X/Y sprawdzone" i przycisk zbiorczy poprawne w wierszu podsumowania — 5a00fe4
- [x] 2.5 Przycisk zbiorczy oznacza/cofa wszystkie odstępstwa bez przeładowania i bez rozwijania wiersza — 5a00fe4
- [x] 2.6 Rozwinięty wiersz pokazuje każde odstępstwo (także bez `detail`) z własnym przyciskiem — 5a00fe4
- [x] 2.7 Indywidualny przełącznik zmienia tylko jedno odstępstwo, licznik aktualizuje się natychmiast — 5a00fe4
- [x] 2.8 Przeładowanie strony potwierdza trwałość zapisanego stanu — 5a00fe4

### Phase 3: Testowanie — rozszerzenie weryfikacji RLS

#### Automated

- [x] 3.1 `npm run verify:rls` kończy się kodem 0 — c79db47

#### Manual

- [x] 3.2 Log skryptu pokazuje jawne asercje dla zmiany statusu własnego odstępstwa i blokady dla cudzego konta — c79db47
