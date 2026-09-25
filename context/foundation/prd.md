---
project: "Kontrola Trasówek"
version: 2
status: draft
created: 2026-09-22
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 6
  hard_deadline: 2026-11-04
  after_hours_only: true
---

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

## User Stories (ciąg dalszy)

### US-02: Kierownik usuwa błędnie wgrany raport

- **Given** zalogowany kierownik ma wgrany raport (wraz z wykrytymi odstępstwami)
- **When** kierownik wybiera opcję usunięcia tego raportu i potwierdza
- **Then** raport oraz wszystkie powiązane wizyty i odstępstwa znikają z listy i nie są już widoczne dla tego konta

#### Acceptance Criteria
- Usunięcie wymaga jawnego potwierdzenia (żeby uniknąć przypadkowej utraty danych)
- Po usunięciu raportu nie da się go odzyskać z poziomu UI
- Usunięcie jednego raportu nie wpływa na inne wgrane raporty tego samego kierownika

### US-03: Kierownik oznacza odstępstwo jako sprawdzone/fałszywy alarm

- **Given** zalogowany kierownik widzi listę odstępstw z co najmniej jedną pozycją
- **When** kierownik oznacza konkretne odstępstwo jako "sprawdzone" (fałszywy alarm)
- **Then** ta pozycja pozostaje widoczna na liście, ale z wyraźnym oznaczeniem statusu przeglądu, odróżniającym ją od odstępstw jeszcze nieprzejrzanych

#### Acceptance Criteria
- Oznaczenie statusu przeglądu jest trwałe — widoczne przy kolejnym powrocie do tego samego raportu
- Oznaczenie nie usuwa odstępstwa z listy, tylko zmienia jego status
- Kierownik może cofnąć oznaczenie (przywrócić status "nieprzejrzane")

## Functional Requirements

### Logowanie i wgrywanie raportu
- FR-001: Kierownik może zalogować się (email + hasło). Priority: must-have
  > Socratic: Brak kontrargumentu — FR stoi jak napisano.
- FR-002: Kierownik może wgrać plik raportu (CSV/Excel). Priority: must-have
  > Socratic: Brak kontrargumentu — FR stoi jak napisano.

### Ekstrakcja danych
- FR-003: System może wyciągnąć dane z wgranego raportu (wizyty: przedstawiciel,
  data, status GPS, typ aktywności [wizyta/telefon, jeśli pole istnieje],
  lokalizacja/dystans przejazdu, zaplanowana lista klientów/trasa). Priority: must-have
  > Socratic: Kontrargument rozważony (pierwotnie): "zakres pól za wąski na
  > przyszłe reguły (trasa, liczba wizyt)". Rozstrzygnięcie: rozszerzono pola
  > od razu, ponieważ reguły trasy i telefon-vs-wizyta weszły do MVP (patrz
  > decyzja o zakresie z 2026-09-22 w Open Questions/historii sesji).

### Wykrywanie odstępstw
- FR-004: System może oznaczyć wizytę jako odstępstwo, gdy GPS nie był
  włączony podczas wizyty. Priority: must-have
  > Socratic: Kontrargument rozważony: "brak GPS nie zawsze oznacza
  > nieuczciwość". Rozstrzygnięcie: zostaje — to sygnał do przejrzenia przez
  > człowieka, nie automatyczna kara.
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

### Przegląd wyników
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
- FR-012: Kierownik może oznaczyć odstępstwo jako sprawdzone/fałszywy alarm. Priority: must-have
  > Socratic: Kontrargument rozważony: "to nie jest wymagane do udowodnienia głównej hipotezy — samo wykrywanie odstępstw już to robi". Rozstrzygnięcie: zostaje jako must-have na wyraźne życzenie użytkownika (2026-09-25) — bez statusu przeglądu kierownik przy każdym powrocie do raportu widzi te same odstępstwa bez śladu, że już je sprawdził, co podważa użyteczność przy regularnym użyciu.

### Zarządzanie raportem
- FR-011: Kierownik może usunąć wgrany raport (wraz z powiązanymi wizytami i odstępstwami). Priority: must-have
  > Socratic: Kontrargument rozważony: "usuwanie danych zwiększa ryzyko przypadkowej utraty". Rozstrzygnięcie: zostaje jako must-have (2026-09-25) — wymaga jawnego potwierdzenia w UI (patrz US-02); narzędzie oparte na ręcznym wgrywaniu plików wymaga podstawowej higieny danych (możliwość poprawienia pomyłki).

## Non-Functional Requirements

- Kierownik widzi wynik analizy wgranego raportu w ciągu kilku sekund od
  wgrania pliku, nie po minutach oczekiwania.
- Dane z wgranego raportu (nawet testowe) pozostają widoczne wyłącznie dla
  konta, które je wgrało — żadna trwała widoczność dla innych kont.

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

## Access Control

Logowanie: email + hasło. Model płaski — jedna rola (kierownik regionalny),
bez podziału na admina i użytkownika w MVP. Każdy zalogowany użytkownik ma
dostęp do raportów, które sam wgrał, i wyników ich analizy — w tym do ich
usuwania (FR-011) i oznaczania statusu przeglądu odstępstw (FR-012); żaden
inny użytkownik nie ma dostępu do tych operacji na cudzych raportach.

## Non-Goals

- **Brak integracji z realnym systemem firmowym** — MVP działa wyłącznie na
  danych testowych/przykładowych (CSV/Excel wgrywanych ręcznie); połączenie z
  prawdziwym eksportem z systemu firmowego to osobna decyzja na później.
- **Brak współdzielenia danych między kierownikami** — żaden kierownik nie
  widzi raportów wgranych przez innego kierownika; brak widoków
  zbiorczych/wielozespołowych w MVP.

## Open Questions

1. **Czy i kiedy dołączyć realny eksport z systemu firmowego zamiast danych
   testowych?** — Owner: user. By: brak ustalonej daty (decyzja po MVP; format
   i sposób pobrania realnego eksportu nie są jeszcze znane).
