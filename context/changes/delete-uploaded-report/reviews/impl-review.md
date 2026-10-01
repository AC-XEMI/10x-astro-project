<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Usuwanie wgranego raportu

- **Plan**: context/changes/delete-uploaded-report/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Błąd zapytania o listę raportów jest cicho połykany, bez logowania

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: `src/pages/reports/index.astro:16-33`
- **Detail**: `fetchError` jest destrukturyzowany, ale nigdy nie odczytywany na ścieżce błędu — brak `console.error`, brak banera. Zgodne z wymogiem planu (błąd zapytania ma degradować do pustej listy, nie crashować strony — potwierdzone, formularz uploadu nadal działa), ale prawdziwy błąd produkcyjny (np. błędna konfiguracja RLS, problem z połączeniem) wyglądałby jak "nie masz żadnych raportów" bez żadnej widoczności dla operatora.
- **Fix**: Dodać `console.error(fetchError)` przed przejściem do domyślnej pustej listy.
- **Decision**: FIXED — dodano `console.error("Failed to fetch reports list:", fetchError)` w `src/pages/reports/index.astro`. Uwaga: to pierwsze użycie `console.*` w `src/`, generuje nowe ostrzeżenie `no-console` (nie błąd — `npm run lint` nadal kończy się kodem 0). Projekt nie ma jeszcze biblioteki logowania (CLAUDE.md: "Observability: absent"), zaakceptowano jako tymczasowy, świadomy kompromis.

### F2 — Numer strony ginie przy przekierowaniu po usunięciu

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (UX)
- **Location**: `src/pages/api/reports/[id]/delete.ts:31` vs `src/pages/reports/index.astro:12,67-68`
- **Detail**: Udane usunięcie przekierowuje bezwarunkowo na `/reports?deleted=1`, tracąc parametr `page`. Usunięcie raportu ze strony 2+ cicho odbija użytkownika na stronę 1, mimo że `index.astro` starannie obsługuje `page` wszędzie indziej. Drobna regresja UX, nie błąd poprawności.
- **Fix**: Endpoint usuwania nie zna aktualnej strony (nie jest przekazywana w formularzu) — wymagałoby dodania ukrytego pola `page` do formularza w `ReportsList.tsx` i odczytania go w `delete.ts` do zbudowania `/reports?deleted=1&page=${page}`.
- **Decision**: FIXED — `ReportsList.tsx` dostaje nowy prop `page`, formularz usuwania ma ukryte pole `<input type="hidden" name="page" value={page} />`; `delete.ts` odczytuje `page` z `formData` (ze zwężeniem typu `typeof page === "string"`, bez niebezpiecznego `String()` na `FormDataEntryValue`) i dołącza do redirectu sukcesu. Zweryfikowano: lint/astro check/build zielone.

### F3 — Ciasteczka sesji bez jawnego SameSite — ekspozycja CSRF (przedawniona, nie wprowadzona przez tę zmianę)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (informational) — pre-existing
- **Location**: `src/lib/supabase.ts:10-21`
- **Detail**: Natywny `<form method="POST">` (używany przez nowy `delete.ts`, a także istniejące `upload.ts`/`signout.ts`) polega wyłącznie na domyślnym zachowaniu SameSite ciasteczek `@supabase/ssr` dla ochrony CSRF — identyczna, już istniejąca ekspozycja, NIE wprowadzona ani poszerzona przez tę zmianę.
- **Fix**: Brak akcji w ramach tej zmiany — do rozważenia zbiorczo dla wszystkich trzech endpointów, jeśli zespół zdecyduje się to wzmocnić.
- **Decision**: FIXED — użytkownik zdecydował się naprawić teraz mimo że poza pierwotnym zakresem. `src/lib/supabase.ts`: `cookies.set(name, value, { ...options, sameSite: "lax" })` — jawne `SameSite=Lax` na wszystkich ciasteczkach sesji (dotyczy całej aplikacji: logowanie, upload, usuwanie, wylogowanie). Zweryfikowano: lint/astro check/build zielone, ręczne logowanie i dostęp do `/reports` nadal działają poprawnie po zmianie.

### F4 — Brak `prerender = false` w API routes (przedawnione, repo-wide, nie wprowadzone przez tę zmianę)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency — pre-existing
- **Location**: `src/pages/api/reports/[id]/delete.ts` (oraz `upload.ts`, `signout.ts`)
- **Detail**: CLAUDE.md mówi "API routes must export `const prerender = false`", ale żaden istniejący endpoint tego nie robi. Funkcjonalnie bez znaczenia, bo `astro.config.mjs` ma globalne `output: "server"` — luka w dokumentacji/konwencji, nie w działaniu, i nie wprowadzona przez tę zmianę (nowy `delete.ts` jest po prostu spójny z już istniejącymi `upload.ts`/`signout.ts`).
- **Fix**: Kandydat na `/10x-lesson` (rozbieżność między zapisaną regułą a rzeczywistym kodem), nie fix w ramach tej zmiany.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Każdy nowy API route musi jawnie eksportować `prerender = false`". Zapisano w `context/foundation/lessons.md` (nowy plik). Użytkownik zdecydował się też naprawić kod teraz: dodano `export const prerender = false;` do wszystkich 5 istniejących API routes (`signin.ts`, `signup.ts`, `signout.ts`, `upload.ts`, `delete.ts`). Zweryfikowano: lint/astro check/build zielone.

## Notes

- Plan-drift sub-agent potwierdził MATCH dla wszystkich 5 plików we wszystkich 3 fazach, włącznie z kluczowym sprawdzeniem krytycznym: brak `fetch`/`onSubmit` przechwytującego formularz usuwania — potwierdzone bezpośrednią inspekcją kodu.
- `npm run verify:rls` zweryfikowany live przez subagenta przeglądu (niezależnie od mojej własnej wcześniejszej weryfikacji) — 8/8 asercji PASS.
- Niezależna ocena wzorca "natywny formularz wewnątrz Radix Dialog portal" — subagent potwierdził, że to czysty, idiomatyczny wzorzec bez wad strukturalnych (portal do `document.body` faktycznie *pomaga* uniknąć zagnieżdżenia formularzy, a nie wprowadza ryzyko).
- Wszystkie automatyczne kryteria sukcesu zweryfikowane podczas implementacji: `npm run lint`, `npx astro check`, `npm run build`, `npm run verify:rls` — wszystkie zielone dla wszystkich 3 faz.
- Wszystkie manualne kryteria sukcesu w Progress są `[x]` z SHA commitów, potwierdzone przez użytkownika na żywo.
- Deliberate-break check dla Fazy 3 wykonany na rzeczywistej polityce RLS w lokalnej bazie (nie tylko kodzie JS) — złamanie `reports_delete_own` dało 3 czerwone asercje, przywrócenie dało znów 8/8.
