import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { translateAuthError } from "@/lib/auth-errors";
import { getPendingSignupEmail } from "@/lib/pending-signup";

export const prerender = false;

/**
 * Re-sends the signup confirmation link. The address comes only from the cookie set by
 * /api/auth/signup - never from the request body - so this can't be used to send mail to
 * arbitrary addresses. Supabase applies its own per-address rate limit on top.
 */
export const POST: APIRoute = async (context) => {
  const email = getPendingSignupEmail(context.cookies);
  if (!email) {
    return context.redirect(
      `/auth/confirm-email?error=${encodeURIComponent("Sesja rejestracji wygasła. Zarejestruj się ponownie albo zaloguj się.")}`,
    );
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/confirm-email?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) {
    return context.redirect(`/auth/confirm-email?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  return context.redirect("/auth/confirm-email?resent=1");
};
