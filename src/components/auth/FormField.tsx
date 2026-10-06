import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  hint?: ReactNode;
  icon: ReactNode;
  endContent?: ReactNode;
  /** Read-only rather than disabled while the form submits: disabled inputs are left out of the POST body. */
  busy?: boolean;
  /** Marks the input invalid without a field-level message (e.g. after a server-side auth error). */
  invalid?: boolean;
}

export function FormField({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  hint,
  icon,
  endContent,
  busy = false,
  invalid = false,
}: FormFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 flex -translate-y-1/2 [&_svg]:size-4">
          {icon}
        </span>
        <input
          id={id}
          name={name ?? id}
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          autoComplete={autoComplete}
          readOnly={busy}
          aria-invalid={Boolean(error) || invalid}
          aria-describedby={describedBy}
          className={cn(
            "border-input placeholder:text-muted-foreground h-9 w-full rounded-md border bg-transparent pr-3 pl-[34px] text-sm shadow-xs transition-[color,box-shadow] outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20",
            endContent && "pr-10",
            busy && "opacity-50",
          )}
        />
        {endContent}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-muted-foreground text-sm">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
