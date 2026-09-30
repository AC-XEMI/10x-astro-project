# Wykrywanie nieoptymalnej trasy w wgranym raporcie — Plan Brief

> Pełny plan: `context/changes/route-deviation-detection/plan.md`

## Co i po co

Druga reguła detekcji odstępstw (roadmap S-02, PRD FR-009): kierownik widzi na liście odstępstw wizyty, w których przedstawiciel odwiedził klienta spoza zaplanowanej listy, lub przejechał dystans znacznie przekraczający najkrótszą (prostoliniową) odległość od poprzedniej wizyty tego samego dnia. To pierwsza reguła w projekcie, która porównuje wizyty między sobą zamiast oceniać każdą z osobna.

## Punkt wyjścia

Schemat bazy już przewidział tę regułę (`deviation_rule` ma wartość `route_deviation` od F-01), a `visits` ma już `distance_km` i listę planowanych klientów (`planned_route_raw`, same nazwy, bez współrzędnych). Nie istnieje jednak żadne pole mówiące, którego klienta faktycznie odwiedzono, ani żadne współrzędne geograficzne — S-01 zbudował całą resztę architektury (parser, endpoint, UI, skrypt weryfikacyjny), którą ten plan rozszerza, nie zastępuje.

## Pożądany stan końcowy

Po wgraniu rozszerzonego pliku raportu, wizyty łamiące którykolwiek z dwóch warunków FR-009 pojawiają się na liście odstępstw z regułą `route_deviation` i konkretnym opisem przyczyny w rozwiniętym wierszu (np. "poza zaplanowaną trasą" albo "nadmiarowy dystans: 25.0 km, linia prosta 10.0 km"). Wizyta może złamać tę regułę razem z `missing_gps` jednocześnie.

## Kluczowe decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) |
| --- | --- | --- |
| Model trasy | Punkt-do-punktu (nie pełna trasa dnia/TSP) | Prostsze, mniej ruchomych części w 6-tygodniowym MVP; nie wymaga ustalania kolejności całego dnia |
| Źródło współrzędnych | Wprost w pliku raportu (nowe kolumny `szerokosc`/`dlugosc`) | Plik pozostaje samowystarczalny, spójne z filozofią S-01 (brak zewnętrznego stanu) |
| Identyfikacja odwiedzonego klienta | Nowa wymagana kolumna `odwiedzony_klient` | Warunek konieczny do porównania "plan" vs "rzeczywistość"; bez niej połowa FR-009 nie działa |
| Punkt startowy dnia | Brak stałego punktu (biura) | Brak wsparcia w danych/PRD dla takiej koncepcji; pierwsza wizyta dnia po prostu nie jest oceniana pod kątem dystansu |
| Kolejność wizyt w dniu | Kolejność wierszy w pliku | Zero nowych kolumn ponad już ustalone; naturalny sposób wypełniania raportu |
| Metoda liczenia odległości | Linia prosta (Haversine) | Zero zależności zewnętrznych/kluczy API, zgodne z NFR "wynik w kilka sekund" i Non-Goals PRD |
| Próg nadmiaru | 50% ponad linię prostą | Margines pokrywający typowe zakręty/drogi nierówne linii prostej, minimalizuje fałszywe alarmy (guardrail PRD) |
| Czas przejazdu | Pominięty — tylko dystans | Brak istniejącego pola mierzącego czas przejazdu (jest tylko "czas na miejscu"); dystans w pełni realizuje intencję reguły |
| Zakres reguły wg typu aktywności | Tylko `typ_aktywnosci=wizyta` | "Nadmiarowy dystans"/"poza trasą" nie mają sensu dla aktywności bez fizycznego przejazdu (telefon) |
| Rozróżnienie przyczyny | Nowe pole `detail` (tekst) na `deviations` | Kierownik widzi konkretną przyczynę, nie tylko nazwę reguły — spójne z FR-006 |
| Brakujące dane opcjonalne | Reguła nie ma zastosowania (nie błąd pliku) | Spójne z istniejącym wzorcem obsługi opcjonalnych pól z S-01 |
| Migracja / rollback | Addytywna migracja + osobny, ręcznie uruchamiany skrypt rollback | Jawna strategia wycofania na wyraźne życzenie użytkownika, bez ryzyka automatycznego uruchomienia |

## Zakres

**W zakresie:**
- Nowe kolumny pliku: `odwiedzony_klient` (wymagana), `szerokosc`, `dlugosc` (opcjonalne)
- Reguła `detectRouteDeviations` (dystans + poza planowaną listą) jako funkcja operująca na całym raporcie
- Migracja schematu (`visited_client`, `visited_latitude`, `visited_longitude` na `visits`; `detail` na `deviations`) + skrypt rollback
- Integracja z endpointem uploadu i rozszerzenie UI o nowe dane i przyczynę odstępstwa
- Rozszerzenie fixture'a i skryptu weryfikacji o 5 nowych przypadków testowych

**Poza zakresem:**
- Pełna optymalizacja trasy dnia (TSP) i rzeczywisty routing drogowy przez zewnętrzne API
- Stały punkt startowy (biuro/depot)
- Osobne pole "czas przejazdu"
- Reguły S-03/S-04/S-05 (telefon-vs-wizyta, usuwanie raportu, oznaczanie jako sprawdzone)
- Konfigurowalny próg w UI (sztywna wartość 50% w kodzie)

## Architektura / Podejście

Reguła trasy żyje jako czysta funkcja `detectRouteDeviations` w `deviation-rules.ts`, ale — inaczej niż `detectMissingGps` — przyjmuje CAŁY zbiór wizyt raportu naraz, bo porównuje kolejne wizyty tego samego przedstawiciela i dnia między sobą. Nowy moduł `geo.ts` izoluje matematykę Haversine. Endpoint uploadu woła tę funkcję raz, po wstawieniu wszystkich wizyt, i łączy wynik z istniejącym `detectMissingGps` przed jednym zbiorczym zapisem do `deviations`.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Migracja schematu | Nowe kolumny + skrypt rollback poza katalogiem migracji | Rollback umieszczony w złym miejscu zostałby uruchomiony automatycznie i skasował dane |
| 2. Rdzeń logiki | Rozszerzony parser + `geo.ts` + `detectRouteDeviations` | Zła interpretacja "kolejności wizyt" lub progu psuje całą regułę |
| 3. Endpoint uploadu | Integracja reguły z zapisem `deviations` | Wywołanie w złym miejscu (przed wstawieniem wizyt) uniemożliwia dostęp do `id` |
| 4. UI | Rozszerzony rozwijany wiersz z przyczyną odstępstwa | Brak obsługi wizyt bez `detail` (np. sam `missing_gps`) |
| 5. Fixture + skrypt | 5 nowych przypadków testowych w obu formatach | Rozszerzenie fixture'a psuje istniejące asercje `missing_gps` |

**Wymagania wstępne:** F-01 (schemat) i S-01 (architektura parser/endpoint/UI/fixture) ukończone i zarchiwizowane — spełnione.
**Szacowany wysiłek:** ~4-5 sesji po godzinach, 5 faz.

## Open Risks & Assumptions

- Kolejność wierszy zwracanych przez `insert().select()` jest zakładana jako zgodna z kolejnością `VALUES` w zapytaniu — typowe, powszechnie polegane zachowanie PostgreSQL dla pojedynczego `INSERT ... RETURNING`, ale nieudokumentowane jako twarda gwarancja. Świadomie zaakceptowane zamiast dodawania osobnej kolumny sekwencji.
- Próg 50% i metoda Haversine to inżynierskie szacunki bez rzeczywistych danych referencyjnych z tego terenu — mogą wymagać korekty po pierwszych realnych raportach.
- Linia prosta systematycznie zaniża rzeczywisty dystans drogowy — próg 50% ma to skompensować, ale nie był kalibrowany na prawdziwych trasach.

## Kryteria sukcesu (podsumowanie)

- Kierownik widzi wizytę spoza planowanej listy LUB z nadmiarowym dystansem oznaczoną jako `route_deviation` z konkretną przyczyną w rozwiniętym wierszu.
- Wizyta łamiąca jednocześnie `missing_gps` i regułę trasy pokazuje obie na liście (bez fałszywych alarmów dla poprawnych wizyt).
- Aktywności telefoniczne i pierwsza wizyta dnia (brak punktu odniesienia) nie są błędnie oznaczane regułą trasy.
