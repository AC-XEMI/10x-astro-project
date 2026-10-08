---
change_id: vitest-mutation-baseline
title: Vitest setup and first unit tests as a baseline for mutation testing
status: impl_reviewed
created: 2026-10-08
updated: 2026-10-08
archived_at: null
---

## Notes

Dodać vitest jako bezpośrednią devDependency z vitest.config.ts (alias @/ → ./src), napisać pierwsze testy jednostkowe dla report-parser.ts i deviation-rules.ts (na fixture'ach z verify:report-detection), zawęzić mutate w stryker.config.json do plików pokrytych testami i uzyskać pierwszy działający przebieg npx stryker run.
