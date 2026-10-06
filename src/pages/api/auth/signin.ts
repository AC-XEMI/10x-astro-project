import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { translateAuthError } from "@/lib/auth-errors";
import { clearPendingSignupEmail } from "@/lib/pending-signup";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = (form.get("email") as string | null)?.trim() ?? "";
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  clearPendingSignupEmail(context.cookies);
  return context.redirect("/reports");
};
