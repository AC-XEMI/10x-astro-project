import { REPORT_ERROR_MESSAGES } from "@/lib/report-errors";

/**
 * Page-level reasons the report details view (src/pages/reports/[id].astro) cannot show a report,
 * rendered by ReportLoadError.astro (also used by the kitchen sink). Lives in a .ts module because
 * type-aware ESLint cannot resolve types exported from an .astro file.
 */
export type ReportLoadErrorKind = "not_found" | "not_configured" | "load_failed";

export const REPORT_LOAD_ERROR_MESSAGES: Record<ReportLoadErrorKind, string> = {
  not_found: "Nie znaleziono raportu.",
  not_configured: REPORT_ERROR_MESSAGES.not_configured,
  load_failed: "Nie udało się wczytać raportu. Spróbuj ponownie za chwilę.",
};

export const REPORT_LOAD_ERROR_STATUS: Record<ReportLoadErrorKind, number> = {
  not_configured: 503,
  not_found: 404,
  load_failed: 500,
};
