import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { HttpClient, HttpResponse } from "./http";

const FIXTURES = {
  csv: new URL("../../../test-data/sample-report.csv", import.meta.url),
  xlsx: new URL("../../../test-data/sample-report.xlsx", import.meta.url),
};

export interface SeededReport {
  reportId: string;
  filename: string;
}

export interface UploadInput {
  name: string;
  content: Uint8Array<ArrayBuffer> | string;
  type: string;
}

export async function readFixture(kind: keyof typeof FIXTURES): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await readFile(FIXTURES[kind]));
}

// Raw response of the real upload route. The client must already hold a session.
export async function uploadFile(http: HttpClient, file: UploadInput): Promise<HttpResponse> {
  return http.request("/api/reports/upload", {
    multipart: { file: { field: "report_file", ...file } },
  });
}

export function reportIdFromLocation(location: string | null): string | null {
  return /^\/reports\/([0-9a-f-]{36})$/i.exec(location ?? "")?.[1] ?? null;
}

export function errorFromLocation(location: string | null): { error: string | null; detail: string | null } {
  const query = location?.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  return { error: params.get("error"), detail: params.get("detail") };
}

// Uploads through the real route, so the report carries the visits and deviations the pipeline
// produces. The client must already hold a session.
export async function uploadSampleReport(http: HttpClient): Promise<SeededReport> {
  const filename = `sample-report-${randomUUID()}.csv`;
  const response = await uploadFile(http, { name: filename, content: await readFixture("csv"), type: "text/csv" });

  const reportId = reportIdFromLocation(response.location);
  if (response.status !== 302 || !reportId) {
    throw new Error(
      `Upload of ${filename} did not redirect to /reports/<id>: ${response.status} ${response.location ?? "(no Location)"}`,
    );
  }
  return { reportId, filename };
}
