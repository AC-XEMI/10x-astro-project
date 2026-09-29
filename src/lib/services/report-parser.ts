// "xlsx" resolves to the @e965/xlsx npm mirror (see package.json) — the plain
// npm `xlsx` package stopped receiving security patches after 0.18.5.
import * as XLSX from "xlsx";
import type { Json } from "@/types";

/**
 * A single visit row extracted from an uploaded report file, shaped to match the
 * `visits` table columns 1:1 (minus `id`/`created_at`/`report_id`, which Phase 2 adds
 * at insert time) so it can be passed straight to `.insert()`.
 */
export interface ExtractedVisit {
  representative_name: string;
  visit_date: string;
  gps_enabled: boolean;
  activity_type: string | null;
  distance_km: number | null;
  time_on_site_minutes: number | null;
  planned_route_raw: Json | null;
  raw_data: Json | null;
  visited_client: string | null;
  visited_latitude: number | null;
  visited_longitude: number | null;
}

export type ParsedReport = { rows: ExtractedVisit[] } | { error: string };

/** Safely stringifies a parsed cell value without relying on Object's default toString. */
function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  return "";
}

function normalizeHeader(value: unknown): string {
  return toDisplayString(value).trim().toLowerCase();
}

function cellToText(value: unknown): string {
  return toDisplayString(value).trim();
}

/** Accepts TAK/NIE (case-insensitive) or 1/0; returns null when unrecognized. */
function parseGpsEnabled(rawValue: string): boolean | null {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "tak" || normalized === "1") return true;
  if (normalized === "nie" || normalized === "0") return false;
  return null;
}

/** Strict RRRR-MM-DD check — also rejects calendar-invalid dates like 2026-02-30. */
function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

function parseOptionalNumber(rawValue: string): number | null {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseReportFile(bytes: ArrayBuffer, filename: string): ParsedReport {
  const dotIndex = filename.lastIndexOf(".");
  const extension = dotIndex === -1 ? "" : filename.slice(dotIndex).toLowerCase();

  let workbook: XLSX.WorkBook;
  try {
    if (extension === ".csv") {
      const text = new TextDecoder("utf-8").decode(bytes);
      workbook = XLSX.read(text, { type: "string" });
    } else if (extension === ".xlsx") {
      workbook = XLSX.read(bytes, { type: "array" });
    } else {
      return { error: "Nieobsługiwany format pliku — akceptowane CSV lub XLSX." };
    }
  } catch {
    return { error: "Nie udało się odczytać pliku — sprawdź czy nie jest uszkodzony." };
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) {
    return { error: "Plik nie zawiera żadnych wierszy z danymi." };
  }

  // header: 1 -> array-of-arrays so we control header matching (case-insensitive) ourselves;
  // raw: false -> every cell comes back as display text, so booleans/numbers parse predictably
  // regardless of whether the source cell was typed as text, number, or date.
  const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });

  if (sheetRows.length === 0) {
    return { error: "Plik nie zawiera żadnych wierszy z danymi." };
  }

  const headerRow = sheetRows[0] ?? [];
  const headers = headerRow.map(normalizeHeader);

  const columnIndex = new Map<string, number>();
  headers.forEach((header, index) => {
    if (header && !columnIndex.has(header)) {
      columnIndex.set(header, index);
    }
  });

  const przedstawicielIndex = columnIndex.get("przedstawiciel");
  if (przedstawicielIndex === undefined) {
    return { error: "Brak wymaganej kolumny: przedstawiciel." };
  }
  const dataWizytyIndex = columnIndex.get("data_wizyty");
  if (dataWizytyIndex === undefined) {
    return { error: "Brak wymaganej kolumny: data_wizyty." };
  }
  const gpsWlaczonyIndex = columnIndex.get("gps_wlaczony");
  if (gpsWlaczonyIndex === undefined) {
    return { error: "Brak wymaganej kolumny: gps_wlaczony." };
  }
  const odwiedzonyKlientIndex = columnIndex.get("odwiedzony_klient");
  if (odwiedzonyKlientIndex === undefined) {
    return { error: "Brak wymaganej kolumny: odwiedzony_klient." };
  }

  const dataRows = sheetRows.slice(1);
  if (dataRows.length === 0) {
    return { error: "Plik nie zawiera żadnych wierszy z danymi." };
  }

  const typAktywnosciIndex = columnIndex.get("typ_aktywnosci");
  const dystansKmIndex = columnIndex.get("dystans_km");
  const czasNaMiejscuIndex = columnIndex.get("czas_na_miejscu_min");
  const planowanaTrasaIndex = columnIndex.get("planowana_trasa");
  const szerokoscIndex = columnIndex.get("szerokosc");
  const dlugoscIndex = columnIndex.get("dlugosc");

  const extractedVisits: ExtractedVisit[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] ?? [];
    const rowNumber = i + 1;

    const representativeName = cellToText(row[przedstawicielIndex]);
    if (!representativeName) {
      return { error: `Wiersz ${rowNumber}: brak wartości w kolumnie przedstawiciel.` };
    }

    const visitDate = cellToText(row[dataWizytyIndex]);
    if (!visitDate) {
      return { error: `Wiersz ${rowNumber}: brak wartości w kolumnie data_wizyty.` };
    }
    if (!isValidIsoDate(visitDate)) {
      return {
        error: `Wiersz ${rowNumber}: nierozpoznany format daty w kolumnie data_wizyty (oczekiwano RRRR-MM-DD).`,
      };
    }

    const gpsEnabled = parseGpsEnabled(cellToText(row[gpsWlaczonyIndex]));
    if (gpsEnabled === null) {
      return { error: `Wiersz ${rowNumber}: nierozpoznana wartość gps_wlaczony (oczekiwano TAK/NIE).` };
    }

    const activityType = typAktywnosciIndex !== undefined ? cellToText(row[typAktywnosciIndex]) || null : null;
    const distanceKm = dystansKmIndex !== undefined ? parseOptionalNumber(cellToText(row[dystansKmIndex])) : null;
    const timeOnSiteMinutes =
      czasNaMiejscuIndex !== undefined ? parseOptionalNumber(cellToText(row[czasNaMiejscuIndex])) : null;

    let plannedRouteRaw: Json | null = null;
    if (planowanaTrasaIndex !== undefined) {
      const rawPlannedRoute = cellToText(row[planowanaTrasaIndex]);
      plannedRouteRaw = rawPlannedRoute
        ? rawPlannedRoute
            .split(";")
            .map((segment) => segment.trim())
            .filter(Boolean)
        : null;
    }

    const visitedClient = cellToText(row[odwiedzonyKlientIndex]) || null;

    let visitedLatitude: number | null = null;
    let visitedLongitude: number | null = null;
    if (szerokoscIndex !== undefined && dlugoscIndex !== undefined) {
      const parsedLatitude = parseOptionalNumber(cellToText(row[szerokoscIndex]));
      const parsedLongitude = parseOptionalNumber(cellToText(row[dlugoscIndex]));
      // No partial coordinates — only keep the pair when both parsed successfully.
      if (parsedLatitude !== null && parsedLongitude !== null) {
        visitedLatitude = parsedLatitude;
        visitedLongitude = parsedLongitude;
      }
    }

    const rawData: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header || header === "__proto__") return;
      rawData[header] = cellToText(row[index]);
    });

    extractedVisits.push({
      representative_name: representativeName,
      visit_date: visitDate,
      gps_enabled: gpsEnabled,
      activity_type: activityType,
      distance_km: distanceKm,
      time_on_site_minutes: timeOnSiteMinutes,
      planned_route_raw: plannedRouteRaw,
      raw_data: rawData,
      visited_client: visitedClient,
      visited_latitude: visitedLatitude,
      visited_longitude: visitedLongitude,
    });
  }

  return { rows: extractedVisits };
}
