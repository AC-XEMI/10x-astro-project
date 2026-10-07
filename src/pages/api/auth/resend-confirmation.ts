import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { authErrorCode, authErrorUrl } from "@/lib/auth-errors";
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
    return context.redirect(authErrorUrl("/auth/confirm-email", "signup_session_expired"));
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(authErrorUrl("/auth/confirm-email", "not_configured"));
  }

  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) {
    return context.redirect(authErrorUrl("/auth/confirm-email", authErrorCode(error.message)));
  }

  return context.redirect("/auth/confirm-email?resent=1");
};
