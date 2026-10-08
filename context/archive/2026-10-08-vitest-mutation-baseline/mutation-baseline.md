# Mutation baseline — `vitest-mutation-baseline`

Stryker 10.0.0 + `@stryker-mutator/vitest-runner` 10.0.0, Vitest 4.1.10, `coverageAnalysis: perTest`,
`mutate`: `report-parser.ts`, `deviation-rules.ts`, `geo.ts` (410 mutants). Run with
`npm run test:mutation`; HTML report in `reports/mutation/mutation.html`.

## Scores

| File                 | Baseline (end of Phase 2) | After static fix | After strengthening round |
| -------------------- | ------------------------- | ---------------- | ------------------------- |
| `deviation-rules.ts` | 83.72                     | 93.02            | **96.12**                 |
| `geo.ts`             | 92.86                     | 92.86            | **100.00**                |
| `report-parser.ts`   | 43.82                     | 77.15            | **84.27**                 |
| **All files**        | **58.05**                 | **82.68**        | **88.54**                 |

| Counts        | Baseline | After static fix | After round |
| ------------- | -------- | ---------------- | ----------- |
| Killed        | 238      | 339              | 363         |
| Survived      | 153      | 52               | 29          |
| No coverage   | 19       | 19               | 18          |
| Timeout/error | 0        | 0                | 0           |
| Tests         | 86       | 86               | 98          |

## What moved the score

1. **Static fix (58 → 83, no new assertions).** Both suites called `parseReportFile` / the rules
   inside `describe.each` bodies, i.e. while Vitest collects tests. Stryker marks mutants hit there
   as *static* and, with this runner, never activates them — 101 mutants "survived" although the
   tests did catch them (a hand-applied mutation went red). Every production call now happens
   inside `it()`; a comment at the top of each fixture block says why.
2. **Strengthening round (83 → 88.5), tests only:**
   - parser: a date that matches the shape but is no date (`2026-13-01`, Invalid Date path); each
     required column missing on its own (4 cases, message names exactly that column); duplicated
     header (first column wins); empty header column left out of `raw_data`; cell whitespace
     trimmed; longitude-only coordinates dropped.
   - rules: a visit with only latitude or only longitude never becomes the reference point;
     `visited_client: null` with a planned route is not "poza zaplanowaną trasą".
   - geo: a quarter of the equator (short hops cannot tell `sqrt(1 - h)` from `sqrt(1 + h)`).

No production code changed; no bug was found.

## Remaining survivors — deliberately not killed (47)

All are equivalent mutants (no input can tell them apart from the original) or unreachable
defensive code. None is a message-text survivor.

### `report-parser.ts` (42)

| Lines | Mutants | Why it cannot be killed |
| ----- | ------- | ----------------------- |
| 29–33 (`toDisplayString`) | 18 (13 no-cov, 5 survived) | `sheet_to_json` runs with `raw: false, defval: ""`, so every cell is already a string: the number/boolean/Date branches are unreachable and the null/undefined guard returns the same `""` as the fall-through. |
| 46 (`rawValue.trim()` removed) | 1 | `cellToText` already trimmed the value. |
| 54 (date regex skipped / anchors removed) | 3 | Anything the regex would reject is rejected later by the Invalid-Date or round-trip check. |
| 68 (no-dot filename) | 2 | Without a dot the extension can never be `.csv`/`.xlsx`, whatever placeholder replaces it. |
| 76 (`{ type: "array" }` dropped) | 2 | SheetJS detects an `ArrayBuffer` on its own. |
| 86–87 (`!sheet`) | 4 (3 no-cov, 1 survived) | `XLSX.read` always yields at least one sheet; unreachable. |
| 104, 151 (`?? []`) | 2 (no-cov) | Index guards for `noUncheckedIndexedAccess`; the indexes are always in range. |
| 174–194 (`…Index !== undefined` forced true) | 8 | Reading a missing column gives `""`, which maps to the same `null` as the skipped branch. |
| 206 (`__proto__` guard) | 2 | Assigning a string to `__proto__` is a no-op, so dropping the guard changes nothing observable. |

### `deviation-rules.ts` (5)

| Line | Mutant | Why it cannot be killed |
| ---- | ------ | ----------------------- |
| 30 | `?? ""` → another string | Any default other than "telefon"/"wizyta" takes the same heuristic path. |
| 40 | `time === null` dropped | In JS `null <= 0` is `true`, so the second clause covers it. |
| 116 | `distance_km !== null` forced true | `null > x` is always `false`. |
| 116 | `distance_km > 0` forced true / `>= 0` | A distance ≤ 0 can never exceed `straight line × 1.5 ≥ 0`. |
