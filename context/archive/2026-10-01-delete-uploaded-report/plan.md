# Usuwanie wgranego raportu Implementation Plan

## Overview

Czwarty wycinek (roadmap S-04, FR-011/US-02): kierownik może usunąć dowolny, wcześniej wgrany raport po jawnym potwierdzeniu w modalu; raport oraz wszystkie powiązane wizyty i odstępstwa znikają z listy i bazy dla tego konta. Plan naprawia też lukę, którą roadmapa i powiązany GitHub issue błędnie zakładały za już rozwiązaną: **żadna lista wcześniej wgranych raportów nigdy nie powstała** (S-01 jawnie odłożyło ją do tego wycinka) — bez niej kierownik nie miałby jak nawigować do raportu sprzed bieżącej sesji, żeby go usunąć.

## Current State Analysis

- `src/pages/reports/index.astro` to wyłącznie formularz uploadu — brak jakiejkolwiek listy/historii wcześniej wgranych raportów.
- `src/pages/reports/[id].astro` pokazuje wynik JEDNEGO, konkretnego raportu (wizyty + odstępstwa); dostępny tylko jeśli użytkownik zna/zapamiętał URL.
- Kaskadowe usuwanie jest już w pełni gotowe: `visits.report_id` i `deviations.visit_id` mają `ON DELETE CASCADE` (`supabase/migrations/20260925120000_create_report_schema.sql`), potwierdzone też komentarzem w `src/pages/api/reports/upload.ts:91-97` ("report_id has ON DELETE CASCADE..."). Usunięcie wiersza `reports` wystarczy — zero dodatkowej logiki czyszczenia.
- `scripts/verify-rls.mjs:120-122` JUŻ dowodzi, że user B nie może usunąć raportu user A (`clientB.from("reports").delete()` zwraca 0 wierszy) — ścieżka negatywna autoryzacji jest pokryta; ten plan dokłada tylko ścieżkę pozytywną (właściciel MOŻE usunąć, kaskada działa).
- `src/middleware.ts:4` chroni już `/reports` i `/api/reports` przez dopasowanie prefiksu — nowe trasy pod tymi ścieżkami (`/api/reports/[id]/delete`) są automatycznie chronione, zero zmian w middleware.
- `src/components/Banner.astro` ma warianty `info`/`warning`/`error` — `info` nadaje się na komunikat sukcesu usunięcia, zero zmian w komponencie.
- Jedyny istniejący shadcn prymityw interaktywny to `table.tsx` (z S-01); brak `dialog.tsx` — potrzebna pierwsza instalacja komponentu Dialog w tym repo.
- `src/components/reports/DeviationsList.tsx` to jedyny istniejący precedens React islandu w tej sekcji aplikacji: jeden komponent `client:load` dostaje całą tablicę danych jako props i sam zarządza stanem interaktywnym (tam: rozwijanie wierszy) — nowy `ReportsList.tsx` powiela ten sam wzorzec dla stanu modala usuwania.
- Wszystkie dotychczasowe API routes (`signin.ts`, `signup.ts`, `signout.ts`, `upload.ts`) to natywne formularze `POST` → `context.redirect(...)`; w repo nie ma ani jednego endpointu zwracającego JSON.

## Desired End State

Na `/reports` kierownik widzi formularz uploadu oraz listę wcześniej wgranych raportów (nazwa pliku, data wgrania, liczba wierszy, link do szczegółów), posortowaną od najnowszych, stronicowaną linkami. Kliknięcie "Usuń" przy raporcie otwiera modal z jego szczegółami i ostrzeżeniem o nieodwracalności; potwierdzenie usuwa raport wraz z powiązanymi wizytami i odstępstwami, po czym `/reports` pokazuje baner potwierdzający usunięcie, a raport znika z listy.

Weryfikacja: `npm run verify:rls` kończy się kodem 0 z asercjami pokrywającymi zarówno brak uprawnień cudzego konta (już istniejące), jak i poprawne usunięcie własnego raportu wraz z kaskadą (nowe); ręczne usunięcie raportu w przeglądarce potwierdza zniknięcie z listy i z bazy.

### Key Discoveries:

- Kaskadowe usuwanie i autoryzacja (RLS) są już w pełni gotowe i częściowo przetestowane — ten plan dodaje wyłącznie: endpoint wywołujący `DELETE`, UI listy, i brakującą asercję pozytywną.
- `ReportsList.tsx` to pierwszy komponent w repo łączący shadcn `Dialog` z natywnym formularzem `POST` (patrz "Critical Implementation Details") — nie pierwszy JSON-owy klient API, bo go nie ma.

## What We're NOT Doing

- Paginacja przez JSON API / doklejanie wyników bez przeładowania strony — linki stron server-side (`?page=N`), zero nowych endpointów zwracających JSON (ustalone w wywiadzie).
- Wpisywanie nazwy pliku jako dodatkowe potwierdzenie usuwania — jeden przycisk "Tak, usuń" po ostrzeżeniu wystarcza (ustalone w wywiadzie).
- Osobna strona/trasa na listę raportów — scalona z istniejącym `/reports` (ustalone w wywiadzie).
- Reguła "oznacz jako sprawdzone" (FR-012, S-05) — osobny wycinek.
- Sortowanie/filtrowanie listy raportów wg innych kryteriów niż data — poza zakresem MVP (analogicznie do FR-007 dla listy odstępstw).
- Miękkie usuwanie / kosz / możliwość przywrócenia — US-02 wprost wymaga, że "po usunięciu raportu nie da się go odzyskać z poziomu UI"; usuwanie jest trwałe i natychmiastowe.

## Implementation Approach

Endpoint usuwania (Faza 1) jest cienką warstwą identyczną w duchu do `upload.ts` — autoryzacja → `DELETE FROM reports WHERE id = ...` (RLS gwarantuje, że cudzy raport nie zostanie usunięty, zwracając 0 wierszy zamiast błędu) → redirect z komunikatem. UI (Faza 2) dodaje drugi React island w tej sekcji aplikacji (`ReportsList.tsx`), zbudowany dokładnie na wzorcu `DeviationsList.tsx` — jeden komponent, cała tablica raportów jako props, lokalny stan na "który raport jest aktualnie potwierdzany do usunięcia". Modal (shadcn `Dialog`) jest czysto wizualną warstwą potwierdzenia; rzeczywiste usunięcie nadal idzie przez natywny formularz `POST` wewnątrz modala, więc całość zachowuje istniejący wzorzec przeładowania strony zamiast wprowadzać fetch/JSON. Paginacja (strony `?page=N`) jest renderowana jako statyczne linki w pliku `.astro`, poza islandem — to czysta nawigacja, nie wymaga stanu React.

## Critical Implementation Details

**Modal opakowuje natywny formularz, nie wywołuje fetch** — `ReportsList.tsx` zarządza lokalnym stanem WIDOCZNOŚCI modala (który raport jest "w trakcie potwierdzania"), ale przycisk "Tak, usuń" wewnątrz `Dialog` jest zwykłym `<button type="submit">` natywnego `<form method="POST" action="/api/reports/{id}/delete">`. Kliknięcie powoduje pełne przeładowanie strony (redirect z endpointu), tak jak wszędzie indziej w aplikacji — implementer nie powinien sięgać po `fetch`/`JSON`, żeby "upłynnić" to doświadczenie, bo wprowadziłoby to pierwszy JSON-owy wzorzec komunikacji w repo dla jednej, pojedynczej funkcji.

## Phase 1: Backend — endpoint usuwania raportu

### Overview

Nowy endpoint wywołujący usunięcie raportu (kaskada już gotowa), z przekierowaniem niosącym komunikat sukcesu lub błędu.

### Changes Required:

#### 1. Endpoint usuwania

**File**: `src/pages/api/reports/[id]/delete.ts` (nowy)

**Intent**: Jedyny punkt wejścia usuwający raport — mirror wzorca `src/pages/api/reports/upload.ts` (auth → operacja Supabase → redirect).

**Contract**:

- `export const POST: APIRoute = async (context) => {...}`; `createClient(context.request.headers, context.cookies)`; brak klienta → redirect `/reports?error=...`; brak zalogowanego użytkownika → redirect `/auth/signin` (mirror `upload.ts`).
- `const { id } = context.params;` — `supabase.from("reports").delete().eq("id", id ?? "").select()`.
- Błąd Supabase → redirect `/reports?error=${encodeURIComponent(error.message)}`.
- Zero usuniętych wierszy (raport nie istnieje LUB należy do innego konta — RLS zwraca pusty wynik w obu przypadkach, tak jak `/reports/[id].astro` już to obsługuje dla odczytu) → redirect `/reports?error=${encodeURIComponent("Nie znaleziono raportu lub brak uprawnień.")}`.
- Sukces (dokładnie 1 usunięty wiersz) → redirect `/reports?deleted=1`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi

#### Manual Verification:

- Ręczne wywołanie usunięcia własnego raportu (np. przez UI z Fazy 2, albo bezpośrednio formularzem) kończy się przekierowaniem na `/reports?deleted=1`, a raport znika z bazy (Supabase Studio/zdalny projekt)
- Próba usunięcia raportu należącego do innego konta (lub nieistniejącego id) kończy się przekierowaniem z komunikatem błędu, bez wpływu na dane

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Frontend — lista raportów i modal potwierdzenia

### Overview

Instalacja shadcn `Dialog`, nowy React island z tabelą raportów i modalem usuwania, rozszerzenie `/reports` o zapytanie z paginacją i banery sukcesu/błędu.

### Changes Required:

#### 1. Instalacja komponentu shadcn

**File**: `src/components/ui/dialog.tsx` (nowy, generowany)

**Intent**: Pierwszy modal w repo — instalacja przez oficjalną ścieżkę projektu.

**Contract**: `npx shadcn@latest add dialog` (styl "new-york" per `components.json`).

#### 2. Komponent listy z modalem usuwania

**File**: `src/components/reports/ReportsList.tsx` (nowy)

**Intent**: Jedyny interaktywny element tej sekcji — tabela wcześniej wgranych raportów z przyciskiem usuwania otwierającym modal potwierdzenia, zbudowany na wzorcu `DeviationsList.tsx`.

**Contract**:

- Props: `{ reports: Tables<"reports">[] }`.
- Pusta tablica → komunikat "Nie masz jeszcze żadnych wgranych raportów." zamiast tabeli.
- Niepusta → shadcn `Table` z kolumnami: nazwa pliku, data wgrania, liczba wierszy, link "Zobacz" (`/reports/{id}`), przycisk "Usuń".
- Lokalny `useState<Tables<"reports"> | null>` przechowuje raport aktualnie potwierdzany do usunięcia; kliknięcie "Usuń" go ustawia, otwierając shadcn `Dialog`.
- Zawartość `Dialog`: nazwa pliku, data wgrania, liczba wierszy usuwanego raportu + ostrzeżenie "Tej operacji nie można cofnąć."; wewnątrz natywny `<form method="POST" action={\`/api/reports/${report.id}/delete\`}>` z przyciskiem submit "Tak, usuń" oraz przyciskiem `type="button"` "Anuluj" zamykającym modal (patrz "Critical Implementation Details" — żadnego `fetch`).

#### 3. Rozszerzenie strony `/reports`

**File**: `src/pages/reports/index.astro`

**Intent**: Dodać zapytanie o wcześniej wgrane raporty z paginacją i osadzić `ReportsList`, zachowując istniejący formularz uploadu.

**Contract**:

- Stała `const PAGE_SIZE = 20;` (sztywna wartość inżynierska, analogicznie do limitu 5 MB z S-01).
- `const page = Math.max(1, Number(Astro.url.searchParams.get("page")) || 1);`
- `supabase.from("reports").select("*", { count: "exact" }).order("uploaded_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)` (RLS ogranicza wynik do właściciela, bez jawnego `.eq("user_id", ...)` — mirror wzorca z `/reports/[id].astro`).
- `Astro.url.searchParams.get("deleted")` → `<Banner variant="info">Raport został usunięty.</Banner>`, zachowując istniejącą obsługę `error`.
- Linki paginacji ("Poprzednia"/"Następna") jako statyczne `<a href="/reports?page=N">`, renderowane w `.astro`, poza islandem (czysta nawigacja, bez stanu React) — "Poprzednia" ukryta na `page === 1`, "Następna" ukryta gdy `(page * PAGE_SIZE) >= count`.
- `<ReportsList reports={reports} client:load />` pod sekcją formularza uploadu.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi
- `npm run build` kończy się bez błędów

#### Manual Verification:

- `/reports` pokazuje listę wcześniej wgranych raportów pod formularzem uploadu, posortowaną od najnowszych
- Kliknięcie "Usuń" otwiera modal ze szczegółami raportu (nazwa, data, liczba wierszy) i ostrzeżeniem
- Potwierdzenie w modalu usuwa raport, przekierowuje na `/reports?deleted=1` z widocznym banerem sukcesu, a raport znika z listy
- Przycisk "Anuluj" zamyka modal bez usuwania raportu
- Przy więcej niż `PAGE_SIZE` raportach, linki "Poprzednia"/"Następna" poprawnie nawigują i chowają się na granicach listy

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Testowanie — rozszerzenie weryfikacji RLS

### Overview

Dodanie ścieżki pozytywnej (właściciel usuwa własny raport, kaskada działa) do istniejącego skryptu, który już dowodzi ścieżki negatywnej (cudzy raport jest chroniony).

### Changes Required:

#### 1. Rozszerzenie skryptu weryfikacji RLS

**File**: `scripts/verify-rls.mjs`

**Intent**: Dopełnić istniejące asercje "user B nie może usunąć raportu A" o "user A MOŻE usunąć własny raport, a kaskada usuwa powiązaną wizytę i odstępstwo" — ten sam skrypt już ma gotową infrastrukturę (dwóch użytkowników, zaseedowany raport+wizyta+odstępstwo) idealnie pasującą do tego testu.

**Contract**: Na końcu `main()`, po istniejących asercjach user B: `clientA.from("reports").delete().eq("id", report.id).select()` → asercja dokładnie 1 usuniętego wiersza; następnie `clientA.from("visits").select().eq("id", visit.id)` i `clientA.from("deviations").select().eq("id", deviation.id)` → obie asercje dokładnie 0 wyników (dowód kaskady).

### Success Criteria:

#### Automated Verification:

- `npm run verify:rls` kończy się kodem 0 (rozszerzone asercje obejmują usunięcie własnego raportu i kaskadę)

#### Manual Verification:

- Przegląd logu skryptu pokazuje jawne asercje dla usunięcia własnego raportu i zniknięcia powiązanej wizyty/odstępstwa

---

## Testing Strategy

### Unit Tests:

Brak frameworka testowego (CLAUDE.md) — logika usuwania to w całości zapytanie Supabase + RLS, już objęte wzorcem `scripts/verify-rls.mjs` (wymaga lokalnego Supabase, `npx supabase start`).

### Integration Tests:

`scripts/verify-rls.mjs` — jedyny automatyczny dowód poprawności autoryzacji i kaskady usuwania.

### Manual Testing Steps:

1. Zalogować się jako testowy kierownik, wejść na `/reports`.
2. Potwierdzić, że lista pokazuje wcześniej wgrane raporty (z poprzednich zmian/testów) posortowane od najnowszych.
3. Kliknąć "Usuń" przy jednym z raportów, potwierdzić że modal pokazuje poprawne szczegóły.
4. Kliknąć "Anuluj", potwierdzić że raport nadal jest na liście.
5. Ponownie kliknąć "Usuń", potwierdzić w modalu, potwierdzić baner sukcesu i zniknięcie raportu z listy.
6. Spróbować wejść na `/reports/{usunięte-id}` — potwierdzić komunikat "nie znaleziono raportu" (istniejąca obsługa).

## Performance Considerations

Brak wpływu — jedno zapytanie `DELETE` plus `ON DELETE CASCADE` w bazie; lista raportów stronicowana (`PAGE_SIZE = 20`) więc zapytanie `SELECT` zawsze ograniczone, zgodnie z `target_scale: small` z PRD.

## Migration Notes

Brak — schemat bazy (w tym `ON DELETE CASCADE`) już istnieje od F-01; ten plan nie dodaje ani nie zmienia żadnej kolumny.

## References

- `context/foundation/prd.md` (v2) — FR-011, US-02
- `context/foundation/roadmap.md` — S-04 (ten change), Prerequisites: F-01, S-01
- GitHub issue #6 — potwierdza brak szczegółowego UX potwierdzenia; błędne założenie o istniejącej liście raportów skorygowane w wywiadzie
- `context/archive/2026-09-25-report-data-schema/plan.md` — `ON DELETE CASCADE` na `visits`/`deviations`
- `src/pages/api/reports/upload.ts` — wzorzec endpointu (auth → operacja → redirect)
- `src/components/reports/DeviationsList.tsx` — wzorzec React islandu (cała tablica jako props, lokalny stan interaktywny)
- `scripts/verify-rls.mjs` — istniejąca infrastruktura testowa dwóch użytkowników, rozszerzana w Fazie 3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Backend — endpoint usuwania raportu

#### Automated

- [x] 1.1 `npm run lint` przechodzi — 0b733fa
- [x] 1.2 `npx astro check` przechodzi — 0b733fa

#### Manual

- [x] 1.3 Usunięcie własnego raportu przekierowuje na `/reports?deleted=1` i usuwa dane z bazy — 0b733fa
- [x] 1.4 Próba usunięcia cudzego/nieistniejącego raportu kończy się błędem bez wpływu na dane — 0b733fa

### Phase 2: Frontend — lista raportów i modal potwierdzenia

#### Automated

- [x] 2.1 `npm run lint` przechodzi — c96e27b
- [x] 2.2 `npx astro check` przechodzi — c96e27b
- [x] 2.3 `npm run build` kończy się bez błędów — c96e27b

#### Manual

- [x] 2.4 `/reports` pokazuje listę wcześniej wgranych raportów posortowaną od najnowszych — c96e27b
- [x] 2.5 Kliknięcie "Usuń" otwiera modal z poprawnymi szczegółami raportu — c96e27b
- [x] 2.6 Potwierdzenie usuwa raport, pokazuje baner sukcesu, raport znika z listy — c96e27b
- [x] 2.7 "Anuluj" zamyka modal bez usuwania — c96e27b
- [x] 2.8 Linki paginacji poprawnie nawigują i chowają się na granicach listy — c96e27b

### Phase 3: Testowanie — rozszerzenie weryfikacji RLS

#### Automated

- [x] 3.1 `npm run verify:rls` kończy się kodem 0 — 481b936

#### Manual

- [x] 3.2 Log skryptu pokazuje jawne asercje usunięcia własnego raportu i kaskady — 481b936
