# Prompty do Claude Design

Prompty do projektowania ekranów w Claude Design (claude.ai/design) z użyciem
design systemu **„Kontrola Trasówek DS”**
(https://claude.ai/design/p/c8742d82-115d-4a8e-97d0-48103befaeca).

Źródła: `context/foundation/prd.md` (US-01 do US-03, FR-001 do FR-012) oraz
istniejące ekrany w `src/pages/`. Prompty 1–5 to warianty istniejących widoków,
prompt 6 wykracza poza MVP.

Design system synchronizuje się przez `/design-sync`. Konfiguracja i konwencje
dla agenta projektowego są w `.design-sync/` (`conventions.md`, `NOTES.md`).

## Jak używać

- Wklej prompt 0 raz na początku rozmowy, potem jeden ekran na rozmowę.
- Proś o 2–3 warianty z uzasadnieniem. Dopytuj w tej samej rozmowie
  („wersja ciemna”, „wersja mobilna”, „mniej gęsto”).
- Zmiany wyglądu samego systemu (kolor marki, promienie, nowy wariant
  przycisku) robi się w kodzie (`src/styles/global.css`, `src/components/ui/`),
  a potem `/design-sync`. Nie robi się ich w Claude Design.
- Gotowy ekran przenosi się do repo przez `/10x-ui` (istniejący widok) albo
  `/10x-research` → `/10x-plan` → `/10x-implement`.

## 0. Kontekst na start rozmowy

```
Projektujemy aplikację „Kontrola Trasówek” dla kierownika regionu, który wgrywa
raporty wizyt przedstawicieli handlowych (CSV/XLSX) i sprawdza wykryte odstępstwa:
brak GPS, telefon zamiast wizyty, odchylenie od trasy (>1,5x odległości w linii prostej).
Wszystkie teksty po polsku. Używaj wyłącznie komponentów i tokenów z design systemu
(Button, Dialog, Table, kolory przez role: primary, destructive, muted-foreground).
Desktop-first, szerokość treści max ok. 1100 px.
```

## 1. Lista raportów z wgrywaniem (`/reports`)

```
Zaprojektuj ekran „Raporty”. U góry nagłówek i obszar wgrywania pliku CSV/XLSX
(max 5 MB) z przyciskiem „Wgraj raport”. Pod spodem tabela wgranych raportów:
nazwa pliku, data wgrania, liczba wierszy, liczba wykrytych odstępstw, akcje
(podgląd, usuń). Pokaż 3 stany obok siebie: lista z 5 raportami, pusty stan
(brak raportów, zachęta do wgrania pierwszego pliku), stan w trakcie wgrywania.
Zaproponuj 2 warianty układu: obszar wgrywania nad tabelą vs w bocznej kolumnie.
```

## 2. Szczegóły raportu: lista odstępstw (`/reports/[id]`)

```
Zaprojektuj ekran szczegółów raportu „trasowki-wrzesien-2026.xlsx”. Nad tabelą
podsumowanie: liczba wizyt, liczba odstępstw w podziale na 3 reguły, ile już
przejrzanych. Pasek narzędzi: filtr po przedstawicielu, filtr po typie odstępstwa,
filtr statusu (nieprzejrzane / sprawdzone), sortowanie po dacie, eksport CSV i XLSX.
Tabela: przedstawiciel, data wizyty, odstępstwa. Jedna wizyta może łamać kilka reguł
naraz, więc pokaż to czytelnie. Zaproponuj, jak lepiej zbudować hierarchię niż
„jedna długa tabela”.
```

## 3. Rozwinięty wiersz i status przeglądu (US-03)

```
Pokaż wiersz tabeli odstępstw w stanie rozwiniętym: pełny kontekst wizyty
(klient, typ aktywności, dystans km, czas na miejscu, GPS tak/nie, planowana trasa)
oraz lista złamanych reguł z wyjaśnieniem każdej. Przy każdym odstępstwie akcja
„Oznacz jako sprawdzone” i możliwość cofnięcia. Pokaż wyraźnie różnicę wizualną
między odstępstwem nieprzejrzanym a sprawdzonym (sprawdzone zostaje na liście).
Zaproponuj też akcję zbiorczą „oznacz wszystkie dla tej wizyty”.
```

## 4. Usuwanie raportu i błędy wgrywania (US-02, US-01)

```
Zaprojektuj: (a) dialog potwierdzenia usunięcia raportu: nazwa pliku, data,
liczba wierszy, ostrzeżenie, że operacji nie da się cofnąć i że znikną też wizyty
i odstępstwa; (b) komunikaty błędów wgrywania: plik za duży, zły format,
brak wymaganych kolumn (przedstawiciel, data_wizyty, gps_wlaczony,
odwiedzony_klient). Komunikat ma mówić, co dokładnie poprawić w pliku.
```

## 5. Logowanie i rejestracja (`/auth/*`)

```
Zaprojektuj ekrany logowania i rejestracji (email + hasło, przełącznik
pokazywania hasła) oraz ekran „Sprawdź skrzynkę, aby potwierdzić email”.
Pokaż stany: puste pola, błąd walidacji przy polu, błąd serwera
(„Nieprawidłowy email lub hasło”), przycisk w trakcie wysyłania.
Krótki opis produktu obok formularza na desktopie.
```

## 6. Pulpit kierownika (pomysł poza MVP)

```
Zaproponuj pulpit startowy kierownika: ranking przedstawicieli wg liczby
odstępstw w ostatnim miesiącu, rozkład odstępstw na 3 reguły, ostatnio wgrane
raporty, liczba odstępstw czekających na przegląd z przejściem do listy.
Daj 2 różne koncepcje: jedną zwartą „do codziennego przeglądu w 30 sekund”,
drugą bardziej analityczną.
```
