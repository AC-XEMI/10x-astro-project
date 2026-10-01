# Oznaczanie odstępstwa jako sprawdzone — Plan Brief

> Pełny plan: `context/changes/mark-deviation-reviewed/plan.md`

## Co i po co

Piąty i ostatni wycinek milestone'u M-1 (roadmap S-05, PRD FR-012/US-03): kierownik może oznaczyć dowolne odstępstwo jako "sprawdzone"/fałszywy alarm, i cofnąć to oznaczenie. Status jest trwały i widoczny przy kolejnych powrotach do raportu; oznaczenie nie usuwa odstępstwa z listy, tylko zmienia jego status.

## Punkt wyjścia

Schemat (`deviations.status`, `deviations.reviewed_at`) i RLS (`deviations_update_own`) są gotowe od F-01 — zero migracji. `DeviationsList.tsx` (z S-01/S-02) renderuje odstępstwa, ale bez żadnego rozróżnienia statusu; sekcja szczegółów pokazuje tylko odstępstwa z polem `detail`, pomijając np. `missing_gps`.

## Pożądany stan końcowy

Wiersz podsumowania każdej wizyty pokazuje licznik "X/Y sprawdzone" i przycisk zbiorczy oznaczający/cofający wszystkie jej odstępstwa naraz. Rozwinięty wiersz pokazuje pełną listę WSZYSTKICH odstępstw (nie tylko tych z `detail`) z indywidualnym przełącznikiem każdego. Przełączanie działa bez przeładowania strony.

## Kluczowe decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) |
| --- | --- | --- |
| Mechanizm przełączania | `fetch` + JSON, aktualizacja stanu klienta | Pierwszy wyjątek od wzorca natywnych formularzy w repo — uzasadniony częstotliwością akcji (w przeciwieństwie do rzadkiego usuwania z S-04) |
| Umiejscowienie kontrolki | Zbiorczy przycisk w wierszu podsumowania + indywidualne w rozwiniętym wierszu | Szybkie oznaczanie wielu pozycji + precyzyjna kontrola gdy odstępstwa mają mieszany status |
| Zakres akcji zbiorczej | Oznacza/cofa WSZYSTKIE odstępstwa danej wizyty naraz | Rozwiązuje niejednoznaczność "które z wielu" przy jednym przycisku w wierszu |
| Wyświetlanie stanu mieszanego | Licznik "X/Y sprawdzone" | Dokładnie oddaje stan częściowy, bez zgadywania |
| Kontrakt endpointu | Jeden `POST /api/deviations/review` z `{ids, status}` | Obsługuje pojedyncze i zbiorcze przełączanie bez duplikacji logiki |
| `reviewed_at` przy cofnięciu | Czyszczone do `null` | Proste, jednoznaczne — pole zawsze odzwierciedla bieżący status |
| Wizualne wyciszanie sprawdzonych | Brak — sam licznik/odznaka wystarcza | Unika dodatkowej logiki warunkowego stylowania dla MVP |
| Testowanie | Rozszerzenie `verify-rls.mjs` o UPDATE na `deviations` | Ta polityka nigdy nie była jawnie testowana automatycznie, mimo że istnieje od F-01 |

## Zakres

**W zakresie:**
- `POST /api/deviations/review` — JSON, pojedyncze i zbiorcze przełączanie statusu
- Ochrona middleware dla `/api/deviations`
- Licznik + przycisk zbiorczy w wierszu podsumowania `DeviationsList.tsx`
- Pełna, rozszerzona lista odstępstw z indywidualnymi przełącznikami w rozwiniętym wierszu
- Rozszerzenie `verify-rls.mjs` o UPDATE na `deviations.status`

**Poza zakresem:**
- Filtrowanie/sortowanie wg statusu przeglądu
- Wizualne wyciszanie w pełni sprawdzonych wierszy
- Potwierdzenie/modal przed przełączeniem (akcja odwracalna, niskiego ryzyka)
- Ślad audytowy "kiedykolwiek sprawdzone"

## Architektura / Podejście

`DeviationsList.tsx` przechodzi z czysto prezentacyjnego komponentu na komponent z lokalnym stanem (`useState` zainicjalizowany propsami), aktualizowanym po każdym udanym wywołaniu endpointu — bez refetchowania strony. Endpoint zwraca tylko faktycznie zaktualizowane wiersze (po filtrze RLS), a klient synchronizuje stan WYŁĄCZNIE na ich podstawie, nie na podstawie żądania. To jedyny endpoint JSON w repo — świadomy, lokalny wyjątek od wzorca natywnych formularzy używanego wszędzie indziej.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Backend | `POST /api/deviations/review` + middleware | Middleware przekierowuje (nie zwraca 401 JSON) przy wygasłej sesji — klient musi to obsłużyć defensywnie |
| 2. Frontend | Licznik, przyciski, lokalny stan | `stopPropagation` na przycisku zbiorczym, żeby nie kolidował z rozwijaniem wiersza |
| 3. Testowanie | Asercja UPDATE na `deviations` w `verify-rls.mjs` | Kolejność względem już istniejących asercji usuwania z S-04 (fixture może być już skasowany) |

**Wymagania wstępne:** F-01 (schemat + RLS) i S-01 (architektura listy) ukończone i zarchiwizowane — spełnione.
**Szacowany wysiłek:** ~2 sesje po godzinach, 3 fazy — najmniejszy z pięciu wycinków poza S-03.

## Open Risks & Assumptions

- Pierwszy JSON API w repo — świadomy, lokalny wyjątek, nie precedens do naśladowania w innych endpointach bez podobnego uzasadnienia częstotliwości.
- Brak obsługi 401 JSON przy wygasłej sesji (middleware przekierowuje) — zaakceptowane jako rzadki edge case, obsłużony defensywnie (brak crasha), bez dedykowanego UX błędu.
- Brak systemu powiadomień/toastów w repo — błędy `fetch` lądują tylko w `console.error`, bez widocznego dla użytkownika komunikatu.

## Kryteria sukcesu (podsumowanie)

- Kierownik oznacza/cofa status dowolnego odstępstwa (pojedynczo lub zbiorczo dla całej wizyty) bez przeładowania strony.
- Status jest trwały — widoczny po przeładowaniu strony i przy kolejnych powrotach do raportu.
- Cudze konto nie może zmienić statusu odstępstwa nienależącego do niego (potwierdzone automatycznym testem RLS).
