/**
 * Report upload/delete errors travel to /reports as a code in `?error=`, never as free text:
 * the page renders only the message mapped here, so neither a raw database message nor text
 * from a crafted link reaches the user. `detail` (parser row messages, our own Polish text) is
 * read only by ReportUpload from the XHR's redirect URL, never rendered by the page itself.
 */
export const REPORT_ERROR_MESSAGES = {
  not_configured: "Aplikacja nie jest połączona z bazą danych. Skontaktuj się z administratorem.",
  no_file: "Nie wybrano pliku do wgrania.",
  too_large: "Plik przekracza limit 5 MB.",
  bad_type: "Nieobsługiwany typ pliku — akceptowane CSV lub XLSX.",
  invalid_file: "Nie udało się przetworzyć pliku.",
  upload_failed: "Nie udało się zapisać raportu. Spróbuj ponownie za chwilę.",
  delete_failed: "Nie udało się usunąć raportu. Spróbuj ponownie za chwilę.",
  report_not_found: "Nie znaleziono raportu lub brak uprawnień.",
} as const;

export type ReportErrorCode = keyof typeof REPORT_ERROR_MESSAGES;

export const GENERIC_REPORT_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";

export function isReportErrorCode(code: string | null | undefined): code is ReportErrorCode {
  return typeof code === "string" && Object.hasOwn(REPORT_ERROR_MESSAGES, code);
}

/** Message for a `?error=` value; anything that is not a known code gets the generic message. */
export function reportErrorMessage(code: string | null | undefined): string {
  return isReportErrorCode(code) ? REPORT_ERROR_MESSAGES[code] : GENERIC_REPORT_ERROR;
}

export function reportErrorUrl(code: ReportErrorCode, detail?: string): string {
  const params = new URLSearchParams({ error: code });
  if (detail) params.set("detail", detail);
  return `/reports?${params.toString()}`;
}
