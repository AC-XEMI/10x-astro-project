<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Oznaczanie odstępstwa jako sprawdzone

- **Plan**: context/changes/mark-deviation-reviewed/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-01
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Brak ochrony przed nakładającymi się żądaniami przełączania

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/reports/DeviationsList.tsx:35-62, 99-114, 156-176
- **Detail**: Żaden przycisk nie jest blokowany na czas trwania własnego żądania. Nakładające się żądania (np. zbiorczy + indywidualny toggle dla tego samego odstępstwa) mogą wrócić w innej kolejności niż zostały wysłane — `setVisits` zastosuje tę, która przyjdzie jako ostatnia, więc UI może pokazać stan starszy niż ostatnia akcja użytkownika.
- **Fix A ⭐ Recommended**: Blokuj przycisk(i) dla danego id na czas trwania żądania (zbiór pending id w stanie, disabled na pasujących przyciskach).
  - Strength: Proste, bezpośrednio eliminuje opisany scenariusz, zgodne z minimalistycznym stylem repo.
  - Tradeoff: Nie chroni przed wyścigiem między dwiema kartami przeglądarki na tym samym koncie.
  - Confidence: HIGH — bezpośrednio adresuje opisany scenariusz.
  - Blind spot: Wyścig między kartami nieobsłużony.
- **Fix B**: Licznik wersji żądania per-id; stosuj tylko odpowiedź będącą wciąż najnowszą dla danego id.
  - Strength: Poprawne przy dowolnym nakładaniu się żądań, w tym między kartami.
  - Tradeoff: Więcej złożoności dla ryzyka niskiego i odwracalnego (plan sam uzasadnia brak modala potwierdzenia tą niskością ryzyka).
  - Confidence: MEDIUM — poprawne teoretycznie, trudniejsze do ręcznego zweryfikowania bez frameworka testowego.
  - Blind spot: Brak istotnych.
- **Decision**: FIXED via Fix A — added `pendingIds` state tracking in-flight deviation ids, disabled matching buttons while pending.

### F2 — Przyciski ikonowe zamiast tekstowych etykiet z planu

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/reports/DeviationsList.tsx:99-114, 156-176
- **Detail**: Kontrakt planu opisywał zwykłe etykiety tekstowe. Implementacja używa przycisków-ikon (lucide-react) z tekstem w `title`/`aria-label` — świadoma zmiana na prośbę użytkownika już po oryginalnej implementacji Fazy 2, nieodzwierciedlona w plan.md.
- **Fix**: Zaakceptować jako świadomą zmianę bez aktualizacji plan.md, albo dopisać jednozdaniowy aneks do kontraktu Fazy 2.
- **Decision**: ACCEPTED — świadoma, zatwierdzona iteracja UI; plan.md pozostaje bez zmian.

### F3 — Węższa obsługa defensywna fetch niż w kontrakcie planu

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/reports/DeviationsList.tsx:43-48
- **Detail**: Plan wymagał sprawdzenia `response.ok` ORAZ content-type przed `response.json()` (middleware przy wygasłej sesji zwraca redirect/HTML, nie czysty 401 JSON). Implementacja sprawdza tylko `response.ok`; błąd i tak trafia do istniejącego `try/catch`, więc nie ma funkcjonalnej awarii — tylko rozbieżność z dokumentacją.
- **Fix**: Dodać sprawdzenie `response.headers.get("content-type")?.includes("application/json")` przed `response.json()`.
- **Decision**: FIXED — added content-type check alongside `response.ok` before `response.json()`.

### F4 — Twarde kolory hover zamiast tokenów motywu (dark mode)

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/reports/DeviationsList.tsx:102, 159
- **Detail**: `hover:border-slate-400 hover:bg-slate-200` to świadomy fix na prośbę użytkownika (domyślny hover wariantu `outline` jest niemal niewidoczny). Brak odpowiednika `dark:` — ale `.dark` nigdy nie jest przełączane nigdzie w aplikacji, więc to czysto teoretyczne ryzyko.
- **Fix**: Zostawić bez zmian; dopisać `dark:hover:bg-slate-700 dark:hover:border-slate-500` tylko jeśli kiedyś zostanie dodany faktyczny dark mode toggle.
- **Decision**: SKIPPED — dark mode nigdy nie jest aktywowany w aplikacji, martwe ryzyko.
