import { beforeAll, describe, expect, it } from "vitest";
import { account, baseUrl, supabaseEnv } from "./helpers/context";
import { clientAs } from "./helpers/db";
import { HttpClient, signInViaApp } from "./helpers/http";
import { uploadSampleReport } from "./helpers/seed";

// Positive proof that the suite reaches both the app and the local database. Without it, green
// denial tests in other files could just mean nothing works at all.
describe("integration harness", () => {
  const userA = account("a");
  const http = new HttpClient(baseUrl());
  const dbA = clientAs(supabaseEnv(), userA);

  beforeAll(async () => {
    const signIn = await signInViaApp(http, userA);
    expect(signIn).toMatchObject({ status: 302, location: "/reports" });
  });

  it("serves /reports to A signed in through the app", async () => {
    const response = await http.request("/reports");
    expect(response.status).toBe(200);
  });

  it("stores a report uploaded over HTTP with its visits and deviations, visible to A", async () => {
    const { reportId, filename } = await uploadSampleReport(http);

    const { data: report, error: reportError } = await dbA
      .from("reports")
      .select("id, user_id, original_filename")
      .eq("id", reportId)
      .maybeSingle();
    expect(reportError).toBeNull();
    expect(report).toEqual({ id: reportId, user_id: userA.userId, original_filename: filename });

    const { data: visits, error: visitsError } = await dbA.from("visits").select("id").eq("report_id", reportId);
    expect(visitsError).toBeNull();
    expect(visits?.length).toBeGreaterThan(0);

    const { count: deviationCount, error: deviationsError } = await dbA
      .from("deviations")
      .select("id, visits!inner(report_id)", { count: "exact", head: true })
      .eq("visits.report_id", reportId);
    expect(deviationsError).toBeNull();
    expect(deviationCount).toBeGreaterThan(0);
  });
});
