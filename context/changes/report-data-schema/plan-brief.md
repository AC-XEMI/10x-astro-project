# Schemat i trwałość danych raportu — Plan Brief

> Full plan: `context/changes/report-data-schema/plan.md`

## What & Why

Pierwsza migracja Supabase w projekcie: tabele `reports`, `visits`, `deviations` przechowujące dane wyekstrahowane z wgranych raportów aktywności przedstawicieli handlowych. To fundament (`F-01` w roadmapie), bez którego żadna z pięciu downstream funkcji (wykrywanie GPS/trasy/telefonu, usuwanie raportu, oznaczanie odstępstwa jako sprawdzone) nie ma gdzie zapisać ani skąd odczytać danych.

## Starting Point

Projekt ma tylko wbudowaną tabelę `auth.users` (Supabase Auth) — brak `supabase/migrations/`, brak jakichkolwiek tabel domenowych. Klient Supabase używa klucza `anon` (nie `service_role`), więc RLS jest jedynym mechanizmem izolacji danych między kierownikami. **Aplikacja łączy się z realnym, hostowanym projektem Supabase Cloud** (`ujvfzfjrijxgpzifnfhi.supabase.co`, potwierdzone w `.env`), nie tylko z lokalnym Dockerem — migracja musi trafić na oba cele.

## Desired End State

Po migracji: trzy tabele z pełnym RLS, tak że zalogowany kierownik widzi wyłącznie własne raporty/wizyty/odstępstwa. Usunięcie raportu kaskadowo usuwa powiązane dane. Odstępstwo ma status przeglądu (nieprzejrzane/sprawdzone), odwracalny. `src/types.ts` daje downstream slice'om typowane zapytania od pierwszego dnia. Automatyczny skrypt (`npm run verify:rls`) programowo potwierdza izolację danych między dwoma kontami testowymi.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Relacja wizyty↔odstępstwa | Osobna tabela `deviations` (nie flagi boolean na `visits`) | Jedna wizyta może złamać kilka reguł naraz (US-01 AC) i każda potrzebuje własnego statusu przeglądu | Plan |
| Reprezentacja reguły | Postgres enum `deviation_rule` | Baza pilnuje poprawności wartości; dodanie 4. reguły to świadoma migracja, nie cichy bug | Plan |
| Status przeglądu (FR-012) | Kolumna `status` na `deviations`, nie osobna tabela audytowa | Prosta, odwracalna zmiana jednego rekordu — PRD nie wymaga historii zmian | Plan |
| Izolacja RLS | `user_id` tylko na `reports`; `visits`/`deviations` przez zagnieżdżony `EXISTS` | Jedno źródło prawdy — brak ryzyka rozjazdu `user_id` między trzema tabelami | Plan |
| Usuwanie raportu (FR-011) | Twarde usuwanie + `ON DELETE CASCADE` | Zgodne wprost z AC „nie da się odzyskać z poziomu UI"; zero ryzyka osieroconych rekordów | Plan |
| Typy TS | Generowane teraz (`supabase gen types` → `src/types.ts`) | S-01–S-05 od razu mają typowane `.from()` zamiast `any` | Plan |
| Weryfikacja RLS | Automatyczny skrypt (`scripts/verify-rls.mjs`), nie tylko ręczna | Izolacja danych to PRD guardrail, nie „nice to have" | Plan |
| Środowisko dev | `.env`/`.dev.vars` wskazują na Cloud (dev pracuje na zdalnym linku); lokalny Docker to tylko piaskownica dla migracji/RLS-testów przed `db push` | Migracja na wspóldzielonej bazie Cloud jest nieodwracalna — taniej złapać błąd lokalnie | Plan (doprecyzowane przez użytkownika) |
| Oryginalny plik raportu | Odrzucany po sparsowaniu, brak Supabase Storage | PRD nie wspomina o audycie/ponownym przetwarzaniu pliku; trzyma F-01 w zakresie czystego schematu Postgres | Plan |

## Scope

**In scope:** migracja SQL (3 tabele + 2 enumy + indeksy), polityki RLS per-operację na wszystkich tabelach, generowanie `src/types.ts`, skrypt automatycznej weryfikacji izolacji RLS + wpięcie w CI.

**Out of scope:** logika wykrywania odstępstw (S-01/S-02/S-03), parsowanie Excel/CSV (S-01), UI (S-01/S-04/S-05), algorytm liczenia progu dystansu/trasy (otwarty Unknown dla S-02), przechowywanie oryginalnego pliku, historia zmian statusu przeglądu, role poza jedną („kierownik").

## Architecture / Approach

Trzy tabele w łańcuchu zależności `reports → visits → deviations`, każda z kluczem obcym `ON DELETE CASCADE` do rodzica. RLS nie duplikuje `user_id` — sprawdza własność przez podzapytanie `EXISTS` do `reports`, dla `deviations` przez dwa poziomy. Po migracji: generowanie typów TS, potem automatyczny dwu-użytkownikowy test izolacji dołączony do istniejącego CI job `smoke`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schemat bazy danych | 3 tabele, 2 enumy, indeksy, kaskadowe FK — zastosowane lokalnie I na zdalnym projekcie (`db push`) | Migracja "przechodzi" lokalnie, ale ktoś zapomni `db push` — produkcja dalej bez tabel |
| 2. Polityki RLS | Granularne polityki SELECT/INSERT/UPDATE/DELETE na wszystkich tabelach | Płytki `EXISTS` na `deviations` (jeden poziom zamiast dwóch) cicho łamie izolację danych |
| 3. Typy TypeScript | `src/types.ts` z `supabase gen types` | Typy trzeba pamiętać regenerować po każdej kolejnej migracji |
| 4. Automatyczna weryfikacja RLS | `scripts/verify-rls.mjs` (wyłącznie przeciw lokalnemu Supabase) + krok w (zakomentowanym) job `smoke` | Skrypt musi pobierać świeże lokalne dane przez `supabase status -o env`, nie z `.dev.vars`/`.env` — te wskazują na projekt Cloud, nie na lokalną instancję |

**Prerequisites:** Docker (dla `npx supabase start` lokalnie), istniejący projekt Supabase Cloud już połączony przez `.env`/`.dev.vars` (`ujvfzfjrijxgpzifnfhi`) — wymaga `npx supabase link` przed pierwszym `db push`.
**Estimated effort:** 4 fazy, jedna sesja implementacyjna — czysty schemat bez UI/logiki biznesowej.

## Open Risks & Assumptions

- Założenie: `planned_route_raw` i `raw_data` na `visits` to surowe, nieprzetworzone pola — S-02 może wymagać dodatkowych kolumn (np. współrzędnych) przy planowaniu route-deviation-detection; to świadomie odłożone (patrz „What We're NOT Doing" w pełnym planie).
- **Zweryfikowane** (nie już ryzyko): `SUPABASE_KEY` to rzeczywiście klucz `anon` — potwierdzone bezpośrednio w `.env` (JWT payload `"role":"anon"`).
- Ryzyko: `npx supabase db push` na zdalny projekt jest nieodwracalne bez ręcznego rollbacku (brak `wrangler rollback`-owego odpowiednika dla schematu bazy) — jeśli migracja ma błąd, naprawa wymaga nowej migracji korygującej, nie cofnięcia.

## Success Criteria (Summary)

- Kierownik (po zaimplementowaniu S-01+) będzie mógł wgrać raport i mieć pewność, że nikt inny nie zobaczy jego danych — `npm run verify:rls` to udowadnia automatycznie.
- Usunięcie raportu nie zostawia osieroconych wizyt/odstępstw w bazie.
- Każda kolejna zmiana (S-01–S-05) zaczyna z typowanymi zapytaniami, bez ręcznego dopisywania typów.
