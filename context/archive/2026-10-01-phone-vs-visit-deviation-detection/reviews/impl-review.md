<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Wykrywanie telefonu zamiast wizyty w wgranym raporcie

- **Plan**: context/changes/phone-vs-visit-deviation-detection/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Asymetria obsługi `null` w `activity_type` nieudokumentowana w kodzie źródłowym

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/lib/services/deviation-rules.ts:27-46` (detectPhoneInsteadOfVisit) vs `:83-84` (detectRouteDeviations)
- **Detail**: `detectRouteDeviations` traktuje `activity_type === null` jako równoważne `"wizyta"` (włączone do grupowania tras), podczas gdy `detectPhoneInsteadOfVisit` traktuje `null` jako "brak pola" (uruchamia heurystykę). Plan jawnie dokumentuje to jako celową różnicę (sekcja "Critical Implementation Details"), i subagent niezależnie potwierdził uruchomieniem kodu, że asymetria faktycznie istnieje w implementacji. Problem: to wyjaśnienie żyje wyłącznie w `plan.md`, a nie w samym pliku źródłowym — przyszły maintainer czytający `deviation-rules.ts` w izolacji (np. po zarchiwizowaniu planu) nie ma żadnego sygnału, że to świadoma decyzja, a nie błąd.
- **Fix**: Dodać jednolinijkowy komentarz przy `detectRouteDeviations:83` (np. "NOTE: unlike detectPhoneInsteadOfVisit below, null activity_type is treated as 'wizyta' here — intentional, different business question") i/lub analogiczną wzmiankę w JSDoc `detectPhoneInsteadOfVisit`.
- **Decision**: FIXED — Fix differently. Użytkownik zdecydował się ujednolicić RZECZYWISTE zachowanie (nie tylko komentarz): `detectRouteDeviations` zmieniony tak, by tylko jawna `"wizyta"` była grupowana (wcześniej `null` był traktowany jak `"wizyta"`, teraz jest wykluczony — spójne z `detectPhoneInsteadOfVisit`). Komentarze w obu funkcjach zaktualizowane z odnośnikiem krzyżowym. Zweryfikowano: `npm run lint`, `npx astro check`, `npm run verify:report-detection` (38/38 PASS, brak regresji — żaden istniejący wiersz fixture nie miał pustego `typ_aktywnosci` w grupie z inną wizytą, więc zmiana nie wpłynęła na istniejące asercje `route_deviation`).

### F2 — Brak jawnej asercji interakcji nowej reguły z istniejącym wierszem fixture

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria (test coverage)
- **Location**: `scripts/verify-report-detection.mjs`; `test-data/sample-report.csv:5` (Katarzyna Zielińska, index 3)
- **Detail**: Nowa reguła powoduje, że istniejący wiersz z S-01 (`typ_aktywnosci=telefon`, już oznaczony `missing_gps`) teraz DODATKOWO dostaje `phone_instead_of_visit` — to poprawne, zgodne ze specyfikacją zachowanie (ścieżka "wprost" jest niezależna od GPS, tak jak `missing_gps` jest niezależne od typu aktywności), potwierdzone bezpośrednim wywołaniem przez subagenta. Skrypt weryfikacyjny nigdy nie asertuje `detectPhoneInsteadOfVisit` względem oryginalnych 9 wierszy (tylko względem nowych 6) — nie ma regresji, ale ta interakcja nie jest jawnie przetestowana.
- **Fix**: Opcjonalnie dodać jedną asercję potwierdzającą, że indeks 3 również dostaje `phone_instead_of_visit`, żeby zabezpieczyć przed przyszłą, cichą zmianą tego zachowania przy edycji fixture'a.
- **Decision**: FIXED — dodano dwie asercje dla indeksu 3 (Katarzyna Zielińska) w `scripts/verify-report-detection.mjs`, potwierdzające że dostaje zarówno `phone_instead_of_visit`, jak i `missing_gps`. Zweryfikowano: oba zielone, dla obu formatów.

## Notes

- Plan-drift sub-agent potwierdził MATCH dla wszystkich plikow we wszystkich 3 fazach — zero DRIFT/MISSING/EXTRA. Oryginalne 9 wierszy fixture potwierdzone bajt-po-bajcie niezmienione (`git diff 5fc4b33 65f36c9`).
- Wszystkie automatyczne kryteria sukcesu zweryfikowane niezależnie przez głównego reviewera po obu przebiegach subagentów: `npm run lint`, `npx astro check`, `npm run verify:report-detection` (38/38 asercji, oba formaty CSV i XLSX) — wszystkie zielone.
- Wszystkie manualne kryteria sukcesu w Progress są `[x]` z SHA commitów i zostały potwierdzone przez użytkownika podczas implementacji na żywo względem podpiętego projektu Supabase.
- Brak migracji (zgodnie z planem) potwierdzony przez `git show --stat` na wszystkich trzech commitach fazowych.
- Izolacja fixture'a od pozostałych dwóch reguł (brak przypadkowego `route_deviation` na nowych wierszach) potwierdzona niezależnie przez odczyt `detectRouteDeviations` i uruchomienie skryptu.
