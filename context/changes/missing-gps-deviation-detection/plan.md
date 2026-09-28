# Wykrywanie braku GPS w wgranym raporcie (gwiazda przewodnia) Implementation Plan

## Overview

Pierwszy pełny, działający wycinek pionowy produktu (roadmap S-01): kierownik regionalny loguje się, wgrywa plik raportu aktywności (CSV lub XLSX), system wyciąga dane wizyt, oznacza te bez włączonego GPS jako odstępstwo (FR-004) i pokazuje je na liście z rozwijanym wierszem pełnego kontekstu (FR-005, FR-006). To dowód, że cały pipeline (login → upload → ekstrakcja → zapis → detekcja → lista → szczegóły) faktycznie działa, zanim dołączą kolejne reguły (S-02, S-03).

## Current State Analysis

- Schemat bazy (`reports`, `visits`, `deviations`) i polityki RLS już istnieją z `F-01` (`context/archive/2026-09-25-report-data-schema/`) — ten plan tylko zapisuje dane przez istniejące tabele, nie zmienia schematu.
- Brak jakiegokolwiek parsowania CSV/Excel w repo — nie istnieje żadna biblioteka do tego celu (`papaparse`, `xlsx`, `exceljs` — brak w `package.json`).
- Jedyne istniejące API routes (`src/pages/api/auth/{signin,signup,signout}.ts`) używają wzorca natywny `<form>` POST → `context.redirect(...)` — brak JSON API, brak jawnych kodów statusu.
- `src/middleware.ts` chroni obecnie tylko `/dashboard` przez prostą tablicę prefiksów `PROTECTED_ROUTES` dopasowywaną przez `startsWith`.
- `src/components/ui/` ma tylko `button.tsx` — brak tabeli, list, komponentów rozwijalnych.
- Brak frameworka testowego w repo (CLAUDE.md) — jedyny istniejący wzorzec automatycznej weryfikacji to bezzależnościowy skrypt `scripts/verify-rls.mjs`.
- Aplikacja działa na Cloudflare Workers (`wrangler.jsonc` ma już `nodejs_compat` + `disable_nodejs_process_v2`) — wybór biblioteki do parsowania plików musi być kompatybilny z workerd, nie tylko z Node.

## Desired End State

Zalogowany kierownik wchodzi na `/reports`, wgrywa plik CSV lub XLSX zgodny z ustalonym kontraktem kolumn i zostaje przekierowany na `/reports/[id]`, gdzie widzi listę wizyt oznaczonych jako odstępstwo (brak GPS) — każdy wiersz rozwijalny do pełnego kontekstu wizyty. Błędny, pusty plik lub plik z choćby jednym niepoprawnym wierszem jest odrzucany w całości, z czytelnym komunikatem, bez żadnego zapisu w bazie.

Weryfikacja: ręczne wgranie plików fixture w przeglądarce daje oczekiwany wynik dla obu formatów; `npm run verify:report-detection` (nowy skrypt) kończy się kodem 0.

### Key Discoveries:

- `src/pages/api/auth/signin.ts:1-20` — wzorzec API route do naśladowania: `formData()` → wywołanie Supabase → `context.redirect(...)` (sukces i błąd), bez JSON, bez `export const prerender = false` (niepotrzebne — `output: "server"` jest globalne w `astro.config.mjs:11`).
- `src/middleware.ts:4,18-22` — `PROTECTED_ROUTES` to płaska tablica prefiksów dopasowywana przez `startsWith`; middleware chroni nawigację stron przekierowaniem, nie chroni automatycznie API routes o innym prefiksie.
- `src/lib/supabase.ts:5-21` — jedyna fabryka klienta (`createClient(requestHeaders, cookies)`), wywoływana identycznie z `.astro` i z API routes; zwraca `null` gdy brak env (wymaga null-checka).
- `src/types.ts` (wygenerowane w `F-01`) — `Tables<'reports'|'visits'|'deviations'>` gotowe do typowanych zapytań `.from()`.
- SheetJS (pakiet npm `xlsx`) ma oficjalną dokumentację kompatybilności z Cloudflare Workers i czyta zarówno CSV, jak i XLSX przez ten sam `XLSX.read()` (przyjmuje `ArrayBuffer` lub `string`) — jedna zależność do obu formatów, bez zależności od `fs`/streamów Node (w przeciwieństwie do ExcelJS, którego ścieżka odczytu jest mocno związana z API plikowym/strumieniowym Node).
- `src/components/auth/SignInForm.tsx` — jedyny istniejący przykład React islandu: `client:load` jako jedyna używana w repo dyrektywa hydratacji, props przekazywane jako zwykłe atrybuty JSX.

## What We're NOT Doing

- Reguła nieoptymalnej trasy (FR-009) — to `S-02`.
- Reguła telefon-zamiast-wizyty (FR-010) — to `S-03`; pole `typ_aktywnosci` jest już ekstrahowane i zapisywane w tym planie, żeby `S-03` nie musiało ponownie dotykać parsera.
- Usuwanie wgranego raportu (FR-011) — to `S-04`.
- Oznaczanie odstępstwa jako sprawdzone/fałszywy alarm (FR-012) — to `S-05`.
- Lista/historia wcześniej wgranych raportów (nawigacja między wieloma uploadami) — świadomie odłożone do `S-04` (decyzja z wywiadu planowania); ten wycinek pokazuje wynik wyłącznie bieżącego, właśnie wgranego pliku.
- Filtrowanie/sortowanie listy odstępstw (FR-007) i eksport listy (FR-008) — nice-to-have, jawnie poza MVP per PRD.
- Realny import z systemu firmowego — Non-Goal PRD; kontrakt kolumn CSV/XLSX zdefiniowany w tym planie dotyczy wyłącznie danych testowych.
- Częściowy import pliku (zapis poprawnych wierszy, pominięcie błędnych) — odrzucone w wywiadzie na rzecz semantyki całość-albo-nic.
- Konfigurowalny limit rozmiaru pliku — przyjmujemy sztywny limit inżynierski (patrz "Critical Implementation Details"), bez UI do jego zmiany.

## Implementation Approach

Logika ekstrakcji i detekcji żyje jako czyste funkcje TypeScript bez zależności od Supabase/Astro (Faza 1) — to zarówno separacja odpowiedzialności (S-02/S-03 dopiszą kolejne reguły bez dotykania parsera), jak i warunek konieczny testowalności w repo bez frameworka testowego (Faza 4 woła te same funkcje bezpośrednio). Endpoint uploadu (Faza 2) jest cienką warstwą łączącą: autoryzacja → parsowanie (Faza 1) → zapis w kolejności zależności `reports` → `visits` → `deviations` → przekierowanie, kontynuując istniejący wzorzec form-POST/redirect z `src/pages/api/auth/*`. UI (Faza 3) dodaje jedyny nowy element interaktywny w repo — rozwijalny wiersz listy odstępstw — jako pojedynczy React island; sama strona uploadu pozostaje statycznym Astro `<form>`, bez potrzeby JS.

## Critical Implementation Details

**Ochrona API endpointu wymaga dwóch wpisów w middleware, nie jednego** — `PROTECTED_ROUTES` dopasowuje przez `startsWith`; strona `/reports` i endpoint `/api/reports/upload` mają różne prefiksy, więc oba muszą trafić do tablicy osobno (Faza 2), inaczej niezalogowany POST na endpoint przejdzie bez przekierowania na `/auth/signin`.

**Limit rozmiaru pliku** — brak dedykowanego UI do konfiguracji; przyjmujemy sztywny limit 5 MB, egzekwowany w endpointzie uploadu przed konwersją do `ArrayBuffer` i przekazaniem do parsera, uzasadniony przez `target_scale: small` w PRD.

## Phase 1: Rdzeń logiki — parsowanie i detekcja (czyste funkcje)

### Overview

Moduł parsujący CSV/XLSX do zwalidowanych wierszy wizyt (semantyka całość-albo-nic) i moduł jedynej reguły tego wycinka (brak GPS) — bez Supabase, bez Astro, w pełni testowalne w izolacji.

### Changes Required:

#### 1. Zależność SheetJS

**File**: `package.json`

**Intent**: Dodać jedyną nową zależność produkcyjną tego planu — bibliotekę parsującą CSV i XLSX kompatybilną z Cloudflare Workers.

**Contract**: dodać `"xlsx": "^0.18.5"` (SheetJS Community Edition) do `dependencies`.

#### 2. Moduł parsowania i walidacji

**File**: `src/lib/services/report-parser.ts`

**Intent**: Wejście: surowe bajty pliku + nazwa pliku. Wyjście: zwalidowane wiersze wizyt gotowe do zapisu, albo błąd walidacji z czytelnym komunikatem — implementuje kontrakt kolumn i semantykę całość-albo-nic ustaloną w wywiadzie planowania.

**Contract**:

- Eksportowana funkcja `parseReportFile(bytes: ArrayBuffer, filename: string): ParsedReport`, gdzie `ParsedReport = { rows: ExtractedVisit[] } | { error: string }`.
- Format rozpoznawany po rozszerzeniu: `.csv` → `XLSX.read(text, { type: "string" })`, `.xlsx` → `XLSX.read(bytes, { type: "array" })`; inne rozszerzenie → `{ error: "Nieobsługiwany format pliku — akceptowane CSV lub XLSX." }`.
- Wymagane nagłówki (case-insensitive): `przedstawiciel`, `data_wizyty`, `gps_wlaczony`. Brak któregokolwiek → cały plik odrzucony, komunikat wskazuje brakującą kolumnę.
- Opcjonalne nagłówki: `typ_aktywnosci`, `dystans_km`, `czas_na_miejscu_min`, `planowana_trasa` (wartości oddzielone `;`, zapisywane jako tablica JSON w `planned_route_raw`).
- Zero wierszy danych (tylko nagłówek albo pusty plik) → `{ error: "Plik nie zawiera żadnych wierszy z danymi." }`.
- Dla każdego wiersza: `przedstawiciel` i `data_wizyty` muszą być niepuste; `gps_wlaczony` musi parsować się do boola przez akceptowane wartości `TAK/NIE` (case-insensitive) lub `1/0`. Pierwszy niepoprawny wiersz przerywa całe parsowanie i zwraca błąd z numerem wiersza (np. `"Wiersz 4: nierozpoznana wartość gps_wlaczony (oczekiwano TAK/NIE)."`) — semantyka całość-albo-nic, bez częściowego zapisu.
- Cały surowy wiersz (wszystkie kolumny, także nieznane) zapisywany do pola `raw_data` każdego zwróconego `ExtractedVisit`.

#### 3. Moduł reguły detekcji

**File**: `src/lib/services/deviation-rules.ts`

**Intent**: Czysta funkcja implementująca jedyną regułę tego wycinka (FR-004), celowo oddzielona od parsowania, żeby `S-02`/`S-03` mogły dopisać kolejne reguły bez dotykania Fazy 1.

**Contract**: `detectMissingGps(visit: ExtractedVisit): DeviationRule | null` zwraca `"missing_gps"` gdy `visit.gps_enabled === false`, inaczej `null`. Wywoływana przez Fazę 2 dla każdej zapisanej wizyty.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi

#### Manual Verification:

- Ręczny przegląd `report-parser.ts` potwierdza dokładnie reguły walidacji ustalone w wywiadzie (całość-albo-nic, wymagane vs opcjonalne kolumny)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Endpoint uploadu i zapis do bazy

### Overview

Cienka warstwa łącząca autoryzację, wywołanie Fazy 1 i zapis do `reports`/`visits`/`deviations`, kontynuując istniejący wzorzec form-POST/redirect.

### Changes Required:

#### 1. Middleware — ochrona nowych tras

**File**: `src/middleware.ts`

**Intent**: Chronić nową stronę i nowy endpoint tak samo jak `/dashboard` dziś.

**Contract**: rozszerzyć `PROTECTED_ROUTES` do `["/dashboard", "/reports", "/api/reports"]` (patrz "Critical Implementation Details" — oba prefiksy potrzebne osobno).

#### 2. Endpoint uploadu

**File**: `src/pages/api/reports/upload.ts`

**Intent**: Jedyny zapisujący endpoint tego wycinka — odczytuje wgrany plik, woła Fazę 1, zapisuje dane w Supabase, przekierowuje z wynikiem; mirror wzorca `src/pages/api/auth/signin.ts`.

**Contract**:

- `export const POST: APIRoute = async (context) => {...}`; `createClient(context.request.headers, context.cookies)`; brak zalogowanego użytkownika → `context.redirect("/auth/signin")`.
- `const file = (await context.request.formData()).get("report_file") as File | null;` — brak pliku → redirect `/reports?error=...`.
- Limit rozmiaru 5 MB egzekwowany na `file.size` przed konwersją do `ArrayBuffer` — przekroczenie → redirect z komunikatem o limicie.
- Wywołanie `parseReportFile(await file.arrayBuffer(), file.name)` z Fazy 1; wynik z `error` → `context.redirect(\`/reports?error=${encodeURIComponent(result.error)}\`)`, nic nie zapisane.
- Zapis w kolejności zależności: `INSERT` do `reports` (`user_id`, `original_filename`, `row_count` = liczba wierszy z Fazy 1) → `INSERT` wsadowy do `visits` z `report_id` ze zwróconego rekordu → dla każdej wstawionej wizyty wywołanie `detectMissingGps` (Faza 1) i zbiorczy `INSERT` do `deviations` dla wierszy, które zwróciły regułę.
- Błąd zapisu Supabase na dowolnym z trzech kroków → redirect `/reports?error=...`; brak aplikacyjnego rollbacku (RLS + klucze obce gwarantują, że częściowo osierocony `reports` bez `visits` nie stanowi wycieku danych między kontami — porządkowanie takich resztek poza zakresem tego planu).
- Sukces → `context.redirect(\`/reports/${reportId}\`)`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi

#### Manual Verification:

- Wgranie poprawnego pliku CSV kończy się przekierowaniem na `/reports/[id]` i widocznymi wierszami w `reports`/`visits`/`deviations` w Supabase Studio
- Wgranie pliku z brakującą wymaganą kolumną kończy się przekierowaniem z powrotem na `/reports` z czytelnym komunikatem błędu, bez żadnego zapisu w bazie

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI — upload i wynik

### Overview

Strona uploadu, strona wyniku z rozwijaną listą odstępstw (jedyny React island tego wycinka) i wymagany prymityw shadcn.

### Changes Required:

#### 1. Instalacja komponentu shadcn

**File**: `src/components/ui/table.tsx` (nowy, generowany)

**Intent**: Brak istniejącego prymitywu tabeli w repo; instalacja przez oficjalną ścieżkę projektu.

**Contract**: `npx shadcn@latest add table` (styl "new-york" per `components.json`).

#### 2. Strona uploadu

**File**: `src/pages/reports/index.astro`

**Intent**: Formularz uploadu pliku — bez Reacta, zwykły natywny `<form>`, spójny z brakiem potrzeby interaktywności na tym ekranie; mirror layoutu błędu z `src/pages/auth/signin.astro`.

**Contract**: `<form method="POST" action="/api/reports/upload" enctype="multipart/form-data">` z `<input type="file" name="report_file" accept=".csv,.xlsx" required>` i przyciskiem submit; odczyt `Astro.url.searchParams.get("error")` i wyświetlenie przez istniejący `src/components/Banner.astro`, gdy obecny.

#### 3. Strona wyniku

**File**: `src/pages/reports/[id].astro`

**Intent**: Server-side odczyt wizyt i odstępstw danego raportu (RLS ogranicza wynik do właściciela) i przekazanie do React islandu renderującego listę.

**Contract**: `Astro.params.id`; zapytanie `.from("visits").select("*, deviations(*)").eq("report_id", id)`; brak wierszy (raport nie istnieje albo należy do innego konta — RLS zwraca pusty wynik w obu przypadkach) → komunikat "nie znaleziono raportu". Dane przekazane jako serializowalny prop do `<DeviationsList visits={visits} client:load />`.

#### 4. Komponent listy z rozwijanym wierszem

**File**: `src/components/reports/DeviationsList.tsx`

**Intent**: Jedyny interaktywny element tego wycinka — lista wizyt oznaczonych jako odstępstwo, każdy wiersz rozwijalny do pełnego kontekstu wizyty (FR-006), bez osobnego ekranu szczegółów.

**Contract**: Props `{ visits: VisitWithDeviations[] }`; renderuje shadcn `Table` z jednym `<tr>` na wizytę, mającą co najmniej jeden wpis w `deviations` (wizyty bez odstępstwa nie są renderowane, per FR-005); lokalny `useState<Set<string>>` przechowuje rozwinięte id, klik na wiersz przełącza obecność w zbiorze i renderuje dodatkowy `<tr>` ze szczegółami, gdy rozwinięty.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi
- `npm run build` kończy się bez błędów

#### Manual Verification:

- `/reports` wymaga zalogowania (niezalogowany użytkownik trafia na `/auth/signin`)
- Po wgraniu pliku z co najmniej jedną wizytą bez GPS, `/reports/[id]` pokazuje tę wizytę na liście
- Kliknięcie wiersza rozwija pełny kontekst wizyty (data, przedstawiciel, dane z raportu) bez przeładowania strony
- Wizyta zgodna z regułą GPS (GPS włączony) nie pojawia się na liście odstępstw

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Fixture testowy i skrypt weryfikacji

### Overview

Przykładowe pliki w obu formatach i bezzależnościowy skrypt asercji wzorowany na `scripts/verify-rls.mjs`, dowodzący poprawności Fazy 1 bez potrzeby lokalnego Supabase.

### Changes Required:

#### 1. Przykładowe pliki

**File**: `test-data/sample-report.csv`, `test-data/sample-report.xlsx`

**Intent**: Ten sam zestaw danych w obu formatach — dowód, że `parseReportFile` obsługuje oba identycznie.

**Contract**: Minimum 4 wiersze: 2 z `gps_wlaczony=TAK` (nie powinny stać się odstępstwem), 2 z `gps_wlaczony=NIE` (powinny); różne nazwy przedstawicieli i daty, żeby asercje mogły identyfikować konkretne wiersze.

#### 2. Skrypt weryfikacji

**File**: `scripts/verify-report-detection.mjs`

**Intent**: Automatyczny dowód, że parsowanie i reguła GPS dają oczekiwany wynik dla obu formatów, bez potrzeby lokalnego Supabase.

**Contract**: Importuje `parseReportFile`/`detectMissingGps` bezpośrednio (Node ESM), uruchamia na obu fixture'ach, asercją potwierdza dokładną liczbę i tożsamość wykrytych odstępstw dla każdego formatu; kończy się niezerowym kodem wyjścia przy niezgodności.

#### 3. Npm script

**File**: `package.json`

**Intent**: Udostępnić skrypt tym samym wzorcem co `verify:rls`.

**Contract**: `"verify:report-detection": "node scripts/verify-report-detection.mjs"`.

### Success Criteria:

#### Automated Verification:

- `npm run verify:report-detection` kończy się kodem 0

#### Manual Verification:

- Przegląd logu skryptu pokazuje jawne asercje liczby wykrytych odstępstw dla obu formatów (CSV i XLSX)

---

## Testing Strategy

### Unit Tests:

Brak frameworka testowego (CLAUDE.md) — Faza 1 jest zaprojektowana jako czyste funkcje właśnie po to, żeby `scripts/verify-report-detection.mjs` (Faza 4) mógł pełnić tę rolę bez frameworka.

### Integration Tests:

`scripts/verify-report-detection.mjs` — jedyny automatyczny dowód poprawności parsowania i reguły GPS.

### Manual Testing Steps:

1. Zalogować się jako testowy kierownik, wejść na `/reports`.
2. Wgrać `test-data/sample-report.csv`, potwierdzić przekierowanie na `/reports/[id]` i poprawną listę odstępstw.
3. Powtórzyć dla `test-data/sample-report.xlsx`, potwierdzić identyczny wynik.
4. Wgrać plik z usuniętą kolumną `gps_wlaczony`, potwierdzić czytelny komunikat błędu i brak zapisu w bazie.
5. Wgrać plik z jednym niepoprawnym wierszem (np. `gps_wlaczony=może`), potwierdzić odrzucenie całego pliku.

## Performance Considerations

Limit 5 MB na plik (patrz "Critical Implementation Details") wystarcza dla `target_scale: small` z PRD; brak potrzeby streamingu czy przetwarzania w tle na tym etapie.

## Migration Notes

Brak — ten plan nie zmienia schematu bazy (schemat już istnieje z `F-01`); tylko zapisuje dane przez istniejące tabele.

## References

- `context/foundation/prd.md` (v2) — FR-001–FR-006, US-01
- `context/foundation/roadmap.md` — S-01 (ten change), Prerequisite: F-01
- `context/archive/2026-09-25-report-data-schema/plan.md` — schemat `reports`/`visits`/`deviations`, RLS, `src/types.ts`
- Wzorzec API route: `src/pages/api/auth/signin.ts`
- Wzorzec skryptu weryfikacyjnego: `scripts/verify-rls.mjs`
- Konwencja klienta Supabase: `src/lib/supabase.ts:5-21`
- Middleware: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Rdzeń logiki — parsowanie i detekcja (czyste funkcje)

#### Automated

- [x] 1.1 `npm run lint` przechodzi — 1e60246
- [x] 1.2 `npx astro check` przechodzi — 1e60246

#### Manual

- [x] 1.3 Ręczny przegląd report-parser.ts potwierdza reguły walidacji z wywiadu — 1e60246

### Phase 2: Endpoint uploadu i zapis do bazy

#### Automated

- [x] 2.1 `npm run lint` przechodzi — f07b4a1
- [x] 2.2 `npx astro check` przechodzi — f07b4a1

#### Manual

- [x] 2.3 Wgranie poprawnego CSV kończy się przekierowaniem i zapisem w bazie — f07b4a1
- [x] 2.4 Wgranie pliku z brakującą wymaganą kolumną nie zapisuje niczego i pokazuje komunikat błędu — f07b4a1

### Phase 3: UI — upload i wynik

#### Automated

- [x] 3.1 `npm run lint` przechodzi — 0a891f3
- [x] 3.2 `npx astro check` przechodzi — 0a891f3
- [x] 3.3 `npm run build` kończy się bez błędów — 0a891f3

#### Manual

- [x] 3.4 `/reports` wymaga zalogowania — 0a891f3
- [x] 3.5 Wizyta bez GPS pojawia się na liście po wgraniu pliku — 0a891f3
- [x] 3.6 Kliknięcie wiersza rozwija pełny kontekst wizyty — 0a891f3
- [x] 3.7 Wizyta z GPS nie pojawia się na liście odstępstw — 0a891f3

### Phase 4: Fixture testowy i skrypt weryfikacji

#### Automated

- [x] 4.1 `npm run verify:report-detection` kończy się kodem 0 — e7ceab9

#### Manual

- [x] 4.2 Log skryptu pokazuje jawne asercje dla obu formatów — e7ceab9
