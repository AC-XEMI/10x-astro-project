---
change_id: testing-report-save-integrity
title: Testy integracyjne kompletnego i poprawnego zapisu wgranego raportu (Phase 2)
status: impl_reviewed
created: 2026-10-09
updated: 2026-10-09
archived_at: null
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Kompletny i poprawny zapis wgranego raportu". Risks covered: #3 (wgranie zapisuje raport częściowo albo kończy się „sukcesem” bez kompletnych danych), #4 (po zmianie parsera lub reguł lista pokazuje odstępstwa niezgodne z regułami), #5 (błędny lub pusty plik bez wyjaśnienia albo serwer ufa kontroli w przeglądarce). Test types planned: integration (local Supabase, run in CI — reuse the tests/integration/ harness from Phase 1, see §6.2/§6.3). Risk response intent: #3 — prove that a forced failure in the middle of the save leaves no orphaned report or visits, and that success means the full set of visits and deviations matching the file's rows; do not accept "redirect to the report page means the data is complete". #4 — prove that after uploading the fixtures the database (and the details page) holds exactly the deviations that follow from the PRD and the fixture oracle, nothing more, nothing less; do not accept "rule unit tests are enough, so save and read cannot lose the result", and never copy expected values from the rule code. #5 — prove that every malformed, empty or badly built file ends with a readable error code and that the server itself rejects what the browser rejects (size, type, missing columns); do not accept "the browser won't send it anyway", assert on the code, not the message text. After creating the folder, follow the downstream continuation rule.
