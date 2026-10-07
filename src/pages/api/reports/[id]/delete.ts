import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { reportErrorUrl } from "@/lib/report-errors";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
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
    console.error("Failed to delete report:", error);
    return context.redirect(reportErrorUrl("delete_failed"));
  }

  if (data.length === 0) {
    return context.redirect(reportErrorUrl("report_not_found"));
  }

  return context.redirect(`/reports?deleted=1${pageParam}`);
};
