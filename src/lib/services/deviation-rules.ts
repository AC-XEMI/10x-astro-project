import type { Database } from "@/types";
import type { ExtractedVisit } from "@/lib/services/report-parser";

export type DeviationRule = Database["public"]["Enums"]["deviation_rule"];

/**
 * FR-004: a visit is flagged as a deviation when GPS was not enabled during the visit.
 * Deliberately separate from report-parser.ts so future rules (route deviation,
 * phone-instead-of-visit — out of scope here) can be added without touching parsing.
 */
export function detectMissingGps(visit: ExtractedVisit): DeviationRule | null {
  return !visit.gps_enabled ? "missing_gps" : null;
}
