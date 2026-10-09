# Phase 2 — kompletny i poprawny zapis wgranego raportu — Plan Brief

> Full plan: `context/changes/testing-report-save-integrity/plan.md`
> Research: `context/changes/testing-report-save-integrity/research.md`

## What & Why

Rollout Phase 2 test-planu (ryzyka #3, #4, #5). Wgranie raportu zapisuje dane w trzech krokach bez transakcji, reguły w produkcji dostają wizyty w kolejności zwróconej przez bazę, a walidację po stronie serwera testowano dotąd tylko jednostkowo. Chcemy dowieść na prawdziwej bazie trzech rzeczy:

- zapis jest „wszystko albo nic”,
- wynik zgadza się z wyrocznią wiersz po wierszu,
- serwer sam odrzuca błędne pliki z czytelnym kodem.

## Starting Point

Harness integracyjny z Phase 1 (`HttpClient`, `clientAs`, konta A/B/C, CI job `smoke`) obsługuje tylko ścieżkę sukcesu wgrania CSV. Dwa spreparowane żądania (ciało nie-multipart, `report_file` jako tekst) dają dziś 500. Błędu insertu `deviations` nie da się wywołać treścią pliku.

## Desired End State

Trzy nowe pliki testowe i helper do wstrzykiwania błędów w bazie są zielone lokalnie i w CI. Każdy test sprawdza stan bazy odczytany jako właściciel i ma udokumentowaną kontrolę czułości. Trasa wgrywania odpowiada `no_file` zamiast 500. Test-plan §6 opisuje nowe wzorce.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Warstwa | Integracja HTTP + odczyt bazy jako właściciel, bez E2E | Najtańszy prawdziwy sygnał dla wszystkich trzech ryzyk | Research |
| Wymuszenie błędu zapisu | Tymczasowy trigger Postgresa zawężony do markera w `original_filename`, przez `supabase db query` (fallback `--db-url`, potem `pg`) | Prawdziwa gałąź błędu i prawdziwa kaskada; mock dowodziłby kompensacji z definicji | Research / Plan |
| Ścieżki 500 | Najpierw czerwony test, potem poprawka w `upload.ts` (try/catch + `instanceof File` → `no_file`) | Zamyka „serwer ufa klientowi” zamiast go opisywać; zmiana w jednym pliku | Plan |
| Rozróżnianie błędów parsera | Tokeny w `detail` (nazwy kolumn, `Wiersz N`) + asercja negatywna dla gałęzi samej prozy | Bez zmiany produktu; znana luka: „pusty” vs „uszkodzony” vs „złe rozszerzenie” nierozróżnialne | Research / Plan |
| Gałęzie kompensacji | `visits`, `deviations`, `count_failed` i `rollback_failed` | Przypina też świadomą decyzję o liczniku i zachowanie przy nieudanym rollbacku | Plan |
| Fixture'y | CSV i XLSX dla #4, tylko CSV dla #3 i #5 | Różne ścieżki odczytu mają znaczenie tylko dla wyniku reguł | Research |
| Asercja #4 | Multizbiór `visited_client → reguły` z ręcznych literałów, zapytanie strony szczegółów | Łapie przeniesienie flagi trasy między wizytami i duplikaty (brak `unique`) | Research |
| Kolejność | Spike → #4 → #5 → #3 → §6 | Niepewny mechanizm sprawdzony najpierw; tanie testy lądują, zanim od niego zależymy | Plan |

## Scope

**In scope:**
- `helpers/db-fault.ts` i uogólniony `seed.ts`
- `upload-oracle.int.test.ts`, `upload-validation.int.test.ts` (14 przypadków), `upload-compensation.int.test.ts` (4 błędy)
- Poprawka 500 w `upload.ts`
- Aktualizacja §2, §3, §4, §6, §8 test-planu

**Out of scope:**
- Strukturalny `kind` błędu parsera
- Zmiany komunikatów
- Jawne sortowanie wizyt w regule trasy
- `max_rows = 1000`
- `unique (visit_id, rule)`
- E2E i testy komponentu
- Ponowne testowanie funkcji reguł

## Architecture / Approach

Test → `HttpClient` → prawdziwa trasa `POST /api/reports/upload` na zbudowanej aplikacji → lokalny Supabase. Asercje czytają bazę klientem właściciela (`clientAs`). Przy wstrzykniętym błędzie liczymy też wiersze jako `postgres`, bo pusty wynik pod RLS nie dowodzi braku danych. Triggery są nazwane `it_fault_<kind>`, zakładane i zdejmowane idempotentnie w `beforeAll`/`afterAll`, zawężone do prefiksu `it-fault-<kind>-<uuid>`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Spike wstrzyknięcia | Helper SQL + test-sonda, sprawdzone w CI | `supabase db query --local` niesprawdzone (Docker był wyłączony); CI bez `postgres-meta` |
| 2. #4 Wyrocznia | CSV i XLSX → 15 wizyt, 15 par per klient | Kolejność `RETURNING` — test ją przypina, nie gwarantuje |
| 3. #5 Walidacja + poprawka 500 | 14 przypadków: kod + token + 0 raportów w bazie | Zachowanie SheetJS na uszkodzonym XLSX i 0 B niepotwierdzone |
| 4. #3 Wszystko albo nic | 4 wstrzyknięte błędy z asercją stanu bazy | Sprzątanie przy triggerze na DELETE |
| 5. §6 i backport | Cookbook i korekty test-planu | — |

**Prerequisites:** Docker + `npx supabase start` lokalnie albo pętla przez CI (PR do `master`); aplikacja pod `BASE_URL` podłączona do lokalnego Supabase.
**Estimated effort:** ok. 3–4 sesje; Faza 1 może wymagać 1–2 iteracji CI.

## Open Risks & Assumptions

- Jeśli żaden wariant uruchamiania SQL nie działa w CI, Faza 4 stoi. Fazy 2–3 nie zależą od mechanizmu.
- Przypadek uszkodzonego XLSX może ujawnić, że SheetJS czyta śmieci jako CSV. To znalezisko do zgłoszenia, nie powód do poluzowania asercji.
- Kolejność `RETURNING` jest dziś zgodna z kolejnością wstawiania, ale nie jest formalnie gwarantowana.

## Success Criteria (Summary)

- Celowe zepsucie kompensacji, granicy rozmiaru, komunikatu parsera albo kolejności wizyt daje czerwony test w CI.
- Spreparowane żądanie bez pliku dostaje `no_file`, nie 500.
- Następny test zapisu lub reguły da się dopisać według §6 bez czytania tego planu.
