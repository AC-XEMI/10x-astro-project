const MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Nieprawidłowy e-mail lub hasło",
  "Email not confirmed": "Adres e-mail nie został potwierdzony",
  "User already registered": "Użytkownik z tym adresem e-mail już istnieje",
  "Password should be at least 6 characters": "Hasło musi mieć co najmniej 6 znaków",
};

export function translateAuthError(message: string): string {
  return MESSAGES[message] ?? message;
}
