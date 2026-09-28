---
change_id: missing-gps-deviation-detection
title: Wykrywanie braku GPS w wgranym raporcie (gwiazda przewodnia)
status: implemented
created: 2026-09-28
updated: 2026-09-28
archived_at: null
---

## Notes

Roadmap ID: S-01 (`context/foundation/roadmap.md`). GitHub issue: [#2](https://github.com/AC-XEMI/10x-astro-project/issues/2).
Prerequisite: F-01 (report-data-schema) — done, archived at `context/archive/2026-09-25-report-data-schema/`.

Gwiazda przewodnia (north star): najmniejszy pełny przepływ (login → upload →
ekstrakcja → zapis → detekcja → lista → szczegóły), który dowodzi, że cała
koncepcja narzędzia działa. Kierownik wgrywa raport i w ciągu kilku sekund
widzi wizyty bez włączonego GPS oznaczone jako odstępstwo; po kliknięciu
widzi pełny kontekst wizyty (data, przedstawiciel, dane z raportu).

PRD refs: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, US-01.
