import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { translateAuthError } from "@/lib/auth-errors";
import { setPendingSignupEmail } from "@/lib/pending-signup";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = (form.get("email") as string | null)?.trim() ?? "";
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  setPendingSignupEmail(context.cookies, email);
  return context.redirect("/auth/confirm-email");
};
