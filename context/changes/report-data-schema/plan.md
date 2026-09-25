# Schemat i trwałość danych raportu Implementation Plan

## Overview

Pierwsza migracja Supabase w projekcie „Kontrola Trasówek": schemat tabel `reports`, `visits` i `deviations` przechowujący dane wyekstrahowane z wgranych raportów aktywności, z politykami RLS izolującymi dane per-użytkownik, wsparciem dla statusu przeglądu odstępstwa (FR-012) i kaskadowego usuwania raportu (FR-011). To fundament (`F-01` w `context/foundation/roadmap.md`), który odblokowuje wszystkie downstream wycinki (S-01–S-05) — sam nie dodaje żadnej logiki wykrywania odstępstw ani UI.

## Current State Analysis

- W projekcie nie istnieje jeszcze żadna migracja Supabase (`supabase/migrations/` nie istnieje) — jedyna istniejąca tabela to wbudowana `auth.users` obsługiwana przez Supabase Auth.
- Klient Supabase (`src/lib/supabase.ts:5-21`) tworzy sesyjny SSR-owy klient przez `@supabase/ssr` z `SUPABASE_KEY` zadeklarowanym w `astro.config.mjs:19` jako `context: "server", access: "secret", optional: true` — to klucz `anon`, nie `service_role`. Nie ma ścieżki z pominięciem RLS: RLS jest jedynym mechanizmem izolacji danych.
- Middleware (`src/middleware.ts:4,18-22`) chroni obecnie tylko `/dashboard`; nie ma jeszcze żadnych tras/API korzystających z tabel domenowych.
- Brak ORM/query buildera — konwencja to surowe wywołania `.from()` z `@supabase/supabase-js`.
- Brak `src/types.ts` — CLAUDE.md wskazuje to miejsce jako docelowe „once shared types are needed" — ten moment następuje teraz.
- `package.json` ma `supabase` jako dev-dependency (`^2.23.4`); brak istniejących npm-scriptów do generowania typów lub testów RLS.
- CI (`.github/workflows/ci.yml`) ma job `smoke`, który uruchamia lokalny Supabase przez CLI, buduje aplikację i odpala `npm run smoke` (`scripts/smoke.mjs`) — ten sam wzorzec (lokalny Supabase w CI) będzie hostował nowy skrypt weryfikacji RLS.
- **`.env`/`.dev.vars` wskazują na realny, hostowany projekt Supabase Cloud** (`https://ujvfzfjrijxgpzifnfhi.supabase.co`), nie na placeholder — to ten projekt, nie lokalny Docker, faktycznie obsługuje wdrożoną aplikację na Cloudflare Workers (sekrety `SUPABASE_URL`/`SUPABASE_KEY` w GitHub Actions i `wrangler secret` wskazują na to samo źródło, per `context/changes/deployment/deployment-plan.md`). Lokalny Supabase (Docker) i CI's `smoke` job używają efemerycznej, osobnej instancji — migracja musi trafić na **oba** cele, nie tylko lokalny.

## Desired End State

Po tej zmianie: `npx supabase db reset` (lokalnie) tworzy trzy tabele (`reports`, `visits`, `deviations`) z pełnymi politykami RLS, tak że zalogowany użytkownik może odczytywać/zapisywać/usuwać wyłącznie własne dane. `src/types.ts` zawiera wygenerowane typy tych tabel. Nowy skrypt automatycznie potwierdza izolację danych między dwoma kontami testowymi.

Weryfikacja: `npx supabase db reset` kończy się bez błędów; `npm run verify:rls` kończy się kodem 0; `npx astro check` i `npm run lint` przechodzą z nowym `src/types.ts`.

### Key Discoveries:

- `src/lib/supabase.ts:9` — `createServerClient(SUPABASE_URL, SUPABASE_KEY, ...)` z kluczem anon — RLS musi być kompletne i granularne (per-operację), bo nie ma warstwy service-role jako siatki bezpieczeństwa.
- `astro.config.mjs:19-20` — oba sekrety `optional: true`; migracja/typy nie mogą zakładać, że zmienne środowiskowe są zawsze ustawione.
- CLAUDE.md — konwencja nazewnictwa migracji: `YYYYMMDDHHmmss_short_description.sql`, RLS „granular per-operation, per-role policies from the start".
- `context/foundation/roadmap.md` (F-01) — ten fundament odblokowuje S-01…S-05; nie zawiera logiki wykrywania odstępstw ani obliczania dystansu/trasy (S-02) — to celowo poza zakresem.

## What We're NOT Doing

- Logika wykrywania odstępstw (reguły GPS/trasa/telefon) — to S-01, S-02, S-03.
- Parsowanie plików Excel/CSV i zapis do tych tabel — to S-01.
- UI listy/szczegółów/usuwania/oznaczania jako sprawdzone — to S-01, S-04, S-05.
- Dokładny algorytm liczenia progu dystansu/trasy (FR-009) — jawnie otwarty Unknown w roadmapie dla S-02; schemat przechowuje tylko surowe wyekstrahowane pola, nie wylicza progu.
- Przechowywanie oryginalnego pliku Excel/CSV w Supabase Storage — odrzucany po sparsowaniu (decyzja z wywiadu planowania).
- Historia/audyt zmian statusu przeglądu odstępstwa — tylko aktualny stan (`status`, `reviewed_at`), bez logu wielokrotnych zmian.
- Role/uprawnienia poza pojedynczą rolą „kierownik" — brak admina w MVP (per PRD Access Control).

## Implementation Approach

Jedna migracja SQL tworzy schemat w kolejności zależności (`reports` → `visits` → `deviations`), z kluczami obcymi `ON DELETE CASCADE` zapewniającymi FR-011 na poziomie bazy. Izolacja danych opiera się na jednym źródle prawdy (`reports.user_id`) — `visits` i `deviations` nie mają własnej kolumny `user_id`, tylko polityki RLS sprawdzające własność przez `EXISTS`/`JOIN` do `reports`. Status przeglądu (FR-012) żyje jako kolumna na `deviations`, nie osobna tabela — to zwykły `UPDATE` jednego rekordu, odwracalny przez ponowny `UPDATE`. Po migracji generujemy typy TS i piszemy automatyczny skrypt weryfikujący RLS dwoma kontami testowymi, uruchamiany lokalnie i w CI.

## Critical Implementation Details

**RLS przez zagnieżdżony EXISTS** — polityki na `deviations` muszą przejść przez dwa poziomy (`deviations` → `visits` → `reports`), nie jeden. Płytka polityka sprawdzająca tylko `visits.report_id` bez dotarcia do `reports.user_id` nie zaizoluje danych poprawnie — to najbardziej podatny na błąd element całej migracji, wart jawnego testu w Fazie 4 zanim jakikolwiek downstream slice zacznie z niego korzystać.

**Migracja ma dwa cele, nie jeden** — `npx supabase db reset` aplikuje migrację wyłącznie do efemerycznej, lokalnej instancji Docker. Aplikacja wdrożona na Cloudflare Workers łączy się z realnym, hostowanym projektem Supabase Cloud (`.env`/`.dev.vars` → `https://ujvfzfjrijxgpzifnfhi.supabase.co`), który jest zupełnie osobną bazą i **nie** widzi lokalnych migracji automatycznie. Bez jawnego `npx supabase link` + `npx supabase db push` (Faza 1) migracja "przejdzie" lokalnie, a produkcyjna/zdalna aplikacja nadal nie będzie miała tabel — łatwa do przeoczenia pułapka, bo lokalna weryfikacja wygląda na sukces.

## Phase 1: Schemat bazy danych

### Overview

Migracja SQL tworząca enumy, trzy tabele i indeksy — bez polityk RLS (Faza 2) i bez kodu aplikacji.

### Changes Required:

#### 1. Nowa migracja Supabase

**File**: `supabase/migrations/20260925120000_create_report_schema.sql`

**Intent**: Utworzyć schemat przechowujący wyekstrahowane dane raportu — bez tej migracji `F-01` (i wszystkie downstream slice'y S-01–S-05) nie mają gdzie zapisać/odczytać danych.

**Contract**:
- Enum `deviation_rule`: `'missing_gps'`, `'route_deviation'`, `'phone_instead_of_visit'`.
- Enum `deviation_review_status`: `'unreviewed'`, `'reviewed'`.
- `reports(id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, original_filename text not null, uploaded_at timestamptz not null default now(), row_count integer, created_at timestamptz not null default now())`.
- `visits(id uuid pk default gen_random_uuid(), report_id uuid not null references reports(id) on delete cascade, representative_name text not null, visit_date timestamptz not null, gps_enabled boolean not null, activity_type text, time_on_site_minutes numeric, distance_km numeric, planned_route_raw jsonb, raw_data jsonb, created_at timestamptz not null default now())`. Pola `activity_type`, `time_on_site_minutes`, `distance_km`, `planned_route_raw` są nullable — FR-003 mówi „jeśli pole istnieje" dla części z nich; `raw_data` to surowy wyekstrahowany wiersz jako zabezpieczenie na przyszłość, bez zakładania konkretnej struktury.
- `deviations(id uuid pk default gen_random_uuid(), visit_id uuid not null references visits(id) on delete cascade, rule deviation_rule not null, status deviation_review_status not null default 'unreviewed', reviewed_at timestamptz, created_at timestamptz not null default now())`.
- Indeksy: `visits(report_id)`, `deviations(visit_id)`, `reports(user_id)` — wspierają najczęstsze zapytania (lista raportów użytkownika, wizyty raportu, odstępstwa wizyty).

#### 2. Zastosowanie migracji na zdalnym projekcie Supabase Cloud

**Intent**: Sama lokalna migracja nie wystarczy — wdrożona aplikacja na Cloudflare Workers łączy się z hostowanym projektem Supabase Cloud (`https://ujvfzfjrijxgpzifnfhi.supabase.co`), oddzielnym od lokalnej instancji Docker. Bez tego kroku F-01 "działa" tylko lokalnie, a produkcja nadal nie ma tabel.

**Contract**: `npx supabase link --project-ref ujvfzfjrijxgpzifnfhi` (jednorazowe powiązanie CLI z projektem zdalnym, jeśli jeszcze nie wykonane), następnie `npx supabase db push` aplikuje wszystkie migracje z `supabase/migrations/` na zdalną bazę w tej samej kolejności co lokalnie.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` (lokalnie, wymaga Docker) kończy się bez błędów i aplikuje migrację
- `npx supabase migration list` pokazuje nową migrację jako zastosowaną (lokalnie)
- `npx supabase db push` kończy się bez błędów na zdalnym projekcie

#### Manual Verification:

- Supabase Studio lokalnie (`http://127.0.0.1:54323`) pokazuje trzy nowe tabele z poprawnymi kolumnami i typami
- Ręczny `INSERT` testowego raportu + wizyty + odstępstwa działa i kaskadowy `DELETE FROM reports` usuwa powiązane wiersze
- **Supabase Studio na hostowanym projekcie** (dashboard.supabase.com → projekt `ujvfzfjrijxgpzifnfhi`) pokazuje te same trzy tabele po `db push` — potwierdza, że produkcyjna baza faktycznie ma schemat, nie tylko lokalna

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Polityki RLS

### Overview

Granularne polityki per-operację (SELECT/INSERT/UPDATE/DELETE) na wszystkich trzech tabelach, egzekwujące że użytkownik widzi/modyfikuje wyłącznie własne dane — zgodnie z konwencją CLAUDE.md „granular per-operation, per-role policies from the start" i guardrailem PRD o izolacji danych.

### Changes Required:

#### 1. RLS na `reports`

**File**: `supabase/migrations/20260925120100_report_schema_rls.sql`

**Intent**: `reports.user_id` to jedyne źródło prawdy o własności — te polityki są najprostsze (bezpośrednie porównanie kolumny).

**Contract**: `ALTER TABLE reports ENABLE ROW LEVEL SECURITY;` + cztery polityki (`select`, `insert`, `update`, `delete`), każda `USING (auth.uid() = user_id)` (a `insert`/`update` dodatkowo `WITH CHECK (auth.uid() = user_id)`).

#### 2. RLS na `visits` i `deviations` (zagnieżdżone `EXISTS`)

**File**: tenże plik migracji jak wyżej

**Intent**: Brak własnej kolumny `user_id` na tych tabelach (decyzja z wywiadu) — własność sprawdzana przez podzapytanie do `reports`, dla `deviations` przez dwa poziomy (`deviations` → `visits` → `reports`).

**Contract**: Przykład wzorca polityki dla `deviations` (najbardziej nieoczywisty element — patrz „Critical Implementation Details"):

```sql
create policy "deviations_select_own" on deviations
  for select using (
    exists (
      select 1 from visits
      join reports on reports.id = visits.report_id
      where visits.id = deviations.visit_id
        and reports.user_id = auth.uid()
    )
  );
```

Ten sam wzorzec (z odpowiednim `WITH CHECK` dla insert/update) powtórzony dla każdej z 4 operacji na `visits` (jeden poziom `EXISTS` do `reports`) i `deviations` (dwa poziomy). Łącznie 4 polityki × 2 tabele = 8 dodatkowych polityk.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` aplikuje politykę bez błędów
- `npm run verify:rls` (dodany w Fazie 4) przechodzi — dowód, że polityki faktycznie izolują dane

#### Manual Verification:

- Supabase Studio → SQL editor z „Run as authenticated user" potwierdza: użytkownik A nie widzi wierszy `reports`/`visits`/`deviations` należących do użytkownika B

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Typy TypeScript

### Overview

Wygenerowanie typowanych definicji tabel z Supabase, żeby S-01–S-05 miały od razu typowane zapytania `.from()` zamiast `any`.

### Changes Required:

#### 1. Wygenerowany plik typów

**File**: `src/types.ts`

**Intent**: Jedno źródło prawdy o kształcie wierszy `reports`/`visits`/`deviations` dla całej aplikacji — pierwszy plik w tej lokalizacji (CLAUDE.md wskazywał ją jako zarezerwowaną na później).

**Contract**: Wygenerowany przez `npx supabase gen types typescript --local > src/types.ts`; eksportuje `Database` (i pochodne, np. `Tables<'reports'>`) zgodnie ze standardowym formatem `supabase gen types`. Plik jest generowany, nie edytowany ręcznie.

#### 2. Skrypt regeneracji typów

**File**: `package.json`

**Intent**: Udokumentować i ułatwić regenerację typów po każdej kolejnej migracji (S-01+ dodadzą kolejne zmiany schematu).

**Contract**: Nowy skrypt `"db:types": "supabase gen types typescript --local > src/types.ts"`.

### Success Criteria:

#### Automated Verification:

- `npx astro check` przechodzi z nowym `src/types.ts` (brak błędów typów)
- `npm run lint` przechodzi

#### Manual Verification:

- Ręczny przegląd `src/types.ts` potwierdza obecność `reports`, `visits`, `deviations` z kolumnami zgodnymi z Fazą 1

---

## Phase 4: Automatyczna weryfikacja izolacji RLS

### Overview

Skrypt (wzorowany na `scripts/smoke.mjs`) programowo potwierdzający, że RLS faktycznie izoluje dane — guardrail PRD, nie tylko ręczne zaufanie do polityk.

### Changes Required:

#### 1. Skrypt weryfikacji RLS

**File**: `scripts/verify-rls.mjs`

**Intent**: Utworzyć dwóch testowych użytkowników, wstawić dane należące do użytkownika A, i asercją potwierdzić że sesja użytkownika B nie widzi tych rekordów w żadnej z trzech tabel (ani przez bezpośredni odczyt, ani przez próbę update/delete cudzego wiersza).

**Contract**: Skrypt bez zależności (jak `smoke.mjs`), łączy się **wyłącznie z lokalnym Supabase** — **nie** czyta `SUPABASE_URL`/`SUPABASE_KEY` z `.dev.vars`/`.env`, bo w tym repo te pliki wskazują na projekt Cloud (`ujvfzfjrijxgpzifnfhi`), nie na lokalną instancję. Zamiast tego pobiera świeże lokalne dane tym samym mechanizmem co istniejący (zakomentowany) job `smoke`: po `npx supabase start` odczytuje `supabase status -o env | grep -E '^(API_URL|ANON_KEY)='` i używa tych wartości do klienta `@supabase/supabase-js`. Tworzy dwóch użytkowników przez `auth.signUp`, loguje się jako każdy, wykonuje `.from('reports').select()` / `.from('visits').select()` / `.from('deviations').select()` jako user B po wstawieniu danych jako user A, i kończy z niezerowym kodem wyjścia jeśli user B widzi cudze dane. Dodatkowo próbuje `UPDATE`/`DELETE` cudzego wiersza i oczekuje odrzucenia przez RLS. **Nigdy nie łączy się ze zdalnym projektem Cloud** — nie tworzy testowych kont na współdzielonej bazie.

#### 2. Npm script + wpięcie w CI

**File**: `package.json`, `.github/workflows/ci.yml`

**Intent**: `verify:rls` uruchamiany lokalnie i w tym samym (obecnie zakomentowanym) job `smoke`, który już stawia lokalny Supabase — bez tworzenia nowego joba CI.

**Contract**: `"verify:rls": "node scripts/verify-rls.mjs"` w `package.json`; jeden dodatkowy krok `npm run verify:rls` w job `smoke` po kroku `npm run smoke`, w tym samym miejscu gdzie `.env`/`.dev.vars` są już nadpisane lokalnymi danymi (linie 49-53 workflow). **Uwaga**: job `smoke` jest obecnie w całości zakomentowany w `.github/workflows/ci.yml` (od commitu "Comment smoke in ci") — ten krok trafia do treści joba, ale nie zacznie faktycznie działać w CI, dopóki ktoś świadomie go odkomentuje; to celowo poza zakresem tego planu (decyzja o włączeniu CI smoke należy do wcześniejszej, osobnej decyzji projektowej).

### Success Criteria:

#### Automated Verification:

- `npm run verify:rls` kończy się kodem 0 lokalnie (po `npx supabase start`)

#### Manual Verification:

- Przegląd logu skryptu pokazuje jawne asercje „user B nie widzi raportu user A" dla wszystkich trzech tabel i operacji update/delete
- Krok w job `smoke` jest poprawnie dodany do pliku workflow (składniowo), nawet jeśli sam job pozostaje zakomentowany — potwierdzone przeglądem diffu `.github/workflows/ci.yml`

---

## Testing Strategy

### Unit Tests:

Brak — projekt nie ma frameworka testowego (CLAUDE.md); weryfikacja opiera się na automatycznych skryptach (`verify:rls`) i `npx supabase db reset`.

### Integration Tests:

- `scripts/verify-rls.mjs` jest testem integracyjnym przeciw lokalnemu Supabase — jedyny automatyczny dowód poprawności RLS w tym planie.

### Manual Testing Steps:

1. `npx supabase start` (wymaga Docker) → `npx supabase db reset`.
2. Otworzyć Supabase Studio, ręcznie wstawić raport + wizytę + odstępstwo dla jednego użytkownika testowego.
3. Zalogować się w Studio jako drugi użytkownik testowy i potwierdzić brak widoczności danych pierwszego.
4. Usunąć raport pierwszego użytkownika i potwierdzić kaskadowe usunięcie wizyt/odstępstw.

## Performance Considerations

Brak realnych obciążeń na tym etapie (mały zespół, MVP) — indeksy z Fazy 1 (`report_id`, `visit_id`, `user_id`) wystarczają dla zakładanej skali (`target_scale: small` w PRD frontmatter).

## Migration Notes

Brak istniejących danych do migrowania — to pierwsza migracja poza wbudowanym `auth.users`. Migracja ma **dwa cele wdrożenia**: lokalna instancja Docker (dev + CI `smoke` — efemeryczna, resetowana przez `supabase db reset`) i hostowany projekt Supabase Cloud `ujvfzfjrijxgpzifnfhi` (rzeczywiste środowisko, z którym łączy się wdrożona aplikacja na Cloudflare Workers, per `.env`/`.dev.vars` i `wrangler secret`). Obie muszą dostać tę samą migrację — lokalny sukces nie oznacza, że zdalna baza ma schemat.

## References

- `context/foundation/prd.md` (v2) — FR-001–FR-012, US-01–US-03, Access Control
- `context/foundation/roadmap.md` — F-01 (ten change), Unlocks: S-01–S-05
- `context/foundation/tech-stack.md`, `context/foundation/infrastructure.md` — Cloudflare Workers + Supabase, RLS jako jedyny mechanizm izolacji (klucz anon, nie service_role)
- Wzorzec skryptu: `scripts/smoke.mjs`
- Konwencja klienta: `src/lib/supabase.ts:5-21`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schemat bazy danych

#### Automated

- [x] 1.1 `npx supabase db reset` kończy się bez błędów i aplikuje migrację — 3ad9b4b
- [x] 1.2 `npx supabase migration list` pokazuje nową migrację jako zastosowaną — 3ad9b4b
- [x] 1.3 `npx supabase db push` kończy się bez błędów na zdalnym projekcie — 3ad9b4b

#### Manual

- [x] 1.4 Supabase Studio (lokalnie) pokazuje trzy nowe tabele z poprawnymi kolumnami i typami — 115e25d
- [x] 1.5 Ręczny INSERT + kaskadowy DELETE działa poprawnie — 115e25d
- [x] 1.6 Supabase Studio na hostowanym projekcie (ujvfzfjrijxgpzifnfhi) pokazuje te same trzy tabele po db push — 3ad9b4b

### Phase 2: Polityki RLS

#### Automated

- [x] 2.1 `npx supabase db reset` aplikuje politykę bez błędów — 115e25d
- [ ] 2.2 `npm run verify:rls` przechodzi

#### Manual

- [x] 2.3 Supabase Studio „Run as authenticated user" potwierdza izolację danych — 115e25d

### Phase 3: Typy TypeScript

#### Automated

- [x] 3.1 `npx astro check` przechodzi z nowym src/types.ts
- [x] 3.2 `npm run lint` przechodzi

#### Manual

- [x] 3.3 Ręczny przegląd src/types.ts potwierdza obecność wszystkich trzech tabel

### Phase 4: Automatyczna weryfikacja izolacji RLS

#### Automated

- [ ] 4.1 `npm run verify:rls` kończy się kodem 0 lokalnie (po `npx supabase start`)

#### Manual

- [ ] 4.2 Przegląd logu skryptu potwierdza jawne asercje izolacji dla wszystkich trzech tabel
- [ ] 4.3 Krok w job `smoke` poprawnie dodany do workflow (job pozostaje zakomentowany — poza zakresem)
