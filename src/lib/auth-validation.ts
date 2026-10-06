/**
 * Client-side mirror of the Supabase password policy in supabase/config.toml
 * (minimum_password_length = 8, password_requirements = "letters_digits"). Supabase stays the
 * authority - these checks only give instant feedback. "letters_digits" counts ASCII letters
 * only, so Polish diacritics alone don't satisfy the letter requirement.
 * A hosted Supabase project needs the same settings in its dashboard (Auth -> Policies).
 */
export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_HINT = `Co najmniej ${MIN_PASSWORD_LENGTH} znaków, w tym litera i cyfra.`;

function charsWord(n: number) {
  if (n === 1) return "znak";
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? "znaki" : "znaków";
}

/** Returns the first rule the password breaks, or null when it satisfies the policy. */
export function validatePassword(password: string): string | null {
  if (!password) return "Wpisz hasło";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Hasło jest za krótkie: ma ${password.length} ${charsWord(password.length)}, a potrzeba co najmniej ${MIN_PASSWORD_LENGTH}.`;
  }
  if (!/[0-9]/.test(password)) return "Hasło musi zawierać co najmniej jedną cyfrę.";
  if (!/[A-Za-z]/.test(password)) return "Hasło musi zawierać co najmniej jedną literę (a–z).";
  return null;
}

/** Simple shape check (something@domain.tld) - the server decides whether the address is real. */
export function validateEmail(email: string): string | null {
  if (!email.trim()) return "Wpisz adres email";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Wpisz pełny adres email, np. jan.kowalski@firma.pl";
  }
  return null;
}
