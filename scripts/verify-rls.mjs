// RLS isolation verification: proves Postgres RLS policies on reports/visits/deviations
// actually isolate per-user data, not just that the policies exist.
// Zero dependencies beyond @supabase/supabase-js (already a project dependency).
// Connects ONLY to the local Supabase instance (via `supabase status -o env`, same
// mechanism as the CI `smoke` job) — never reads SUPABASE_URL/SUPABASE_KEY from
// .env/.dev.vars, since those point at the remote Cloud project in this repo.
// Run: node scripts/verify-rls.mjs (requires `npx supabase start` beforehand)

import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function getLocalSupabaseEnv() {
  let output;
  try {
    output = execSync("npx supabase status -o env", { encoding: "utf8" });
  } catch (err) {
    console.error("FAIL  could not read local Supabase status (is `npx supabase start` running?)");
    console.error(String(err.stderr ?? err.message ?? err));
    process.exit(1);
  }

  const apiUrlMatch = output.match(/^API_URL="?([^"\r\n]*)"?/m);
  const anonKeyMatch = output.match(/^ANON_KEY="?([^"\r\n]*)"?/m);
  if (!apiUrlMatch || !anonKeyMatch) {
    console.error("FAIL  could not parse API_URL/ANON_KEY from `supabase status -o env` output");
    console.error(output);
    process.exit(1);
  }

  return { apiUrl: apiUrlMatch[1], anonKey: anonKeyMatch[1] };
}

const { apiUrl, anonKey } = getLocalSupabaseEnv();

function makeClient() {
  // persistSession/autoRefreshToken off: this is a one-shot Node script, not a browser
  // session, and there's no storage to persist to.
  return createClient(apiUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const password = "Rls-Test-Passw0rd!1";
const emailA = `rls-test-a-${Date.now()}@example.com`;
const emailB = `rls-test-b-${Date.now()}@example.com`;

const clientA = makeClient();
const clientB = makeClient();

async function signUpAndEnsureSession(client, email) {
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(`signUp failed for ${email}: ${error.message}`);
  if (data.session) return data.user;

  // Fallback in case local email confirmation is required after all.
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn failed for ${email}: ${signInError.message}`);
  return signInData.user;
}

let failed = 0;
function record(ok, name) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

async function main() {
  const userA = await signUpAndEnsureSession(clientA, emailA);
  await signUpAndEnsureSession(clientB, emailB);

  // Seed data as user A: one report, one visit on it, one deviation on that visit.
  const { data: report, error: reportErr } = await clientA
    .from("reports")
    .insert({ user_id: userA.id, original_filename: "rls-test.csv" })
    .select()
    .single();
  if (reportErr) throw new Error(`setup: insert report as user A failed: ${reportErr.message}`);

  const { data: visit, error: visitErr } = await clientA
    .from("visits")
    .insert({
      report_id: report.id,
      representative_name: "RLS Test Rep",
      visit_date: new Date().toISOString(),
      gps_enabled: true,
    })
    .select()
    .single();
  if (visitErr) throw new Error(`setup: insert visit as user A failed: ${visitErr.message}`);

  const { data: deviation, error: deviationErr } = await clientA
    .from("deviations")
    .insert({ visit_id: visit.id, rule: "missing_gps" })
    .select()
    .single();
  if (deviationErr) throw new Error(`setup: insert deviation as user A failed: ${deviationErr.message}`);

  // Assertions as user B: user B must not see, update, or delete user A's rows.

  const { data: reportsSeenByB, error: reportsSelectErr } = await clientB.from("reports").select();
  if (reportsSelectErr) throw new Error(`assert: user B select reports failed: ${reportsSelectErr.message}`);
  record(!(reportsSeenByB ?? []).some((r) => r.id === report.id), "user B cannot select user A's report");

  const { data: visitsSeenByB, error: visitsSelectErr } = await clientB.from("visits").select();
  if (visitsSelectErr) throw new Error(`assert: user B select visits failed: ${visitsSelectErr.message}`);
  record(!(visitsSeenByB ?? []).some((v) => v.id === visit.id), "user B cannot select user A's visit");

  const { data: deviationsSeenByB, error: deviationsSelectErr } = await clientB.from("deviations").select();
  if (deviationsSelectErr) throw new Error(`assert: user B select deviations failed: ${deviationsSelectErr.message}`);
  record(!(deviationsSeenByB ?? []).some((d) => d.id === deviation.id), "user B cannot select user A's deviation");

  const { data: updateResult, error: updateErr } = await clientB
    .from("reports")
    .update({ original_filename: "hacked.csv" })
    .eq("id", report.id)
    .select();
  if (updateErr) throw new Error(`assert: user B update report failed unexpectedly: ${updateErr.message}`);
  record((updateResult ?? []).length === 0, "user B cannot update user A's report");

  const { data: deleteResult, error: deleteErr } = await clientB
    .from("reports")
    .delete()
    .eq("id", report.id)
    .select();
  if (deleteErr) throw new Error(`assert: user B delete report failed unexpectedly: ${deleteErr.message}`);
  record((deleteResult ?? []).length === 0, "user B cannot delete user A's report");

  console.log(failed ? `\n${failed} assertion(s) failed` : "\nAll RLS isolation checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("FAIL  unexpected error:", err.message);
  process.exit(1);
});
