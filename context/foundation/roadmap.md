---
project: "Kontrola Trasówek"
version: 1
status: draft
created: 2026-09-25
updated: 2026-09-25
prd_version: 2
main_goal: quality
top_blocker: time
milestone_id: deviation-detection-mvp
milestone_seq: 1
milestone_status: open
---

# Roadmap: Kontrola Trasówek

> Wygenerowane z `context/foundation/prd.md` + auto-zbadanej bazowej kondycji kodu.
> Edytuj w miejscu; archiwizuj, gdy zostanie zastąpione.
> Wycinki poniżej są w kolejności zależności. Tabela "At a glance" to indeks.

## Milestone

**M-1: Wykrywanie odstępstw w raportach aktywności — MVP** — Status: open

- **Intent:** Kierownik regionalny może wgrać raport aktywności i zobaczyć automatycznie wykryte odstępstwa (brak GPS, nieoptymalna trasa, telefon zamiast wizyty) z pełnym kontekstem każdej wizyty, korzystając z danych trwale zapisanych w bazie, do których może wracać.
- **Source materials:** `context/foundation/prd.md` (v2)
- **Done when:** F-01, S-01, S-02, S-03, S-04 i S-05 są wszystkie `done`.
- **Scope anchors:** —

## Vision recap

Kierownik regionalny ręcznie przegląda raporty aktywności przedstawicieli handlowych, żeby wychwycić odstępstwa od normy (nieoptymalne trasy, telefon zamiast wizyty, wyłączone GPS) — dane do oceny już istnieją, ale ręczne wyciąganie z nich sensu jest czasochłonne i zbyt wolne, żeby robić to systematycznie dla całego zespołu. Wzorce odstępstw widać dopiero po zestawieniu wielu raportów w czasie, nie z pojedynczego raportu.

## North star

**S-01: Kierownik wgrywa raport i widzi wizyty z brakującym GPS oznaczone jako odstępstwo** — najmniejszy pełny przepływ (login → upload → ekstrakcja → zapis → detekcja → lista → szczegóły), który dowodzi, że cała koncepcja narzędzia działa, zanim zainwestujemy w bardziej złożone reguły.

> "Gwiazda przewodnia" (north star) to najmniejszy pełny wycinek funkcjonalności, który — jeśli się uda — dowodzi, że główna hipoteza produktu jest słuszna. Umieszczamy go możliwie wcześnie w kolejności, bo reszta ma sens tylko wtedy, gdy ten pierwszy przepływ faktycznie działa.

## At a glance

| ID   | Change ID                        | Outcome (user can …)                                                              | Prerequisites | PRD refs                                              | Status   |
| ---- | --------------------------------- | ----------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------ | -------- |
| F-01 | report-data-schema                 | (foundation) Schemat i trwałość danych raportu w Supabase, izolowane per-użytkownik | —              | Access Control, NFR (izolacja danych)                  | done |
| S-01 | missing-gps-deviation-detection    | Kierownik wgrywa raport i widzi wizyty bez GPS oznaczone jako odstępstwo             | F-01           | FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, US-01  | proposed |
| S-02 | route-deviation-detection          | Kierownik widzi wizyty z nieoptymalną trasą/nadmiarowym dystansem jako odstępstwo    | F-01, S-01     | FR-009, US-01                                           | proposed |
| S-03 | phone-vs-visit-deviation-detection | Kierownik widzi aktywności "telefon zamiast wizyty" oznaczone jako odstępstwo        | F-01, S-01     | FR-010, US-01                                           | proposed |
| S-04 | delete-uploaded-report             | Kierownik usuwa błędnie wgrany raport wraz z powiązanymi danymi                      | F-01, S-01     | FR-011, US-02                                           | proposed |
| S-05 | mark-deviation-reviewed            | Kierownik oznacza odstępstwo jako sprawdzone/fałszywy alarm                          | F-01, S-01     | FR-012, US-03                                           | proposed |

## Baseline

Co już jest w kodzie na dzień `2026-09-25` (auto-zbadane + potwierdzone przez użytkownika).
Foundations poniżej zakładają, że to jest już gotowe i tego nie budują od nowa.

- **Frontend:** present — Astro 7 SSR + React 19 islands, shadcn/ui (per `tech-stack.md`)
- **Backend / API:** present — Astro SSR + istniejące trasy API (`src/pages/api/auth/*`)
- **Data:** absent — brak `supabase/migrations/`, brak tabel własnych poza `auth.users`. Doprecyzowanie użytkownika: dane wyekstrahowane z pliku raportu mają trafiać do bazy (nie tylko do pamięci sesji), a kierownik musi móc wrócić do wcześniej wgranych raportów odczytanych z bazy.
- **Auth:** present — Supabase Auth przez `@supabase/ssr` (`src/lib/supabase.ts`), middleware (`src/middleware.ts`) chroni obecnie tylko `/dashboard`
- **Deploy / infra:** present — Cloudflare Workers, `wrangler` skonfigurowany (per `infrastructure.md`)
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
- **Status:** proposed

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
- **Status:** proposed

### S-03: Kierownik wykrywa telefon zamiast wizyty w wgranym raporcie

- **Outcome:** Kierownik widzi na liście odstępstw aktywności oznaczone jako "telefon zamiast wizyty" — wprost z pola typu aktywności, albo (gdy pole nie istnieje) na podstawie braku GPS i bardzo krótkiego/zerowego czasu na miejscu.
- **Change ID:** phone-vs-visit-deviation-detection
- **PRD refs:** FR-010, US-01
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Logika reguły jest już w pełni sprecyzowana w FR-010 (brak niejasności). Sekwencjonowana równolegle do S-02, bo obie reguły są niezależne i opierają się na tych samych fundamentach z S-01.
- **Status:** proposed

### S-04: Kierownik usuwa błędnie wgrany raport

- **Outcome:** Kierownik może usunąć wgrany raport (po jawnym potwierdzeniu); raport oraz wszystkie powiązane wizyty i odstępstwa znikają z listy i bazy dla tego konta.
- **Change ID:** delete-uploaded-report
- **PRD refs:** FR-011, US-02
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-03, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Operacja nieodwracalna — wymaga jawnego potwierdzenia w UI, żeby uniknąć przypadkowej utraty danych. Sekwencjonowana po S-01, bo korzysta z tej samej listy raportów zbudowanej w gwieździe przewodniej.
- **Status:** proposed

### S-05: Kierownik oznacza odstępstwo jako sprawdzone/fałszywy alarm

- **Outcome:** Kierownik może oznaczyć dowolne odstępstwo na liście jako "sprawdzone" (i cofnąć to oznaczenie); status przeglądu jest trwały i widoczny przy kolejnych powrotach do raportu.
- **Change ID:** mark-deviation-reviewed
- **PRD refs:** FR-012, US-03
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Prosta zmiana statusu na już istniejącym rekordzie odstępstwa — niska złożoność, ale wymaga pola statusu przeglądu w schemacie z F-01. Sekwencjonowana po S-01, gdy lista odstępstw już istnieje.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                        | Suggested issue title                                          | Ready for `/10x-plan` | Notes                          |
| ---------- | ---------------------------------- | ---------------------------------------------------------------- | ---------------------- | ------------------------------- |
| F-01       | report-data-schema                 | Migracja Supabase: schemat raportów/wizyt/odstępstw z RLS       | yes                    | Uruchom `/10x-plan report-data-schema` · GitHub: [#1](https://github.com/AC-XEMI/10x-astro-project/issues/1) |
| S-01       | missing-gps-deviation-detection    | Wykrywanie braku GPS w raporcie (gwiazda przewodnia)             | no                     | Czeka na ukończenie F-01 · GitHub: [#2](https://github.com/AC-XEMI/10x-astro-project/issues/2) |
| S-02       | route-deviation-detection          | Wykrywanie nieoptymalnej trasy w raporcie                        | no                     | Czeka na F-01, S-01 · GitHub: [#3](https://github.com/AC-XEMI/10x-astro-project/issues/3) |
| S-03       | phone-vs-visit-deviation-detection | Wykrywanie telefonu zamiast wizyty w raporcie                    | no                     | Czeka na F-01, S-01 · GitHub: [#4](https://github.com/AC-XEMI/10x-astro-project/issues/4) |
| S-04       | delete-uploaded-report             | Usuwanie błędnie wgranego raportu                                 | no                     | Czeka na F-01, S-01 · GitHub: [#6](https://github.com/AC-XEMI/10x-astro-project/issues/6) |
| S-05       | mark-deviation-reviewed            | Oznaczanie odstępstwa jako sprawdzone/fałszywy alarm              | no                     | Czeka na F-01, S-01 · GitHub: [#7](https://github.com/AC-XEMI/10x-astro-project/issues/7) |

## Open Roadmap Questions

1. **Czy i kiedy dołączyć realny eksport z systemu firmowego zamiast danych testowych?** — Owner: user. Block: brak (świadomie poza zakresem MVP, patrz Parked). GitHub: [#5](https://github.com/AC-XEMI/10x-astro-project/issues/5)

## Parked

- **Filtrowanie/sortowanie listy odstępstw (FR-007)** — Why parked: Priority nice-to-have w PRD, jawnie poza MVP.
- **Eksport listy odstępstw (FR-008)** — Why parked: Priority nice-to-have w PRD, jawnie poza MVP.
- **Integracja z realnym systemem firmowym** — Why parked: PRD Non-Goals — MVP działa wyłącznie na danych testowych/przykładowych.
- **Współdzielenie danych między kierownikami / widoki zbiorcze** — Why parked: PRD Non-Goals — brak takiej funkcji w MVP.

## Milestone History

(pusto — pierwszy milestone)

## Done

- **F-01: (foundation) Schemat i trwałość danych raportu w Supabase, izolowane per-użytkownik** — Archived 2026-09-25 → `context/archive/2026-09-25-report-data-schema/`. Lesson: —.
