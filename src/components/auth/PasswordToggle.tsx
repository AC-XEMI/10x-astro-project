import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function PasswordToggle({ visible, onToggle, disabled }: PasswordToggleProps) {
  const label = visible ? "Ukryj hasło" : "Pokaż hasło";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onToggle}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="text-muted-foreground absolute top-0 right-0 cursor-pointer"
    >
      {visible ? <EyeOff /> : <Eye />}
    </Button>
  );
}
