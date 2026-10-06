/**
 * Required-column check for an uploaded report's header row, shared so the upload card can
 * explain a missing-column error before the file is sent. report-parser.ts stays the
 * authority: it matches headers by trim + lower-case only, and this module must agree with it
 * on what counts as "found" (see normalizeHeader below).
 */
export const REQUIRED_COLUMNS = ["przedstawiciel", "data_wizyty", "gps_wlaczony", "odwiedzony_klient"] as const;

export type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];

export interface ColumnCheck {
  name: RequiredColumn;
  found: boolean;
  /** A header that would match after fixing case/diacritics/spaces, e.g. "Data wizyty" -> data_wizyty. */
  similar: { header: string; column: string } | null;
}

/** Same normalization as report-parser.ts - this is what the parser actually accepts. */
function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

/** Looser form used only to suggest a fix: strips Polish diacritics and turns spaces/hyphens into "_". */
function looseHeader(value: string) {
  return normalizeHeader(value)
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s-]+/g, "_");
}

/** 0 -> "A", 25 -> "Z", 26 -> "AA" (spreadsheet column letters). */
export function columnLetter(index: number) {
  let letter = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  }
  return letter;
}

export function checkRequiredColumns(headers: string[]): ColumnCheck[] {
  const normalized = headers.map(normalizeHeader);
  return REQUIRED_COLUMNS.map((name) => {
    if (normalized.includes(name)) return { name, found: true, similar: null };
    const index = headers.findIndex((header) => looseHeader(header) === name);
    return {
      name,
      found: false,
      similar: index === -1 ? null : { header: headers[index].trim(), column: columnLetter(index) },
    };
  });
}
