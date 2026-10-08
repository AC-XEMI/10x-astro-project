import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseReportFile, type ExtractedVisit, type ParsedReport } from "@/lib/services/report-parser";

const REQUIRED_HEADER = "przedstawiciel,data_wizyty,gps_wlaczony,odwiedzony_klient";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function csv(text: string): ArrayBuffer {
  return toArrayBuffer(new TextEncoder().encode(text));
}

function fixture(filename: string): ArrayBuffer {
  return toArrayBuffer(readFileSync(new URL(`../../../test-data/${filename}`, import.meta.url)));
}

function rowsOf(result: ParsedReport): ExtractedVisit[] {
  if ("error" in result) throw new Error(`expected rows, got error: ${result.error}`);
  return result.rows;
}

function errorOf(result: ParsedReport): string {
  if (!("error" in result)) throw new Error(`expected an error, got ${result.rows.length} rows`);
  return result.error;
}

describe.each(["sample-report.csv", "sample-report.xlsx"])("parseReportFile on %s", (filename) => {
  const rows = rowsOf(parseReportFile(fixture(filename), filename));

  it("parses all 15 data rows", () => {
    expect(rows).toHaveLength(15);
  });

  it("maps a full row to typed visit fields", () => {
    expect(rows[6]).toMatchObject({
      representative_name: "Marek Nowicki",
      visit_date: "2026-09-04",
      gps_enabled: true,
      activity_type: "wizyta",
      distance_km: 15,
      time_on_site_minutes: 10,
      planned_route_raw: ["Klient P", "Klient Q"],
      visited_client: "Klient Q",
      visited_latitude: 52.25,
      visited_longitude: 21.03,
    });
  });

  it("maps blank optional cells to null", () => {
    expect(rows[11]).toMatchObject({
      representative_name: "Lucyna Wrona",
      gps_enabled: false,
      activity_type: null,
      time_on_site_minutes: null,
      planned_route_raw: null,
      visited_latitude: null,
      visited_longitude: null,
    });
  });

  it("keeps every source column in raw_data", () => {
    expect(rows[0].raw_data).toMatchObject({ przedstawiciel: "Jan Kowalski", planowana_trasa: "Klient A;Klient B" });
  });
});

describe("parseReportFile format handling", () => {
  it("rejects an unsupported extension", () => {
    expect(errorOf(parseReportFile(csv(REQUIRED_HEADER), "report.txt"))).toBe(
      "Nieobsługiwany format pliku — akceptowane CSV lub XLSX.",
    );
  });

  it("rejects a file without an extension", () => {
    expect(errorOf(parseReportFile(csv(REQUIRED_HEADER), "report"))).toBe(
      "Nieobsługiwany format pliku — akceptowane CSV lub XLSX.",
    );
  });

  it("accepts an upper-case extension and matches headers case-insensitively", () => {
    const rows = rowsOf(
      parseReportFile(
        csv(" PRZEDSTAWICIEL ,Data_Wizyty,GPS_WLACZONY,odwiedzony_klient\nJan,2026-09-01,tak,K"),
        "R.CSV",
      ),
    );
    expect(rows).toEqual([expect.objectContaining({ representative_name: "Jan", gps_enabled: true })]);
  });

  it("reports a corrupted xlsx as unreadable", () => {
    const corruptZip = toArrayBuffer(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5]));
    expect(errorOf(parseReportFile(corruptZip, "report.xlsx"))).toBe(
      "Nie udało się odczytać pliku — sprawdź czy nie jest uszkodzony.",
    );
  });

  it("reports an empty file as having no data rows", () => {
    expect(errorOf(parseReportFile(csv(""), "report.csv"))).toBe("Plik nie zawiera żadnych wierszy z danymi.");
  });

  it("reports a header-only file as having no data rows", () => {
    expect(errorOf(parseReportFile(csv(`${REQUIRED_HEADER}\n`), "report.csv"))).toBe(
      "Plik nie zawiera żadnych wierszy z danymi.",
    );
  });

  it("names every missing required column", () => {
    expect(errorOf(parseReportFile(csv("przedstawiciel,gps_wlaczony\nJan,TAK"), "report.csv"))).toBe(
      "Brak wymaganych kolumn: data_wizyty, odwiedzony_klient.",
    );
  });
});

describe("parseReportFile row validation", () => {
  const parseRows = (...lines: string[]) => parseReportFile(csv([REQUIRED_HEADER, ...lines].join("\n")), "r.csv");

  it("rejects an empty representative with the 1-based row number", () => {
    expect(errorOf(parseRows("Jan,2026-09-01,TAK,K", ",2026-09-01,TAK,K"))).toBe(
      "Wiersz 2: brak wartości w kolumnie przedstawiciel.",
    );
  });

  it("rejects an empty visit date", () => {
    expect(errorOf(parseRows("Jan,,TAK,K"))).toBe("Wiersz 1: brak wartości w kolumnie data_wizyty.");
  });

  it.each(["01.09.2026", "2026-9-1", "2026-02-30"])("rejects the date %s", (date) => {
    expect(errorOf(parseRows(`Jan,${date},TAK,K`))).toBe(
      "Wiersz 1: nierozpoznany format daty w kolumnie data_wizyty (oczekiwano RRRR-MM-DD).",
    );
  });

  it("rejects an unrecognized GPS value", () => {
    expect(errorOf(parseRows("Jan,2026-09-01,może,K"))).toBe(
      "Wiersz 1: nierozpoznana wartość gps_wlaczony (oczekiwano TAK/NIE).",
    );
  });

  it.each([
    ["TAK", true],
    ["tak", true],
    ["1", true],
    ["NIE", false],
    ["nie", false],
    ["0", false],
  ])("reads GPS value %s as %s", (value, expected) => {
    expect(rowsOf(parseRows(`Jan,2026-09-01,${value},K`))[0].gps_enabled).toBe(expected);
  });
});

describe("parseReportFile optional columns", () => {
  const HEADER = `${REQUIRED_HEADER},typ_aktywnosci,dystans_km,czas_na_miejscu_min,planowana_trasa,szerokosc,dlugosc`;
  const parseOne = (line: string) => rowsOf(parseReportFile(csv(`${HEADER}\n${line}`), "r.csv"))[0];

  it("leaves optional fields null when the columns are absent", () => {
    expect(rowsOf(parseReportFile(csv(`${REQUIRED_HEADER}\nJan,2026-09-01,TAK,K`), "r.csv"))[0]).toMatchObject({
      activity_type: null,
      distance_km: null,
      time_on_site_minutes: null,
      planned_route_raw: null,
      visited_latitude: null,
      visited_longitude: null,
    });
  });

  it("treats a non-numeric distance or time as null", () => {
    expect(parseOne("Jan,2026-09-01,TAK,K,wizyta,abc,xyz,,,")).toMatchObject({
      distance_km: null,
      time_on_site_minutes: null,
    });
  });

  it("splits the planned route on semicolons, trimming and dropping empty segments", () => {
    expect(parseOne('Jan,2026-09-01,TAK,K,wizyta,1,1," A ; ;B;",,').planned_route_raw).toEqual(["A", "B"]);
  });

  it("keeps coordinates only when both parse", () => {
    expect(parseOne("Jan,2026-09-01,TAK,K,wizyta,1,1,,52.1,")).toMatchObject({
      visited_latitude: null,
      visited_longitude: null,
    });
    expect(parseOne("Jan,2026-09-01,TAK,K,wizyta,1,1,,52.1,21.2")).toMatchObject({
      visited_latitude: 52.1,
      visited_longitude: 21.2,
    });
  });

  it("maps an empty visited client to null", () => {
    expect(parseOne("Jan,2026-09-01,TAK,,wizyta,1,1,,,").visited_client).toBeNull();
  });
});
