Plan: Pierwsze wdrożenie Kontroli Trasówek na Cloudflare Workers

 Kontekst

 Plan zbudowany bezpośrednio na podstawie context/foundation/infrastructure.md
 (decyzja z /10x-infra-research): Cloudflare Workers jako platforma MVP —
 darmowy tier przy tej skali ruchu,
 zerowa migracja bo adapter @astrojs/cloudflare jest już zainstalowany, 5/5
 Pass na kryteriach agent-friendly. Repo jest już praktycznie
 skonfigurowane pod ten deploy (starter to przewidział), ale nigdy nie
 odbył się rzeczywisty deploy na Cloudflare — celem tego planu jest
 doprowadzenie do pierwszego działającego wdrożenia produkcyjnego przez
 istniejący pipeline CI/CD, z poprawką dwóch znanych, udokumentowanych w
 infrastructure.md problemów zanim ruch produkcyjny zacznie płynąć.

 Ustalenia z rozmowy: nazwa Workera ma zostać zmieniona z pozostałości po
 starterze (10x-astro-starter) na kontrola-trasowek; pierwszy deploy ma
 przejść wyłącznie przez istniejący pipeline GitHub Actions (job deploy w
 .github/workflows/ci.yml), bez lokalnego wrangler login/wrangler deploy.

 Kroki automatyczne poniżej realizują wprost sekcję Getting Started
 (punkty 2 i 4) oraz dwa pierwsze wiersze Risk Register z
 infrastructure.md; bramki manualne i podział agent/człowiek odzwierciedlają
 sekcję Operational Story → Secrets/Approval tego samego pliku.

 Stan repo (zweryfikowany)

 - wrangler.jsonc istnieje i jest kompletny: name: "10x-astro-starter",
   compatibility_date: "2026-05-08", compatibility_flags: ["nodejs_compat"],
   binding ASSETS → ./dist, observability.enabled: true. Brakuje
   disable_nodejs_process_v2 — znany bug z infrastructure.md (SSR może po
   cichu zwrócić [object Object] z HTTP 200).
 - astro.config.mjs ma już adapter: cloudflare() i schemat env dla
   SUPABASE_URL/SUPABASE_KEY (oba optional: true).
 - .github/workflows/ci.yml ma gotowy, aktywny job deploy (linie 63-86):
   uruchamia się po zielonym jobie ci, tylko na push do master, przez
   cloudflare/wrangler-action@v3 z sekretami CLOUDFLARE_API_TOKEN i
   CLOUDFLARE_ACCOUNT_ID. Job ci buduje z sekretami SUPABASE_URL/
   SUPABASE_KEY. Job smoke jest zakomentowany (nieaktywny).
 - context/foundation/tech-stack.md wciąż ma nieaktualną wskazówkę
   deployment_target: cloudflare-pages (powinno być cloudflare-workers,
   zgodnie z Getting Started w infrastructure.md).
 - Brak dowodów na jakikolwiek wcześniejszy wrangler login/wrangler deploy
   w tym repo — to będzie faktycznie pierwszy deploy.
 - Git remote: https://github.com/AC-XEMI/10x-astro-project.git, branch
   master, working tree czyste.

 Kroki automatyczne (wykona agent po zatwierdzeniu planu)

 1. wrangler.jsonc — zmiana "name": "10x-astro-starter" →
    "name": "kontrola-trasowek".
 2. wrangler.jsonc — dodanie "disable_nodejs_process_v2" do
    compatibility_flags (obok istniejącego nodejs_compat) — mitygacja
    ryzyka z rejestru ryzyk w infrastructure.md.
 3. context/foundation/tech-stack.md — korekta
    deployment_target: cloudflare-pages → deployment_target: cloudflare-workers.
    (Ten plik jest w .gitignore — zmiana lokalna, nie trafi do commita, ale
    utrzymuje kontrakt fundacyjny zgodny ze stanem faktycznym.)
 4. Commit zmian w wrangler.jsonc (jedyny realnie śledzony przez git plik z
    powyższych) z jasnym opisem — do zatwierdzenia przez użytkownika przed
    push, zgodnie ze standardowym protokołem bezpieczeństwa git.

 Bramki manualne (tylko człowiek — zgodnie z posturą "production-access

 boundary" z CLAUDE.md: scoped tokeny, brak plaintext w repo)

 1. Utworzenie scoped API tokena w Cloudflare Dashboard → My Profile →
    API Tokens → Create Token: uprawnienia ograniczone do
    Workers Scripts:Edit (i Workers Routes:Edit jeśli w przyszłości custom
    domain) dla jednego konta/projektu — bez DNS, bez billing, bez dostępu do
    innych zasobów.
 2. Odczyt Account ID z prawego panelu Cloudflare Dashboard.
 3. Dodanie sekretów repo na
    https://github.com/AC-XEMI/10x-astro-project/settings/secrets/actions:
    - CLOUDFLARE_API_TOKEN (z kroku 1)
    - CLOUDFLARE_ACCOUNT_ID (z kroku 2)
    - Weryfikacja, że SUPABASE_URL i SUPABASE_KEY już tam są (job ci już
      ich używa do builda, więc prawdopodobnie istnieją — potwierdzić ręcznie,
      bo agent nie ma dostępu do odczytu wartości sekretów).
 4. Merge do master — commitu z kroku 4 (automatycznego) powyżej, przez
    PR albo bezpośredni push po code review — to uruchamia ci → deploy.

 Weryfikacja end-to-end

 1. Obserwacja przebiegu w GitHub Actions (gh run watch albo zakładka
    Actions) — potwierdzenie, że job ci i deploy kończą się sukcesem.
 2. Odczyt adresu *.workers.dev z logu kroku wrangler-action w jobie
    deploy (albo z Cloudflare Dashboard → Workers & Pages →
    kontrola-trasowek).
 3. Ręczne sprawdzenie w przeglądarce: strona główna się renderuje, /auth/signin
    się renderuje, próba logowania faktycznie łączy się z Supabase (nie
    zwraca pustego/uszkodzonego SSR — to byłby symptom znanego buga
    nodejs_compat, który krok 2 automatyczny ma zapobiec).
 4. Uruchomienie smoke testu względem żywego URL-a:
    BASE_URL=https://kontrola-trasowek.<subdomain>.workers.dev npm run smoke.
 5. Opcjonalnie: wrangler tail --status error (wymaga lokalnego
    wrangler login, poza zakresem tego pierwszego, CI-only deployu, ale
    dostępne jako następny krok przy debugowaniu).

 Addendum (2026-09-28, dopisane po /10x-impl-review)

 Podczas realizacji tego planu wykonano dwie dodatkowe zmiany w
 .github/workflows/ci.yml, nieujęte w oryginalnych "Krokach automatycznych"
 powyżej — obie okazały się konieczne, gdy pierwszy faktyczny deploy
 ujawnił luki, których plan nie przewidział:

 1. Commit 31efb44 — "Push Supabase credentials as Workers runtime
    secrets on deploy". Job deploy wstrzykiwał SUPABASE_URL/SUPABASE_KEY
    tylko na etapie astro build; sam Worker w runtime (Astro.locals.
    runtime.env) nigdy ich nie otrzymywał, więc żywy deploy serwowałby
    "Supabase is not configured" na signup/dashboard. Naprawiono przez
    dodanie sekcji secrets: do kroku cloudflare/wrangler-action@v3, co
    nieinteraktywnie uruchamia wrangler secret put z env joba — bez
    potrzeby lokalnego wrangler login.
 2. Commit c9ace44 — "fix(ci): re-enable smoke job and gate deploy on
    it". Odkomentowano job smoke (lokalny Supabase + npm run smoke) i
    zmieniono needs joba deploy z [ci] na [ci, smoke] — produkcyjny
    deploy jest teraz blokowany, dopóki smoke test nie przejdzie.

 Uwaga: nie zweryfikowano na żywym tokenie, czy zakres Workers
 Scripts:Edit (patrz Bramki manualne, krok 1) wystarcza do wrangler
 secret put — jeśli nie, krok "secrets:" w deploy zawiedzie i zakres
 tokena trzeba będzie rozszerzyć.