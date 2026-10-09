import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { account, supabaseEnv } from "./helpers/context";
import { anonClient, clientAs, type DbClient } from "./helpers/db";
import { type SeededRows, seedAs, VISIT_DATE, VISIT_FIELDS } from "./helpers/seed-db";

// Postgres error code PostgREST returns when a row fails an RLS USING / WITH CHECK expression.
const RLS_VIOLATION = "42501";

async function countReportsOf(db: DbClient, userId: string): Promise<number> {
  const { count, error } = await db.from("reports").select("id", { count: "exact", head: true }).eq("user_id", userId);
  expect(error).toBeNull();
  return count ?? -1;
}

async function countVisitsOf(db: DbClient, reportId: string): Promise<number> {
  const { count, error } = await db
    .from("visits")
    .select("id", { count: "exact", head: true })
    .eq("report_id", reportId);
  expect(error).toBeNull();
  return count ?? -1;
}

async function countDeviationsOf(db: DbClient, visitId: string): Promise<number> {
  const { count, error } = await db
    .from("deviations")
    .select("id", { count: "exact", head: true })
    .eq("visit_id", visitId);
  expect(error).toBeNull();
  return count ?? -1;
}

// Database-level proof that RLS isolates A's reports, visits and deviations from B and from anon.
// Every denial re-reads A's state as A: an empty result or a missing error alone would also pass
// against a broken client or an empty database.
describe("RLS isolation between accounts", () => {
  const userA = account("a");
  const userB = account("b");
  const env = supabaseEnv();
  const dbA = clientAs(env, userA);
  const dbB = clientAs(env, userB);
  const anon = anonClient(env);

  let a: SeededRows;
  let b: SeededRows;

  beforeAll(async () => {
    a = await seedAs(dbA, userA.userId, "rls-isolation-a");
    // B's own rows, for the re-parenting check (B moving its own visit under A's report).
    b = await seedAs(dbB, userB.userId, "rls-isolation-b");
  });

  describe("SELECT", () => {
    it("B gets nothing for A's report by id, A sees it", async () => {
      const asB = await dbB.from("reports").select("id").eq("id", a.reportId);
      expect(asB.error).toBeNull();
      expect(asB.data).toEqual([]);

      const listedByB = await dbB.from("reports").select("id");
      expect(listedByB.error).toBeNull();
      expect(listedByB.data?.map((r) => r.id)).not.toContain(a.reportId);

      const asA = await dbA.from("reports").select("id").eq("id", a.reportId);
      expect(asA.error).toBeNull();
      expect(asA.error).toBeNull();
      expect(asA.data).toEqual([{ id: a.reportId }]);
    });

    it("B gets nothing for A's visit by id, A sees it", async () => {
      const asB = await dbB.from("visits").select("id").eq("id", a.visitId);
      expect(asB.error).toBeNull();
      expect(asB.data).toEqual([]);

      const listedByB = await dbB.from("visits").select("id");
      expect(listedByB.error).toBeNull();
      expect(listedByB.data?.map((v) => v.id)).not.toContain(a.visitId);

      const asA = await dbA.from("visits").select("id").eq("id", a.visitId);
      expect(asA.error).toBeNull();
      expect(asA.error).toBeNull();
      expect(asA.data).toEqual([{ id: a.visitId }]);
    });

    it("B gets nothing for A's deviation by id, A sees it", async () => {
      const asB = await dbB.from("deviations").select("id").eq("id", a.deviationId);
      expect(asB.error).toBeNull();
      expect(asB.data).toEqual([]);

      const listedByB = await dbB.from("deviations").select("id");
      expect(listedByB.error).toBeNull();
      expect(listedByB.data?.map((d) => d.id)).not.toContain(a.deviationId);

      const asA = await dbA.from("deviations").select("id").eq("id", a.deviationId);
      expect(asA.error).toBeNull();
      expect(asA.error).toBeNull();
      expect(asA.data).toEqual([{ id: a.deviationId }]);
    });
  });

  describe("INSERT", () => {
    it("B cannot insert a report owned by A", async () => {
      const before = await countReportsOf(dbA, userA.userId);

      const { error } = await dbB
        .from("reports")
        .insert({ user_id: userA.userId, original_filename: `rls-forged-${randomUUID()}.csv` });
      expect(error?.code).toBe(RLS_VIOLATION);

      expect(await countReportsOf(dbA, userA.userId)).toBe(before);
    });

    it("B cannot insert a visit under A's report", async () => {
      const before = await countVisitsOf(dbA, a.reportId);

      const { error } = await dbB
        .from("visits")
        .insert({ report_id: a.reportId, visit_date: VISIT_DATE, ...VISIT_FIELDS });
      expect(error?.code).toBe(RLS_VIOLATION);

      expect(await countVisitsOf(dbA, a.reportId)).toBe(before);
    });

    it("B cannot insert a deviation under A's visit", async () => {
      const before = await countDeviationsOf(dbA, a.visitId);

      const { error } = await dbB.from("deviations").insert({ visit_id: a.visitId, rule: "phone_instead_of_visit" });
      expect(error?.code).toBe(RLS_VIOLATION);

      expect(await countDeviationsOf(dbA, a.visitId)).toBe(before);
    });
  });

  describe("UPDATE", () => {
    it("B updates no row of A's report and A still sees the original filename", async () => {
      const { data, error } = await dbB
        .from("reports")
        .update({ original_filename: "hacked.csv" })
        .eq("id", a.reportId)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const asA = await dbA.from("reports").select("original_filename").eq("id", a.reportId).single();
      expect(asA.error).toBeNull();
      expect(asA.data?.original_filename).toBe(a.filename);
    });

    it("B updates no row of A's visit and A still sees the original fields", async () => {
      const { data, error } = await dbB
        .from("visits")
        .update({ representative_name: "Hacked Rep", gps_enabled: false, visited_client: "Hacked" })
        .eq("id", a.visitId)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const asA = await dbA
        .from("visits")
        .select("report_id, representative_name, visit_date, gps_enabled, visited_client")
        .eq("id", a.visitId)
        .single();
      expect(asA.error).toBeNull();
      const { visit_date: visitDate, ...rest } = asA.data ?? { visit_date: "" };
      // visit_date is timestamptz and comes back in Postgres's own format; compare the instant.
      expect(Date.parse(visitDate)).toBe(Date.parse(VISIT_DATE));
      expect(rest).toEqual({ report_id: a.reportId, ...VISIT_FIELDS });
    });

    it("B updates no row of A's deviation and A still sees it unreviewed", async () => {
      const { data, error } = await dbB
        .from("deviations")
        .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
        .eq("id", a.deviationId)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const asA = await dbA.from("deviations").select("status, reviewed_at").eq("id", a.deviationId).single();
      expect(asA.error).toBeNull();
      expect(asA.data).toEqual({ status: "unreviewed", reviewed_at: null });
    });

    it("B cannot move its own visit under A's report (WITH CHECK)", async () => {
      const visitsOfA = await countVisitsOf(dbA, a.reportId);

      const { error } = await dbB.from("visits").update({ report_id: a.reportId }).eq("id", b.visitId);
      expect(error?.code).toBe(RLS_VIOLATION);

      // B's visit stays under B's report, and A's report did not gain it.
      const asB = await dbB.from("visits").select("report_id").eq("id", b.visitId).single();
      expect(asB.error).toBeNull();
      expect(asB.data?.report_id).toBe(b.reportId);
      expect(await countVisitsOf(dbA, a.reportId)).toBe(visitsOfA);
    });
  });

  describe("DELETE", () => {
    it("B deletes no deviation of A and A still sees it", async () => {
      const { data, error } = await dbB.from("deviations").delete().eq("id", a.deviationId).select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const asA = await dbA.from("deviations").select("id").eq("id", a.deviationId);
      expect(asA.error).toBeNull();
      expect(asA.data).toEqual([{ id: a.deviationId }]);
    });

    it("B deletes no visit of A and A still sees it", async () => {
      const { data, error } = await dbB.from("visits").delete().eq("id", a.visitId).select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const asA = await dbA.from("visits").select("id").eq("id", a.visitId);
      expect(asA.error).toBeNull();
      expect(asA.data).toEqual([{ id: a.visitId }]);
    });

    it("B deletes no report of A and A still sees it", async () => {
      const { data, error } = await dbB.from("reports").delete().eq("id", a.reportId).select();
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const asA = await dbA.from("reports").select("id").eq("id", a.reportId);
      expect(asA.error).toBeNull();
      expect(asA.data).toEqual([{ id: a.reportId }]);
    });
  });

  describe("anon", () => {
    it("gets nothing from any of the three tables while A still sees its rows", async () => {
      const reports = await anon.from("reports").select("id").eq("id", a.reportId);
      const visits = await anon.from("visits").select("id").eq("id", a.visitId);
      const deviations = await anon.from("deviations").select("id").eq("id", a.deviationId);
      for (const result of [reports, visits, deviations]) {
        expect(result.error).toBeNull();
        expect(result.data).toEqual([]);
      }

      expect(await countVisitsOf(dbA, a.reportId)).toBe(1);
      expect(await countDeviationsOf(dbA, a.visitId)).toBe(1);
    });

    it("cannot insert into any of the three tables", async () => {
      const reportsBefore = await countReportsOf(dbA, userA.userId);

      const report = await anon
        .from("reports")
        .insert({ user_id: userA.userId, original_filename: `rls-anon-${randomUUID()}.csv` });
      const visit = await anon
        .from("visits")
        .insert({ report_id: a.reportId, visit_date: VISIT_DATE, ...VISIT_FIELDS });
      const deviation = await anon.from("deviations").insert({ visit_id: a.visitId, rule: "missing_gps" });
      for (const result of [report, visit, deviation]) {
        expect(result.error?.code).toBe(RLS_VIOLATION);
      }

      expect(await countReportsOf(dbA, userA.userId)).toBe(reportsBefore);
      expect(await countVisitsOf(dbA, a.reportId)).toBe(1);
      expect(await countDeviationsOf(dbA, a.visitId)).toBe(1);
    });
  });

  // Positive path carried over from scripts/verify-rls.mjs. Runs last: it changes and removes A's rows.
  describe("owner (positive path)", () => {
    it("A can review its own deviation", async () => {
      const { data, error } = await dbA
        .from("deviations")
        .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
        .eq("id", a.deviationId)
        .select("id, status");
      expect(error).toBeNull();
      expect(data).toEqual([{ id: a.deviationId, status: "reviewed" }]);
    });

    it("A can delete its own report, cascading to the visit and deviation", async () => {
      const { data, error } = await dbA.from("reports").delete().eq("id", a.reportId).select("id");
      expect(error).toBeNull();
      expect(data).toEqual([{ id: a.reportId }]);

      const visits = await dbA.from("visits").select("id").eq("id", a.visitId);
      expect(visits.error).toBeNull();
      expect(visits.data).toEqual([]);

      const deviations = await dbA.from("deviations").select("id").eq("id", a.deviationId);
      expect(deviations.error).toBeNull();
      expect(deviations.data).toEqual([]);
    });
  });
});
