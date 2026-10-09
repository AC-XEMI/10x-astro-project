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
  signup_session_expired: "Sesja rejestracji wygasła. Zarejestruj się ponownie albo zaloguj się.",
  confirmation_link_invalid:
    "Link aktywacyjny jest nieprawidłowy lub wygasł. Wyślij nowy link albo zarejestruj się ponownie.",
  not_configured: REPORT_ERROR_MESSAGES.not_configured,
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGES | "unknown";

export const GENERIC_AUTH_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";

const EXACT_CODES: Record<string, AuthErrorCode> = {
  "Invalid login credentials": "invalid_credentials",
  "Email not confirmed": "email_not_confirmed",
  "User already registered": "user_exists",
  "Email rate limit exceeded": "email_rate_limit",
};

/** Supabase messages that carry variable parts (lengths, seconds), matched by prefix. */
const PREFIX_CODES: [string, AuthErrorCode][] = [
  ["Password should", "weak_password"],
  ["For security purposes, you can only request this after", "resend_too_soon"],
];

/** Code for a Supabase auth error message; unmapped messages are logged and become "unknown". */
export function authErrorCode(supabaseMessage: string): AuthErrorCode {
  if (Object.hasOwn(EXACT_CODES, supabaseMessage)) return EXACT_CODES[supabaseMessage];
  const prefixed = PREFIX_CODES.find(([prefix]) => supabaseMessage.startsWith(prefix))?.[1];
  if (prefixed) return prefixed;
  console.error("Unmapped Supabase auth error:", supabaseMessage);
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
