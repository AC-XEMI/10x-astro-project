import type { APIRoute } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { parseReportFile } from "@/lib/services/report-parser";
import { detectMissingGps } from "@/lib/services/deviation-rules";
import type { Database, TablesInsert } from "@/types";

// 5 MB, enforced on file.size before the file is read into memory as an ArrayBuffer.
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const POST: APIRoute = async (context) => {
  // createClient() is not parameterized with Database in src/lib/supabase.ts (out of this phase's
  // file scope), so .from() would otherwise resolve to `any`; cast locally to get typed queries.
  const supabase = createClient(context.request.headers, context.cookies) as SupabaseClient<Database> | null;
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
    return context.redirect(`/reports?error=${encodeURIComponent(visitsError.message)}`);
  }

  const deviationsToInsert: TablesInsert<"deviations">[] = insertedVisits.flatMap((visit) => {
    const rule = detectMissingGps(visit);
    return rule ? [{ visit_id: visit.id, rule }] : [];
  });

  if (deviationsToInsert.length > 0) {
    const { error: deviationsError } = await supabase.from("deviations").insert(deviationsToInsert);
    if (deviationsError) {
      return context.redirect(`/reports?error=${encodeURIComponent(deviationsError.message)}`);
    }
  }

  return context.redirect(`/reports/${report.id}`);
};
