---
project: "Kontrola Trasówek"
version: 1
status: draft
created: 2026-09-25
updated: 2026-10-08
prd_version: 2
main_goal: quality
top_blocker: decisions
milestone_id: error-visibility-and-test-plan
milestone_seq: 4
milestone_status: open
---

# Roadmap: Kontrola Trasówek

> Wygenerowane z `context/foundation/prd.md` + auto-zbadanej bazowej kondycji kodu.
> Edytuj w miejscu; archiwizuj, gdy zostanie zastąpione.
> Wycinki poniżej są w kolejności zależności. Tabela "At a glance" to indeks.

## Milestone

**M-4: Widoczność błędów i plan testów** — Status: open

- **Intent:** Gdy coś w aplikacji zawiedzie, zespół może to później zobaczyć i zrozumieć (dziś błędy są widoczne tylko na żywo przez `wrangler tail`), a najważniejsze przepływy — wybrane na podstawie mapy ryzyk, nie intuicji — są chronione testami w CI.
- **Source materials:** opis użytkownika (kotwice poniżej): „Observability + plan testów” — dwaj kandydaci z Baseline i z otwartych pytań roadmapy po zamknięciu M-3.
- **Done when:** F-03 oraz S-16…S-20 są wszystkie `done`.
- **Scope anchors:**
  - MS-01: Błędy i kluczowe zdarzenia aplikacji są rejestrowane trwale, z kodem i kontekstem (bez danych osobowych), i można je przejrzeć po fakcie — nie tylko podglądając logi na żywo.
  - MS-02: Krytyczne przepływy aplikacji, wskazane przez plan testów oparty na ryzykach, są chronione testami uruchamianymi w CI.

Kotwice zamkniętego M-3 (F-02 i S-08…S-15 odwołują się do nich z prefiksem `M-3`, żeby nie mylić ich z kotwicami M-4):

  - M-3 MS-01: Każdy widok aplikacji (Raporty, Szczegóły raportu, Pulpit, Strona startowa, strony logowania) korzysta z tokenów i wspólnych komponentów design systemu, ma udokumentowany kontrakt i stronę „kitchen sink” z 7 stanami w jasnym i ciemnym motywie, a treść komunikatów z Claude Design zostaje bez zmian.
  - M-3 MS-02: Błędy logowania i rejestracji docierają do strony jako kody, a użytkownik widzi tylko przetłumaczony komunikat — nigdy surowy tekst z Supabase.
  - M-3 MS-03: W jasnym motywie karty, okna i przyciski wyraźnie odcinają się od tła strony, a każdy tekst na tle ma kontrast co najmniej 4.5:1.
  - M-3 MS-04: Logika parsowania raportu i reguł wykrywania odstępstw jest chroniona testami jednostkowymi uruchamianymi w CI, a ich skuteczność zmierzona testami mutacyjnymi.

## Vision recap

Kierownik regionalny ręcznie przegląda raporty aktywności przedstawicieli handlowych, żeby wychwycić odstępstwa od normy (nieoptymalne trasy, telefon zamiast wizyty, wyłączone GPS) — dane do oceny już istnieją, ale ręczne wyciąganie z nich sensu jest czasochłonne i zbyt wolne, żeby robić to systematycznie dla całego zespołu. Wzorce odstępstw widać dopiero po zestawieniu wielu raportów w czasie, nie z pojedynczego raportu.

## North star

**S-01: Kierownik wgrywa raport i widzi wizyty z brakującym GPS oznaczone jako odstępstwo** (`done`, zarchiwizowane) — najmniejszy pełny przepływ (login → upload → ekstrakcja → zapis → detekcja → lista → szczegóły), który już udowodnił, że cała koncepcja narzędzia działa.

> "Gwiazda przewodnia" (north star) to najmniejszy pełny wycinek funkcjonalności, który — jeśli się uda — dowodzi, że główna hipoteza produktu jest słuszna. Umieszczamy go możliwie wcześnie w kolejności, bo reszta ma sens tylko wtedy, gdy ten pierwszy przepływ faktycznie działa.

M-4 nie ma nowej hipotezy produktu — to praca nad niezawodnością istniejących funkcji. Pierwszym wycinkiem jest **S-16: nieudane wgranie lub usunięcie raportu zostawia trwały wpis z kodem błędu i kontekstem** — to główny przepływ produktu, a dziś jego błędy kończą jako `console.error` widoczne tylko na żywo. Jeśli ten jeden przepływ da się zdiagnozować po fakcie, ten sam wzorzec obejmie pozostałe (S-17…S-19).

## At a glance

| ID   | Change ID                        | Outcome (user can …)                                                              | Prerequisites | PRD refs                                              | Status   |
| ---- | --------------------------------- | ----------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------ | -------- |
| F-01 | report-data-schema                 | (foundation) Schemat i trwałość danych raportu w Supabase, izolowane per-użytkownik | —              | Access Control, NFR (izolacja danych)                  | done |
| F-02 | vitest-mutation-baseline           | (foundation) Testy jednostkowe w CI chronią parser i reguły wykrywania odstępstw     | F-01; reguły wykrywania z M-1 w kodzie | M-3 MS-04                                                 | done |
| S-01 | missing-gps-deviation-detection    | Kierownik wgrywa raport i widzi wizyty bez GPS oznaczone jako odstępstwo             | F-01           | FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, US-01  | done |
| S-02 | route-deviation-detection          | Kierownik widzi wizyty z nieoptymalną trasą/nadmiarowym dystansem jako odstępstwo    | F-01, S-01     | FR-009, US-01                                           | done |
| S-03 | phone-vs-visit-deviation-detection | Kierownik widzi aktywności "telefon zamiast wizyty" oznaczone jako odstępstwo        | F-01, S-01     | FR-010, US-01                                           | done |
| S-04 | delete-uploaded-report             | Kierownik usuwa błędnie wgrany raport wraz z powiązanymi danymi                      | F-01, S-01     | FR-011, US-02                                           | done |
| S-05 | mark-deviation-reviewed            | Kierownik oznacza odstępstwo jako sprawdzone/fałszywy alarm                          | F-01, S-01     | FR-012, US-03                                           | done |
| S-06 | filter-sort-deviations-list        | Kierownik filtruje/sortuje listę odstępstw (wg przedstawiciela, daty, reguły, statusu) | F-01, S-01     | FR-007                                                  | done |
| S-07 | export-deviations-list             | Kierownik eksportuje listę odstępstw do pliku                                        | F-01, S-01     | FR-008                                                  | done |
| S-08 | reports-list-ui-tokens             | Kierownik widzi listę raportów w spójnych kolorach marki, także w trybie ciemnym     | S-01           | M-3 MS-01                                                   | done |
| S-09 | reports-list-ui-contract           | Kierownik dostaje na liście raportów czytelne komunikaty i błędy wgrywania jako przetłumaczone kody | S-08 | M-3 MS-01                                              | done |
| S-10 | dashboard-ui-tokens                | Kierownik widzi Pulpit w spójnym układzie kart i kolorach serii reguł                | S-08           | M-3 MS-01                                                   | done |
| S-11 | landing-ui-contract                | Odwiedzający widzi czytelną stronę startową, także na telefonie i w trybie ciemnym   | S-08           | M-3 MS-01, M-3 MS-03                                            | done |
| S-12 | report-details-ui-contract         | Kierownik przegląda szczegóły raportu z klawiatury i na wąskim ekranie, z jasnymi błędami ładowania | S-08 | M-3 MS-01                                             | done |
| S-13 | ui-leftovers                       | Kierownik widzi wszystkie komunikaty w jednym komponencie Alert na każdym widoku     | S-09, S-12     | M-3 MS-01                                                   | done |
| S-14 | auth-error-codes                   | Użytkownik widzi przy logowaniu i rejestracji tylko przetłumaczony komunikat błędu   | S-01           | M-3 MS-02                                                   | done |
| S-15 | light-surface-tokens               | Kierownik w jasnym motywie odróżnia karty, okna i przyciski od tła strony            | S-09, S-10, S-11, S-12 | M-3 MS-03                                           | done |
| F-03 | risk-based-test-plan               | (foundation) Mapa ryzyk i fazy wdrażania testów zapisane w planie testów             | F-02           | MS-02                                                   | ready |
| S-16 | upload-error-visibility            | Zespół widzi po fakcie każde nieudane wgranie lub usunięcie raportu, z kodem błędu i kontekstem | —   | MS-01                                                   | done |
| S-17 | report-view-error-visibility       | Zespół widzi po fakcie błędy ładowania szczegółów raportu, oznaczania i eksportu      | S-16           | MS-01                                                   | proposed |
| S-18 | auth-error-visibility              | Zespół widzi po fakcie nieudane logowania i rejestracje jako kody, bez haseł i e-maili | S-16          | MS-01                                                   | proposed |
| S-19 | upload-duration-visibility         | Zespół widzi czas analizy każdego wgrania i może sprawdzić, czy wynik pojawia się w ciągu kilku sekund | S-16 | MS-01, NFR (wynik w ciągu kilku sekund)   | proposed |
| S-20 | critical-flows-test-rollout        | Krytyczne przepływy wskazane w planie testów są chronione testami w CI               | F-03           | MS-02                                                   | blocked |

## Baseline

Co już jest w kodzie na dzień `2026-10-08` (auto-zbadane i potwierdzone przy otwarciu M-4).
Foundations poniżej zakładają, że to jest już gotowe i tego nie budują od nowa.

- **Frontend:** present — Astro 7 SSR + React 19 islands, shadcn/ui; tokeny kolorów w `src/styles/global.css` (marka, serie reguł, rozdzielone powierzchnie w jasnym motywie), kontrakty widoków i strony `src/pages/dev/kitchen-sink/*` (per `CLAUDE.md`)
- **Backend / API:** present — Astro SSR + trasy API (`src/pages/api/auth/*`, `src/pages/api/reports/*`, `src/pages/api/deviations/review.ts`); błędy auth i raportów przekazywane jako kody (`src/lib/auth-errors.ts`, `src/lib/report-errors.ts`)
- **Data:** present — Supabase tabele `reports`, `visits`, `deviations` z RLS per-użytkownik (z F-01)
- **Auth:** present — Supabase Auth przez `@supabase/ssr` (`src/lib/supabase.ts`), middleware (`src/middleware.ts`)
- **Deploy / infra:** present — Cloudflare Workers, CI w GitHub Actions (`ci`: lint → `npm test` → `astro check` → build; `smoke` z lokalnym Supabase)
- **Testy:** partial — Vitest (`npm test`, `src/**/*.test.ts`) dla parsera, reguł i `geo` (98 testów), Stryker (`npm run test:mutation`) lokalnie, wynik 88.54% (z F-02); wgrywanie, API, auth, RLS i UI chronione tylko skryptami `smoke` i `verify:rls`; brak `context/foundation/test-plan.md`
- **Observability:** partial — Workers Logs włączone (`wrangler.jsonc` → `"observability": { "enabled": true }`), 18 wywołań `console.*` w `src/`; brak ustrukturyzowanych wpisów z kodem i kontekstem, śledzenia błędów, metryk i alertów; podgląd tylko na żywo przez `wrangler tail`, który pod obciążeniem próbkuje (`infrastructure.md`)

## Foundations

### F-01: Schemat i trwałość danych raportu

- **Outcome:** (foundation) Migracja Supabase tworzy tabele na raporty, wizyty/aktywności i odstępstwa, z politykami RLS izolującymi dane per-użytkownik. Dane wyekstrahowane z wgranego pliku trafiają do bazy zamiast pozostawać tylko w pamięci sesji. Tabela odstępstw ma pole statusu przeglądu (nieprzejrzane/sprawdzone) pod FR-012, a usunięcie raportu kaskadowo usuwa powiązane wizyty i odstępstwa pod FR-011.
- **Change ID:** report-data-schema
- **PRD refs:** Access Control (izolacja per-użytkownik), NFR (dane widoczne wyłącznie dla konta, które je wgrało)
- **Unlocks:** S-01, S-02, S-03, S-04, S-05; redukuje lukę bazową "Data: absent"; umożliwia weryfikowalną ścieżkę "kierownik wraca do wcześniej wgranych raportów pobranych z bazy"
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sekwencjonowana jako pierwsza, bo cel to `jakość` — bez trwałego, izolowanego per-użytkownik schematu żadna reguła wykrywania nie ma gdzie zapisać ani skąd odczytać wyników; odłożenie tego zwiększyłoby ryzyko przecieku danych między kontami.
- **Status:** done

### F-02: Testy jednostkowe i testy mutacyjne dla wykrywania odstępstw

- **Outcome:** (foundation) Vitest uruchamia w CI testy parsera raportów i trzech reguł wykrywania odstępstw (wyrocznia na przykładowych raportach CSV/XLSX plus przypadki graniczne); Stryker mierzy ich skuteczność lokalnie. Zastąpiło to wcześniejszy skrypt `verify:report-detection`.
- **Change ID:** vitest-mutation-baseline
- **PRD refs:** M-3 MS-04
- **Unlocks:** ścieżka weryfikacji dla każdej przyszłej zmiany reguł wykrywania lub parsera (regresja łapana w CI, zanim trafi na `master`); punkt wyjścia dla planu testów opartego na ryzykach
- **Prerequisites:** F-01; reguły wykrywania z M-1 w kodzie
- **Parallel with:** S-08, S-09, S-10, S-11, S-12, S-13, S-14, S-15
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Narzędzia testów mutacyjnych bywają wrażliwe na wersję Vitest i sposób uruchamiania testów; obie pułapki (Vitest 5, wywołania w ciele `describe`) zostały wykryte i opisane w `CLAUDE.md` oraz w archiwum zmiany.
- **Status:** done

### F-03: Plan testów oparty na ryzykach

- **Outcome:** (foundation) Plan testów zapisany w `context/foundation/test-plan.md`: 5–7 scenariuszy porażki w języku użytkownika, każdy z oceną skutku i prawdopodobieństwa, oraz fazy wdrażania testów, z których każda staje się osobną zmianą.
- **Change ID:** risk-based-test-plan
- **PRD refs:** MS-02
- **Unlocks:** S-20 (rozstrzyga jego blokujące pytanie „które przepływy chronić i w jakiej kolejności”); zamyka otwarte pytanie o następne kroki testowe z M-3
- **Prerequisites:** F-02
- **Parallel with:** S-16, S-17, S-18, S-19
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Powstaje przez `/10x-test-plan`, a nie `/10x-plan` — nie tworzy folderu zmiany o tym Change ID, więc jego status trzeba przestawić ręcznie po zapisaniu planu. Sekwencjonowany wcześnie, bo bez niego S-20 nie da się zaplanować.
- **Status:** ready

## Slices

### S-01: Kierownik wykrywa brak GPS w wgranym raporcie

- **Outcome:** Kierownik wgrywa raport i w ciągu kilku sekund widzi wizyty bez włączonego GPS oznaczone jako odstępstwo; po kliknięciu widzi pełny kontekst wizyty (data, przedstawiciel, dane z raportu).
- **Change ID:** missing-gps-deviation-detection
- **PRD refs:** FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, US-01
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** To gwiazda przewodnia — sekwencjonowana zaraz po F-01, najmniej złożona z trzech reguł (prosty warunek, bez silnika liczenia dystansu), więc najszybciej dowodzi, że cały pipeline (upload → ekstrakcja → zapis → detekcja → lista → szczegóły) działa.
- **Status:** done

### S-02: Kierownik wykrywa nieoptymalną trasę w wgranym raporcie

- **Outcome:** Kierownik widzi na liście odstępstw wizyty, które są poza zaplanowaną trasą lub mają nadmiarowy dystans/czas przejazdu ponad próg wynikający z najkrótszej trasy.
- **Change ID:** route-deviation-detection
- **PRD refs:** FR-009, US-01
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - Jaką dokładnie metodą liczyć próg dystansu/czasu do najkrótszej trasy (źródło współrzędnych, sposób obliczania odległości)? — Owner: team. Block: no (decyzja implementacyjna dla `/10x-plan`, nie blokuje sekwencjonowania na poziomie roadmapy).
- **Risk:** PRD samo nazywa tę regułę "realną pracą inżynierską" — najbardziej złożona z trzech reguł. Sekwencjonowana po S-01, żeby wzorce ekstrakcji/listy/szczegółów były już sprawdzone na prostszym przypadku.
- **Status:** done

### S-03: Kierownik wykrywa telefon zamiast wizyty w wgranym raporcie

- **Outcome:** Kierownik widzi na liście odstępstw aktywności oznaczone jako "telefon zamiast wizyty" — wprost z pola typu aktywności, albo (gdy pole nie istnieje) na podstawie braku GPS i bardzo krótkiego/zerowego czasu na miejscu.
- **Change ID:** phone-vs-visit-deviation-detection
- **PRD refs:** FR-010, US-01
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Logika reguły jest już w pełni sprecyzowana w FR-010 (brak niejasności). Sekwencjonowana równolegle do S-02, bo obie reguły są niezależne i opierają się na tych samych fundamentach z S-01.
- **Status:** done

### S-04: Kierownik usuwa błędnie wgrany raport

- **Outcome:** Kierownik może usunąć wgrany raport (po jawnym potwierdzeniu); raport oraz wszystkie powiązane wizyty i odstępstwa znikają z listy i bazy dla tego konta.
- **Change ID:** delete-uploaded-report
- **PRD refs:** FR-011, US-02
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-03, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Operacja nieodwracalna — wymaga jawnego potwierdzenia w UI, żeby uniknąć przypadkowej utraty danych. Sekwencjonowana po S-01, bo korzysta z tej samej listy raportów zbudowanej w gwieździe przewodniej.
- **Status:** done

### S-05: Kierownik oznacza odstępstwo jako sprawdzone/fałszywy alarm

- **Outcome:** Kierownik może oznaczyć dowolne odstępstwo na liście jako "sprawdzone" (i cofnąć to oznaczenie); status przeglądu jest trwały i widoczny przy kolejnych powrotach do raportu.
- **Change ID:** mark-deviation-reviewed
- **PRD refs:** FR-012, US-03
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Prosta zmiana statusu na już istniejącym rekordzie odstępstwa — niska złożoność, ale wymaga pola statusu przeglądu w schemacie z F-01. Sekwencjonowana po S-01, gdy lista odstępstw już istnieje.
- **Status:** done

### S-06: Kierownik filtruje/sortuje listę odstępstw

- **Outcome:** Kierownik może zawęzić i uporządkować listę odstępstw (np. wg przedstawiciela, daty, reguły która zadziałała, statusu przeglądu), zamiast przewijać całą listę ręcznie.
- **Change ID:** filter-sort-deviations-list
- **PRD refs:** FR-007 (Priority: nice-to-have; Secondary Success Criteria)
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Niska złożoność — dane i kolumny pod filtr/sort (`rule`, `status`, `visit_date`, `representative_name`) już istnieją w schemacie z F-01, baseline potwierdza brak dziś jakiejkolwiek logiki filtra/sortu w `DeviationsList.tsx`. Sekwencjonowana przed eksportem, bo eksport może (opcjonalnie, do ustalenia w `/10x-plan`) korzystać z aktualnie przefiltrowanego widoku.
- **Status:** done

### S-07: Kierownik eksportuje listę odstępstw do pliku

- **Outcome:** Kierownik może wyeksportować listę odstępstw do pliku (np. CSV) na dysk lokalny.
- **Change ID:** export-deviations-list
- **PRD refs:** FR-008 (Priority: nice-to-have; Secondary Success Criteria)
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:**
  - Czy eksport ma respektować aktualnie zastosowany filtr/sort z S-06, czy zawsze eksportuje pełną listę? — Owner: team. Block: no (decyzja implementacyjna dla `/10x-plan`, nie blokuje sekwencjonowania na poziomie roadmapy).
- **Risk:** Niska złożoność, niezależna od S-06 funkcjonalnie (baseline potwierdza zero istniejącego kodu eksportu w `src/`) — ale sensowniej zrobić po S-06, żeby UX decyzja o zakresie eksportu (przefiltrowany vs. pełny) miała z czego korzystać.
- **Status:** done

### S-08: Kierownik widzi listę raportów w spójnych kolorach marki

- **Outcome:** Kierownik widzi listę raportów w kolorach marki zdefiniowanych raz jako tokeny (zamiast rozsianych literałów), poprawnie także w trybie ciemnym.
- **Change ID:** reports-list-ui-tokens
- **PRD refs:** M-3 MS-01
- **Prerequisites:** S-01
- **Parallel with:** S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pierwszy widok przeniesiony na tokeny — ustalił kolor marki (`--primary`) i wzorzec, który powtórzono na pozostałych widokach.
- **Status:** done

### S-09: Kierownik dostaje czytelne komunikaty na liście raportów

- **Outcome:** Kierownik widzi na liście raportów komunikaty w jednym komponencie, błędy wgrywania i usuwania jako przetłumaczone komunikaty (nie surowy tekst bazy), daty w jednym formacie, a wszystkie 7 stanów widoku działa w obu motywach.
- **Change ID:** reports-list-ui-contract
- **PRD refs:** M-3 MS-01
- **Prerequisites:** S-08
- **Parallel with:** S-10, S-11, S-12, S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Treść komunikatów z Claude Design musiała zostać słowo w słowo — zmieniały się tylko style i logika wyświetlania.
- **Status:** done

### S-10: Kierownik widzi Pulpit w spójnym układzie

- **Outcome:** Kierownik widzi Pulpit złożony ze wspólnych kart, z kolorami serii reguł (brak GPS, telefon, trasa) czytelnymi w obu motywach.
- **Change ID:** dashboard-ui-tokens
- **PRD refs:** M-3 MS-01
- **Prerequisites:** S-08
- **Parallel with:** S-09, S-11, S-12, S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Kolory serii wymagały osobnych tokenów z kontrastem co najmniej 3:1 względem karty, żeby wykresy pozostały czytelne.
- **Status:** done

### S-11: Odwiedzający widzi czytelną stronę startową

- **Outcome:** Odwiedzający widzi stronę startową zgodną z projektem, obsługiwaną z klawiatury i z menu na telefonie, z tekstem na kolorze marki czytelnym w obu motywach.
- **Change ID:** landing-ui-contract
- **PRD refs:** M-3 MS-01, M-3 MS-03
- **Prerequisites:** S-08
- **Parallel with:** S-09, S-10, S-12, S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zmiana koloru marki w trybie ciemnym dotknęła wszystkich przycisków w aplikacji — zmierzona i opisana przed zmianą widoku.
- **Status:** done

### S-12: Kierownik wygodnie przegląda szczegóły raportu

- **Outcome:** Kierownik przegląda szczegóły raportu także z klawiatury i na ekranie telefonu; błędy ładowania rozróżniają „nie znaleziono”, „brak konfiguracji” i awarię bazy, a nieudane oznaczenie lub eksport pokazuje komunikat.
- **Change ID:** report-details-ui-contract
- **PRD refs:** M-3 MS-01
- **Prerequisites:** S-08
- **Parallel with:** S-09, S-10, S-11, S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Najbardziej rozbudowany widok — awaria bazy nie może być już raportowana jako „nie znaleziono”.
- **Status:** done

### S-13: Kierownik widzi komunikaty w jednym komponencie na każdym widoku

- **Outcome:** Kierownik widzi każdy komunikat wewnątrz strony (raporty, szczegóły, Pulpit, potwierdzenie e-maila) w tym samym komponencie, a pasek na pełną szerokość zostaje tylko dla ostrzeżenia o konfiguracji.
- **Change ID:** ui-leftovers
- **PRD refs:** M-3 MS-01
- **Prerequisites:** S-09, S-12
- **Parallel with:** S-10, S-11, S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Domknięcie pozostałości po kontraktach widoków — niska złożoność.
- **Status:** done

### S-14: Użytkownik widzi przetłumaczone błędy logowania i rejestracji

- **Outcome:** Użytkownik po nieudanym logowaniu, rejestracji lub ponownym wysłaniu potwierdzenia widzi tylko przetłumaczony komunikat; adres strony niesie kod błędu, a nie dowolny tekst.
- **Change ID:** auth-error-codes
- **PRD refs:** M-3 MS-02
- **Prerequisites:** S-01
- **Parallel with:** S-08, S-09, S-10, S-11, S-12, S-13, S-15, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Wcześniej tekst z adresu trafiał wprost na stronę — przejście na kody zamyka tę drogę.
- **Status:** done

### S-15: Kierownik odróżnia powierzchnie od tła w jasnym motywie

- **Outcome:** Kierownik w jasnym motywie widzi karty, okna i przyciski jako białe na lekko szarym tle strony, a każdy tekst na tle ma kontrast co najmniej 4.5:1.
- **Change ID:** light-surface-tokens
- **PRD refs:** M-3 MS-03
- **Prerequisites:** S-09, S-10, S-11, S-12
- **Parallel with:** S-13, S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zmiana jednego tokenu dotyka każdego widoku — zweryfikowana zrzutami wszystkich kitchen-sinków przed i po w obu motywach.
- **Status:** done

### S-16: Zespół widzi po fakcie nieudane wgrania i usunięcia raportu

- **Outcome:** Zespół widzi po fakcie każde nieudane wgranie lub usunięcie raportu, z kodem błędu i kontekstem (bez danych osobowych), bez podglądania logów na żywo.
- **Change ID:** upload-error-visibility
- **PRD refs:** MS-01
- **Prerequisites:** —
- **Parallel with:** F-03
- **Blockers:** —
- **Unknowns:**
  - Gdzie mają trafiać wpisy: zapytania do Workers Logs w panelu Cloudflare czy zewnętrzna usługa śledzenia błędów (konto, klucz, koszt)? — Owner: user. Block: no (decyzja na etapie `/10x-plan` tego wycinka; ustala wzorzec dla S-17…S-19).
  - Jakie pola wpisu są bezpieczne (bez nazwisk przedstawicieli, nazw klientów, e-maili)? — Owner: team. Block: no.
- **Risk:** Pierwszy, bo to główny przepływ produktu i jego błędy dziś przepadają; tu zapada decyzja o miejscu i formacie wpisów, którą przejmą kolejne wycinki. Ryzyko: wpis z danymi osobowymi z raportu — stąd jawne pytanie o pola.
- **Status:** done

### S-17: Zespół widzi po fakcie błędy na widoku raportu

- **Outcome:** Zespół widzi po fakcie błędy ładowania szczegółów raportu oraz nieudane oznaczenie odstępstwa i eksport — także te, które zdarzają się w przeglądarce, a nie na serwerze.
- **Change ID:** report-view-error-visibility
- **PRD refs:** MS-01
- **Prerequisites:** S-16
- **Parallel with:** S-18, S-19, F-03
- **Blockers:** —
- **Unknowns:**
  - Jak przekazać do rejestru błędy powstające w przeglądarce (eksport po stronie klienta)? — Owner: team. Block: no.
- **Risk:** Rozszerza wzorzec z S-16 na drugi najważniejszy widok; błędy z przeglądarki to nowa droga, więc osobny wycinek zamiast dopychania do S-16.
- **Status:** proposed

### S-18: Zespół widzi po fakcie nieudane logowania i rejestracje

- **Outcome:** Zespół widzi po fakcie nieudane logowania, rejestracje i ponowne wysłania potwierdzenia jako kody błędów, bez haseł i e-maili.
- **Change ID:** auth-error-visibility
- **PRD refs:** MS-01
- **Prerequisites:** S-16
- **Parallel with:** S-17, S-19, F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Kody błędów już istnieją (S-14), więc to głównie podpięcie ich do rejestru z S-16; najwyższe ryzyko wycieku danych logowania, stąd osobny wycinek.
- **Status:** proposed

### S-19: Zespół widzi czas analizy każdego wgrania

- **Outcome:** Zespół widzi czas analizy każdego wgranego raportu i może sprawdzić, czy wynik pojawia się w ciągu kilku sekund, jak wymaga PRD.
- **Change ID:** upload-duration-visibility
- **PRD refs:** MS-01, NFR (wynik w ciągu kilku sekund)
- **Prerequisites:** S-16
- **Parallel with:** S-17, S-18, F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Jedyne wymaganie wydajnościowe PRD nie jest dziś mierzone wcale; korzysta z tego samego rejestru co S-16, więc po nim.
- **Status:** proposed

### S-20: Krytyczne przepływy chronione testami w CI

- **Outcome:** Krytyczne przepływy wskazane w planie testów (F-03) są chronione testami uruchamianymi w CI, wdrażanymi faza po fazie.
- **Change ID:** critical-flows-test-rollout
- **PRD refs:** MS-02
- **Prerequisites:** F-03
- **Parallel with:** S-16, S-17, S-18, S-19
- **Blockers:** —
- **Unknowns:**
  - Które przepływy chronić i w jakiej kolejności? — Owner: F-03 (plan testów). Block: yes.
- **Risk:** Zakres zależy w całości od mapy ryzyk z F-03, więc zablokowany do jej powstania. Każda faza z planu testów to osobna zmiana o własnym Change ID — status tego wycinka przestawia się ręcznie, gdy zamknie się ostatnia faza.
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID                        | Suggested issue title                                          | Ready for `/10x-plan` | Notes                          |
| ---------- | ---------------------------------- | ---------------------------------------------------------------- | ---------------------- | ------------------------------- |
| F-01       | report-data-schema                 | Migracja Supabase: schemat raportów/wizyt/odstępstw z RLS       | done                   | Zaimplementowane i zarchiwizowane 2026-09-25 → `context/archive/2026-09-25-report-data-schema/` · GitHub: [#1](https://github.com/AC-XEMI/10x-astro-project/issues/1) |
| S-01       | missing-gps-deviation-detection    | Wykrywanie braku GPS w raporcie (gwiazda przewodnia)             | done                   | Zaimplementowane i zarchiwizowane 2026-09-29 → `context/archive/2026-09-28-missing-gps-deviation-detection/` · GitHub: [#2](https://github.com/AC-XEMI/10x-astro-project/issues/2) |
| S-02       | route-deviation-detection          | Wykrywanie nieoptymalnej trasy w raporcie                        | done                   | Zaimplementowane i zarchiwizowane 2026-09-30 → `context/archive/2026-09-29-route-deviation-detection/` · GitHub: [#3](https://github.com/AC-XEMI/10x-astro-project/issues/3) |
| S-03       | phone-vs-visit-deviation-detection | Wykrywanie telefonu zamiast wizyty w raporcie                    | done                   | Zaimplementowane i zarchiwizowane 2026-10-01 → `context/archive/2026-10-01-phone-vs-visit-deviation-detection/` · GitHub: [#4](https://github.com/AC-XEMI/10x-astro-project/issues/4) |
| S-04       | delete-uploaded-report             | Usuwanie błędnie wgranego raportu                                 | done                   | Zaimplementowane i zarchiwizowane 2026-10-01 → `context/archive/2026-10-01-delete-uploaded-report/` · GitHub: [#6](https://github.com/AC-XEMI/10x-astro-project/issues/6) |
| S-05       | mark-deviation-reviewed            | Oznaczanie odstępstwa jako sprawdzone/fałszywy alarm              | done                   | Zaimplementowane i zarchiwizowane 2026-10-01 → `context/archive/2026-10-01-mark-deviation-reviewed/` · GitHub: [#7](https://github.com/AC-XEMI/10x-astro-project/issues/7) |
| S-06       | filter-sort-deviations-list        | Filtrowanie/sortowanie listy odstępstw                           | done                   | Zaimplementowane i zarchiwizowane 2026-10-02 → `context/archive/2026-10-01-filter-sort-deviations-list/` |
| S-07       | export-deviations-list             | Eksport listy odstępstw do pliku                                 | done                   | Zaimplementowane i zarchiwizowane 2026-10-02 → `context/archive/2026-10-02-export-deviations-list/` |
| F-02       | vitest-mutation-baseline           | Testy jednostkowe (Vitest) i mutacyjne (Stryker) dla wykrywania odstępstw | done          | Zaimplementowane i zarchiwizowane 2026-10-08 → `context/archive/2026-10-08-vitest-mutation-baseline/` |
| S-08       | reports-list-ui-tokens             | Lista raportów na tokenach design systemu                        | done                   | Zaimplementowane i zarchiwizowane 2026-10-07 → `context/archive/2026-10-06-reports-list-ui-tokens/` |
| S-09       | reports-list-ui-contract           | Kontrakt UI listy raportów (komunikaty, kody błędów, 7 stanów)   | done                   | Zaimplementowane i zarchiwizowane 2026-10-07 → `context/archive/2026-10-07-reports-list-ui-contract/` |
| S-10       | dashboard-ui-tokens                | Pulpit na kontrakcie design systemu                              | done                   | Zaimplementowane i zarchiwizowane 2026-10-07 → `context/archive/2026-10-07-dashboard-ui-tokens/` |
| S-11       | landing-ui-contract                | Kontrakt UI strony startowej i kontrast koloru marki             | done                   | Zaimplementowane i zarchiwizowane 2026-10-07 → `context/archive/2026-10-07-landing-ui-contract/` |
| S-12       | report-details-ui-contract         | Kontrakt UI szczegółów raportu                                   | done                   | Zaimplementowane i zarchiwizowane 2026-10-07 → `context/archive/2026-10-07-report-details-ui-contract/` |
| S-13       | ui-leftovers                       | Komunikaty w Alert na wszystkich widokach, dopracowanie szczegółów | done                 | Zaimplementowane i zarchiwizowane 2026-10-07 → `context/archive/2026-10-07-ui-leftovers/` |
| S-14       | auth-error-codes                   | Błędy logowania/rejestracji jako kody                            | done                   | Zaimplementowane i zarchiwizowane 2026-10-07 → `context/archive/2026-10-07-auth-error-codes/` |
| S-15       | light-surface-tokens               | Rozdzielenie powierzchni od tła w jasnym motywie                 | done                   | Zaimplementowane i zarchiwizowane 2026-10-08 → `context/archive/2026-10-08-light-surface-tokens/` |
| F-03       | risk-based-test-plan               | Plan testów oparty na ryzykach (`test-plan.md`)                  | yes                    | Uruchom `/10x-test-plan` (nie `/10x-plan`) |
| S-16       | upload-error-visibility            | Trwałe wpisy o nieudanych wgraniach i usunięciach raportu        | yes                    | Uruchom `/10x-plan upload-error-visibility`; decyzja o miejscu wpisów zapada tutaj |
| S-17       | report-view-error-visibility       | Trwałe wpisy o błędach widoku szczegółów raportu                 | no                     | Po S-16 |
| S-18       | auth-error-visibility              | Trwałe wpisy o nieudanych logowaniach i rejestracjach            | no                     | Po S-16 |
| S-19       | upload-duration-visibility         | Pomiar czasu analizy wgranego raportu                            | no                     | Po S-16 |
| S-20       | critical-flows-test-rollout        | Testy krytycznych przepływów wg planu testów                     | no                     | Zablokowane do F-03; fazy prowadzi `/10x-test-plan` |

## Open Roadmap Questions

1. **Czy i kiedy dołączyć realny eksport z systemu firmowego zamiast danych testowych?** — Owner: user. Block: brak (świadomie poza zakresem MVP, patrz Parked). GitHub: [#5](https://github.com/AC-XEMI/10x-astro-project/issues/5)
2. **Gdzie trafiają trwałe wpisy o błędach i zdarzeniach — zapytania do Workers Logs w Cloudflare czy zewnętrzna usługa śledzenia błędów?** — Owner: user. Block: no (rozstrzygane przy `/10x-plan` dla S-16; wybór obowiązuje też S-17, S-18 i S-19). Jeśli zewnętrzna usługa — `infrastructure.md` trzeba uzupełnić o konto, klucz i koszt.

## Parked

- **Integracja z realnym systemem firmowym** — Why parked: PRD Non-Goals — MVP działa wyłącznie na danych testowych/przykładowych.
- **Współdzielenie danych między kierownikami / widoki zbiorcze** — Why parked: PRD Non-Goals — brak takiej funkcji w MVP.
- **Testy mutacyjne w CI z progiem `break`** — Why parked: decyzja w F-02 — najpierw zapisany wynik bazowy, Stryker uruchamiany lokalnie.
- **Alerty o skokach liczby błędów i panele metryk** — Why parked: M-4 (MS-01) najpierw sprawia, że błędy w ogóle są widoczne po fakcie; powiadamianie ma sens dopiero, gdy wiadomo, jak wygląda ich normalny poziom.

## Milestone History

- **M-1: Wykrywanie odstępstw w raportach aktywności — MVP** (`deviation-detection-mvp`) — closed 2026-10-01. Kierownik wgrywa raport, widzi odstępstwa (brak GPS, nieoptymalna trasa, telefon zamiast wizyty) z pełnym kontekstem wizyt, może oznaczać je jako sprawdzone i usuwać błędnie wgrane raporty — wszystko trwale zapisane w bazie per-użytkownik.
- **M-2: Filtrowanie/sortowanie i eksport listy odstępstw** (`deviation-list-filter-export`) — closed 2026-10-02. Kierownik filtruje/sortuje listę odstępstw (wg przedstawiciela, daty, reguły, statusu) i eksportuje bieżący widok do pliku CSV lub XLS.
- **M-3: Dopracowanie UI i podstawy jakości** (`ui-contract-quality-baseline`) — closed 2026-10-08. Wszystkie widoki na kontrakcie design systemu (tokeny, wspólne komponenty, 7 stanów w obu motywach), błędy auth jako kody, rozdzielone powierzchnie w jasnym motywie oraz testy jednostkowe w CI z wynikiem mutacyjnym 88.54% dla wykrywania odstępstw. Zapisany retroaktywnie — zmiany powstały poza roadmapą.

## Done

- **F-01: (foundation) Schemat i trwałość danych raportu w Supabase, izolowane per-użytkownik** — Archived 2026-09-25 → `context/archive/2026-09-25-report-data-schema/`. Lesson: —.
- **S-01: Kierownik wgrywa raport i w ciągu kilku sekund widzi wizyty bez włączonego GPS oznaczone jako odstępstwo; po kliknięciu widzi pełny kontekst wizyty (data, przedstawiciel, dane z raportu).** — Archived 2026-09-29 → `context/archive/2026-09-28-missing-gps-deviation-detection/`. Lesson: —.
- **S-02: Kierownik widzi na liście odstępstw wizyty, które są poza zaplanowaną trasą lub mają nadmiarowy dystans/czas przejazdu ponad próg wynikający z najkrótszej trasy.** — Archived 2026-09-30 → `context/archive/2026-09-29-route-deviation-detection/`. Lesson: —.
- **S-03: Kierownik widzi na liście odstępstw aktywności oznaczone jako "telefon zamiast wizyty" — wprost z pola typu aktywności, albo (gdy pole nie istnieje) na podstawie braku GPS i bardzo krótkiego/zerowego czasu na miejscu.** — Archived 2026-10-01 → `context/archive/2026-10-01-phone-vs-visit-deviation-detection/`. Lesson: —.
- **S-04: Kierownik może usunąć wgrany raport (po jawnym potwierdzeniu); raport oraz wszystkie powiązane wizyty i odstępstwa znikają z listy i bazy dla tego konta.** — Archived 2026-10-01 → `context/archive/2026-10-01-delete-uploaded-report/`. Lesson: CLAUDE.md wymagał `prerender = false` w API routes, ale żaden endpoint tego nie robił — patrz `context/foundation/lessons.md`.
- **S-05: Kierownik może oznaczyć dowolne odstępstwo na liście jako "sprawdzone" (i cofnąć to oznaczenie); status przeglądu jest trwały i widoczny przy kolejnych powrotach do raportu.** — Archived 2026-10-01 → `context/archive/2026-10-01-mark-deviation-reviewed/`. Lesson: —.
- **S-06: Kierownik może zawęzić i uporządkować listę odstępstw (np. wg przedstawiciela, daty, reguły która zadziałała, statusu przeglądu), zamiast przewijać całą listę ręcznie.** — Archived 2026-10-02 → `context/archive/2026-10-01-filter-sort-deviations-list/`. Lesson: —.
- **S-07: Kierownik może wyeksportować listę odstępstw do pliku (np. CSV) na dysk lokalny.** — Archived 2026-10-02 → `context/archive/2026-10-02-export-deviations-list/`. Lesson: —.
- **F-02: (foundation) Vitest uruchamia w CI testy parsera raportów i trzech reguł wykrywania odstępstw; Stryker mierzy ich skuteczność lokalnie.** — Archived 2026-10-08 → `context/archive/2026-10-08-vitest-mutation-baseline/`. Lesson: —.
- **S-08: Kierownik widzi listę raportów w kolorach marki zdefiniowanych raz jako tokeny, poprawnie także w trybie ciemnym.** — Archived 2026-10-07 → `context/archive/2026-10-06-reports-list-ui-tokens/`. Lesson: —.
- **S-09: Kierownik widzi na liście raportów komunikaty w jednym komponencie, błędy wgrywania i usuwania jako przetłumaczone komunikaty, daty w jednym formacie i 7 stanów widoku w obu motywach.** — Archived 2026-10-07 → `context/archive/2026-10-07-reports-list-ui-contract/`. Lesson: wyjątek dla nagłówków arkusza w regule o nazwach kolumn — patrz `context/foundation/lessons.md`.
- **S-10: Kierownik widzi Pulpit złożony ze wspólnych kart, z kolorami serii reguł czytelnymi w obu motywach.** — Archived 2026-10-07 → `context/archive/2026-10-07-dashboard-ui-tokens/`. Lesson: —.
- **S-11: Odwiedzający widzi stronę startową zgodną z projektem, obsługiwaną z klawiatury i z menu na telefonie, z tekstem na kolorze marki czytelnym w obu motywach.** — Archived 2026-10-07 → `context/archive/2026-10-07-landing-ui-contract/`. Lesson: —.
- **S-12: Kierownik przegląda szczegóły raportu z klawiatury i na ekranie telefonu, z rozróżnionymi błędami ładowania i komunikatem przy nieudanym oznaczeniu lub eksporcie.** — Archived 2026-10-07 → `context/archive/2026-10-07-report-details-ui-contract/`. Lesson: —.
- **S-13: Kierownik widzi każdy komunikat wewnątrz strony w tym samym komponencie na wszystkich widokach.** — Archived 2026-10-07 → `context/archive/2026-10-07-ui-leftovers/`. Lesson: —.
- **S-14: Użytkownik widzi przy logowaniu, rejestracji i ponownym wysłaniu potwierdzenia tylko przetłumaczony komunikat błędu.** — Archived 2026-10-07 → `context/archive/2026-10-07-auth-error-codes/`. Lesson: —.
- **S-15: Kierownik w jasnym motywie widzi karty, okna i przyciski jako białe na lekko szarym tle, a każdy tekst na tle ma kontrast co najmniej 4.5:1.** — Archived 2026-10-08 → `context/archive/2026-10-08-light-surface-tokens/`. Lesson: —.
- **S-16: Zespół widzi po fakcie każde nieudane wgranie lub usunięcie raportu, z kodem błędu i kontekstem (bez danych osobowych), bez podglądania logów na żywo.** — Archived 2026-10-08 → `context/archive/2026-10-08-upload-error-visibility/`. Lesson: —.
