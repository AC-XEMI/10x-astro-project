import { CircleAlert } from "lucide-react";

interface ServerErrorProps {
  message?: string | null;
}

/** The first sentence is the headline (bold); anything after it is the follow-up hint. */
export function ServerError({ message }: ServerErrorProps) {
  if (!message) return null;

  const splitAt = message.indexOf(". ");
  const headline = splitAt === -1 ? message : message.slice(0, splitAt + 1);
  const rest = splitAt === -1 ? "" : message.slice(splitAt + 2);

  return (
    <div role="alert" className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md p-3 text-sm">
      <CircleAlert className="mt-0.5 size-4 flex-none" />
      <span>
        <strong>{headline}</strong>
        {rest && ` ${rest}`}
      </span>
    </div>
  );
}
