import type { AstroCookies } from "astro";

/**
 * Remembers the just-registered email for the "Sprawdź skrzynkę" page and its resend button.
 * Kept in a short-lived httpOnly cookie rather than a query param, so the address doesn't end
 * up in browser history, logs or Referer headers. One cookie on path "/" because it has to
 * reach both /auth/confirm-email and /api/auth/resend-confirmation, and Astro keeps a single
 * Set-Cookie per name (two cookies of the same name on different paths overwrite each other).
 */
const COOKIE_NAME = "pending_signup_email";
const COOKIE_OPTIONS = { path: "/", httpOnly: true, sameSite: "lax", secure: import.meta.env.PROD } as const;

export function setPendingSignupEmail(cookies: AstroCookies, email: string) {
  cookies.set(COOKIE_NAME, email, { ...COOKIE_OPTIONS, maxAge: 60 * 60 });
}

export function getPendingSignupEmail(cookies: AstroCookies): string | null {
  return cookies.get(COOKIE_NAME)?.value ?? null;
}

/** Once the user signs in, the pending confirmation is over. */
export function clearPendingSignupEmail(cookies: AstroCookies) {
  if (cookies.has(COOKIE_NAME)) cookies.delete(COOKIE_NAME, { path: "/" });
}
