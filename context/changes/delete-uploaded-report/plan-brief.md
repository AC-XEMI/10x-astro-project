# Usuwanie wgranego raportu — Plan Brief

> Pełny plan: `context/changes/delete-uploaded-report/plan.md`

## Co i po co

Czwarty wycinek (roadmap S-04, PRD FR-011/US-02): kierownik może usunąć dowolny, wcześniej wgrany raport po jawnym potwierdzeniu w modalu; raport oraz wszystkie powiązane wizyty i odstępstwa znikają z listy i bazy dla tego konta. Plan naprawia też lukę, którą roadmapa i powiązany GitHub issue błędnie zakładały za rozwiązaną: żadna lista wcześniej wgranych raportów nigdy nie powstała (S-01 jawnie odłożyło ją do tego wycinka).

## Punkt wyjścia

`/reports` to dziś wyłącznie formularz uploadu; `/reports/[id]` pokazuje wynik jednego, konkretnego raportu, dostępny tylko ze znajomości URL. Kaskadowe usuwanie (`ON DELETE CASCADE` na `visits`/`deviations`) i autoryzacja (RLS blokująca usuwanie cudzych raportów) są już w pełni gotowe i częściowo przetestowane od F-01/S-01.

## Pożądany stan końcowy

Na `/reports` kierownik widzi formularz uploadu oraz stronicowaną listę wcześniej wgranych raportów. Kliknięcie "Usuń" otwiera modal ze szczegółami raportu i ostrzeżeniem o nieodwracalności; potwierdzenie usuwa raport wraz z wizytami/odstępstwami i pokazuje baner sukcesu.

## Kluczowe decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) |
| --- | --- | --- |
| Lista raportów | Zbudować minimalną listę | Bez niej US-02 nie jest realnie wykonalne dla raportów sprzed bieżącej sesji; roadmapa błędnie zakładała, że lista już istnieje |
| Lokalizacja listy | Scalona z `/reports` | Jeden landing page, naturalne miejsce, zero nowych tras |
| Mechanizm potwierdzenia | Modal (shadcn Dialog) | Wybrane świadomie mimo kosztu nowego komponentu — najbardziej dopracowane UX dla operacji nieodwracalnej |
| Siła potwierdzenia | Jeden przycisk po ostrzeżeniu | Spełnia wymóg PRD bez nadmiernego tarcia dla narzędzia używanego regularnie |
| Treść modala | Pokazuje szczegóły raportu | Przy wielu podobnych raportach łatwo pomylić, który się usuwa |
| Paginacja | Linki server-side (`?page=N`) | Spójne z całym istniejącym wzorcem apki (zero JSON API w repo) |
| Przesyłanie usunięcia | Natywny formularz POST wewnątrz modala | Modal to czysto wizualna warstwa — unika wprowadzania pierwszego fetch/JSON wzorca w repo |
| Testowanie | Rozszerzenie `verify-rls.mjs` | Gotowa infrastruktura dwóch użytkowników idealnie pasuje do testu kaskady |

## Zakres

**W zakresie:**
- `POST /api/reports/[id]/delete` — usunięcie raportu (kaskada już gotowa)
- Lista raportów na `/reports` z paginacją (`PAGE_SIZE=20`)
- Modal potwierdzenia (shadcn Dialog, nowy komponent) ze szczegółami raportu
- Baner sukcesu/błędu
- Rozszerzenie `verify-rls.mjs` o ścieżkę pozytywną (właściciel usuwa, kaskada działa)

**Poza zakresem:**
- JSON API / doklejanie wyników bez przeładowania
- Dodatkowe potwierdzenie (wpisanie nazwy pliku)
- Osobna trasa na listę raportów
- Miękkie usuwanie / możliwość przywrócenia (US-02 wprost wymaga trwałości)
- S-05 (oznaczanie odstępstwa jako sprawdzone)

## Architektura / Podejście

Endpoint usuwania to cienka warstwa mirror `upload.ts` (auth → `DELETE` → redirect). UI dodaje drugi React island w tej sekcji (`ReportsList.tsx`), zbudowany dokładnie na wzorcu `DeviationsList.tsx` z S-01 — jeden komponent, cała tablica jako props, lokalny stan na "który raport jest potwierdzany do usunięcia". Modal jest czysto wizualny; rzeczywiste usunięcie idzie przez natywny `<form method="POST">` wewnątrz niego, zachowując istniejący wzorzec przeładowania strony. Paginacja to statyczne linki renderowane w `.astro`, poza islandem.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Backend | Endpoint `DELETE` z obsługą błędów/autoryzacji | RLS musi poprawnie zwrócić 0 wierszy (nie błąd) dla cudzego raportu |
| 2. Frontend | Lista + modal + paginacja | Pierwszy Dialog w repo musi wciąż submitować natywny formularz, nie fetch |
| 3. Testowanie | Rozszerzenie `verify-rls.mjs` o kaskadę | Kolejność asercji w skrypcie (usunięcie musi być ostatnie, bo niszczy fixture) |

**Wymagania wstępne:** F-01 (schemat + kaskada) i S-01 (wzorzec API/UI) ukończone i zarchiwizowane — spełnione.
**Szacowany wysiłek:** ~2-3 sesje po godzinach, 3 fazy.

## Open Risks & Assumptions

- `PAGE_SIZE=20` to inżynierski domyślny wariant bez wywiadu o dokładnej liczbie — do rewizji, jeśli okaże się za mała/duża.
- Pierwszy modal (shadcn Dialog) w repo — wzorzec "modal + natywny formularz" nie ma jeszcze precedensu, implementer musi uważać, żeby nie "ulepszyć" tego do fetch/JSON.

## Kryteria sukcesu (podsumowanie)

- Kierownik widzi na `/reports` listę wcześniej wgranych raportów i może usunąć dowolny z nich po potwierdzeniu w modalu.
- Usunięty raport i wszystkie powiązane wizyty/odstępstwa znikają trwale z bazy i UI.
- Usunięcie jednego raportu nie wpływa na inne raporty tego samego konta; cudze raporty są chronione (już dowiedzione przez istniejący `verify-rls.mjs`, teraz dopełnione ścieżką pozytywną).
