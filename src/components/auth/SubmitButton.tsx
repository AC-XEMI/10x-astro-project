import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  /**
   * Set by the form once client validation passes. useFormStatus() can't be used here: it only
   * tracks React form actions, and these forms do a native POST to an API route.
   */
  pending: boolean;
  pendingText: string;
  icon: ReactNode;
  children: ReactNode;
}

export function SubmitButton({ pending, pendingText, icon, children }: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={pending} className="w-full cursor-pointer disabled:cursor-not-allowed">
      {pending ? (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : (
        icon
      )}
      {pending ? pendingText : children}
    </Button>
  );
}
