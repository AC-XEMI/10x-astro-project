<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Phase 2 — kompletny i poprawny zapis wgranego raportu

- **Plan**: context/changes/testing-report-save-integrity/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Automated evidence (2026-10-09):
- `npm run lint`: 0 errors.
- `npx astro check`: 0 errors.
- `npm test`: 126/126.
- `npx prettier --check context/foundation/test-plan.md`: clean.
- `grep "TBD — see §3 Phase 2"`: 0 hits.
- CI on PR #11 at HEAD `526eec7`: `ci` pass, `smoke` pass. The integration run in `smoke` (74 tests, 8 files) was confirmed on `b40f8bc`.

Local `npm run test:integration` was not re-run in this review: env files were restored to the cloud project.

Known adaptations, verified and not flagged:
- deviation status is `unreviewed`, not `new`;
- the DDL runs as one `do` block (CLI one-statement limit);
- `--agent no --output-format json`;
- the formData `catch` falls into the existing `no_file` branch;
- `HttpClient` sends `Connection: close`;
- §3 stays `implementing` until archive.

## Findings

### F1 — Pozostawiony raport `it-fault-%` psuje wszystkie kolejne przebiegi

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/integration/helpers/db-fault.ts:178-184, tests/integration/upload-compensation.int.test.ts:33-37
- **Detail**: Końcowe `afterAll` pliku sprawdza `faultReportCount() === 0` dla wszystkich raportów `it-fault-%` w bazie, nie tylko z tego przebiegu. Raport zostaje, gdy przebieg zostanie przerwany w (d), sprzątanie zawiedzie albo kontrola czułości ominie kompensację (stało się tak przy 4.5, posprzątane ręcznie). Należy on do konta A tamtego przebiegu, a każdy przebieg tworzy nowe konta, więc żaden kolejny go nie usunie. Asercja pada wtedy przy każdym następnym przebiegu, aż do ręcznego czyszczenia lub resetu bazy. Triggery same się naprawiają (idempotentne `create or replace`), raporty nie.
- **Fix A ⭐ Recommended**: Samonaprawa na starcie pliku. W `beforeAll` usuń wszystkie cztery faulty i wykonaj `delete from public.reports where original_filename like 'it-fault-%'` przez `runLocalSql` (jako `postgres`, lokalnie; kaskada usuwa wizyty i odstępstwa). Dodaj to jako funkcję w `db-fault.ts`, np. `resetFaults()`.
  - Strength: Zachowuje mocną asercję końcową. Przerwany przebieg nie blokuje następnego, a SQL zostaje w helperze zgodnie z jego kontraktem.
  - Tradeoff: Test usuwa dane jako `postgres`. Zakres jest ograniczony do prefiksu, który mają wyłącznie testy.
  - Confidence: HIGH — prefiks `it-fault-` nadaje tylko `faultMarker()`, baza jest lokalna i efemeryczna w CI.
  - Blind spot: Równoległe uruchomienie dwóch przebiegów na tej samej bazie (dziś nie występuje: `fileParallelism: false`, jeden przebieg naraz).
- **Fix B**: Zawęzić asercję końcową do markerów tego pliku (zebrać markery z describe'ów i sumować `markerRowCounts`).
  - Strength: Test nie dotyka cudzych danych.
  - Tradeoff: Stary raport zostaje w bazie na zawsze, a ślad przerwanego przebiegu jest niewidoczny.
  - Confidence: MED — prostsze, ale ukrywa problem zamiast go naprawiać.
  - Blind spot: Nic nie sprząta pozostałości.
- **Decision**: FIXED (Fix A — `resetFaults()` w `db-fault.ts`, wołane w `beforeAll` pliku kompensacji; sprawdzone: zdejmuje triggery i usuwa pozostawiony raport)

### F2 — `execSync` bez limitu czasu może zawiesić cały przebieg

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/helpers/db-fault.ts:37
- **Detail**: `execSync` blokuje pętlę zdarzeń, więc timery Vitest (30 s / 60 s) nie zadziałają. Zawieszone `npx supabase db query` (wstrzymany Docker, prompt CLI) zawiesza przebieg lokalnie i job `smoke` w CI aż do jego globalnego limitu.
- **Fix**: Dodać `timeout: 30_000` do opcji `execSync` w `execLocalSql`. Błąd przekroczenia czasu przejdzie przez istniejący `catch` z czytelnym komunikatem.
- **Decision**: FIXED (`timeout: 30_000` w `execLocalSql`)

### F3 — Notatka §6.5 Phase 2 pomija kontrolę czułości z Fazy 1

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/foundation/test-plan.md §6.5 (Phase 2)
- **Detail**: Kryterium 5.4 (odznaczone) wymaga wyników kontroli czułości z Faz 1–4. Notatka wymienia sześć kontroli z Faz 2–4, ale pomija Fazę 1: sonda jest czerwona bez `installFault` (Progress 1.5).
- **Fix**: Dopisać do listy kontroli: „sonda bez `installFault` (wgranie z markerem przeszło)”.
- **Decision**: FIXED (§6.5 Phase 2: dopisana sonda bez `installFault`)

### F4 — §6.2 opisuje fallback `--db-url` tak, jakby był zaimplementowany

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md §6.2 („Wymuszony błąd zapisu w bazie”)
- **Detail**: Tekst „fallback to `--db-url` z `DB_URL` w `connectionArgs()`” sugeruje istniejący fallback. Tymczasem `connectionArgs()` zwraca tylko `"--local"` (`db-fault.ts:29-31`), a fallback opisuje jedynie komentarz.
- **Fix**: Zmienić na „gdyby `--local` przestało działać, przełącz `connectionArgs()` na `--db-url` z `DB_URL`”.
- **Decision**: FIXED (§6.2: fallback jako instrukcja przełączenia)

### F5 — Nieaktualna liczba logowań na przebieg

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/integration/global-setup.ts:32, context/foundation/test-plan.md:132
- **Detail**: Komunikat limitu w `globalSetup` i §6.2 mówią „about 10” / „ok. 10 z 30”. Po dodaniu trzech plików (po jednym logowaniu A na plik) przebieg zużywa ok. 13–14.
- **Fix**: Zmienić na „about 14” / „ok. 14 z 30” i zaznaczyć, że po dwóch przebiegach z rzędu trzeba odczekać.
- **Decision**: FIXED (`global-setup.ts`: about 14; §6.2: ok. 14 z 30)

### F6 — Log `no_file` nie odróżnia nieczytelnego ciała od braku pola

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/reports/upload.ts:39-43
- **Detail**: Gołe `catch {}` mapuje każdy wyjątek `formData()` na `no_file`: ciało nie-multipart, ale też przerwany strumień. Dla klienta 302 `no_file` jest poprawne i nic, co powinno być 500, nie ginie. Wpis `report.upload.rejected / no_file / validate` jest jednak identyczny w obu przypadkach.
- **Fix**: Dodać w `src/lib/app-events.ts` etap (np. `read_body`) do unii `AppEventStage` i użyć go w gałęzi `catch` (bez logowania obiektu błędu). Wymaga rozdzielenia gałęzi `catch` od wspólnej gałęzi `no_file`.
- **Decision**: SKIPPED

### F7 — Podwójne `removeFault("reports_delete")` w (d)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/integration/upload-compensation.int.test.ts:168,171
- **Detail**: `afterAll` (d) zdejmuje trigger DELETE w `try` (żeby móc usunąć sierotę) i ponownie w `finally`. Jest to idempotentne i nieszkodliwe, ale może mylić. Wywołanie w `finally` jest siatką bezpieczeństwa na wypadek, gdyby pierwsze rzuciło wyjątek.
- **Fix**: Dodać komentarz przy drugim wywołaniu („again in case the first removal threw”) albo zostawić.
- **Decision**: SKIPPED
