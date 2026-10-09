import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { account, baseUrl, supabaseEnv } from "./helpers/context";
import { clientAs } from "./helpers/db";
import { HttpClient, type HttpResponse, type RequestOptions, signInViaApp } from "./helpers/http";
import { uploadSampleReport } from "./helpers/seed";

const PAGES_DIR = fileURLToPath(new URL("../../src/pages", import.meta.url));
const SAMPLE_REPORT = new URL("../../test-data/sample-report.csv", import.meta.url);

// Routes meant to be reachable without a session. The kitchen-sink pages render fixtures only.
const PUBLIC_ROUTES = ["/", "/auth/*", "/api/auth/*", "/dev/kitchen-sink/*"];

interface Seed {
  reportId: string;
  deviationIds: string[];
  sampleCsv: Uint8Array<ArrayBuffer>;
}

interface ProtectedRequest {
  name: string;
  path: (seed: Seed) => string;
  options?: (seed: Seed) => RequestOptions;
}

// Every route that touches user data, as a concrete request. A new route under src/pages must be
// listed here (or in PUBLIC_ROUTES) - the inventory test below fails otherwise.
const PROTECTED_REQUESTS: ProtectedRequest[] = [
  { name: "GET /dashboard", path: () => "/dashboard" },
  { name: "GET /reports", path: () => "/reports" },
  { name: "GET /reports/<random id>", path: () => `/reports/${randomUUID()}` },
  { name: "GET /reports/<A's report id>", path: (s) => `/reports/${s.reportId}` },
  {
    name: "POST /api/reports/upload (valid CSV)",
    path: () => "/api/reports/upload",
    options: (s) => ({
      multipart: {
        file: { field: "report_file", name: `anon-${randomUUID()}.csv`, content: s.sampleCsv, type: "text/csv" },
      },
    }),
  },
  {
    name: "POST /api/reports/<A's report id>/delete",
    path: (s) => `/api/reports/${s.reportId}/delete`,
    options: () => ({ form: {} }),
  },
  {
    name: "POST /api/deviations/review (A's deviation ids)",
    path: () => "/api/deviations/review",
    options: (s) => ({ json: { ids: s.deviationIds, status: "reviewed" } }),
  },
];

// Spellings that must not slip past the middleware's prefix check.
const PATH_VARIANTS: ProtectedRequest[] = [
  { name: "GET /Reports", path: () => "/Reports" },
  { name: "GET /REPORTS/<A's report id>", path: (s) => `/REPORTS/${s.reportId}` },
  { name: "GET /%72eports", path: () => "/%72eports" },
  { name: "GET /reports/", path: () => "/reports/" },
  { name: "GET /dashboard/", path: () => "/dashboard/" },
  {
    name: "POST /API/deviations/review",
    path: () => "/API/deviations/review",
    options: (s) => ({ json: { ids: s.deviationIds, status: "reviewed" } }),
  },
];

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".+");
  return new RegExp(`^${escaped}$`);
}

interface PageRoute {
  file: string;
  pattern: string;
  matcher: RegExp;
}

// Astro file-based routing: index -> directory, [param] -> one segment, [...rest] -> any tail,
// files and directories starting with "_" are not routes.
function pageRoutes(): PageRoute[] {
  const files = readdirSync(PAGES_DIR, { recursive: true, encoding: "utf8" })
    .map((file) => file.replace(/\\/g, "/"))
    .filter((file) => /\.(astro|ts)$/.test(file) && !file.split("/").some((part) => part.startsWith("_")));

  return files.map((file) => {
    const segments = file.replace(/\.(astro|ts)$/, "").split("/");
    if (segments.at(-1) === "index") segments.pop();
    const pattern = `/${segments.join("/")}`;
    const matcher = new RegExp(
      `^/${segments
        .map((segment) => {
          if (/^\[\.\.\..+\]$/.test(segment)) return ".*";
          if (/^\[.+\]$/.test(segment)) return "[^/]+";
          return segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("/")}/?$`,
    );
    return { file, pattern, matcher };
  });
}

function expectSignInRedirect(response: HttpResponse): void {
  expect(response.status).toBe(302);
  expect(response.location?.startsWith("/auth/signin")).toBe(true);
}

// Without a session every protected page and API answers 302 -> /auth/signin (not 401) and
// changes nothing. A's data is the control: it exists, and is re-read after the anonymous POSTs.
// One app sign-in for A in this file: sign-ins share Supabase's per-IP auth rate limit.
describe("route access without a session", () => {
  const userA = account("a");
  const dbA = clientAs(supabaseEnv(), userA);
  const anonymous = new HttpClient(baseUrl());

  let seed: Seed;
  let reportIdsOfA: string[];

  async function listReportIdsOfA(): Promise<string[]> {
    const { data, error } = await dbA.from("reports").select("id").eq("user_id", userA.userId).order("id");
    expect(error).toBeNull();
    return (data ?? []).map((r) => r.id);
  }

  async function deviationsOfA(
    reportId: string,
  ): Promise<{ id: string; status: string; reviewed_at: string | null }[]> {
    const { data, error } = await dbA
      .from("deviations")
      .select("id, status, reviewed_at, visits!inner(report_id)")
      .eq("visits.report_id", reportId)
      .order("id");
    expect(error).toBeNull();
    return (data ?? []).map(({ id, status, reviewed_at }) => ({ id, status, reviewed_at }));
  }

  beforeAll(async () => {
    const httpA = new HttpClient(baseUrl());
    expect(await signInViaApp(httpA, userA)).toMatchObject({ status: 302, location: "/reports" });
    const { reportId } = await uploadSampleReport(httpA);

    const deviations = await deviationsOfA(reportId);
    expect(deviations.length).toBeGreaterThan(0);
    expect(deviations.every((d) => d.status === "unreviewed" && d.reviewed_at === null)).toBe(true);

    seed = {
      reportId,
      deviationIds: deviations.map((d) => d.id),
      sampleCsv: new Uint8Array(await readFile(SAMPLE_REPORT)),
    };
    reportIdsOfA = await listReportIdsOfA();
    expect(reportIdsOfA).toContain(reportId);
  });

  describe("protected requests redirect to /auth/signin", () => {
    it.each(PROTECTED_REQUESTS)("$name", async (request) => {
      const response = await anonymous.request(request.path(seed), request.options?.(seed));
      expectSignInRedirect(response);
    });

    // Runs after the requests above (tests in a file run in order).
    it("left A's reports and deviations unchanged", async () => {
      expect(await listReportIdsOfA()).toEqual(reportIdsOfA);

      const deviations = await deviationsOfA(seed.reportId);
      expect(deviations.map((d) => d.id)).toEqual(seed.deviationIds);
      for (const deviation of deviations) {
        expect(deviation).toMatchObject({ status: "unreviewed", reviewed_at: null });
      }
    });
  });

  describe("path variants are not served", () => {
    it.each(PATH_VARIANTS)("$name", async (variant) => {
      const response = await anonymous.request(variant.path(seed), variant.options?.(seed));
      expect(response.status >= 200 && response.status < 300, `answered ${response.status}`).toBe(false);
    });
  });

  it("every route under src/pages is public or covered by PROTECTED_REQUESTS", () => {
    const routes = pageRoutes();
    expect(routes.map((r) => r.pattern)).toContain("/reports/[id]");

    const placeholder: Seed = { reportId: randomUUID(), deviationIds: [randomUUID()], sampleCsv: new Uint8Array() };
    const requestedPaths = PROTECTED_REQUESTS.map((r) => r.path(placeholder));
    const publicMatchers = PUBLIC_ROUTES.map(globToRegExp);

    const uncovered = routes
      .filter((route) => !publicMatchers.some((matcher) => matcher.test(route.pattern)))
      .filter((route) => !requestedPaths.some((path) => route.matcher.test(path)))
      .map((route) => `${route.pattern} (src/pages/${route.file})`);
    expect(uncovered).toEqual([]);
  });
});
