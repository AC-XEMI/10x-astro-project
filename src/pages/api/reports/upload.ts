import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { parseReportFile } from "@/lib/services/report-parser";
import { detectMissingGps, detectRouteDeviations } from "@/lib/services/deviation-rules";
import type { TablesInsert } from "@/types";

// 5 MB, enforced on file.size before the file is read into memory as an ArrayBuffer.
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Browsers report inconsistent (or empty) MIME types for .csv in particular, so this is a
// coarse belt-and-suspenders check alongside the extension check in report-parser.ts, not
// the sole gate — an empty file.type is allowed rather than rejected.
const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/reports?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const file = (await context.request.formData()).get("report_file") as File | null;
  if (!file) {
    return context.redirect(`/reports?error=${encodeURIComponent("Nie wybrano pliku do wgrania.")}`);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return context.redirect(`/reports?error=${encodeURIComponent("Plik przekracza limit 5 MB.")}`);
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return context.redirect(`/reports?error=${encodeURIComponent("Nieobsługiwany typ pliku.")}`);
  }

  const result = parseReportFile(await file.arrayBuffer(), file.name);
  if ("error" in result) {
    return context.redirect(`/reports?error=${encodeURIComponent(result.error)}`);
  }

  const { rows } = result;

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      user_id: user.id,
      original_filename: file.name,
      row_count: rows.length,
    })
    .select()
    .single();

  if (reportError) {
    return context.redirect(`/reports?error=${encodeURIComponent(reportError.message)}`);
  }

  const visitsToInsert: TablesInsert<"visits">[] = rows.map((row) => ({
    ...row,
    report_id: report.id,
  }));

  const { data: insertedVisits, error: visitsError } = await supabase.from("visits").insert(visitsToInsert).select();

  if (visitsError) {
    // Compensating rollback: report is already committed at this point but would be
    // permanently orphaned with zero visits — mirrors the deviationsError branch below.
    await supabase.from("reports").delete().eq("id", report.id);
    return context.redirect(`/reports?error=${encodeURIComponent(visitsError.message)}`);
  }

  const missingGpsDeviations: TablesInsert<"deviations">[] = insertedVisits.flatMap((visit) => {
    const rule = detectMissingGps(visit);
    return rule ? [{ visit_id: visit.id, rule }] : [];
  });

  const routeDeviations: TablesInsert<"deviations">[] = detectRouteDeviations(insertedVisits).map((flag) => ({
    visit_id: flag.visit_id,
    rule: "route_deviation" as const,
    detail: flag.detail,
  }));

  const deviationsToInsert: TablesInsert<"deviations">[] = [...missingGpsDeviations, ...routeDeviations];

  if (deviationsToInsert.length > 0) {
    const { error: deviationsError } = await supabase.from("deviations").insert(deviationsToInsert);
    if (deviationsError) {
      // Compensating rollback: visits are already committed at this point, but without
      // their deviations they'd be silently and permanently under-reported as compliant.
      // report_id has ON DELETE CASCADE, so deleting the report also removes its visits.
      await supabase.from("reports").delete().eq("id", report.id);
      return context.redirect(`/reports?error=${encodeURIComponent(deviationsError.message)}`);
    }
  }

  return context.redirect(`/reports/${report.id}`);
};
