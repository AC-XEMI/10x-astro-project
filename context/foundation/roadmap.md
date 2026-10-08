---
project: "Kontrola Trasówek"
version: 1
status: draft
created: 2026-09-25
updated: 2026-10-08
prd_version: 2
main_goal: quality
top_blocker: time
milestone_id: ui-contract-quality-baseline
milestone_seq: 3
milestone_status: done
---

# Roadmap: Kontrola Trasówek

> Wygenerowane z `context/foundation/prd.md` + auto-zbadanej bazowej kondycji kodu.
> Edytuj w miejscu; archiwizuj, gdy zostanie zastąpione.
> Wycinki poniżej są w kolejności zależności. Tabela "At a glance" to indeks.

## Milestone

**M-3: Dopracowanie UI i podstawy jakości** — Status: done

- **Intent:** Po wyczerpaniu wymagań funkcjonalnych PRD (M-1, M-2) aplikacja dostaje spójny wygląd i komunikaty na wszystkich widokach oraz pierwszą siatkę testów, która chroni wykrywanie odstępstw przed regresją. Kamień milowy zapisany retroaktywnie: praca powstała jako samodzielne zmiany poza roadmapą i została tu podpięta, żeby roadmapa opowiadała pełną historię projektu.
- **Source materials:** opis użytkownika (kotwice poniżej), na podstawie zmian zarchiwizowanych 2026-10-07…2026-10-08
- **Done when:** F-02 oraz S-08…S-15 są wszystkie `done`.
- **Scope anchors:**
  - MS-01: Każdy widok aplikacji (Raporty, Szczegóły raportu, Pulpit, Strona startowa, strony logowania) korzysta z tokenów i wspólnych komponentów design systemu, ma udokumentowany kontrakt i stronę „kitchen sink” z 7 stanami w jasnym i ciemnym motywie, a treść komunikatów z Claude Design zostaje bez zmian.
  - MS-02: Błędy logowania i rejestracji docierają do strony jako kody, a użytkownik widzi tylko przetłumaczony komunikat — nigdy surowy tekst z Supabase.
  - MS-03: W jasnym motywie karty, okna i przyciski wyraźnie odcinają się od tła strony, a każdy tekst na tle ma kontrast co najmniej 4.5:1.
  - MS-04: Logika parsowania raportu i reguł wykrywania odstępstw jest chroniona testami jednostkowymi uruchamianymi w CI, a ich skuteczność zmierzona testami mutacyjnymi.

## Vision recap

Kierownik regionalny ręcznie przegląda raporty aktywności przedstawicieli handlowych, żeby wychwycić odstępstwa od normy (nieoptymalne trasy, telefon zamiast wizyty, wyłączone GPS) — dane do oceny już istnieją, ale ręczne wyciąganie z nich sensu jest czasochłonne i zbyt wolne, żeby robić to systematycznie dla całego zespołu. Wzorce odstępstw widać dopiero po zestawieniu wielu raportów w czasie, nie z pojedynczego raportu.

## North star

**S-01: Kierownik wgrywa raport i widzi wizyty z brakującym GPS oznaczone jako odstępstwo** (`done`, zarchiwizowane) — najmniejszy pełny przepływ (login → upload → ekstrakcja → zapis → detekcja → lista → szczegóły), który już udowodnił, że cała koncepcja narzędzia działa.

> "Gwiazda przewodnia" (north star) to najmniejszy pełny wycinek funkcjonalności, który — jeśli się uda — dowodzi, że główna hipoteza produktu jest słuszna. Umieszczamy go możliwie wcześnie w kolejności, bo reszta ma sens tylko wtedy, gdy ten pierwszy przepływ faktycznie działa.

M-3 nie ma nowej hipotezy produktu — to praca nad jakością istniejących funkcji. Jego osią jest **S-08 → S-09** (kontrakt widoku listy raportów), bo na nim powstał wzorzec (tokeny → wspólne komponenty → 7 stanów → zrzuty), który potem powtórzono na pozostałych widokach.

## At a glance

| ID   | Change ID                        | Outcome (user can …)                                                              | Prerequisites | PRD refs                                              | Status   |
| ---- | --------------------------------- | ----------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------ | -------- |
| F-01 | report-data-schema                 | (foundation) Schemat i trwałość danych raportu w Supabase, izolowane per-użytkownik | —              | Access Control, NFR (izolacja danych)                  | done |
| F-02 | vitest-mutation-baseline           | (foundation) Testy jednostkowe w CI chronią parser i reguły wykrywania odstępstw     | F-01; reguły wykrywania z M-1 w kodzie | MS-04                                                 | done |
| S-01 | missing-gps-deviation-detection    | Kierownik wgrywa raport i widzi wizyty bez GPS oznaczone jako odstępstwo             | F-01           | FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, US-01  | done |
| S-02 | route-deviation-detection          | Kierownik widzi wizyty z nieoptymalną trasą/nadmiarowym dystansem jako odstępstwo    | F-01, S-01     | FR-009, US-01                                           | done |
| S-03 | phone-vs-visit-deviation-detection | Kierownik widzi aktywności "telefon zamiast wizyty" oznaczone jako odstępstwo        | F-01, S-01     | FR-010, US-01                                           | done |
| S-04 | delete-uploaded-report             | Kierownik usuwa błędnie wgrany raport wraz z powiązanymi danymi                      | F-01, S-01     | FR-011, US-02                                           | done |
| S-05 | mark-deviation-reviewed            | Kierownik oznacza odstępstwo jako sprawdzone/fałszywy alarm                          | F-01, S-01     | FR-012, US-03                                           | done |
| S-06 | filter-sort-deviations-list        | Kierownik filtruje/sortuje listę odstępstw (wg przedstawiciela, daty, reguły, statusu) | F-01, S-01     | FR-007                                                  | done |
| S-07 | export-deviations-list             | Kierownik eksportuje listę odstępstw do pliku                                        | F-01, S-01     | FR-008                                                  | done |
| S-08 | reports-list-ui-tokens             | Kierownik widzi listę raportów w spójnych kolorach marki, także w trybie ciemnym     | S-01           | MS-01                                                   | done |
| S-09 | reports-list-ui-contract           | Kierownik dostaje na liście raportów czytelne komunikaty i błędy wgrywania jako przetłumaczone kody | S-08 | MS-01                                              | done |
| S-10 | dashboard-ui-tokens                | Kierownik widzi Pulpit w spójnym układzie kart i kolorach serii reguł                | S-08           | MS-01                                                   | done |
| S-11 | landing-ui-contract                | Odwiedzający widzi czytelną stronę startową, także na telefonie i w trybie ciemnym   | S-08           | MS-01, MS-03                                            | done |
| S-12 | report-details-ui-contract         | Kierownik przegląda szczegóły raportu z klawiatury i na wąskim ekranie, z jasnymi błędami ładowania | S-08 | MS-01                                             | done |
| S-13 | ui-leftovers                       | Kierownik widzi wszystkie komunikaty w jednym komponencie Alert na każdym widoku     | S-09, S-12     | MS-01                                                   | done |
| S-14 | auth-error-codes                   | Użytkownik widzi przy logowaniu i rejestracji tylko przetłumaczony komunikat błędu   | S-01           | MS-02                                                   | done |
| S-15 | light-surface-tokens               | Kierownik w jasnym motywie odróżnia karty, okna i przyciski od tła strony            | S-09, S-10, S-11, S-12 | MS-03                                           | done |

## Baseline

Co już jest w kodzie na dzień `2026-10-08` (auto-zbadane, po zamknięciu M-3).
Foundations poniżej zakładają, że to jest już gotowe i tego nie budują od nowa.

- **Frontend:** present — Astro 7 SSR + React 19 islands, shadcn/ui; tokeny kolorów w `src/styles/global.css` (marka, serie reguł, rozdzielone powierzchnie w jasnym motywie), kontrakty widoków i strony `src/pages/dev/kitchen-sink/*` (per `CLAUDE.md`)
- **Backend / API:** present — Astro SSR + trasy API (`src/pages/api/auth/*`, `src/pages/api/reports/*`, `src/pages/api/deviations/review.ts`); błędy auth i raportów przekazywane jako kody (`src/lib/auth-errors.ts`, `src/lib/report-errors.ts`)
- **Data:** present — Supabase tabele `reports`, `visits`, `deviations` z RLS per-użytkownik (z F-01)
- **Auth:** present — Supabase Auth przez `@supabase/ssr` (`src/lib/supabase.ts`), middleware (`src/middleware.ts`)
- **Deploy / infra:** present — Cloudflare Workers, CI w GitHub Actions (`ci`: lint → `npm test` → `astro check` → build; `smoke` z lokalnym Supabase)
- **Testy:** present — Vitest (`npm test`, `src/**/*.test.ts`) dla parsera, reguł i `geo`; Stryker (`npm run test:mutation`) lokalnie, wynik 88.54% (z F-02)
- **Observability:** absent — brak biblioteki logowania, error trackingu, metryk

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
- **PRD refs:** MS-04
- **Unlocks:** ścieżka weryfikacji dla każdej przyszłej zmiany reguł wykrywania lub parsera (regresja łapana w CI, zanim trafi na `master`); punkt wyjścia dla planu testów opartego na ryzykach
- **Prerequisites:** F-01; reguły wykrywania z M-1 w kodzie
- **Parallel with:** S-08, S-09, S-10, S-11, S-12, S-13, S-14, S-15
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Narzędzia testów mutacyjnych bywają wrażliwe na wersję Vitest i sposób uruchamiania testów; obie pułapki (Vitest 5, wywołania w ciele `describe`) zostały wykryte i opisane w `CLAUDE.md` oraz w archiwum zmiany.
- **Status:** done

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
- **PRD refs:** MS-01
- **Prerequisites:** S-01
- **Parallel with:** S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pierwszy widok przeniesiony na tokeny — ustalił kolor marki (`--primary`) i wzorzec, który powtórzono na pozostałych widokach.
- **Status:** done

### S-09: Kierownik dostaje czytelne komunikaty na liście raportów

- **Outcome:** Kierownik widzi na liście raportów komunikaty w jednym komponencie, błędy wgrywania i usuwania jako przetłumaczone komunikaty (nie surowy tekst bazy), daty w jednym formacie, a wszystkie 7 stanów widoku działa w obu motywach.
- **Change ID:** reports-list-ui-contract
- **PRD refs:** MS-01
- **Prerequisites:** S-08
- **Parallel with:** S-10, S-11, S-12, S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Treść komunikatów z Claude Design musiała zostać słowo w słowo — zmieniały się tylko style i logika wyświetlania.
- **Status:** done

### S-10: Kierownik widzi Pulpit w spójnym układzie

- **Outcome:** Kierownik widzi Pulpit złożony ze wspólnych kart, z kolorami serii reguł (brak GPS, telefon, trasa) czytelnymi w obu motywach.
- **Change ID:** dashboard-ui-tokens
- **PRD refs:** MS-01
- **Prerequisites:** S-08
- **Parallel with:** S-09, S-11, S-12, S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Kolory serii wymagały osobnych tokenów z kontrastem co najmniej 3:1 względem karty, żeby wykresy pozostały czytelne.
- **Status:** done

### S-11: Odwiedzający widzi czytelną stronę startową

- **Outcome:** Odwiedzający widzi stronę startową zgodną z projektem, obsługiwaną z klawiatury i z menu na telefonie, z tekstem na kolorze marki czytelnym w obu motywach.
- **Change ID:** landing-ui-contract
- **PRD refs:** MS-01, MS-03
- **Prerequisites:** S-08
- **Parallel with:** S-09, S-10, S-12, S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zmiana koloru marki w trybie ciemnym dotknęła wszystkich przycisków w aplikacji — zmierzona i opisana przed zmianą widoku.
- **Status:** done

### S-12: Kierownik wygodnie przegląda szczegóły raportu

- **Outcome:** Kierownik przegląda szczegóły raportu także z klawiatury i na ekranie telefonu; błędy ładowania rozróżniają „nie znaleziono”, „brak konfiguracji” i awarię bazy, a nieudane oznaczenie lub eksport pokazuje komunikat.
- **Change ID:** report-details-ui-contract
- **PRD refs:** MS-01
- **Prerequisites:** S-08
- **Parallel with:** S-09, S-10, S-11, S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Najbardziej rozbudowany widok — awaria bazy nie może być już raportowana jako „nie znaleziono”.
- **Status:** done

### S-13: Kierownik widzi komunikaty w jednym komponencie na każdym widoku

- **Outcome:** Kierownik widzi każdy komunikat wewnątrz strony (raporty, szczegóły, Pulpit, potwierdzenie e-maila) w tym samym komponencie, a pasek na pełną szerokość zostaje tylko dla ostrzeżenia o konfiguracji.
- **Change ID:** ui-leftovers
- **PRD refs:** MS-01
- **Prerequisites:** S-09, S-12
- **Parallel with:** S-10, S-11, S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Domknięcie pozostałości po kontraktach widoków — niska złożoność.
- **Status:** done

### S-14: Użytkownik widzi przetłumaczone błędy logowania i rejestracji

- **Outcome:** Użytkownik po nieudanym logowaniu, rejestracji lub ponownym wysłaniu potwierdzenia widzi tylko przetłumaczony komunikat; adres strony niesie kod błędu, a nie dowolny tekst.
- **Change ID:** auth-error-codes
- **PRD refs:** MS-02
- **Prerequisites:** S-01
- **Parallel with:** S-08, S-09, S-10, S-11, S-12, S-13, S-15, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Wcześniej tekst z adresu trafiał wprost na stronę — przejście na kody zamyka tę drogę.
- **Status:** done

### S-15: Kierownik odróżnia powierzchnie od tła w jasnym motywie

- **Outcome:** Kierownik w jasnym motywie widzi karty, okna i przyciski jako białe na lekko szarym tle strony, a każdy tekst na tle ma kontrast co najmniej 4.5:1.
- **Change ID:** light-surface-tokens
- **PRD refs:** MS-03
- **Prerequisites:** S-09, S-10, S-11, S-12
- **Parallel with:** S-13, S-14, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zmiana jednego tokenu dotyka każdego widoku — zweryfikowana zrzutami wszystkich kitchen-sinków przed i po w obu motywach.
- **Status:** done

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

## Open Roadmap Questions

1. **Czy i kiedy dołączyć realny eksport z systemu firmowego zamiast danych testowych?** — Owner: user. Block: brak (świadomie poza zakresem MVP, patrz Parked). GitHub: [#5](https://github.com/AC-XEMI/10x-astro-project/issues/5)
2. **Co jest następnym kamieniem milowym, skoro wszystkie wymagania funkcjonalne PRD (FR-001…FR-012) są zrealizowane?** — Owner: user. Block: roadmap-wide. Kandydaci widoczni w artefaktach: plan testów oparty na ryzykach (brak `context/foundation/test-plan.md`), observability (Baseline: absent), nowa wersja PRD.

## Parked

- **Integracja z realnym systemem firmowym** — Why parked: PRD Non-Goals — MVP działa wyłącznie na danych testowych/przykładowych.
- **Współdzielenie danych między kierownikami / widoki zbiorcze** — Why parked: PRD Non-Goals — brak takiej funkcji w MVP.
- **Testy mutacyjne w CI z progiem `break`** — Why parked: decyzja w F-02 — najpierw zapisany wynik bazowy, Stryker uruchamiany lokalnie.

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
