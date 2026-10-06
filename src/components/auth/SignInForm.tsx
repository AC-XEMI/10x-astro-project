import React, { useState } from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { usePendingSubmit } from "@/hooks/usePendingSubmit";
import { validateEmail } from "@/lib/auth-validation";

interface Props {
  serverError?: string | null;
}

export default function SignInForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  // The server error outlines both fields until the user starts correcting them.
  const [edited, setEdited] = useState(false);
  const [pending, setPending] = usePendingSubmit();

  function validate() {
    const next: typeof errors = {};
    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;
    // No policy check on sign-in: accounts created under an older, shorter policy must still log in.
    if (!password) next.password = "Wpisz hasło";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    setEdited(true);
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (pending || !validate()) {
      e.preventDefault();
      return;
    }
    setPending(true);
  }

  const invalid = Boolean(serverError) && !edited;

  return (
    <form method="POST" action="/api/auth/signin" className="space-y-6" onSubmit={handleSubmit} noValidate>
      <ServerError message={serverError} />

      <div className="space-y-4">
        <FormField
          id="email"
          type="email"
          label="Email"
          autoComplete="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            clearError("email");
          }}
          placeholder="jan.kowalski@firma.pl"
          error={errors.email}
          invalid={invalid}
          busy={pending}
          icon={<Mail />}
        />

        <FormField
          id="password"
          label="Hasło"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            clearError("password");
          }}
          placeholder="Twoje hasło"
          error={errors.password}
          invalid={invalid}
          busy={pending}
          icon={<Lock />}
          endContent={
            <PasswordToggle
              visible={showPassword}
              disabled={pending}
              onToggle={() => {
                setShowPassword(!showPassword);
              }}
            />
          }
        />
      </div>

      <SubmitButton pending={pending} pendingText="Logowanie…" icon={<LogIn />}>
        Zaloguj się
      </SubmitButton>
    </form>
  );
}
