---
change_id: testing-data-isolation-access
title: Izolacja danych i dostęp w CI — testy integracyjne (rollout Phase 1)
status: archived
created: 2026-10-08
updated: 2026-10-09
archived_at: 2026-10-09T05:05:37Z
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Izolacja danych i dostęp w CI". Risks covered: #1 (kierownik widzi, oznacza lub usuwa dane innego kierownika — IDOR/RLS), #2 (niezalogowany dostęp do chronionej strony lub API, sesja po wylogowaniu). Test types planned: integration (local Supabase, run in CI). Risk response intent: #1 — prove that user B gets "not found"/denial for every read and every operation on user A's reports, visits and deviations (pages, API with a foreign id, direct queries) while A's data stays untouched; do not accept "RLS policies exist, so they isolate". #2 — prove that without a session every protected page redirects to sign-in and every protected API refuses, and that a signed-out session unlocks nothing; do not accept "smoke signs in, so route protection works". After creating the folder, follow the downstream continuation rule.
