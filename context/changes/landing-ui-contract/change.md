---
change_id: landing-ui-contract
title: Landing ui contract
status: implemented
created: 2026-10-07
updated: 2026-10-07
archived_at: null
---

## Notes

Audyt `/10x-ui` widoku `src/components/Welcome.astro` (strona startowa, renderowana przez `src/pages/index.astro`). Jeden widok.

Wariant kontraktu: **istniejący design system** — rozszerzamy. Źródło tokenów: `src/styles/global.css` (`:root` / `.dark` → `@theme inline`), działający przełącznik motywu w nagłówku. Komponenty: `src/components/ui/*` (`button`, `card`, `alert`, …). Widok pochodzi z Claude Design („Strona startowa”): style i logika wyświetlania mogą się zmieniać, treść (nagłówki, opisy, kroki, kolumny) zostaje słowo w słowo.
