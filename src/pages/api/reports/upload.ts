import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { reportErrorUrl } from "@/lib/report-errors";
import { fileExtension, logAppEvent } from "@/lib/app-events";
import { parseReportFile } from "@/lib/services/report-parser";
import { detectMissingGps, detectPhoneInsteadOfVisit, detectRouteDeviations } from "@/lib/services/deviation-rules";
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

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    logAppEvent({ event: "report.upload.failed", code: "not_configured", stage: "config" });
    return context.redirect(reportErrorUrl("not_configured"));
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  // A crafted request (non-multipart body, or report_file sent as text) gets the same refusal as a
  // missing file instead of an exception: formData() throws on a body it cannot parse.
  let file: FormDataEntryValue | null;
  try {
    file = (await context.request.formData()).get("report_file");
  } catch {
    file = null;
  }
  if (!(file instanceof File)) {
    logAppEvent({ event: "report.upload.rejected", code: "no_file", stage: "validate", userId: user.id });
    return context.redirect(reportErrorUrl("no_file"));
  }

  // Never the filename itself - it can carry a representative's or client's name.
  const fileContext = { userId: user.id, fileExt: fileExtension(file.name), fileSize: file.size };

  if (file.size > MAX_FILE_SIZE_BYTES) {
    logAppEvent({ event: "report.upload.rejected", code: "too_large", stage: "validate", ...fileContext });
    return context.redirect(reportErrorUrl("too_large"));
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    logAppEvent({ event: "report.upload.rejected", code: "bad_type", stage: "validate", ...fileContext });
    return context.redirect(reportErrorUrl("bad_type"));
  }

  const result = parseReportFile(await file.arrayBuffer(), file.name);
  if ("error" in result) {
    logAppEvent({
      event: "report.upload.rejected",
      code: "invalid_file",
      stage: "parse",
      detail: result.error,
      ...fileContext,
    });
    // Parser messages are our own Polish, row-specific text - passed as detail for the upload card.
    return context.redirect(reportErrorUrl("invalid_file", result.error));
  }

  const { rows } = result;
  const uploadContext = { ...fileContext, rowCount: rows.length };

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
    logAppEvent({
      event: "report.upload.failed",
      code: "upload_failed",
      stage: "insert_report",
      dbError: reportError,
      ...uploadContext,
    });
    return context.redirect(reportErrorUrl("upload_failed"));
  }

  const reportContext = { ...uploadContext, reportId: report.id };

  // Compensating rollback for a half-written report. Its own failure is logged separately: it
  // leaves an orphaned report (with zero or under-reported visits) that nothing else would surface.
  const rollbackReport = async () => {
    const { error: rollbackError } = await supabase.from("reports").delete().eq("id", report.id);
    if (rollbackError) {
      logAppEvent({
        event: "report.upload.rollback_failed",
        stage: "rollback",
        dbError: rollbackError,
        ...reportContext,
      });
    }
  };

  const visitsToInsert: TablesInsert<"visits">[] = rows.map((row) => ({
    ...row,
    report_id: report.id,
  }));

  const { data: insertedVisits, error: visitsError } = await supabase.from("visits").insert(visitsToInsert).select();

  if (visitsError) {
    logAppEvent({
      event: "report.upload.failed",
      code: "upload_failed",
      stage: "insert_visits",
      dbError: visitsError,
      ...reportContext,
    });
    // Compensating rollback: report is already committed at this point but would be
    // permanently orphaned with zero visits — mirrors the deviationsError branch below.
    await rollbackReport();
    return context.redirect(reportErrorUrl("upload_failed"));
  }

  const perVisitDeviations: TablesInsert<"deviations">[] = insertedVisits.flatMap((visit) => {
    const entries: TablesInsert<"deviations">[] = [];

    const missingGpsRule = detectMissingGps(visit);
    if (missingGpsRule) {
      entries.push({ visit_id: visit.id, rule: missingGpsRule });
    }

    const phoneInsteadOfVisit = detectPhoneInsteadOfVisit(visit);
    if (phoneInsteadOfVisit) {
      entries.push({ visit_id: visit.id, rule: "phone_instead_of_visit", detail: phoneInsteadOfVisit.detail });
    }

    return entries;
  });

  const routeDeviations: TablesInsert<"deviations">[] = detectRouteDeviations(insertedVisits).map((flag) => ({
    visit_id: flag.visit_id,
    rule: "route_deviation" as const,
    detail: flag.detail,
  }));

  const deviationsToInsert: TablesInsert<"deviations">[] = [...perVisitDeviations, ...routeDeviations];

  if (deviationsToInsert.length > 0) {
    const { error: deviationsError } = await supabase.from("deviations").insert(deviationsToInsert);
    if (deviationsError) {
      logAppEvent({
        event: "report.upload.failed",
        code: "upload_failed",
        stage: "insert_deviations",
        dbError: deviationsError,
        ...reportContext,
      });
      // Compensating rollback: visits are already committed at this point, but without
      // their deviations they'd be silently and permanently under-reported as compliant.
      // report_id has ON DELETE CASCADE, so deleting the report also removes its visits.
      await rollbackReport();
      return context.redirect(reportErrorUrl("upload_failed"));
    }
  }

  // Denormalized count for the reports list. Not worth rolling back over: the visits and
  // deviations are complete, and a null count only renders as "—" in the list.
  const { error: countError } = await supabase
    .from("reports")
    .update({ deviation_count: deviationsToInsert.length })
    .eq("id", report.id);
  if (countError) {
    logAppEvent({ event: "report.upload.count_failed", stage: "store_count", dbError: countError, ...reportContext });
  }

  return context.redirect(`/reports/${report.id}`);
};
