import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { account, baseUrl, supabaseEnv } from "./helpers/context";
import { clientAs } from "./helpers/db";
import { HttpClient, signInViaApp } from "./helpers/http";
import { EXPECTED_RULES_BY_CLIENT } from "./helpers/oracle";
import { type DeviationState, type ReviewStatus, reportDeviationState } from "./helpers/report-state";
import { uploadSampleReport } from "./helpers/seed";

const REVIEW_PATH = "/api/deviations/review";

// reviewed_at is stamped by the app (src/pages/api/deviations/review.ts), not by this process, so
// the window around the request allows for a small difference between the two clocks.
const CLOCK_SKEW_MS = 5_000;

const EXPECTED_DEVIATION_COUNT = Object.values(EXPECTED_RULES_BY_CLIENT).reduce((sum, rules) => sum + rules.length, 0);

// Visits of the fixture with two deviations (Klient F, S, T2, T3, T4), from the oracle.
const TWO_DEVIATION_CLIENTS = Object.entries(EXPECTED_RULES_BY_CLIENT)
  .filter(([, rules]) => rules.length === 2)
  .map(([client]) => client)
  .sort();

// Each case works on its own visit, so no case depends on another one's result or order.
// Klient T4 is left untouched here.
const CLIENT = {
  bulk: "Klient F",
  oneOfTwo: "Klient S",
  undo: "Klient T2",
  cycle: "Klient T3",
} as const;

interface UpdatedRow {
  id: string;
  status: ReviewStatus;
  reviewed_at: string | null;
}

// Marking and un-marking through the real endpoint persist, and change only the requested
// deviations. Every case compares ALL deviations of the report, re-read with the report details
// query, with the snapshot taken right before the action — a check on the touched rows alone (or
// on the response alone) would let an update without its `.in("id", ids)` filter pass.
// One app sign-in for A in this file: sign-ins share Supabase's per-IP auth rate limit.
describe("deviation review through the endpoint", () => {
  const userA = account("a");
  const dbA = clientAs(supabaseEnv(), userA);
  const httpA = new HttpClient(baseUrl());

  let reportId: string | null = null;

  async function readState(): Promise<DeviationState[]> {
    if (!reportId) throw new Error("upload did not produce a report");
    return reportDeviationState(dbA, reportId);
  }

  function idsOf(state: DeviationState[], client: string): string[] {
    const ids = state.filter((d) => d.visited_client === client).map((d) => d.id);
    expect(ids, `deviations of ${client}`).toHaveLength(2);
    return ids;
  }

  // Snapshot → POST → response check → re-read → the whole report equals the snapshot with only
  // the requested rows changed. Returns the re-read state.
  async function reviewAndCompare(ids: string[], status: ReviewStatus): Promise<DeviationState[]> {
    const snapshot = await readState();

    const startedAt = Date.now();
    const response = await httpA.request(REVIEW_PATH, { json: { ids, status }, readBody: true });
    const finishedAt = Date.now();

    expect(response.status).toBe(200);
    const { updated } = JSON.parse(response.body ?? "null") as { updated: UpdatedRow[] };
    // Order of the returned rows is not guaranteed: compare as sets.
    expect(updated.map((row) => row.id).sort()).toEqual([...ids].sort());

    // A marked row is expected to hold the stamp the update returned (checked against the request's
    // time window below); an un-marked row must hold null, whatever the response says.
    const returnedStamp = new Map(updated.map((row) => [row.id, row.reviewed_at]));
    const requested = new Set(ids);
    const expected = snapshot.map((d) =>
      requested.has(d.id)
        ? { ...d, status, reviewed_at: status === "reviewed" ? (returnedStamp.get(d.id) ?? null) : null }
        : d,
    );
    const actual = await readState();
    expect(actual).toEqual(expected);

    if (status === "reviewed") {
      for (const d of actual.filter((row) => requested.has(row.id))) {
        const stampedAt = Date.parse(d.reviewed_at ?? "");
        expect(stampedAt, `reviewed_at of ${d.id}: ${d.reviewed_at}`).toBeGreaterThanOrEqual(startedAt - CLOCK_SKEW_MS);
        expect(stampedAt, `reviewed_at of ${d.id}: ${d.reviewed_at}`).toBeLessThanOrEqual(finishedAt + CLOCK_SKEW_MS);
      }
    }
    return actual;
  }

  beforeAll(async () => {
    expect(await signInViaApp(httpA, userA)).toMatchObject({ status: 302, location: "/reports" });
    ({ reportId } = await uploadSampleReport(httpA));

    // Entry check: a fresh upload with the oracle's deviations, nothing reviewed yet.
    const state = await readState();
    expect(state).toHaveLength(EXPECTED_DEVIATION_COUNT);
    for (const d of state) {
      expect(d, `${d.rule} of ${String(d.visited_client)}`).toMatchObject({ status: "unreviewed", reviewed_at: null });
    }
    const perVisit = new Map<string, string[]>();
    for (const d of state) perVisit.set(d.visit_id, [...(perVisit.get(d.visit_id) ?? []), String(d.visited_client)]);
    const twoDeviationClients = [...perVisit.values()]
      .filter((clients) => clients.length === 2)
      .map(([client]) => client)
      .sort();
    expect(twoDeviationClients).toEqual(TWO_DEVIATION_CLIENTS);
    expect(twoDeviationClients).toHaveLength(5);
  });

  afterAll(async () => {
    if (reportId) {
      const { error } = await dbA.from("reports").delete().eq("id", reportId);
      expect(error).toBeNull();
    }
  });

  it("marks both deviations of a visit at once and leaves every other deviation unchanged", async () => {
    const ids = idsOf(await readState(), CLIENT.bulk);
    await reviewAndCompare(ids, "reviewed");
  });

  it("marks one of a visit's two deviations and leaves its sibling unreviewed", async () => {
    const [target, sibling] = idsOf(await readState(), CLIENT.oneOfTwo);
    const after = await reviewAndCompare([target], "reviewed");
    // Already part of the full comparison; spelled out because it is the point of this case.
    expect(after.find((d) => d.id === sibling)).toMatchObject({ status: "unreviewed", reviewed_at: null });
  });

  it("un-marks a reviewed visit back to unreviewed with reviewed_at cleared", async () => {
    const ids = idsOf(await readState(), CLIENT.undo);
    // Marked first within this case, so the undo does not depend on another case having run.
    await reviewAndCompare(ids, "reviewed");
    const after = await reviewAndCompare(ids, "unreviewed");
    for (const d of after.filter((row) => ids.includes(row.id))) {
      expect(d).toMatchObject({ status: "unreviewed", reviewed_at: null });
    }
  });

  it("survives mark → un-mark → mark, ending reviewed", async () => {
    const ids = idsOf(await readState(), CLIENT.cycle);
    await reviewAndCompare(ids, "reviewed");
    await reviewAndCompare(ids, "unreviewed");
    const after = await reviewAndCompare(ids, "reviewed");
    for (const d of after.filter((row) => ids.includes(row.id))) {
      expect(d.status).toBe("reviewed");
      expect(d.reviewed_at).not.toBeNull();
    }
  });
});
