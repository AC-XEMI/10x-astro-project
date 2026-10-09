import { beforeAll, describe, expect, it } from "vitest";
import { reportErrorUrl } from "@/lib/report-errors";
import { account, baseUrl, supabaseEnv } from "./helpers/context";
import { clientAs } from "./helpers/db";
import { HttpClient, type HttpResponse, signInViaApp } from "./helpers/http";
import { uploadSampleReport } from "./helpers/seed";

function jsonBody(response: HttpResponse): unknown {
  return JSON.parse(response.body ?? "null") as unknown;
}

// The app's routes turn an RLS denial into "not found" or a refusal, and never change A's data.
// Every denial is checked against A's state in the database, not only by the response code.
// One app sign-in per account in this file: sign-ins share Supabase's per-IP auth rate limit.
describe("HTTP isolation between accounts", () => {
  const userA = account("a");
  const userB = account("b");
  const dbA = clientAs(supabaseEnv(), userA);
  const httpA = new HttpClient(baseUrl());
  const httpB = new HttpClient(baseUrl());

  let reportId: string;
  let filename: string;
  let visitCount: number;
  let deviationIds: string[];

  async function deviationsOfA(): Promise<{ id: string; status: string; reviewed_at: string | null }[]> {
    const { data, error } = await dbA
      .from("deviations")
      .select("id, status, reviewed_at, visits!inner(report_id)")
      .eq("visits.report_id", reportId)
      .order("id");
    expect(error).toBeNull();
    return (data ?? []).map(({ id, status, reviewed_at }) => ({ id, status, reviewed_at }));
  }

  async function visitCountOfA(): Promise<number> {
    const { count, error } = await dbA
      .from("visits")
      .select("id", { count: "exact", head: true })
      .eq("report_id", reportId);
    expect(error).toBeNull();
    return count ?? -1;
  }

  beforeAll(async () => {
    expect(await signInViaApp(httpA, userA)).toMatchObject({ status: 302, location: "/reports" });
    ({ reportId, filename } = await uploadSampleReport(httpA));

    visitCount = await visitCountOfA();
    expect(visitCount).toBeGreaterThan(0);
    const deviations = await deviationsOfA();
    expect(deviations.length).toBeGreaterThan(0);
    expect(deviations.every((d) => d.status === "unreviewed" && d.reviewed_at === null)).toBe(true);
    deviationIds = deviations.map((d) => d.id);

    expect(await signInViaApp(httpB, userB)).toMatchObject({ status: 302, location: "/reports" });
  });

  describe("report details", () => {
    it("serves A's report to A (control)", async () => {
      const response = await httpA.request(`/reports/${reportId}`);
      expect(response.status).toBe(200);
    });

    it("answers 404 to B for A's report", async () => {
      const response = await httpB.request(`/reports/${reportId}`);
      expect(response.status).toBe(404);
    });
  });

  describe("report delete", () => {
    it("redirects B with report_not_found and leaves A's report and visits intact", async () => {
      const response = await httpB.request(`/api/reports/${reportId}/delete`, { form: {} });
      expect(response.status).toBe(302);
      expect(response.location).toBe(reportErrorUrl("report_not_found"));

      const { data, error } = await dbA.from("reports").select("id").eq("id", reportId);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: reportId }]);
      expect(await visitCountOfA()).toBe(visitCount);
    });
  });

  describe("deviation review", () => {
    it("answers 404 not_found to B for A's deviations and leaves them unreviewed", async () => {
      const response = await httpB.request("/api/deviations/review", {
        json: { ids: deviationIds, status: "reviewed" },
        readBody: true,
      });
      expect(response.status).toBe(404);
      expect(jsonBody(response)).toEqual({ error: "not_found" });

      const deviations = await deviationsOfA();
      expect(deviations.map((d) => d.id)).toEqual(deviationIds);
      for (const deviation of deviations) {
        expect(deviation).toMatchObject({ status: "unreviewed", reviewed_at: null });
      }
    });

    it("answers 400 invalid_request to a non-UUID id", async () => {
      const response = await httpB.request("/api/deviations/review", {
        json: { ids: ["not-a-uuid"], status: "reviewed" },
        readBody: true,
      });
      expect(response.status).toBe(400);
      expect(jsonBody(response)).toEqual({ error: "invalid_request" });
    });

    it("answers 400 invalid_request to an empty id list", async () => {
      const response = await httpB.request("/api/deviations/review", {
        json: { ids: [], status: "reviewed" },
        readBody: true,
      });
      expect(response.status).toBe(400);
      expect(jsonBody(response)).toEqual({ error: "invalid_request" });
    });
  });

  describe("lists and dashboard", () => {
    it("shows A's report on A's own /reports and /dashboard (control)", async () => {
      const reports = await httpA.request("/reports", { readBody: true });
      expect(reports.status).toBe(200);
      expect(reports.body).toContain(filename);

      const dashboard = await httpA.request("/dashboard", { readBody: true });
      expect(dashboard.status).toBe(200);
      expect(dashboard.body).toContain(filename);
    });

    it("keeps A's report off B's /reports", async () => {
      const response = await httpB.request("/reports", { readBody: true });
      expect(response.status).toBe(200);
      expect(response.body).not.toContain(reportId);
      expect(response.body).not.toContain(filename);
    });

    it("keeps A's report off B's /dashboard", async () => {
      const response = await httpB.request("/dashboard", { readBody: true });
      expect(response.status).toBe(200);
      expect(response.body).not.toContain(reportId);
      expect(response.body).not.toContain(filename);
    });
  });
});
