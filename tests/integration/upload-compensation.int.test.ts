import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { account, baseUrl, supabaseEnv } from "./helpers/context";
import { clientAs } from "./helpers/db";
import {
  faultMarker,
  faultReportCount,
  installedFaultTriggers,
  installFault,
  markerRowCounts,
  removeFault,
} from "./helpers/db-fault";
import { HttpClient, type HttpResponse, signInViaApp } from "./helpers/http";
import { EXPECTED_RULES_BY_CLIENT, rulesByClient } from "./helpers/oracle";
import { errorFromLocation, readFixture, reportIdFromLocation, uploadFile } from "./helpers/seed";

// Upload compensation under write failures forced inside the database (helpers/db-fault.ts): a real
// Postgres error from a marker-scoped trigger, never a mocked client. Each describe installs its own
// fault with its own marker in beforeAll and removes it in afterAll; files run sequentially and
// describes in order, so triggers of different describes never overlap. All uploads use the CSV
// fixture (XLSX only in upload-oracle.int.test.ts).
// One app sign-in for A in this file: sign-ins share Supabase's per-IP auth rate limit.
const userA = account("a");
const dbA = clientAs(supabaseEnv(), userA);
const httpA = new HttpClient(baseUrl());
let sampleCsv: Uint8Array<ArrayBuffer>;

beforeAll(async () => {
  expect(await signInViaApp(httpA, userA)).toMatchObject({ status: 302, location: "/reports" });
  sampleCsv = await readFixture("csv");
});

afterAll(() => {
  // Nothing of this file may outlive it: no trigger, no report carrying a fault marker.
  expect(installedFaultTriggers()).toEqual([]);
  expect(faultReportCount()).toBe(0);
});

async function upload(name: string): Promise<HttpResponse> {
  return uploadFile(httpA, { name, content: sampleCsv, type: "text/csv" });
}

async function reportIdsOfANamed(filename: string): Promise<string[]> {
  const { data, error } = await dbA
    .from("reports")
    .select("id")
    .eq("user_id", userA.userId)
    .eq("original_filename", filename);
  expect(error).toBeNull();
  return (data ?? []).map((r) => r.id);
}

async function deleteAsA(reportId: string): Promise<void> {
  const { error } = await dbA.from("reports").delete().eq("id", reportId);
  expect(error).toBeNull();
}

function expectUploadFailed(response: HttpResponse): void {
  expect(response.status).toBe(302);
  expect(response.location?.startsWith("/reports?"), `answered ${response.location ?? "(no Location)"}`).toBe(true);
  expect(errorFromLocation(response.location).error).toBe("upload_failed");
}

// (a) and (b): the failed upload leaves nothing - read as A by name, and as postgres by marker,
// since an empty result under RLS could also mean "no access".
function describeNothingLeft(kind: "visits_insert" | "deviations_insert", title: string): void {
  describe(title, () => {
    const marker = faultMarker(kind);
    let controlReportId: string | null = null;

    beforeAll(() => {
      installFault(kind, marker);
    });

    afterAll(async () => {
      try {
        // An insert trigger does not block deletes, so the control report may go first.
        if (controlReportId) await deleteAsA(controlReportId);
      } finally {
        removeFault(kind);
      }
    });

    it("answers upload_failed and leaves no report, visit or deviation behind", async () => {
      const faulty = `${marker}.csv`;
      expectUploadFailed(await upload(faulty));

      expect(await reportIdsOfANamed(faulty)).toEqual([]);
      expect(markerRowCounts(marker)).toEqual({ reports: 0, visits: 0, deviations: 0 });
    });

    it("still stores an upload without the marker (control)", async () => {
      const control = `it-control-${randomUUID()}.csv`;
      const succeeded = await upload(control);
      controlReportId = reportIdFromLocation(succeeded.location);
      expect(succeeded.status).toBe(302);
      expect(controlReportId, `answered ${succeeded.location ?? "(no Location)"}`).not.toBeNull();
      expect(await reportIdsOfANamed(control)).toEqual([controlReportId]);
    });
  });
}

// (a) Nothing is written past the report row; the rollback removes it.
describeNothingLeft("visits_insert", "visits insert fails");

// (b) Visits are already committed when deviations fail: proves the rollback with the FK cascade.
describeNothingLeft("deviations_insert", "deviations insert fails");

// (c) The denormalized count is not worth a rollback: the report stays complete, count is null.
describe("deviation count update fails (count_failed)", () => {
  const marker = faultMarker("reports_update");
  let reportId: string | null = null;

  beforeAll(() => {
    installFault("reports_update", marker);
  });

  afterAll(async () => {
    try {
      // An update trigger does not block deletes.
      if (reportId) await deleteAsA(reportId);
    } finally {
      removeFault("reports_update");
    }
  });

  it("still redirects to the report, which holds every visit and the oracle's deviations", async () => {
    const response = await upload(`${marker}.csv`);
    reportId = reportIdFromLocation(response.location);
    expect(response.status).toBe(302);
    expect(reportId, `answered ${response.location ?? "(no Location)"}`).not.toBeNull();
    if (!reportId) return;

    const { data: report, error: reportError } = await dbA
      .from("reports")
      .select("row_count, deviation_count")
      .eq("id", reportId)
      .single();
    expect(reportError).toBeNull();
    // deviation_count is not the proof of completeness here - it is null by design.
    expect(report).toEqual({ row_count: 15, deviation_count: null });

    // Verbatim the query of src/pages/reports/[id].astro.
    const { data: visits, error } = await dbA.from("visits").select("*, deviations(*)").eq("report_id", reportId);
    expect(error).toBeNull();
    if (!visits) throw new Error("no visits returned");
    expect(visits).toHaveLength(15);
    const clients = visits.map((v) => v.visited_client);
    expect(new Set(clients).size).toBe(clients.length);
    expect(rulesByClient(visits)).toEqual(EXPECTED_RULES_BY_CLIENT);
  });
});

// (d) The rollback itself fails: the route still answers upload_failed and leaves a documented
// orphan - the report with its visits and without deviations.
describe("deviations insert and its rollback fail (rollback_failed)", () => {
  const marker = faultMarker("deviations_insert");
  const filename = `${marker}.csv`;

  beforeAll(() => {
    installFault("deviations_insert", marker);
    installFault("reports_delete", marker);
  });

  afterAll(async () => {
    try {
      // The delete trigger goes first, otherwise the orphan cannot be removed.
      removeFault("reports_delete");
      for (const id of await reportIdsOfANamed(filename)) await deleteAsA(id);
    } finally {
      removeFault("reports_delete");
      removeFault("deviations_insert");
    }
  });

  it("answers upload_failed and leaves the report with its visits and no deviations", async () => {
    expectUploadFailed(await upload(filename));

    const ids = await reportIdsOfANamed(filename);
    expect(ids).toHaveLength(1);
    const [orphanId] = ids;
    if (!orphanId) return;

    const { data: visits, error } = await dbA.from("visits").select("*, deviations(*)").eq("report_id", orphanId);
    expect(error).toBeNull();
    expect(visits).toHaveLength(15);
    expect((visits ?? []).flatMap((v) => v.deviations)).toEqual([]);
  });
});
