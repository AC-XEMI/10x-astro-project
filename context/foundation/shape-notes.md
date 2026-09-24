---
project: "Kontrola Trasówek"
context_type: greenfield
created: 2026-09-22
updated: 2026-09-22
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 6
  hard_deadline: 2026-11-04
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "typ bólu"
      decision: "tarcie w procesie (workflow friction) — dane istnieją, ekstrakcja sensu jest ręczna i wolna"
    - topic: "insight"
      decision: "wzorzec odstępstw widoczny dopiero po zestawieniu wielu raportów; ręczna analiza za wolna na systematyczne wykrywanie"
    - topic: "zakres persony"
      decision: "jedna rola: kierownik regionalny (pojedyncza organizacja)"
    - topic: "przepływ MVP"
      decision: "login → upload pliku raportu → lista odstępstw → szczegóły wizyty; wszystkie trzy reguły (GPS, trasa, telefon-vs-wizyta) od startu; 6 tygodni po godzinach"
    - topic: "norma trasy"
      decision: "wizyta poza zaplanowaną listą klientów LUB nadmiarowy dystans/czas ponad próg wynikający z najkrótszej trasy między punktami"
    - topic: "telefon vs wizyta"
      decision: "pole 'typ aktywności' w raporcie, jeśli istnieje; w braku pola — wnioskowanie z braku GPS + bardzo krótkiego/zerowego czasu na miejscu"
  frs_drafted: 10
  quality_check_status: accepted
---

# Shape Notes

## Seed idea

System/AI do analizy raportów aktywności przedstawicieli handlowych — wgrywanie pliku
raportu (dane testowe, format CSV/Excel), wyciąganie danych, automatyczne oznaczanie
odstępstw od normy (na start: brak GPS podczas wizyty; docelowo też: nieoptymalna
trasa, telefon zamiast wizyty). Cel: odciążyć przełożonego od ręcznego przeglądania
raportów.

Kontekst z rozmowy wstępnej: problem dotyczy "cwanych" przedstawicieli handlowych —
nieoptymalne trasówki (jeżdżą tam gdzie chcą, nie tam gdzie powinni), dzwonią zamiast
jeździć, nie włączają GPS. Przełożony ma dostęp do gotowych raportów, ale ręczne
przeszukiwanie ich w poszukiwaniu odstępstw zajmuje czas.

Nierozstrzygnięte pytania zgłoszone na starcie (rozwiązane w toku sesji):
- ~~Dokładna definicja "normy" dla trasy i liczby wizyt.~~ → patrz `gray_areas_resolved.norma trasy`
- ~~Sposób odróżnienia telefonu od wizyty w danych.~~ → patrz `gray_areas_resolved.telefon vs wizyta`
- Czy/kiedy dołączyć realny eksport z systemu firmowego (na razie: dane testowe) — nadal otwarte, patrz Non-Goals.

Decyzja o zakresie (2026-09-22): wszystkie trzy reguły odstępstw (brak GPS,
nieoptymalna trasa, telefon zamiast wizyty) wchodzą do MVP od startu, nie
etapami. Użytkownik świadomie zaakceptował wydłużenie MVP do 6 tygodni po
godzinach zamiast pierwotnych 3 — patrz `## Timeline acknowledgment` niżej.

## Timeline acknowledgment

Acknowledged on 2026-09-22: 6-week MVP (rozszerzony o reguły trasy i
telefon-vs-wizyta ponad pierwotne 3 tygodnie tylko dla reguły GPS) requires
sustained dedication; user accepted.

## Vision & Problem Statement

Kierownik regionalny odpowiedzialny za zespół przedstawicieli handlowych ręcznie
przegląda raporty aktywności (trasy, liczbę wizyt, użycie GPS), żeby wychwycić
odstępstwa od normy — przedstawicieli, którzy jeżdżą nieoptymalnymi trasami,
dzwonią zamiast odwiedzać klientów, albo nie włączają GPS podczas wizyt. To
tarcie w procesie: dane do oceny już istnieją w raportach, ale wyciągnięcie z
nich sensu wymaga czasochłonnego, ręcznego przeszukiwania, które kierownik
wykonuje cyklicznie przy okresowym przeglądzie pracy zespołu.

Pojedynczy raport rzadko ujawnia problem — wzorzec odstępstw (np. ten sam
przedstawiciel regularnie wyłącza GPS) widać dopiero po zestawieniu wielu
raportów w czasie, a ręczna analiza jest zbyt wolna, żeby robić to zestawienie
systematycznie dla całego zespołu.

## User & Persona

**Kierownik regionalny** — osoba zarządzająca zespołem przedstawicieli
handlowych. Sięga po to narzędzie podczas okresowego przeglądu aktywności
zespołu, żeby szybko zobaczyć, gdzie są odstępstwa od normy, zamiast ręcznie
przeszukiwać raporty.

## Access Control

Logowanie: email + hasło. Model płaski — jedna rola (kierownik regionalny),
bez podziału na admina i użytkownika w MVP. Każdy zalogowany użytkownik ma
dostęp do raportów, które sam wgrał, i wyników ich analizy.

## Success Criteria

### Primary
- Kierownik wgrywa plik raportu (CSV/Excel, dane testowe) i w ciągu kilku
  sekund widzi listę odstępstw od normy wg trzech reguł: brak GPS podczas
  wizyty, nieoptymalna trasa, telefon zamiast wizyty.
- Kierownik może kliknąć w konkretne odstępstwo i zobaczyć pełny kontekst
  wizyty (data, przedstawiciel, dane z raportu, reguła która zadziałała).

### Secondary
- Filtrowanie/sortowanie listy odstępstw (np. wg przedstawiciela lub daty).
- Eksport listy odstępstw do pliku.

### Guardrails
- Poprawność wykrywania odstępstw — system nie oznacza poprawnych wizyt jako
  odstępstwo, dla żadnej z trzech reguł (fałszywe alarmy podważają zaufanie
  do narzędzia).
- Izolacja danych — raporty wgrane przez jednego kierownika są widoczne
  wyłącznie dla niego.

## User Stories

### US-01: Kierownik wykrywa odstępstwo w wgranym raporcie

- **Given** zalogowany kierownik wgrał plik raportu zawierający co najmniej
  jedną wizytę, która łamie jedną z trzech reguł (brak GPS, poza zaplanowaną
  trasą / nadmiarowy dystans, telefon zamiast wizyty)
- **When** system przetworzy raport
- **Then** ta wizyta pojawia się na liście odstępstw z adnotacją, która reguła
  zadziałała, a po kliknięciu w nią kierownik widzi pełny kontekst wizyty
  (data, przedstawiciel, dane z raportu)

#### Acceptance Criteria
- Wizyty zgodne ze wszystkimi trzema regułami nie są oznaczane jako
  odstępstwo (brak fałszywych alarmów)
- Błędny lub pusty plik raportu pokazuje czytelny komunikat, nie pustą listę
  bez wyjaśnienia
- Jedna wizyta może złamać więcej niż jedną regułę jednocześnie — lista
  pokazuje wszystkie zadziałane reguły dla tej wizyty

## Functional Requirements

- FR-001: Kierownik może zalogować się (email + hasło). Priority: must-have
  > Socratic: Brak kontrargumentu — FR stoi jak napisano.
- FR-002: Kierownik może wgrać plik raportu (CSV/Excel). Priority: must-have
  > Socratic: Brak kontrargumentu — FR stoi jak napisano.
- FR-003: System może wyciągnąć dane z wgranego raportu (wizyty: przedstawiciel,
  data, status GPS, typ aktywności [wizyta/telefon, jeśli pole istnieje],
  lokalizacja/dystans przejazdu, zaplanowana lista klientów/trasa). Priority: must-have
  > Socratic: Kontrargument rozważony (pierwotnie): "zakres pól za wąski na
  > przyszłe reguły (trasa, liczba wizyt)". Rozstrzygnięcie: rozszerzono pola
  > od razu, ponieważ reguły trasy i telefon-vs-wizyta weszły do MVP (patrz
  > decyzja o zakresie z 2026-09-22).
- FR-004: System może oznaczyć wizytę jako odstępstwo, gdy GPS nie był
  włączony podczas wizyty. Priority: must-have
  > Socratic: Kontrargument rozważony: "brak GPS nie zawsze oznacza
  > nieuczciwość". Rozstrzygnięcie: zostaje — to sygnał do przejrzenia przez
  > człowieka, nie automatyczna kara.
- FR-005: Kierownik może zobaczyć listę oznaczonych odstępstw. Priority: must-have
  > Socratic: Kontrargument rozważony: "długa lista bez priorytetyzacji to
  > ten sam problem co dziś". Rozstrzygnięcie: zostaje — przy jednej regule
  > (brak GPS) lista będzie krótka; priorytetyzacja to problem na później.
- FR-006: Kierownik może rozwinąć wiersz na liście odstępstw, żeby zobaczyć
  pełny kontekst wizyty (data, przedstawiciel, dane z raportu) — bez
  przechodzenia na osobny ekran. Priority: must-have
  > Socratic: Kontrargument rozważony: "osobny ekran szczegółów wydłuża
  > budowę MVP". Rozstrzygnięcie: zmieniono z osobnego ekranu na rozwijany
  > wiersz w liście.
- FR-007: Kierownik może filtrować/sortować listę odstępstw (np. wg
  przedstawiciela lub daty). Priority: nice-to-have
  > Socratic: Brak kontrargumentu — FR stoi jak napisano (i tak poza MVP).
- FR-008: Kierownik może wyeksportować listę odstępstw do pliku. Priority: nice-to-have
  > Socratic: Brak kontrargumentu — FR stoi jak napisano (i tak poza MVP).
- FR-009: System może oznaczyć wizytę jako odstępstwo, gdy przedstawiciel
  odwiedził klienta spoza zaplanowanej listy/trasy LUB pokonał dystans/czas
  przejazdu przekraczający próg wynikający z najkrótszej trasy między
  punktami. Priority: must-have
  > Socratic: Kontrargument rozważony: "liczenie dystansu między punktami to
  > realna praca inżynierska (współrzędne, obliczanie odległości/trasy), nie
  > prosty warunek". Rozstrzygnięcie: zostaje w całości — świadomie wliczone
  > w 6-tygodniowy szacunek MVP.
- FR-010: System może oznaczyć aktywność jako odstępstwo (telefon zamiast
  wizyty), gdy raport wskazuje typ "telefon" wprost, a w braku tego pola —
  gdy współwystępuje brak GPS i brak/bardzo krótki czas "na miejscu".
  Priority: must-have
  > Socratic: Brak kontrargumentu — FR stoi jak napisano (to i tak tylko
  > sygnał do przejrzenia przez człowieka).

## Business Logic

System automatycznie oznacza wizytę lub aktywność z raportu jako odstępstwo
od normy, gdy zachodzi co najmniej jeden z trzech warunków: brak GPS podczas
wizyty, wizyta poza zaplanowaną trasą lub z nadmiarowym dystansem/czasem
przejazdu, albo aktywność zarejestrowana jako telefon zamiast wizyty.

System przyjmuje na wejściu wyekstrahowane dane wizyty/aktywności
(przedstawiciel, data, status GPS, typ aktywności, dystans/lokalizacja,
zaplanowana lista klientów) z wgranego pliku raportu. Wyjściem jest
oznaczenie danej pozycji jako "odstępstwo" wraz z informacją, która reguła
zadziałała — widoczne na liście, którą kierownik może rozwinąć, by zobaczyć
pełny kontekst. Kierownik spotyka te reguły od razu po wgraniu pliku — nie
musi sam przeglądać raportu, żeby znaleźć nieprawidłowość.

## Non-Functional Requirements

- Kierownik widzi wynik analizy wgranego raportu w ciągu kilku sekund od
  wgrania pliku, nie po minutach oczekiwania.
- Dane z wgranego raportu (nawet testowe) pozostają widoczne wyłącznie dla
  konta, które je wgrało — żadna trwała widoczność dla innych kont.

## Non-Goals

- **Brak integracji z realnym systemem firmowym** — MVP działa wyłącznie na
  danych testowych/przykładowych (CSV/Excel wgrywanych ręcznie); połączenie z
  prawdziwym eksportem z systemu firmowego to osobna decyzja na później.
- **Brak współdzielenia danych między kierownikami** — żaden kierownik nie
  widzi raportów wgranych przez innego kierownika; brak widoków
  zbiorczych/wielozespołowych w MVP.
