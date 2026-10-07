---
change_id: report-details-ui-contract
title: Report details ui contract
status: implementing
created: 2026-10-07
updated: 2026-10-07
archived_at: null
---

## Notes

Audyt `/10x-ui` widoku **Szczegóły raportu**: `src/pages/reports/[id].astro` + `src/components/reports/DeviationsList.tsx` (strona i jej wyspa React to jeden widok).

Wariant kontraktu: **istniejący design system** — rozszerzamy. Źródło tokenów: `src/styles/global.css` (`:root` / `.dark` → `@theme inline`, w tym `--rule-*` dla serii reguł). Komponenty: `src/components/ui/*` (`button`, `card`, `alert`, `table`, `dialog`). Widok pochodzi z Claude Design („Szczegóły raportu”): style i logika wyświetlania mogą się zmieniać, treść (komunikaty, etykiety, podpowiedzi) zostaje słowo w słowo.

Wstępny skan (2026-10-07): 0 literałów kolorów / klas palety; 58 użyć tokenów (56 w DeviationsList, 2 w stronie); arbitralne: kolumny `w-[110/150/200/230px]`, siatki `grid-cols-[300px_minmax(0,1fr)]`, `grid-cols-[1.2fr_repeat(3,1fr)_1.3fr]`, `transition-[width]`, `max-w-[1100px]`; `bg-primary/10` (status sprawdzone); 7 ręcznych kontenerów `bg-card rounded-lg border` zamiast `Card`; 2 natywne `<select>` (`SELECT_CLASS`); `Banner` dla „Nie znaleziono raportu.”; liczniki reguł bez `--rule-*`; ręczne formatowanie daty `getHours()` (`DeviationsList.tsx:96`); brak kitchen sinka i brak w `check:ui-tokens`.
