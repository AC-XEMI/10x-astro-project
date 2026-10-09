// Expected rules per visit of test-data/sample-report.{csv,xlsx}, typed in by hand: the oracle in
// src/lib/services/deviation-rules.test.ts:55-110 (row indexes) joined with the fixture's
// visited_client column (research #4, testing-report-save-integrity). Never compute it with the
// rule functions or from the fixture — the point is to catch the stored result drifting from it.
// Lists are sorted; an empty list means "no deviation", asserted, not skipped.
export const EXPECTED_RULES_BY_CLIENT: Record<string, string[]> = {
  "Klient A": [],
  "Klient C": ["missing_gps"],
  "Klient D": [],
  "Klient F": ["missing_gps", "phone_instead_of_visit"],
  "Klient Z": ["route_deviation"],
  "Klient P": [],
  "Klient Q": ["route_deviation"],
  "Klient R": [],
  "Klient S": ["missing_gps", "route_deviation"],
  "Klient T1": ["phone_instead_of_visit"],
  "Klient T2": ["missing_gps", "phone_instead_of_visit"],
  "Klient T3": ["missing_gps", "phone_instead_of_visit"],
  "Klient T4": ["missing_gps", "phone_instead_of_visit"],
  "Klient T5": [],
  "Klient T6": ["missing_gps"],
};

export interface VisitWithDeviations {
  visited_client: string | null;
  deviations: { rule: string }[];
}

// Sorted rules per visited client, built from the result of the report details query
// (`visits.select("*, deviations(*)")`). Callers check client uniqueness first: a duplicate
// client would silently overwrite an entry here.
export function rulesByClient(visits: VisitWithDeviations[]): Record<string, string[]> {
  return Object.fromEntries(
    visits.map((v): [string, string[]] => [String(v.visited_client), v.deviations.map((d) => d.rule).sort()]),
  );
}
