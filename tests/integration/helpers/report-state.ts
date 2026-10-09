import type { Enums } from "@/types";
import type { DbClient } from "./db";

export type ReviewStatus = Enums<"deviation_review_status">;

export interface DeviationState {
  id: string;
  visit_id: string;
  visited_client: string | null;
  rule: Enums<"deviation_rule">;
  status: ReviewStatus;
  reviewed_at: string | null;
}

function byId(a: DeviationState, b: DeviationState): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Every deviation of the report as the report details page sees it after a reload: verbatim the
// query of src/pages/reports/[id].astro, flattened and sorted by id so two reads compare with
// toEqual. Throws on a query error, so a failed read never passes as an empty report.
export async function reportDeviationState(db: DbClient, reportId: string): Promise<DeviationState[]> {
  const { data, error } = await db.from("visits").select("*, deviations(*)").eq("report_id", reportId);
  if (error) throw new Error(`Reading report ${reportId} failed: ${error.message}`);

  return data
    .flatMap((visit) =>
      visit.deviations.map((d): DeviationState => ({
        id: d.id,
        visit_id: d.visit_id,
        visited_client: visit.visited_client,
        rule: d.rule,
        status: d.status,
        reviewed_at: d.reviewed_at,
      })),
    )
    .sort(byId);
}
