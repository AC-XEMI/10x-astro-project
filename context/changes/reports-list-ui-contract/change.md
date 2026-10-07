---
change_id: reports-list-ui-contract
title: Reports list ui contract
status: implementing
created: 2026-10-07
updated: 2026-10-07
archived_at: null
---

## Notes

Audyt `/10x-ui` widoku `src/pages/reports/index.astro` (lista raportów) z podkomponentami `src/components/reports/ReportsList.tsx`, `src/components/reports/ReportUpload.tsx` i `src/components/Banner.astro`. Jeden widok.

Wariant kontraktu: **istniejący design system** — rozszerzamy. Źródło tokenów: `src/styles/global.css` (`:root` / `.dark` → `@theme inline`), działający przełącznik jasny/ciemny. Komponenty: `src/components/ui/*` (w tym `card.tsx` z `context/archive/2026-10-07-dashboard-ui-tokens/`). Poprzedni audyt tego widoku: `context/archive/2026-10-06-reports-list-ui-tokens/` (sprzed redesignów 95f6031 i 4ba9f5a).
