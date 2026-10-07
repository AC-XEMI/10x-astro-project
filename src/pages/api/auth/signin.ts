import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { authErrorCode, authErrorUrl } from "@/lib/auth-errors";
import { clearPendingSignupEmail } from "@/lib/pending-signup";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = (form.get("email") as string | null)?.trim() ?? "";
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(authErrorUrl("/auth/signin", "not_configured"));
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return context.redirect(authErrorUrl("/auth/signin", authErrorCode(error.message)));
  }

  clearPendingSignupEmail(context.cookies);
  return context.redirect("/reports");
};
