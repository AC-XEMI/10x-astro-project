import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { HttpClient } from "./http";

const SAMPLE_REPORT = new URL("../../../test-data/sample-report.csv", import.meta.url);

export interface SeededReport {
  reportId: string;
  filename: string;
}

// Uploads through the real route, so the report carries the visits and deviations the pipeline
// produces. The client must already hold a session.
export async function uploadSampleReport(http: HttpClient): Promise<SeededReport> {
  const filename = `sample-report-${randomUUID()}.csv`;
  const content = await readFile(SAMPLE_REPORT);
  const response = await http.request("/api/reports/upload", {
    multipart: { file: { field: "report_file", name: filename, content, type: "text/csv" } },
  });

  const reportId = /^\/reports\/([0-9a-f-]{36})$/i.exec(response.location ?? "")?.[1];
  if (response.status !== 302 || !reportId) {
    throw new Error(
      `Upload of ${filename} did not redirect to /reports/<id>: ${response.status} ${response.location ?? "(no Location)"}`,
    );
  }
  return { reportId, filename };
}
