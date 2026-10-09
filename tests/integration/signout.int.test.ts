import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { account, baseUrl, supabaseEnv } from "./helpers/context";
import { anonClient, clientAs, type DbClient } from "./helpers/db";
import { type CookieSnapshot, HttpClient, type HttpResponse, signInViaApp } from "./helpers/http";
import { uploadSampleReport } from "./helpers/seed";

interface DeviationState {
  id: string;
  status: string;
  reviewed_at: string | null;
}

async function deviationsOf(db: DbClient, reportId: string): Promise<DeviationState[]> {
  const { data, error } = await db
    .from("deviations")
    .select("id, status, reviewed_at, visits!inner(report_id)")
    .eq("visits.report_id", reportId)
    .order("id");
  expect(error).toBeNull();
  return (data ?? []).map(({ id, status, reviewed_at }) => ({ id, status, reviewed_at }));
}

function expectSignInRedirect(response: HttpResponse): void {
  expect(response.status).toBe(302);
  expect(response.location?.startsWith("/auth/signin")).toBe(true);
}

// Proof that sign-out invalidates the session on the server: the cookies copied before sign-out
// are replayed afterwards and must unlock nothing, although the access token has not expired yet.
// Account C only - signOut() without a scope is global and would end A's and B's sessions too.
describe("session after sign-out", () => {
  const userC = account("c");
  const env = supabaseEnv();
  const http = new HttpClient(baseUrl());

  let reportId: string;
  let deviationsBefore: DeviationState[];
  let oldCookies: CookieSnapshot;

  beforeAll(async () => {
    expect(await signInViaApp(http, userC)).toMatchObject({ status: 302, location: "/reports" });
    ({ reportId } = await uploadSampleReport(http));

    // Read through C's signUp token while it is certainly valid; the global sign-out ends that session too.
    deviationsBefore = await deviationsOf(clientAs(env, userC), reportId);
    expect(deviationsBefore.length).toBeGreaterThan(0);
    expect(deviationsBefore.every((d) => d.status === "unreviewed" && d.reviewed_at === null)).toBe(true);

    oldCookies = http.snapshotCookies();
    expect(oldCookies.size).toBeGreaterThan(0);

    // Control: the copied cookies are a working session right before sign-out.
    expect((await http.request("/reports")).status).toBe(200);

    expect(await http.request("/api/auth/signout", { method: "POST" })).toMatchObject({ status: 302, location: "/" });
  });

  // Every request replays the full pre-sign-out copy, even if an earlier response cleared cookies.
  beforeEach(() => {
    http.restoreCookies(oldCookies);
  });

  it.each(["/reports", "/dashboard"])("GET %s with the old cookies redirects to /auth/signin", async (path) => {
    expectSignInRedirect(await http.request(path));
  });

  it("GET /reports/<C's report id> with the old cookies redirects to /auth/signin", async () => {
    expectSignInRedirect(await http.request(`/reports/${reportId}`));
  });

  it("POST /api/deviations/review with the old cookies redirects and leaves C's deviations unchanged", async () => {
    const response = await http.request("/api/deviations/review", {
      json: { ids: deviationsBefore.map((d) => d.id), status: "reviewed" },
    });
    expectSignInRedirect(response);

    // A fresh sign-in (one extra auth request) instead of the signUp token: the sign-out revoked
    // that session, and whether PostgREST still honours its JWT must not decide this check.
    const fresh = anonClient(env);
    const signIn = await fresh.auth.signInWithPassword({ email: userC.email, password: userC.password });
    expect(signIn.error).toBeNull();
    expect(await deviationsOf(fresh, reportId)).toEqual(deviationsBefore);
  });
});
