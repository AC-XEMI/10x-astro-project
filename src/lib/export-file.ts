/**
 * Guards against CSV formula injection: source data (e.g. representative_name) is free text
 * from the uploaded file, not system-generated. A leading =/+/-/@/tab/CR is how spreadsheet
 * apps detect a formula in a CSV cell (no type info in the format itself, unlike XLSX), so
 * such values get a leading apostrophe to force plain-text interpretation on open.
 */
export function csvField(value: string) {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** Semicolon-separated (Polish Excel default) with a BOM so Excel detects UTF-8. */
export function buildCsv(rows: string[][]): string {
  const csvBody = rows.map((row) => row.map(csvField).join(";")).join("\n");
  const byteOrderMark = String.fromCharCode(0xfeff);
  return byteOrderMark + csvBody;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
