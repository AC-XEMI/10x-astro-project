---
change_id: dashboard-ui-tokens
title: Align dashboard (Pulpit) view with the design-system contract
status: implemented
created: 2026-10-07
updated: 2026-10-07
archived_at: null
---

## Notes

Audyt `/10x-ui` widoku `src/pages/dashboard.astro` (Pulpit kierownika) wraz z jego podkomponentami (`src/components/dashboard/RankingTable.tsx`, `DashboardExport.tsx`). Jeden widok.

Wariant kontraktu: **istniejący design system** — rozszerzamy, nie forkujemy. Źródło tokenów: `src/styles/global.css` (`:root` / `.dark`, publikowane przez `@theme inline`). Komponenty: `src/components/ui/*` (shadcn "new-york"; dziś `button`, `table`, `dialog`, `LibBadge`). Aplikacja ma przełącznik jasny/ciemny (`ThemeToggle.astro`), więc oba motywy wchodzą w zakres bramki wizualnej.
