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
  representative_name: "Seed Rep",
  gps_enabled: true,
  visited_client: "Klient seed",
};

// One report → one visit → one unreviewed `missing_gps` deviation, inserted directly as the given
// account (under RLS, no app sign-in). `label` names the caller in the filename (`<label>-<uuid>.csv`),
// so leftover rows point at the test that seeded them. Throws on any insert error, so a failed seed
// never passes as an empty account; a report inserted before the failure is deleted first, because
// the caller never gets its id to clean up.
export async function seedAs(db: DbClient, userId: string, label: string): Promise<SeededRows> {
  const filename = `${label}-${randomUUID()}.csv`;
  const report = await db.from("reports").insert({ user_id: userId, original_filename: filename }).select().single();
  if (report.error) throw new Error(`seed: insert report as ${label} failed: ${report.error.message}`);
  const reportId = report.data.id;

  async function fail(step: string, message: string): Promise<never> {
    // Cascades to the visit; best effort - the original error is the one worth reporting.
    await db.from("reports").delete().eq("id", reportId);
    throw new Error(`seed: insert ${step} as ${label} failed: ${message}`);
  }

  const visit = await db
    .from("visits")
    .insert({ report_id: reportId, visit_date: VISIT_DATE, ...VISIT_FIELDS })
    .select()
    .single();
  if (visit.error) return fail("visit", visit.error.message);

  const deviation = await db
    .from("deviations")
    .insert({ visit_id: visit.data.id, rule: "missing_gps" })
    .select()
    .single();
  if (deviation.error) return fail("deviation", deviation.error.message);

  return { reportId, visitId: visit.data.id, deviationId: deviation.data.id, filename };
}
