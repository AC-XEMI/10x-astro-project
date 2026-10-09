import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { logAppEvent } from "@/lib/app-events";
import { authErrorUrl } from "@/lib/auth-errors";
import { clearPendingSignupEmail, getPendingSignupEmail } from "@/lib/pending-signup";

export const prerender = false;

/**
 * Target of the activation link in the signup email. Two link shapes reach it:
 * - `?token_hash=…&type=signup|email` from the template in supabase/templates/confirmation.html
 *   (works on any device - no cookie from the signup request is needed),
 * - `?code=…` from Supabase's default template via /auth/v1/verify (PKCE: only in the browser that
 *   signed up, since the code verifier lives in that browser's cookie).
 * On success the user is confirmed and signed in; any failure (expired, reused or forged link)
 * becomes one code, never Supabase's message.
 */
export const GET: APIRoute = async (context) => {
  const params = context.url.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(authErrorUrl("/auth/signin", "not_configured"));
  }

  let error: { code?: string } | null = { code: "missing_params" };
  if (tokenHash && (type === "signup" || type === "email")) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  }

  if (error) {
    logAppEvent({ event: "auth.confirm.failed", code: "confirmation_link_invalid", stage: "confirm", dbError: error });
    // With the signup cookie still present the confirm-email page offers "Wyślij link ponownie".
    const back = getPendingSignupEmail(context.cookies) ? "/auth/confirm-email" : "/auth/signin";
    return context.redirect(authErrorUrl(back, "confirmation_link_invalid"));
  }

  clearPendingSignupEmail(context.cookies);
  return context.redirect("/reports");
};
