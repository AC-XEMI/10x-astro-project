---
change_id: testing-review-status
title: Test rollout Phase 3 — trwałość i zakres statusu przeglądu odstępstw
status: impl_reviewed
created: 2026-10-09
updated: 2026-10-09
archived_at: null
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md: "Status przeglądu". Risks covered: #6 (status przeglądu nie utrwala się, trafia na inne odstępstwa albo zmienia tylko część zaznaczonych bez komunikatu). Test types planned: integration (local Supabase, run in CI job `smoke` — reuse the tests/integration/ harness, see §6.2/§6.3). Risk response intent: #6 — prove that marking and un-marking survive a reload, touch only the indicated deviations, and that a partial success is reported to the user; do not accept "the UI shows the change, so it is saved"; assert on database state, not component state, and never test only a single mark. After creating the folder, follow the downstream continuation rule.
