import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { authErrorCode, authErrorUrl } from "@/lib/auth-errors";
import { setPendingSignupEmail } from "@/lib/pending-signup";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = (form.get("email") as string | null)?.trim() ?? "";
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(authErrorUrl("/auth/signup", "not_configured"));
  }
  // The activation link lands on /auth/confirm (must be on the project's redirect allow-list).
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: new URL("/auth/confirm", context.url).toString() },
  });

  if (error) {
    return context.redirect(authErrorUrl("/auth/signup", authErrorCode(error)));
  }

  setPendingSignupEmail(context.cookies, email);
  return context.redirect("/auth/confirm-email");
};
