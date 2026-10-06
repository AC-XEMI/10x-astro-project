const MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Nieprawidłowy email lub hasło. Sprawdź dane i spróbuj ponownie.",
  "Email not confirmed": "Adres email nie został potwierdzony. Kliknij link z wiadomości aktywacyjnej.",
  "User already registered": "Konto z tym adresem email już istnieje. Zaloguj się.",
  "Email rate limit exceeded": "Wysłano zbyt wiele wiadomości. Spróbuj ponownie później.",
};

/** Supabase messages that carry variable parts (lengths, seconds), matched by prefix. */
const PREFIX_MESSAGES: [string, string][] = [
  ["Password should", "Hasło jest za słabe: potrzeba co najmniej 8 znaków, w tym litery i cyfry."],
  ["For security purposes, you can only request this after", "Odczekaj chwilę przed ponownym wysłaniem linku."],
];

export function translateAuthError(message: string): string {
  if (Object.hasOwn(MESSAGES, message)) return MESSAGES[message];
  return PREFIX_MESSAGES.find(([prefix]) => message.startsWith(prefix))?.[1] ?? message;
}
