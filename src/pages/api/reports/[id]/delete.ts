import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { reportErrorUrl } from "@/lib/report-errors";
import { logAppEvent } from "@/lib/app-events";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    logAppEvent({ event: "report.delete.failed", code: "not_configured", stage: "config" });
    return context.redirect(reportErrorUrl("not_configured"));
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const { id } = context.params;
  const formData = await context.request.formData();
  const page = formData.get("page");
  const pageParam = typeof page === "string" && page ? `&page=${encodeURIComponent(page)}` : "";

  const { data, error } = await supabase
    .from("reports")
    .delete()
    .eq("id", id ?? "")
    .select();

  if (error) {
    logAppEvent({
      event: "report.delete.failed",
      code: "delete_failed",
      stage: "delete",
      userId: user.id,
      reportId: id,
      dbError: error,
    });
    return context.redirect(reportErrorUrl("delete_failed"));
  }

  if (data.length === 0) {
    logAppEvent({
      event: "report.delete.rejected",
      code: "report_not_found",
      stage: "delete",
      userId: user.id,
      reportId: id,
    });
    return context.redirect(reportErrorUrl("report_not_found"));
  }

  return context.redirect(`/reports?deleted=1${pageParam}`);
};
