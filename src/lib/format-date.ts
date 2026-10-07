// One explicit time zone, so the same instant renders the same text on the server (UTC on
// Cloudflare) and in the browser after hydration, and on every view that shows upload times.
const dateTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "02.10.2026, 14:30" (Europe/Warsaw) for 2026-10-02T12:30:00Z. */
export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(typeof value === "string" ? new Date(value) : value);
}
