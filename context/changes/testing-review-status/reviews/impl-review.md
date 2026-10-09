<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Phase 3 — status przeglądu odstępstw

- **Plan**: context/changes/testing-review-status/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Automatyczne kryteria ponownie uruchomione 2026-10-09: `npm test` 134/134, `npm run lint` 0 błędów, `npx astro check` 0 błędów, `check:ui-tokens` OK, Prettier test-planu OK; integracja: CI na PR #12 (commit `68a0f1b`) zielone, `deviation-review.int.test.ts` 5/5 w logu `smoke`. Manualne 1.6, 2.4, 3.6, 3.7, 4.3 potwierdzone przez użytkownika w sesji. Znane adaptacje (cofnięcie na własnej wizycie T2, `isPartialReview`, predykat „brak któregoś id”) uznane za zgodne z intencją.

## Findings

### F1 — Sprzątanie w afterAll może zostawić dane B

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/deviation-review.int.test.ts (afterAll), tests/integration/helpers/seed-db.ts:21-41
- **Detail**: Gdy usunięcie raportu A nie powiedzie się, `expect(error).toBeNull()` rzuca przed usunięciem raportu B. Dodatkowo, jeśli `seedAs` padnie po wstawieniu raportu (wizyta/odstępstwo), `foreignReportId` nie zostaje ustawione i raport B zostaje. Konta są per przebieg, więc wyciek nie przechodzi między przebiegami, ale w obrębie przebiegu B jest współdzielone z `rls-isolation`.
- **Fix**: W afterAll najpierw wykonać oba usunięcia (`Promise.allSettled`), potem asercje; dla częściowego seeda — sprzątać po nazwie pliku/prefiksie B albo zwracać id raportu także przy błędzie.
- **Decision**: FIXED — `Promise.all` w afterAll przed asercjami; `seedAs` usuwa raport przy błędzie wizyty/odstępstwa

### F2 — Wspólny helper `seed-db.ts` ma nazwy z `rls-isolation`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/integration/helpers/seed-db.ts:12-22
- **Detail**: Po przeniesieniu helper nadal twardo koduje prefiks `rls-isolation-` i `VISIT_FIELDS` („RLS Isolation Rep”, „Klient RLS”), więc raport B z `deviation-review` nazywa się `rls-isolation-deviation-review-b-<uuid>.csv` — mylące przy debugowaniu pozostawionych wierszy.
- **Fix**: Prefiks nazwy pliku z `label` (np. `seed-${label}-…`, a `rls-isolation` przekazuje `rls-isolation-a`) i neutralne nazwy pól; asercje `rls-isolation` na nazwie pliku sprawdzić po zmianie.
- **Decision**: FIXED — nazwa pliku `<label>-<uuid>.csv`, `rls-isolation` przekazuje `rls-isolation-a/b`, neutralne `VISIT_FIELDS`

### F3 — Pole `partial` z `applyReviewResult` nieużywane w produkcji

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/review-result.ts:24-42, src/lib/review-result.test.ts:82-144
- **Detail**: Komponent woła `isPartialReview` poza updaterem (słusznie), a `applyReviewResult(...).partial` jest liczone i wyrzucane. Testy asertują `result.partial`, więc `isPartialReview` jest testowane tylko pośrednio — testy dowodzą pola, którego produkcja nie czyta.
- **Fix**: Usunąć `partial` z wyniku `applyReviewResult` (zwracać same wizyty) i przepiąć asercje częściowego sukcesu na bezpośrednie wywołania `isPartialReview`; kontrolę czułości D powtórzyć.
- **Decision**: FIXED — `applyReviewResult(visits, updated): V[]` bez `partial`; testy bezpośrednio na `isPartialReview` (+ duplikat id); kontrola czułości D powtórzona: 3 czerwone

### F4 — §8 Freshness Ledger nieodświeżony po edycji §2

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md §8
- **Detail**: Faza 4 zmieniła Risk Response Guidance #6 (§2, część strategii), a „Strategy (§1–§5) last reviewed” zostało na 2026-10-08. Plan uzależniał wpis od potrzeby („jeśli sekcja tego wymaga”).
- **Fix**: Ustawić „Strategy (§1–§5) last reviewed: 2026-10-09 (§2 #6 po Phase 3)”.
- **Decision**: FIXED — §8 Strategy last reviewed: 2026-10-09

### F5 — Adaptacje implementacji nie są zapisane w planie

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/testing-review-status/plan.md (Faza 1 „cofnięcie”, Faza 3 Contract)
- **Detail**: Cofnięcie działa na własnej wizycie T2 (plan: wizyta z „zbiorczo”), a Faza 3 dodała eksport `isPartialReview` używany przez komponent. Zmiany są uzasadnione, ale plan — źródło prawdy dla archiwum — o nich nie mówi.
- **Fix**: Dopisać krótkie notki „Adaptacja:” w blokach Faza 1 i Faza 3 (bez zmiany Progress).
- **Decision**: FIXED — notki „Adaptacja” w Faza 1 i Faza 3 planu
