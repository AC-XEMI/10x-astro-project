import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { account, baseUrl, supabaseEnv } from "./helpers/context";
import { clientAs } from "./helpers/db";
import { HttpClient, signInViaApp } from "./helpers/http";
import { EXPECTED_RULES_BY_CLIENT, rulesByClient } from "./helpers/oracle";
import { readFixture, reportIdFromLocation, uploadFile } from "./helpers/seed";

const VARIANTS = [
  { kind: "csv", type: "text/csv" },
  { kind: "xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
] as const;

// One app sign-in for A in this file: sign-ins share Supabase's per-IP auth rate limit.
const userA = account("a");
const dbA = clientAs(supabaseEnv(), userA);
const httpA = new HttpClient(baseUrl());

beforeAll(async () => {
  expect(await signInViaApp(httpA, userA)).toMatchObject({ status: 302, location: "/reports" });
});

describe.each(VARIANTS)("stored result of sample-report.$kind", ({ kind, type }) => {
  let reportId: string | null = null;

  beforeAll(async () => {
    const response = await uploadFile(httpA, {
      name: `oracle-${randomUUID()}.${kind}`,
      content: await readFixture(kind),
      type,
    });
    reportId = reportIdFromLocation(response.location);
    expect(response.status).toBe(302);
    expect(reportId, `answered ${response.location ?? "(no Location)"}`).not.toBeNull();
  });

  afterAll(async () => {
    if (reportId) {
      const { error } = await dbA.from("reports").delete().eq("id", reportId);
      expect(error).toBeNull();
    }
  });

  it("holds exactly the oracle's rules per visit, read with the report details query", async () => {
    if (!reportId) throw new Error("upload did not produce a report");
    // Verbatim the query of src/pages/reports/[id].astro.
    const { data: visits, error } = await dbA.from("visits").select("*, deviations(*)").eq("report_id", reportId);
    expect(error).toBeNull();
    if (!visits) throw new Error("no visits returned");

    expect(visits).toHaveLength(15);
    const clients = visits.map((v) => v.visited_client);
    expect(new Set(clients).size).toBe(clients.length);

    expect(rulesByClient(visits)).toEqual(EXPECTED_RULES_BY_CLIENT);

    const deviations = visits.flatMap((v) => v.deviations);
    for (const d of deviations) {
      // A fresh upload: nothing reviewed yet ('unreviewed' is the enum's initial value).
      expect(d.status, `${d.rule} on visit ${d.visit_id}`).toBe("unreviewed");
      if (d.rule === "missing_gps") {
        expect(d.detail, `missing_gps on visit ${d.visit_id}`).toBeNull();
      } else {
        expect(typeof d.detail, `${d.rule} on visit ${d.visit_id}`).toBe("string");
        expect(d.detail?.trim(), `${d.rule} on visit ${d.visit_id}`).not.toBe("");
      }
    }
  });

  it("records the row count (and, secondarily, the deviation count) on the report", async () => {
    if (!reportId) throw new Error("upload did not produce a report");
    const { data, error } = await dbA.from("reports").select("row_count, deviation_count").eq("id", reportId).single();
    expect(error).toBeNull();
    expect(data).toEqual({ row_count: 15, deviation_count: 15 });
  });

  it("renders the report details page", async () => {
    if (!reportId) throw new Error("upload did not produce a report");
    expect((await httpA.request(`/reports/${reportId}`)).status).toBe(200);
  });
});
