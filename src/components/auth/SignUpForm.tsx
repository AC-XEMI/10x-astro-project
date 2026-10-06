import React, { useState } from "react";
import { Mail, Lock, UserPlus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { usePendingSubmit } from "@/hooks/usePendingSubmit";
import { PASSWORD_HINT, validateEmail, validatePassword } from "@/lib/auth-validation";

interface Props {
  serverError?: string | null;
}

export default function SignUpForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [pending, setPending] = usePendingSubmit();

  function validate() {
    const next: typeof errors = {};
    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;
    const passwordError = validatePassword(password);
    if (passwordError) next.password = passwordError;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (pending || !validate()) {
      e.preventDefault();
      return;
    }
    setPending(true);
  }

  return (
    <form method="POST" action="/api/auth/signup" className="space-y-6" onSubmit={handleSubmit} noValidate>
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
          busy={pending}
          icon={<Mail />}
        />

        <FormField
          id="password"
          label="Hasło"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            clearError("password");
          }}
          placeholder="Twoje hasło"
          error={errors.password}
          hint={PASSWORD_HINT}
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

      <SubmitButton pending={pending} pendingText="Zakładanie konta…" icon={<UserPlus />}>
        Załóż konto
      </SubmitButton>
    </form>
  );
}
