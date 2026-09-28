# Wykrywanie braku GPS w wgranym raporcie (gwiazda przewodnia) — Plan Brief

> Pełny plan: `context/changes/missing-gps-deviation-detection/plan.md`

## Co i po co

Kierownik regionalny wgrywa plik raportu aktywności (CSV lub XLSX) i w ciągu kilku sekund widzi listę wizyt, w których nie był włączony GPS — z pełnym kontekstem wizyty po rozwinięciu wiersza. To najmniejszy pełny przepływ (login → upload → ekstrakcja → zapis → detekcja → lista → szczegóły), który dowodzi, że cała koncepcja narzędzia działa, zanim dołączą kolejne reguły odstępstw (nieoptymalna trasa, telefon zamiast wizyty).

## Punkt wyjścia

Schemat bazy (`reports`/`visits`/`deviations`) i RLS izolujące dane per-użytkownik już istnieją (`F-01`, zarchiwizowane). Nie istnieje jeszcze żadne parsowanie plików, żaden endpoint zapisujący dane poza auth, ani żaden komponent listy/tabeli w UI — ten plan buduje to wszystko od zera, opierając się na istniejącym wzorcu form-POST/redirect z `src/pages/api/auth/*`.

## Pożądany stan końcowy

Zalogowany kierownik wchodzi na `/reports`, wgrywa plik zgodny z ustalonym kontraktem kolumn i trafia na `/reports/[id]` z listą odstępstw (brak GPS) do rozwinięcia. Błędny lub choćby częściowo niepoprawny plik jest odrzucany w całości z czytelnym komunikatem, bez żadnego zapisu w bazie.

## Kluczowe decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) |
| --- | --- | --- |
| Format pliku | CSV i XLSX od startu | Użytkownik wybrał pełne pokrycie "CSV/Excel" z PRD zamiast zawężenia do samego CSV |
| Biblioteka parsująca | `xlsx` (SheetJS) | Jedyna zweryfikowana researchem biblioteka z oficjalnym wsparciem dla Cloudflare Workers, obsługuje oba formaty jednym API |
| Kontrakt kolumn | Własne polskie nagłówki (`przedstawiciel`, `data_wizyty`, `gps_wlaczony`, ...) | Dane jawnie testowe (PRD Non-Goals) — nie integrujemy się z realnym systemem, więc definiujemy kontrakt sami |
| Historia raportów | Poza zakresem — tylko wynik bieżącego uploadu | Najmniejszy pełny dowód koncepcji; nawigacja do wcześniejszych raportów to `S-04` |
| Routing | Nowa sekcja `/reports` + `/reports/[id]` | Czytelny podział upload/wynik, spójny z istniejącą konwencją stron server-rendered |
| Błędny plik / błędny wiersz | Całość-albo-nic | Prosta, atomowa semantyka — łatwiejsza do zaimplementowania i przetestowania w najmniejszym wycinku |
| Testowanie | Fixture (CSV+XLSX) + skrypt asercji | Repo nie ma frameworka testowego; wzorzec `scripts/verify-rls.mjs` już to rozwiązuje dla innej domeny |

## Zakres

**W zakresie:**
- Upload pliku CSV/XLSX, ekstrakcja wszystkich pól z FR-003 (nie tylko GPS — przyszłościowo dla S-02/S-03)
- Reguła "brak GPS" (FR-004) i lista odstępstw z rozwijanym wierszem (FR-005, FR-006)
- Zapis do `reports`/`visits`/`deviations` przez istniejące RLS
- Fixture testowy + skrypt weryfikacji

**Poza zakresem:**
- Reguły trasy (`S-02`) i telefon-vs-wizyta (`S-03`)
- Usuwanie raportu (`S-04`), oznaczanie jako sprawdzone (`S-05`)
- Lista/historia wcześniej wgranych raportów
- Filtrowanie/sortowanie/eksport (nice-to-have, poza MVP)
- Częściowy import pliku (import poprawnych wierszy, pominięcie błędnych)

## Architektura / Podejście

Logika ekstrakcji i detekcji to czyste funkcje TypeScript (`src/lib/services/report-parser.ts`, `deviation-rules.ts`) bez zależności od Supabase/Astro — testowalne wprost przez skrypt weryfikacyjny i gotowe na kolejne reguły S-02/S-03. Endpoint `POST /api/reports/upload` jest cienką warstwą: auth → parsowanie → zapis `reports`→`visits`→`deviations` → redirect, kontynuując istniejący wzorzec form-POST/redirect. UI dodaje jeden React island (`DeviationsList.tsx`, `client:load`) — jedyny element wymagający interaktywności klienta w tym wycinku.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Rdzeń logiki | Parsowanie CSV/XLSX + reguła GPS jako czyste funkcje | Poprawność walidacji całość-albo-nic dla nietypowych wartości `gps_wlaczony` |
| 2. Endpoint uploadu | `/api/reports/upload` + zapis do 3 tabel | Middleware musi chronić `/reports` i `/api/reports` osobno (różne prefiksy) |
| 3. UI | `/reports`, `/reports/[id]`, rozwijana lista | Brak istniejącego komponentu tabeli w repo — pierwsza instalacja shadcn `table` |
| 4. Fixture + skrypt | Przykładowe pliki + `verify-report-detection.mjs` | Fixture musi dawać identyczny wynik w obu formatach (CSV i XLSX) |

**Wymagania wstępne:** `F-01` (schemat + RLS) ukończone i zarchiwizowane — spełnione.
**Szacowany wysiłek:** ~3-4 sesje po godzinach, 4 fazy.

## Otwarte ryzyka i założenia

- SheetJS działa poprawnie w środowisku workerd zgodnie z oficjalną dokumentacją — nie zweryfikowane jeszcze przez faktyczne uruchomienie w tym repo (Faza 1/2 to zweryfikuje).
- Sztywny limit 5 MB na plik nie był przedmiotem wywiadu — przyjęty jako rozsądny domyślny wariant inżynierski, do rewizji jeśli okaże się za niski/wysoki.
- Kontrakt kolumn jest własną propozycją (dane testowe) — jeśli GitHub issue #2 zawiera już inny, bardziej szczegółowy kontrakt, trzeba go zweryfikować przed implementacją Fazy 1 (brak dostępu do sieci podczas planowania, żeby to sprawdzić).

## Kryteria sukcesu (podsumowanie)

- Kierownik wgrywa poprawny plik CSV lub XLSX i w ciągu kilku sekund widzi listę wizyt bez GPS.
- Kliknięcie wiersza pokazuje pełny kontekst wizyty bez przeładowania strony.
- Błędny lub częściowo niepoprawny plik nie zapisuje niczego w bazie i pokazuje czytelny komunikat.
