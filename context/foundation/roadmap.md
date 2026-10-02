---
project: "Kontrola Trasówek"
version: 1
status: draft
created: 2026-09-25
updated: 2026-10-02
prd_version: 2
main_goal: quality
top_blocker: time
milestone_id: deviation-list-filter-export
milestone_seq: 2
milestone_status: open
---

# Roadmap: Kontrola Trasówek

> Wygenerowane z `context/foundation/prd.md` + auto-zbadanej bazowej kondycji kodu.
> Edytuj w miejscu; archiwizuj, gdy zostanie zastąpione.
> Wycinki poniżej są w kolejności zależności. Tabela "At a glance" to indeks.

## Milestone

**M-2: Filtrowanie/sortowanie i eksport listy odstępstw** — Status: open

- **Intent:** Kierownik może zawęzić/uporządkować listę odstępstw (wg przedstawiciela, daty, reguły, statusu przeglądu) i wyeksportować ją do pliku — dwie funkcje oznaczone w PRD jako nice-to-have i świadomie odłożone poza MVP (M-1), teraz podjęte jako kolejna transza tego samego PRD.
- **Source materials:** `context/foundation/prd.md` (v2)
- **Done when:** S-06 i S-07 są wszystkie `done`.
- **Scope anchors:** FR-007, FR-008 (Secondary Success Criteria)

## Vision recap

Kierownik regionalny ręcznie przegląda raporty aktywności przedstawicieli handlowych, żeby wychwycić odstępstwa od normy (nieoptymalne trasy, telefon zamiast wizyty, wyłączone GPS) — dane do oceny już istnieją, ale ręczne wyciąganie z nich sensu jest czasochłonne i zbyt wolne, żeby robić to systematycznie dla całego zespołu. Wzorce odstępstw widać dopiero po zestawieniu wielu raportów w czasie, nie z pojedynczego raportu.

## North star

**S-01: Kierownik wgrywa raport i widzi wizyty z brakującym GPS oznaczone jako odstępstwo** (`done`, zarchiwizowane) — najmniejszy pełny przepływ (login → upload → ekstrakcja → zapis → detekcja → lista → szczegóły), który już udowodnił, że cała koncepcja narzędzia działa.

> "Gwiazda przewodnia" (north star) to najmniejszy pełny wycinek funkcjonalności, który — jeśli się uda — dowodzi, że główna hipoteza produktu jest słuszna. Umieszczamy go możliwie wcześnie w kolejności, bo reszta ma sens tylko wtedy, gdy ten pierwszy przepływ faktycznie działa.

M-2 nie ma nowej hipotezy produktu do udowodnienia — główna hipoteza została już potwierdzona w M-1. Pierwszym w kolejności slice'em tego milestone'u jest **S-06** (filtrowanie/sortowanie), bo jest mniejszy i bardziej fundamentalny niż eksport (S-07 może, ale nie musi, korzystać z przefiltrowanego widoku).

## At a glance

| ID   | Change ID                        | Outcome (user can …)                                                              | Prerequisites | PRD refs                                              | Status   |
| ---- | --------------------------------- | ----------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------ | -------- |
| F-01 | report-data-schema                 | (foundation) Schemat i trwałość danych raportu w Supabase, izolowane per-użytkownik | —              | Access Control, NFR (izolacja danych)                  | done |
| S-01 | missing-gps-deviation-detection    | Kierownik wgrywa raport i widzi wizyty bez GPS oznaczone jako odstępstwo             | F-01           | FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, US-01  | done |
| S-02 | route-deviation-detection          | Kierownik widzi wizyty z nieoptymalną trasą/nadmiarowym dystansem jako odstępstwo    | F-01, S-01     | FR-009, US-01                                           | done |
| S-03 | phone-vs-visit-deviation-detection | Kierownik widzi aktywności "telefon zamiast wizyty" oznaczone jako odstępstwo        | F-01, S-01     | FR-010, US-01                                           | done |
| S-04 | delete-uploaded-report             | Kierownik usuwa błędnie wgrany raport wraz z powiązanymi danymi                      | F-01, S-01     | FR-011, US-02                                           | done |
| S-05 | mark-deviation-reviewed            | Kierownik oznacza odstępstwo jako sprawdzone/fałszywy alarm                          | F-01, S-01     | FR-012, US-03                                           | done |
| S-06 | filter-sort-deviations-list        | Kierownik filtruje/sortuje listę odstępstw (wg przedstawiciela, daty, reguły, statusu) | F-01, S-01     | FR-007                                                  | done |
| S-07 | export-deviations-list             | Kierownik eksportuje listę odstępstw do pliku                                        | F-01, S-01     | FR-008                                                  | done |

## Baseline

Co już jest w kodzie na dzień `2026-10-01` (auto-zbadane, po zamknięciu M-1).
Foundations poniżej zakładają, że to jest już gotowe i tego nie budują od nowa.

- **Frontend:** present — Astro 7 SSR + React 19 islands, shadcn/ui (per `tech-stack.md`)
- **Backend / API:** present — Astro SSR + istniejące trasy API (`src/pages/api/auth/*`, `src/pages/api/reports/*`, `src/pages/api/deviations/review.ts`)
- **Data:** present — Supabase tabele `reports`, `visits`, `deviations` z RLS per-użytkownik (z F-01); `deviations` ma kolumny `rule`, `status`, `reviewed_at` gotowe pod filtrowanie/sortowanie
- **Auth:** present — Supabase Auth przez `@supabase/ssr` (`src/lib/supabase.ts`), middleware (`src/middleware.ts`)
- **Deploy / infra:** present — Cloudflare Workers, `wrangler` skonfigurowany (per `infrastructure.md`)
- **Observability:** absent — brak biblioteki logowania, error trackingu, metryk
- **Filtrowanie/sortowanie listy odstępstw:** absent — `src/components/reports/DeviationsList.tsx` nie ma żadnej logiki filtra/sortu (tylko ukrywa wizyty bez odstępstw); zapytanie w `src/pages/reports/[id].astro:16-19` nie przyjmuje parametrów filtra/sortu
- **Eksport do pliku:** absent — brak jakiegokolwiek kodu CSV/Blob/download w `src/`; jedyne wystąpienie "csv" to allowlista MIME przy uploadzie (`src/pages/api/reports/upload.ts:14`)

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

## Backlog Handoff

| Roadmap ID | Change ID                        | Suggested issue title                                          | Ready for `/10x-plan` | Notes                          |
| ---------- | ---------------------------------- | ---------------------------------------------------------------- | ---------------------- | ------------------------------- |
| F-01       | report-data-schema                 | Migracja Supabase: schemat raportów/wizyt/odstępstw z RLS       | done                   | Zaimplementowane i zarchiwizowane 2026-09-25 → `context/archive/2026-09-25-report-data-schema/` · GitHub: [#1](https://github.com/AC-XEMI/10x-astro-project/issues/1) |
| S-01       | missing-gps-deviation-detection    | Wykrywanie braku GPS w raporcie (gwiazda przewodnia)             | done                   | Zaimplementowane i zarchiwizowane 2026-09-29 → `context/archive/2026-09-28-missing-gps-deviation-detection/` · GitHub: [#2](https://github.com/AC-XEMI/10x-astro-project/issues/2) |
| S-02       | route-deviation-detection          | Wykrywanie nieoptymalnej trasy w raporcie                        | done                   | Zaimplementowane i zarchiwizowane 2026-09-30 → `context/archive/2026-09-29-route-deviation-detection/` · GitHub: [#3](https://github.com/AC-XEMI/10x-astro-project/issues/3) |
| S-03       | phone-vs-visit-deviation-detection | Wykrywanie telefonu zamiast wizyty w raporcie                    | done                   | Zaimplementowane i zarchiwizowane 2026-10-01 → `context/archive/2026-10-01-phone-vs-visit-deviation-detection/` · GitHub: [#4](https://github.com/AC-XEMI/10x-astro-project/issues/4) |
| S-04       | delete-uploaded-report             | Usuwanie błędnie wgranego raportu                                 | done                   | Zaimplementowane i zarchiwizowane 2026-10-01 → `context/archive/2026-10-01-delete-uploaded-report/` · GitHub: [#6](https://github.com/AC-XEMI/10x-astro-project/issues/6) |
| S-05       | mark-deviation-reviewed            | Oznaczanie odstępstwa jako sprawdzone/fałszywy alarm              | done                   | Zaimplementowane i zarchiwizowane 2026-10-01 → `context/archive/2026-10-01-mark-deviation-reviewed/` · GitHub: [#7](https://github.com/AC-XEMI/10x-astro-project/issues/7) |
| S-06       | filter-sort-deviations-list        | Filtrowanie/sortowanie listy odstępstw                           | yes                    | F-01, S-01 ukończone · Uruchom `/10x-plan filter-sort-deviations-list` |
| S-07       | export-deviations-list             | Eksport listy odstępstw do pliku                                 | yes                    | F-01, S-01 ukończone · Uruchom `/10x-plan export-deviations-list` |

## Open Roadmap Questions

1. **Czy i kiedy dołączyć realny eksport z systemu firmowego zamiast danych testowych?** — Owner: user. Block: brak (świadomie poza zakresem MVP, patrz Parked). GitHub: [#5](https://github.com/AC-XEMI/10x-astro-project/issues/5)

## Parked

- **Integracja z realnym systemem firmowym** — Why parked: PRD Non-Goals — MVP działa wyłącznie na danych testowych/przykładowych.
- **Współdzielenie danych między kierownikami / widoki zbiorcze** — Why parked: PRD Non-Goals — brak takiej funkcji w MVP.

## Milestone History

- **M-1: Wykrywanie odstępstw w raportach aktywności — MVP** (`deviation-detection-mvp`) — closed 2026-10-01. Kierownik wgrywa raport, widzi odstępstwa (brak GPS, nieoptymalna trasa, telefon zamiast wizyty) z pełnym kontekstem wizyt, może oznaczać je jako sprawdzone i usuwać błędnie wgrane raporty — wszystko trwale zapisane w bazie per-użytkownik.

## Done

- **F-01: (foundation) Schemat i trwałość danych raportu w Supabase, izolowane per-użytkownik** — Archived 2026-09-25 → `context/archive/2026-09-25-report-data-schema/`. Lesson: —.
- **S-01: Kierownik wgrywa raport i w ciągu kilku sekund widzi wizyty bez włączonego GPS oznaczone jako odstępstwo; po kliknięciu widzi pełny kontekst wizyty (data, przedstawiciel, dane z raportu).** — Archived 2026-09-29 → `context/archive/2026-09-28-missing-gps-deviation-detection/`. Lesson: —.
- **S-02: Kierownik widzi na liście odstępstw wizyty, które są poza zaplanowaną trasą lub mają nadmiarowy dystans/czas przejazdu ponad próg wynikający z najkrótszej trasy.** — Archived 2026-09-30 → `context/archive/2026-09-29-route-deviation-detection/`. Lesson: —.
- **S-03: Kierownik widzi na liście odstępstw aktywności oznaczone jako "telefon zamiast wizyty" — wprost z pola typu aktywności, albo (gdy pole nie istnieje) na podstawie braku GPS i bardzo krótkiego/zerowego czasu na miejscu.** — Archived 2026-10-01 → `context/archive/2026-10-01-phone-vs-visit-deviation-detection/`. Lesson: —.
- **S-04: Kierownik może usunąć wgrany raport (po jawnym potwierdzeniu); raport oraz wszystkie powiązane wizyty i odstępstwa znikają z listy i bazy dla tego konta.** — Archived 2026-10-01 → `context/archive/2026-10-01-delete-uploaded-report/`. Lesson: CLAUDE.md wymagał `prerender = false` w API routes, ale żaden endpoint tego nie robił — patrz `context/foundation/lessons.md`.
- **S-05: Kierownik może oznaczyć dowolne odstępstwo na liście jako "sprawdzone" (i cofnąć to oznaczenie); status przeglądu jest trwały i widoczny przy kolejnych powrotach do raportu.** — Archived 2026-10-01 → `context/archive/2026-10-01-mark-deviation-reviewed/`. Lesson: —.
- **S-06: Kierownik może zawęzić i uporządkować listę odstępstw (np. wg przedstawiciela, daty, reguły która zadziałała, statusu przeglądu), zamiast przewijać całą listę ręcznie.** — Archived 2026-10-02 → `context/archive/2026-10-01-filter-sort-deviations-list/`. Lesson: —.
- **S-07: Kierownik może wyeksportować listę odstępstw do pliku (np. CSV) na dysk lokalny.** — Archived 2026-10-02 → `context/archive/2026-10-02-export-deviations-list/`. Lesson: —.
