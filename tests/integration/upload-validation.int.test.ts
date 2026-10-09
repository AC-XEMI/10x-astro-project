import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { account, baseUrl, supabaseEnv } from "./helpers/context";
import { clientAs } from "./helpers/db";
import { HttpClient, signInViaApp, type RequestOptions } from "./helpers/http";
import { errorFromLocation, readFixture, reportIdFromLocation, uploadFile } from "./helpers/seed";

// The server must refuse on its own whatever the browser refuses (ReportUpload.tsx is only the
// source of "what the browser rejects"; research #5, testing-report-save-integrity). Each refusal is
// a 302 to /reports?error=<code>, parser refusals carry a distinguishing token in `detail` (never a
// whole sentence compared), and no report row is left behind.

// The 10 sheet headers of report-parser.ts, typed in by hand: a `detail` "without a token" must
// name none of them. Never imported from production code.
const SHEET_HEADERS = [
  "przedstawiciel",
  "data_wizyty",
  "gps_wlaczony",
  "typ_aktywnosci",
  "dystans_km",
  "czas_na_miejscu_min",
  "planowana_trasa",
  "odwiedzony_klient",
  "szerokosc",
  "dlugosc",
];
const ROW_TOKEN = /Wiersz \d+/;

const MIB_5 = 5 * 1024 * 1024; // 5 242 880 B - the last size that still passes.
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const encoder = new TextEncoder();
const fixtureText = new TextDecoder("utf-8").decode(await readFixture("csv"));
const fixtureLines = fixtureText.split(/\r?\n/).filter((line) => line !== "");
const header = (fixtureLines[0] ?? "").split(",");

function csv(lines: string[][]): string {
  return `${lines.map((cells) => cells.join(",")).join("\n")}\n`;
}

function fixtureCells(): string[][] {
  return fixtureLines.map((line) => line.split(","));
}

/** Fixture CSV without the given columns (header and every row). */
function withoutColumns(names: string[]): string {
  const drop = new Set(names.map((name) => header.indexOf(name)));
  if (drop.has(-1)) throw new Error(`fixture lacks one of ${names.join(", ")}`);
  return csv(fixtureCells().map((cells) => cells.filter((_, index) => !drop.has(index))));
}

/** Fixture CSV with one cell replaced; dataRow is 1-based and excludes the header (as the parser counts). */
function withCell(dataRow: number, column: string, value: string): string {
  const columnIndex = header.indexOf(column);
  const rows = fixtureCells();
  if (columnIndex === -1 || dataRow < 1 || dataRow >= rows.length) {
    throw new Error(`fixture has no cell ${column} in data row ${dataRow}`);
  }
  rows[dataRow][columnIndex] = value;
  return csv(rows);
}

/** Exactly `size` bytes: the fixture padded with spaces (only file.size matters, never parsed). */
function padded(size: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size).fill(0x20);
  bytes.set(encoder.encode(fixtureText).subarray(0, size));
  return bytes;
}

// A ZIP local-file-header signature followed by garbage: looks like an XLSX, is not one.
const truncatedZip = new Uint8Array([
  0x50,
  0x4b,
  0x03,
  0x04,
  ...encoder.encode("not really a workbook \u0000\u0001\u0002"),
]);

type DetailExpectation =
  { kind: "absent" } | { kind: "no-token" } | { kind: "tokens"; contains: (string | RegExp)[]; excludes: string[] };

interface FileCase {
  name: string;
  ext: string;
  content: Uint8Array<ArrayBuffer> | string;
  type: string;
  error: string;
  detail: DetailExpectation;
}

const absent: DetailExpectation = { kind: "absent" };
const noToken: DetailExpectation = { kind: "no-token" };

const FILE_CASES: FileCase[] = [
  {
    name: "#1 size boundary passes (5 242 880 B) and reaches the type check",
    ext: "csv",
    content: padded(MIB_5),
    type: "application/pdf",
    error: "bad_type",
    detail: absent,
  },
  {
    name: "#2 size boundary +1 B",
    ext: "csv",
    content: padded(MIB_5 + 1),
    type: "text/csv",
    error: "too_large",
    detail: absent,
  },
  {
    name: "#3 wrong MIME, good extension",
    ext: "csv",
    content: fixtureText,
    type: "application/octet-stream",
    error: "bad_type",
    detail: absent,
  },
  {
    name: "#4 PDF",
    ext: "pdf",
    content: "%PDF-1.4\n%fake\n",
    type: "application/pdf",
    error: "bad_type",
    detail: absent,
  },
  {
    name: "#5 wrong extension, allowed MIME",
    ext: "txt",
    content: fixtureText,
    type: "text/csv",
    error: "invalid_file",
    detail: noToken,
  },
  {
    name: "#6 two required columns missing",
    ext: "csv",
    content: withoutColumns(["gps_wlaczony", "odwiedzony_klient"]),
    type: "text/csv",
    error: "invalid_file",
    detail: {
      kind: "tokens",
      contains: ["gps_wlaczony", "odwiedzony_klient"],
      excludes: ["przedstawiciel", "data_wizyty"],
    },
  },
  { name: "#7 empty file (0 B)", ext: "csv", content: "", type: "text/csv", error: "invalid_file", detail: noToken },
  {
    name: "#8 header row only",
    ext: "csv",
    content: `${fixtureLines[0] ?? ""}\n`,
    type: "text/csv",
    error: "invalid_file",
    detail: noToken,
  },
  {
    name: "#9 corrupt XLSX",
    ext: "xlsx",
    content: truncatedZip,
    type: XLSX_TYPE,
    error: "invalid_file",
    detail: noToken,
  },
  {
    name: "#10 bad date in data row 3",
    ext: "csv",
    content: withCell(3, "data_wizyty", "04.09.2026"),
    type: "text/csv",
    error: "invalid_file",
    detail: { kind: "tokens", contains: [/Wiersz 3(?!\d)/, "data_wizyty"], excludes: [] },
  },
  {
    name: "#11 bad GPS value in data row 2",
    ext: "csv",
    content: withCell(2, "gps_wlaczony", "MOŻE"),
    type: "text/csv",
    error: "invalid_file",
    detail: { kind: "tokens", contains: [/Wiersz 2(?!\d)/, "gps_wlaczony"], excludes: [] },
  },
];

// Crafted requests the browser never sends; there is no filename, so the database check is
// "A's report count is unchanged".
const CRAFTED_CASES: { name: string; options: RequestOptions }[] = [
  { name: "#12 multipart without report_file", options: { multipart: { fields: { x: "1" } } } },
  { name: "#13 non-multipart (JSON) body", options: { json: { report_file: "x" } } },
  { name: "#14 report_file sent as a text field", options: { multipart: { fields: { report_file: "raport.csv" } } } },
];

// One app sign-in for A in this file: sign-ins share Supabase's per-IP auth rate limit.
const userA = account("a");
const dbA = clientAs(supabaseEnv(), userA);
const httpA = new HttpClient(baseUrl());

beforeAll(async () => {
  expect(await signInViaApp(httpA, userA)).toMatchObject({ status: 302, location: "/reports" });
});

async function reportIdsNamed(name: string): Promise<string[]> {
  const { data, error } = await dbA.from("reports").select("id").eq("original_filename", name);
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.id);
}

async function reportCountOfA(): Promise<number> {
  const { count, error } = await dbA.from("reports").select("id", { count: "exact", head: true });
  expect(error).toBeNull();
  if (count === null) throw new Error("no count returned");
  return count;
}

function expectDetail(detail: string | null, expectation: DetailExpectation): void {
  if (expectation.kind === "absent") {
    expect(detail).toBeNull();
    return;
  }
  expect(detail?.trim(), "detail must be a non-empty message").toBeTruthy();
  const text = detail ?? "";
  if (expectation.kind === "no-token") {
    for (const name of SHEET_HEADERS) expect(text, `detail names ${name}`).not.toContain(name);
    expect(text).not.toMatch(ROW_TOKEN);
    return;
  }
  for (const token of expectation.contains) {
    if (typeof token === "string") expect(text).toContain(token);
    else expect(text).toMatch(token);
  }
  for (const name of expectation.excludes) expect(text).not.toContain(name);
}

describe("upload route refuses invalid files on its own", () => {
  it("control: a valid upload under a unique name is visible to A, then removed", async () => {
    const name = `valid-${randomUUID()}.csv`;
    const response = await uploadFile(httpA, { name, content: fixtureText, type: "text/csv" });
    const reportId = reportIdFromLocation(response.location);
    try {
      expect(response.status).toBe(302);
      expect(reportId, `answered ${response.location ?? "(no Location)"}`).not.toBeNull();
      expect(await reportIdsNamed(name)).toEqual([reportId]);
    } finally {
      if (reportId) {
        const { error } = await dbA.from("reports").delete().eq("id", reportId);
        expect(error).toBeNull();
      }
    }
    expect(await reportIdsNamed(name)).toEqual([]);
  });

  it.each(FILE_CASES)("$name → $error", async ({ ext, content, type, error, detail }) => {
    const name = `invalid-${randomUUID()}.${ext}`;
    const response = await uploadFile(httpA, { name, content, type });

    expect(response.status).toBe(302);
    expect(response.location).toMatch(/^\/reports\?/);
    const query = errorFromLocation(response.location);
    expect(query.error).toBe(error);
    expectDetail(query.detail, detail);
    expect(await reportIdsNamed(name)).toEqual([]);
  });

  it.each(CRAFTED_CASES)("$name → no_file", async ({ options }) => {
    const before = await reportCountOfA();
    const response = await httpA.request("/api/reports/upload", options);

    expect(response.status).toBe(302);
    expect(response.location).toMatch(/^\/reports\?/);
    expect(errorFromLocation(response.location)).toEqual({ error: "no_file", detail: null });
    expect(await reportCountOfA()).toBe(before);
  });
});
