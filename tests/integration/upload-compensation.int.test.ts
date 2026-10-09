import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { account, baseUrl, supabaseEnv } from "./helpers/context";
import { clientAs } from "./helpers/db";
import { type FaultKind, faultMarker, installedFaultTriggers, installFault, removeFault } from "./helpers/db-fault";
import { HttpClient, signInViaApp } from "./helpers/http";
import { errorFromLocation, readFixture, reportIdFromLocation, uploadFile } from "./helpers/seed";

// Upload compensation under write failures forced inside the database (helpers/db-fault.ts).
// One app sign-in for A in this file: sign-ins share Supabase's per-IP auth rate limit.
describe("fault injection probe", () => {
  const userA = account("a");
  const dbA = clientAs(supabaseEnv(), userA);
  const httpA = new HttpClient(baseUrl());
  const kind: FaultKind = "visits_insert";
  const marker = faultMarker(kind);

  let sampleCsv: Uint8Array<ArrayBuffer>;
  let controlReportId: string | null = null;

  async function reportIdsOfANamed(filename: string): Promise<string[]> {
    const { data, error } = await dbA
      .from("reports")
      .select("id")
      .eq("user_id", userA.userId)
      .eq("original_filename", filename);
    expect(error).toBeNull();
    return (data ?? []).map((r) => r.id);
  }

  beforeAll(async () => {
    expect(await signInViaApp(httpA, userA)).toMatchObject({ status: 302, location: "/reports" });
    sampleCsv = await readFixture("csv");
    installFault(kind, marker);
  });

  afterAll(async () => {
    // The visits_insert trigger does not block deletes, so the control report goes first.
    if (controlReportId) {
      const { error } = await dbA.from("reports").delete().eq("id", controlReportId);
      expect(error).toBeNull();
    }
    removeFault(kind);
    expect(installedFaultTriggers()).toEqual([]);
  });

  it("fails an upload carrying the marker and leaves other uploads alone", async () => {
    const faulty = `${marker}.csv`;
    const failed = await uploadFile(httpA, { name: faulty, content: sampleCsv, type: "text/csv" });
    expect(failed.status).toBe(302);
    expect(failed.location?.startsWith("/reports?")).toBe(true);
    expect(errorFromLocation(failed.location).error).toBe("upload_failed");
    expect(await reportIdsOfANamed(faulty)).toEqual([]);

    const control = `it-control-${randomUUID()}.csv`;
    const succeeded = await uploadFile(httpA, { name: control, content: sampleCsv, type: "text/csv" });
    controlReportId = reportIdFromLocation(succeeded.location);
    expect(succeeded.status).toBe(302);
    expect(controlReportId, `answered ${succeeded.location ?? "(no Location)"}`).not.toBeNull();
    expect(await reportIdsOfANamed(control)).toEqual([controlReportId]);
  });
});
