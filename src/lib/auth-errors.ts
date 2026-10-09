import { REPORT_ERROR_MESSAGES } from "@/lib/report-errors";

/**
 * Auth failures travel to /auth/{signin,signup,confirm-email} as a code in `?error=`, never as free
 * text: the page renders only the message mapped here, so neither a raw Supabase message nor text
 * from a crafted link reaches the user (same contract as report-errors.ts).
 */
export const AUTH_ERROR_MESSAGES = {
  invalid_credentials: "Nieprawidłowy email lub hasło. Sprawdź dane i spróbuj ponownie.",
  email_not_confirmed: "Adres email nie został potwierdzony. Kliknij link z wiadomości aktywacyjnej.",
  user_exists: "Konto z tym adresem email już istnieje. Zaloguj się.",
  email_rate_limit: "Wysłano zbyt wiele wiadomości. Spróbuj ponownie później.",
  weak_password: "Hasło jest za słabe: potrzeba co najmniej 8 znaków, w tym litery i cyfry.",
  resend_too_soon: "Odczekaj chwilę przed ponownym wysłaniem linku.",
  email_send_failed: "Nie udało się wysłać wiadomości aktywacyjnej. Spróbuj ponownie później.",
  signup_session_expired: "Sesja rejestracji wygasła. Zarejestruj się ponownie albo zaloguj się.",
  confirmation_link_invalid:
    "Link aktywacyjny jest nieprawidłowy lub wygasł. Wyślij nowy link albo zarejestruj się ponownie.",
  not_configured: REPORT_ERROR_MESSAGES.not_configured,
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGES | "unknown";

export const GENERIC_AUTH_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";

/**
 * Supabase `error.code` -> app code. Preferred over the message: the hosted project and the local
 * CLI word some messages differently (hosted sends "email rate limit exceeded" in lower case).
 */
const SUPABASE_CODES: Record<string, AuthErrorCode> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  user_already_exists: "user_exists",
  email_exists: "user_exists",
  over_email_send_rate_limit: "email_rate_limit",
  weak_password: "weak_password",
  email_address_not_authorized: "email_send_failed",
};

/** Fallback for errors without a code, compared case-insensitively. */
const EXACT_MESSAGES: Record<string, AuthErrorCode> = {
  "invalid login credentials": "invalid_credentials",
  "email not confirmed": "email_not_confirmed",
  "user already registered": "user_exists",
  "email rate limit exceeded": "email_rate_limit",
  "error sending confirmation email": "email_send_failed",
};

/**
 * Messages that carry variable parts (lengths, seconds), matched by lower-cased prefix. Checked
 * before the code: the resend cooldown shares `over_email_send_rate_limit` with the hourly limit.
 */
const PREFIX_MESSAGES: [string, AuthErrorCode][] = [
  ["password should", "weak_password"],
  ["for security purposes, you can only request this after", "resend_too_soon"],
];

/** App code for a Supabase auth error; unmapped errors are logged and become "unknown". */
export function authErrorCode(error: { message: string; code?: string }): AuthErrorCode {
  const message = error.message.toLowerCase();
  const prefixed = PREFIX_MESSAGES.find(([prefix]) => message.startsWith(prefix))?.[1];
  if (prefixed) return prefixed;
  if (error.code && Object.hasOwn(SUPABASE_CODES, error.code)) return SUPABASE_CODES[error.code];
  if (Object.hasOwn(EXACT_MESSAGES, message)) return EXACT_MESSAGES[message];
  console.error("Unmapped Supabase auth error:", error.code, error.message);
  return "unknown";
}

/** Message for a `?error=` value: null when absent, the generic message for anything not a known code. */
export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return Object.hasOwn(AUTH_ERROR_MESSAGES, code)
    ? AUTH_ERROR_MESSAGES[code as keyof typeof AUTH_ERROR_MESSAGES]
    : GENERIC_AUTH_ERROR;
}

export function authErrorUrl(path: "/auth/signin" | "/auth/signup" | "/auth/confirm-email", code: AuthErrorCode) {
  return `${path}?${new URLSearchParams({ error: code }).toString()}`;
}
