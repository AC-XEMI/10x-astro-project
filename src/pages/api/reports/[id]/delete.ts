import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/reports?error=${encodeURIComponent("Supabase is not configured")}`);
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
    return context.redirect(`/reports?error=${encodeURIComponent(error.message)}`);
  }

  if (data.length === 0) {
    return context.redirect(`/reports?error=${encodeURIComponent("Nie znaleziono raportu lub brak uprawnień.")}`);
  }

  return context.redirect(`/reports?deleted=1${pageParam}`);
};
