import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Runs SQL as `postgres` (no RLS) on the LOCAL Supabase through the CLI, so a test can force a
// write to fail inside the database. Tests never write SQL themselves and never get the
// service-role key: they call installFault/removeFault and queryLocalSql below.
//
// Variant: `npx supabase db query --local` (checked locally on CLI 2.117.0 - the version pinned in
// package-lock.json, which `npx` also resolves in CI). If it does not work in CI, switch
// connectionArgs() to `--db-url <DB_URL from npx supabase status -o env>`.
//
// CLI facts this relies on (CLI 2.117.0):
// - one statement per call ("cannot insert multiple commands into a prepared statement"), so
//   multi-step DDL is wrapped in a single `do` block;
// - `--agent no` keeps the output shape stable: with agent detection on, rows come wrapped in
//   `{ boundary, rows, warning }` instead of a bare array;
// - rows go to stdout as JSON, a statement without rows prints its tag (e.g. `DO`), an error exits
//   non-zero with `{"_tag":"Error",...}` on stdout; progress and update notices go to stderr.
// SQL is passed as a file: quoting of `$$` and quotes differs between Windows and bash shells.

export type FaultKind = "visits_insert" | "deviations_insert" | "reports_update" | "reports_delete";

// A narrow, unique prefix: a broad pattern could fire on rows of other tests sharing the database.
const MARKER_PATTERN = /^it-fault-[a-z_]+-[0-9a-f-]{36}$/;

function connectionArgs(): string {
  return "--local";
}

function execLocalSql(sql: string): string {
  const file = join(tmpdir(), `it-sql-${randomUUID()}.sql`);
  writeFileSync(file, sql, "utf8");
  try {
    return execSync(`npx supabase db query ${connectionArgs()} --agent no --output-format json -f "${file}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    // With encoding "utf8" both streams are strings; stdout carries the CLI's JSON error.
    const { stdout = "", stderr = String(err) } = err as { stdout?: string; stderr?: string };
    throw new Error(`Local SQL failed:\n${sql}\n--- stdout:\n${stdout}\n--- stderr:\n${stderr}`, { cause: err });
  } finally {
    rmSync(file, { force: true });
  }
}

// Kept separate so a change in the CLI's output shape is fixed in one place.
function parseRows<T>(stdout: string): T[] {
  const start = stdout.search(/[[{]/);
  if (start < 0) throw new Error(`No JSON rows in \`supabase db query\` output:\n${stdout}`);
  const parsed: unknown = JSON.parse(stdout.slice(start));
  if (Array.isArray(parsed)) return parsed as T[];
  // Agent-mode envelope, in case `--agent no` is ever ignored.
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown }).rows)) {
    return (parsed as { rows: T[] }).rows;
  }
  throw new Error(`Unexpected \`supabase db query\` output:\n${stdout}`);
}

// One statement per call (see above).
export function runLocalSql(sql: string): void {
  execLocalSql(sql);
}

export function queryLocalSql<T>(sql: string): T[] {
  return parseRows<T>(execLocalSql(sql));
}

// The validated marker cannot contain a quote, `$` or `%`, so embedding it as a SQL literal is
// safe. Its `_` is a LIKE wildcard, harmless next to the UUID.
function assertMarker(markerPrefix: string): void {
  if (!MARKER_PATTERN.test(markerPrefix)) {
    throw new Error(`Fault marker must match ${String(MARKER_PATTERN)}, got: ${markerPrefix}`);
  }
}

export function faultMarker(kind: FaultKind): string {
  return `it-fault-${kind}-${randomUUID()}`;
}

interface FaultTarget {
  timing: "insert" | "update" | "delete";
  table: "visits" | "deviations" | "reports";
  // Expression for the original_filename of the report the row belongs to.
  filename: string;
  // Row returned when the trigger does not fire.
  passRow: "new" | "old";
}

const TARGETS: Record<FaultKind, FaultTarget> = {
  visits_insert: {
    timing: "insert",
    table: "visits",
    filename: "(select r.original_filename from public.reports r where r.id = new.report_id)",
    passRow: "new",
  },
  deviations_insert: {
    timing: "insert",
    table: "deviations",
    filename:
      "(select r.original_filename from public.visits v join public.reports r on r.id = v.report_id where v.id = new.visit_id)",
    passRow: "new",
  },
  reports_update: { timing: "update", table: "reports", filename: "old.original_filename", passRow: "new" },
  reports_delete: { timing: "delete", table: "reports", filename: "old.original_filename", passRow: "old" },
};

// Installs (or replaces) a BEFORE trigger that raises `it_fault_<kind>` for rows of reports whose
// original_filename starts with markerPrefix. Idempotent.
export function installFault(kind: FaultKind, markerPrefix: string): void {
  assertMarker(markerPrefix);
  const name = `it_fault_${kind}`;
  const target = TARGETS[kind];
  // security definer: the lookup runs as the function owner, not under the caller's RLS.
  runLocalSql(`do $it$
begin
  create or replace function public.${name}() returns trigger
    language plpgsql
    security definer
    set search_path = public
  as $fn$
  begin
    if ${target.filename} like '${markerPrefix}%' then
      raise exception '${name}';
    end if;
    return ${target.passRow};
  end
  $fn$;
  drop trigger if exists ${name} on public.${target.table};
  create trigger ${name} before ${target.timing} on public.${target.table}
    for each row execute function public.${name}();
end
$it$;`);
}

// Idempotent: safe in afterAll and after an interrupted run.
export function removeFault(kind: FaultKind): void {
  const name = `it_fault_${kind}`;
  const target = TARGETS[kind];
  runLocalSql(`do $it$
begin
  drop trigger if exists ${name} on public.${target.table};
  drop function if exists public.${name}();
end
$it$;`);
}

export function installedFaultTriggers(): string[] {
  return queryLocalSql<{ tgname: string }>("select tgname from pg_trigger where tgname like 'it_fault_%'").map(
    (row) => row.tgname,
  );
}

export interface MarkerRowCounts {
  reports: number;
  visits: number;
  deviations: number;
}

// Rows of reports whose original_filename starts with markerPrefix, counted as `postgres` (no RLS):
// an empty result read as a user could also mean "no access".
export function markerRowCounts(markerPrefix: string): MarkerRowCounts {
  assertMarker(markerPrefix);
  const like = `'${markerPrefix}%'`;
  const row = queryLocalSql<MarkerRowCounts>(`select
  (select count(*)::int from public.reports r where r.original_filename like ${like}) as reports,
  (select count(*)::int from public.visits v join public.reports r on r.id = v.report_id
    where r.original_filename like ${like}) as visits,
  (select count(*)::int from public.deviations d join public.visits v on v.id = d.visit_id
    join public.reports r on r.id = v.report_id where r.original_filename like ${like}) as deviations`).at(0);
  if (!row) throw new Error(`No counts returned for marker ${markerPrefix}`);
  return { reports: row.reports, visits: row.visits, deviations: row.deviations };
}

// Reports left behind by any fault-injection test (every marker starts with `it-fault-`).
export function faultReportCount(): number {
  const row = queryLocalSql<{ count: number }>(
    "select count(*)::int as count from public.reports where original_filename like 'it-fault-%'",
  ).at(0);
  if (!row) throw new Error("No count returned for fault reports");
  return row.count;
}
