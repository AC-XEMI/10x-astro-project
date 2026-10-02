# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## CLAUDE.md wymaga `prerender = false` w API routes, ale żaden endpoint tego nie robi

**Context:** Wszystkie dotychczasowe API routes (`src/pages/api/auth/{signin,signup,signout}.ts`, `src/pages/api/reports/upload.ts`, `src/pages/api/reports/[id]/delete.ts`) — żaden nie eksportuje `const prerender = false`.

**Problem:** CLAUDE.md jawnie mówi "API routes must export `const prerender = false`", ale żaden istniejący endpoint tego nie robi. Funkcjonalnie bez znaczenia dziś, bo `astro.config.mjs` ma globalne `output: "server"` (wszystkie trasy są domyślnie server-rendered) — ale zapisana reguła i rzeczywisty kod są rozbieżne.

**Rule:** Każdy nowy API route (`src/pages/api/**`) musi jawnie eksportować `export const prerender = false;`, nawet gdy `astro.config.mjs` ma globalne `output: "server"` — dokumentacja i kod mają się zgadzać, a jawna deklaracja chroni przed cichą regresją, gdyby `output` kiedyś się zmieniło.

**Applies to:** Wszystkie pliki pod `src/pages/api/**`; sprawdzać przy review nowych endpointów.

## shadcn `TableCell` ma wbudowane `whitespace-nowrap`, które blokuje zawijanie tekstu w całej komórce

**Context:** `src/components/ui/table.tsx` — `TableCell` ma w bazowych klasach `whitespace-nowrap`. W `DeviationsList.tsx` komórka z rozwiniętymi szczegółami wizyty (`<TableCell colSpan={3}>`) renderuje dużo swobodnego tekstu (opis odstępstwa, JSON trasy) — dziedziczone `white-space: nowrap` blokowało łamanie linii we WSZYSTKICH potomkach tej komórki, mimo dodania `break-words`/`min-w-0` na konkretnych elementach wewnątrz (te właściwości nie mają znaczenia, gdy `white-space: nowrap` w ogóle zabrania łamania linii przy spacjach).

**Problem:** Dopóki nie nadpisano `whitespace-nowrap` bezpośrednio na tej konkretnej komórce (`className="whitespace-normal"`), żadna ilość `break-words`/`flex-wrap`/`min-w-0` na elementach potomnych nie pomagała — długi tekst wypychał tabelę w poziomy scroll zamiast się zawijać.

**Rule:** Zanim dodaje się `break-words`/`flex-wrap` do naprawy zawijania tekstu w tabeli shadcn, sprawdź najpierw, czy `TableCell`/`TableRow` nie mają wbudowanego `whitespace-nowrap` wyżej w drzewie — jeśli tak, nadpisz `whitespace-normal` na najbliższej komórce zawierającej swobodny tekst, zanim zacznie się debugować elementy potomne.

**Applies to:** Każde użycie `<TableCell>` ze shadcn w tym repo, które renderuje więcej niż krótki, jednowierszowy tekst (np. komórki z `colSpan` pokazujące rozwinięte szczegóły).

## Tekst pokazywany użytkownikowi nie może zawierać surowych nazw kolumn/pól z bazy

**Context:** `src/lib/services/deviation-rules.ts` (`detectPhoneInsteadOfVisit`) budował tekst `detail` odstępstwa z dosłownym fragmentem `(pole typ_aktywnosci puste lub nierozpoznane)` — nazwa kolumny `typ_aktywnosci` (z arkusza wejściowego) trafiła wprost do UI, mimo że reszta aplikacji jest w pełni spolszczona i czytelna dla kierownika.

**Problem:** Literówka/nazwa techniczna wygląda jak błąd aplikacji w oczach użytkownika; dodatkowo naprawa kodu nie cofnęła się na już zapisane w bazie rekordy (`detail` jest zapisywany raz, przy wgrywaniu raportu) — wymagało to osobnego backfillu danych.

**Rule:** Żaden string budowany do wyświetlenia użytkownikowi nie może zawierać dosłownej nazwy kolumny/pola źródłowego (snake_case, nazwa z arkusza importu itp.) — zawsze używać opisowego zdania w języku użytkownika. Jeśli taki tekst jest zapisywany do bazy (nie liczony w locie), poprawka kodu wymaga też rozważenia backfillu istniejących rekordów.

**Applies to:** Wszystkie miejsca budujące `detail`/komunikaty w `src/lib/services/*.ts` zapisywane do bazy przy przetwarzaniu raportu; review nowych reguł detekcji odstępstw.
