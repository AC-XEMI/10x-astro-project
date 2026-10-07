---
change_id: ui-leftovers
title: UI leftovers - Banner to Alert, report details polish
status: archived
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07T20:01:39Z
---

## Notes

Lekki obieg (bez /10x-research i wywiadu /10x-plan, decyzja użytkownika 2026-10-07). Zakres:

1. Ostatnie in-page `Banner` → `Alert`: `src/components/dashboard/DashboardView.astro:131` (błąd ładowania pulpitu), `src/pages/auth/confirm-email.astro:52-53` (ponowne wysłanie linku, błąd). `Banner` w `Layout.astro` (pasek konfiguracji) zostaje – to full-bleed strip.
2. Szczegóły raportu (`DeviationsList.tsx`), pozostałości z `context/archive/2026-10-07-report-details-ui-contract/`: nagłówek grupy ściska się na 390px przy krótkim nazwisku; „0 z odstępstwami” jest czerwone przy zerze.

Treści komunikatów bez zmian (reguła Claude Design).
