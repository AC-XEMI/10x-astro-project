import { randomUUID } from "node:crypto";
import type { DbClient } from "./db";

export interface SeededRows {
  reportId: string;
  visitId: string;
  deviationId: string;
  filename: string;
}

export const VISIT_DATE = "2026-09-01T00:00:00Z";
export const VISIT_FIELDS = {
  representative_name: "RLS Isolation Rep",
  gps_enabled: true,
  visited_client: "Klient RLS",
};

// One report → one visit → one unreviewed `missing_gps` deviation, inserted directly as the given
// account (under RLS, no app sign-in). Throws on any insert error, so a failed seed never passes as
// an empty account.
export async function seedAs(db: DbClient, userId: string, label: string): Promise<SeededRows> {
  const filename = `rls-isolation-${label}-${randomUUID()}.csv`;
  const report = await db.from("reports").insert({ user_id: userId, original_filename: filename }).select().single();
  if (report.error) throw new Error(`seed: insert report as ${label} failed: ${report.error.message}`);

  const visit = await db
    .from("visits")
    .insert({ report_id: report.data.id, visit_date: VISIT_DATE, ...VISIT_FIELDS })
    .select()
    .single();
  if (visit.error) throw new Error(`seed: insert visit as ${label} failed: ${visit.error.message}`);

  const deviation = await db
    .from("deviations")
    .insert({ visit_id: visit.data.id, rule: "missing_gps" })
    .select()
    .single();
  if (deviation.error) throw new Error(`seed: insert deviation as ${label} failed: ${deviation.error.message}`);

  return { reportId: report.data.id, visitId: visit.data.id, deviationId: deviation.data.id, filename };
}
